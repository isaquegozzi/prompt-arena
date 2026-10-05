import type {
  AIProviderAdapter,
  AdapterType,
  ConnectionTestResult,
  GenerationRequest,
  GenerationResult,
  ProviderConfig,
  ProviderModel,
} from '@/lib/providers/types';
import { combineTimeoutSignal, withAbortGuard, validateBaseURL } from '@/lib/providers/http';
import { buildResult } from '@/lib/providers/responses/build';
import { filterParameters } from '@/lib/providers/capabilities/capabilities';
import { errors, normalizeError, classifyHttpStatus } from '@/lib/providers/errors';
import { ProviderError } from '@/lib/errors';

/**
 * Adaptador Anthropic - Messages API.
 *
 * Auth: x-api-key (NUNCA Authorization Bearer, diferente de OpenAI) +
 *       anthropic-version: 2023-06-01.
 *
 * Endpoints:
 *   - POST /v1/messages
 *   - GET  /v1/models  (desde 2024)
 */

const DEFAULT_BASE_URL = 'https://api.anthropic.com';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_TIMEOUT_MS = 60_000;

interface AnthropicContentBlock {
  type?: string;
  text?: string;
}

interface AnthropicMessage {
  role: string;
  content: string | AnthropicContentBlock[];
}

interface AnthropicResponse {
  id?: string;
  model?: string;
  type?: string;
  role?: string;
  content?: AnthropicContentBlock[];
  stop_reason?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

interface AnthropicModelsResponse {
  data?: Array<{ id: string; display_name?: string }>;
}

function isAnthropicResponse(value: unknown): value is AnthropicResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'content' in value &&
    Array.isArray((value as AnthropicResponse).content)
  );
}

function extractText(content: AnthropicContentBlock[] | undefined): string {
  if (!content) return '';
  return content
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text ?? '')
    .join('\n')
    .trim();
}

function withHeaders(
  config: ProviderConfig,
  explicit?: Record<string, string>,
): Record<string, string> {
  const headers: Record<string, string> = {
    'anthropic-version': ANTHROPIC_VERSION,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(explicit ?? {}),
  };
  // Anthropic nao aceita Authorization Bearer; usamos x-api-key explicito.
  if (config.apiKey) headers['x-api-key'] = config.apiKey;
  if (config.extraHeaders) {
    for (const [k, v] of Object.entries(config.extraHeaders)) {
      headers[k] = v;
    }
  }
  return headers;
}

async function anthropicFetch<T = unknown>(
  config: ProviderConfig,
  path: string,
  init: { method: string; body?: string },
  normalizeOpts: { model?: string },
): Promise<{ status: number; json: T | undefined; text: string | undefined }> {
  const base = validateBaseURL(
    config.baseUrl && config.baseUrl.trim() !== '' ? config.baseUrl : DEFAULT_BASE_URL,
  );
  const url = new URL(path, base).toString();
  const combined = combineTimeoutSignal(config.timeoutMs && config.timeoutMs > 0 ? config.timeoutMs : DEFAULT_TIMEOUT_MS);

  try {
    let response: Response;
    try {
      response = await withAbortGuard(
        fetch(url, {
          method: init.method,
          headers: withHeaders(config),
          body: init.body,
          signal: combined.signal,
        }),
        combined,
        'anthropic',
        normalizeOpts.model,
      );
    } catch (err) {
      throw normalizeError(err, { provider: 'anthropic', model: normalizeOpts.model, baseUrl: base.toString() });
    }

    const text = await response.text().catch(() => undefined);
    let json: T | undefined;
    if (text) {
      try {
        json = JSON.parse(text) as T;
      } catch {
        // fluxo invalido segue para error path
      }
    }

    if (!response.ok) {
      const errFromBody =
        json && typeof json === 'object'
          ? (json as { error?: { message?: string } }).error?.message
          : undefined;
      const code = classifyHttpStatus(response.status);
      throw new ProviderError({
        code,
        message: errFromBody ?? `Resposta ${response.status} do Anthropic.`,
        provider: 'anthropic',
        model: normalizeOpts.model,
        retryable: [429, 503, 502, 504].includes(response.status),
        statusCode: response.status,
      });
    }

    return { status: response.status, json, text };
  } finally {
    combined.cleanup();
  }
}

