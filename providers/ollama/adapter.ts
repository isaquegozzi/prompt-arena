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
 * Adaptador Ollama - servico local de modelos abertos.
 *
 * Endpoints:
 *   - POST /api/chat
 *   - GET  /api/tags  (lista modelos instalados localmente)
 *
 * Auth: nenhuma (servico local).
 */

const DEFAULT_BASE_URL = 'http://localhost:11434';
const DEFAULT_TIMEOUT_MS = 120_000; // local pode ser mais lento na primeira geracao

interface OllamaMessage {
  role: string;
  content: string;
}

interface OllamaChatResponse {
  model?: string;
  message?: OllamaMessage;
  done?: boolean;
  done_reason?: string;
  prompt_eval_count?: number;
  eval_count?: number;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_duration?: number;
  eval_duration?: number;
}

interface OllamaTagsResponse {
  models?: Array<{
    name: string;
    model?: string;
    size?: number;
    details?: { parameter_size?: string; quantization_level?: string; family?: string };
  }>;
}

function isOllamaChatResponse(value: unknown): value is OllamaChatResponse {
  return typeof value === 'object' && value !== null && 'message' in value;
}

async function ollamaFetch<T = unknown>(
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
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(config.extraHeaders ?? {}),
          },
          body: init.body,
          signal: combined.signal,
        }),
        combined,
        'ollama',
        normalizeOpts.model,
      );
    } catch (err) {
      throw normalizeError(err, { provider: 'ollama', model: normalizeOpts.model, baseUrl: base.toString() });
    }

    const text = await response.text().catch(() => undefined);
    let json: T | undefined;
    if (text) {
      try {
        json = JSON.parse(text) as T;
      } catch {
        // segue para o path de erro
      }
    }

    if (!response.ok) {
      const errFromBody =
        json && typeof json === 'object'
          ? (json as { error?: string }).error
          : undefined;
      const code = classifyHttpStatus(response.status);
      throw new ProviderError({
        code,
        message: errFromBody ?? `Resposta ${response.status} do Ollama.`,
        provider: 'ollama',
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

export const ollamaAdapter: AIProviderAdapter = {
  adapterType: 'OLLAMA' as AdapterType,

  async testConnection(configIn: ProviderConfig): Promise<ConnectionTestResult> {
    const config = { ...configIn, timeoutMs: configIn.timeoutMs ?? DEFAULT_TIMEOUT_MS };
    try {
      const res = await ollamaFetch<OllamaTagsResponse>(
        config,
        '/api/tags',
        { method: 'GET' },
        {},
      );
      const body = res.json;
      if (!body || !Array.isArray(body.models)) {
        return {
          ok: false,
          message: 'Ollama respondeu, mas /api/tags nao retornou lista de modelos. Verifique se ha modelos instalados.',
        };
      }
      const models: ProviderModel[] = body.models.map((m) => ({
        id: `${config.id}:${m.name}`,
        providerId: config.id,
        technicalId: m.name,
        displayName: m.name,
        isLocal: true,
        active: true,
        supportsStreaming: true,
        metadata: { size: m.size, family: m.details?.family },
      }));
      return { ok: true, message: 'Conectado com sucesso.', models };
    } catch (err) {
      const normalized = normalizeError(err, { provider: 'ollama', baseUrl: config.baseUrl });
      return { ok: false, message: normalized.message };
    }
  },

  async listModels(configIn: ProviderConfig): Promise<ProviderModel[]> {
    const config = { ...configIn, timeoutMs: configIn.timeoutMs ?? DEFAULT_TIMEOUT_MS };
    const res = await ollamaFetch<OllamaTagsResponse>(
      config,
      '/api/tags',
      { method: 'GET' },
      {},
    );
    const body = res.json;
    if (!body || !Array.isArray(body.models)) {
      throw errors.invalidResponse('ollama', undefined, '/api/tags sem array models.');
    }
    return body.models.map((m) => ({
      id: `${config.id}:${m.name}`,
      providerId: config.id,
      technicalId: m.name,
      displayName: m.name,
      isLocal: true,
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
    const { allowed } = filterParameters('OLLAMA', parameters);

    const messages: OllamaMessage[] = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: userPrompt });

    const payload: Record<string, unknown> = {
      model: model.technicalId,
      messages,
      stream: false,
    };
    if (allowed.temperature !== undefined) payload.temperature = allowed.temperature;
    if (allowed.maxTokens !== undefined) payload.num_predict = allowed.maxTokens;
    if (allowed.topP !== undefined) payload.top_p = allowed.topP;
    if (allowed.seed !== undefined) payload.seed = allowed.seed;
    if (allowed.stop !== undefined) payload.stop = allowed.stop;

    const startedAt = Date.now();
    try {
      const res = await ollamaFetch<OllamaChatResponse>(
        config,
        '/api/chat',
        { method: 'POST', body: JSON.stringify(payload) },
        { model: model.technicalId },
      );
      const body = res.json;
      if (!body || !isOllamaChatResponse(body)) {
        throw errors.invalidResponse('ollama', model.technicalId, 'Resposta fora do formato esperado.');
      }
      const content = body.message?.content ?? '';
      const inputTokens = body.prompt_eval_count;
      const outputTokens = body.eval_count;

      return buildResult({
        provider: { id: config.id, name: config.name, type: 'OLLAMA' as GenerationResult['providerType'] },
        model,
        content,
        inputTokens,
        outputTokens,
        latencyMs: Date.now() - startedAt,
        finishReason: body.done_reason ?? (body.done ? 'stop' : undefined),
        usedStreaming: false,
        rawMetadata: body as unknown as Record<string, unknown>,
      });
    } catch (err) {
      throw normalizeError(err, { provider: 'ollama', model: model.technicalId, baseUrl: config.baseUrl });
    }
  },
};