export const anthropicAdapter: AIProviderAdapter = {
  adapterType: 'ANTHROPIC' as AdapterType,

  async testConnection(configIn: ProviderConfig): Promise<ConnectionTestResult> {
    const config = { ...configIn, timeoutMs: configIn.timeoutMs ?? DEFAULT_TIMEOUT_MS };
    try {
      const res = await anthropicFetch<AnthropicModelsResponse>(
        config,
        '/v1/models',
        { method: 'GET' },
        {},
      );
      const body = res.json;
      if (!body || !Array.isArray(body.data)) {
        return {
          ok: false,
          message: 'Anthropic respondeu, mas sem lista de modelos. Cadastre os modelos manualmente se necessario.',
        };
      }
      const models: ProviderModel[] = body.data.map((m) => ({
        id: `${config.id}:${m.id}`,
        providerId: config.id,
        technicalId: m.id,
        displayName: m.display_name ?? m.id,
        active: true,
        supportsStreaming: true,
      }));
      return { ok: true, message: 'Conectado com sucesso.', models };
    } catch (err) {
      const normalized = normalizeError(err, { provider: 'anthropic', baseUrl: config.baseUrl });
      return { ok: false, message: normalized.message };
    }
  },

  async listModels(configIn: ProviderConfig): Promise<ProviderModel[]> {
    const config = { ...configIn, timeoutMs: configIn.timeoutMs ?? DEFAULT_TIMEOUT_MS };
    const res = await anthropicFetch<AnthropicModelsResponse>(
      config,
      '/v1/models',
      { method: 'GET' },
      {},
    );
    const body = res.json;
    if (!body || !Array.isArray(body.data)) {
      throw errors.invalidResponse('anthropic', undefined, 'Resposta /v1/models sem array data.');
    }
    return body.data.map((m) => ({
      id: `${config.id}:${m.id}`,
      providerId: config.id,
      technicalId: m.id,
      displayName: m.display_name ?? m.id,
      active: true,
      supportsStreaming: true,
    }));
  },

  async generate(
    request: GenerationRequest,
    configIn: ProviderConfig,
  ): Promise<GenerationResult> {
    const config = { ...configIn, timeoutMs: configIn.timeoutMs ?? DEFAULT_TIMEOUT_MS };
    const { model, userPrompt, systemPrompt, parameters } = request;
    const { allowed } = filterParameters('ANTHROPIC', parameters);

    const messages: AnthropicMessage[] = [];
    if (systemPrompt) {
      // System prompt vai como campo dedicado em /v1/messages
    }
    messages.push({ role: 'user', content: userPrompt });

    const payload: Record<string, unknown> = {
      model: model.technicalId,
      max_tokens: allowed.maxTokens ?? 1024,
      messages,
      stream: false,
    };
    if (systemPrompt) payload.system = systemPrompt;
    if (allowed.temperature !== undefined) payload.temperature = allowed.temperature;
    if (allowed.topP !== undefined) payload.top_p = allowed.topP;
    if (allowed.stop !== undefined) payload.stop_sequences = allowed.stop;

    const startedAt = Date.now();
    try {
      const res = await anthropicFetch<AnthropicResponse>(
        config,
        '/v1/messages',
        { method: 'POST', body: JSON.stringify(payload) },
        { model: model.technicalId },
      );
      const body = res.json;
      if (!body || !isAnthropicResponse(body)) {
        throw errors.invalidResponse('anthropic', model.technicalId, 'Resposta fora do formato esperado.');
      }
      const content = extractText(body.content);
      const inputTokens = body.usage?.input_tokens;
      const outputTokens = body.usage?.output_tokens;

      return buildResult({
        provider: { id: config.id, name: config.name, type: 'ANTHROPIC' as GenerationResult['providerType'] },
        model,
        content,
        inputTokens,
        outputTokens,
        latencyMs: Date.now() - startedAt,
        finishReason: body.stop_reason ?? 'stop',
        usedStreaming: false,
        rawMetadata: body as unknown as Record<string, unknown>,
      });
    } catch (err) {
      throw normalizeError(err, { provider: 'anthropic', model: model.technicalId, baseUrl: config.baseUrl });
    }
  },
};