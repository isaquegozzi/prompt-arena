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
import { errors, normalizeError, classifyHttpStatus, ErrorCodes } from '@/lib/providers/errors';
import { ProviderError } from '@/lib/errors';

/**
 * Adaptador Google Gemini - Generative Language API.
 *
 * Auth: ?key=<apiKey> (query parameter)
 *
 * Endpoints:
 *   - POST /v1beta/models/{model}:generateContent?key=<apiKey>
 *   - GET  /v1beta/models?key=<apiKey>
 */

const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com';
const DEFAULT_TIMEOUT_MS = 60_000;

interface GeminiPart {
  text?: string;
}

interface GeminiCandidate {
  content?: { parts?: GeminiPart[]; role?: string };
  finishReason?: string;
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

interface GeminiModelsResponse {
  models?: Array<{ name: string; displayName?: string; description?: string; supportedGenerationMethods?: string[] }>;
}

function isGeminiResponse(value: unknown): value is GeminiResponse {
  return typeof value === 'object' && value !== null && 'candidates' in value;
}

function extractText(candidates: GeminiCandidate[] | undefined): string {
  if (!candidates) return '';
  return candidates
    .flatMap((c) => c.content?.parts ?? [])
    .filter((p) => typeof p.text === 'string')
    .map((p) => p.text ?? '')
    .join('\n')
    .trim();
}

async function geminiFetch<T = unknown>(
  config: ProviderConfig,
  path: string,
  init: { method: string; body?: string },
  normalizeOpts: { model?: string },
): Promise<{ status: number; json: T | undefined; text: string | undefined }> {
  const base = validateBaseURL(
    config.baseUrl && config.baseUrl.trim() !== '' ? config.baseUrl : DEFAULT_BASE_URL,
  );
  const url = new URL(path, base);
  // Auth via query param
  if (config.apiKey) url.searchParams.set('key', config.apiKey);
  const finalUrl = url.toString();

  const combined = combineTimeoutSignal(config.timeoutMs && config.timeoutMs > 0 ? config.timeoutMs : DEFAULT_TIMEOUT_MS);

  try {
    let response: Response;
    try {
      response = await withAbortGuard(
        fetch(finalUrl, {
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
        'gemini',
        normalizeOpts.model,
      );
    } catch (err) {
      throw normalizeError(err, { provider: 'gemini', model: normalizeOpts.model, baseUrl: base.toString() });
    }

    const text = await response.text().catch(() => undefined);
    let json: T | undefined;
    if (text) {
      try {
        json = JSON.parse(text) as T;
      } catch {
        // fluxo de erro segue abaixo
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
        message: errFromBody ?? `Resposta ${response.status} do Gemini.`,
        provider: 'gemini',
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

export const geminiAdapter: AIProviderAdapter = {
  adapterType: 'GEMINI' as AdapterType,

  async testConnection(configIn: ProviderConfig): Promise<ConnectionTestResult> {
    const config = { ...configIn, timeoutMs: configIn.timeoutMs ?? DEFAULT_TIMEOUT_MS };
    try {
      const res = await geminiFetch<GeminiModelsResponse>(
        config,
        '/v1beta/models',
        { method: 'GET' },
        {},
      );
      const body = res.json;
      if (!body || !Array.isArray(body.models)) {
        return {
          ok: false,
          message: 'Gemini respondeu, mas sem lista de modelos. Cadastre os modelos manualmente se necessario.',
        };
      }
      const models: ProviderModel[] = body.models
        .filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
        .map((m) => {
          const technicalId = m.name.replace(/^models\//, '');
          return {
            id: `${config.id}:${technicalId}`,
            providerId: config.id,
            technicalId,
            displayName: m.displayName ?? technicalId,
            active: true,
            supportsStreaming: true,
          };
        });
      return { ok: true, message: 'Conectado com sucesso.', models };
    } catch (err) {
      const normalized = normalizeError(err, { provider: 'gemini', baseUrl: config.baseUrl });
      return { ok: false, message: normalized.message };
    }
  },

  async listModels(configIn: ProviderConfig): Promise<ProviderModel[]> {
    const config = { ...configIn, timeoutMs: configIn.timeoutMs ?? DEFAULT_TIMEOUT_MS };
    const res = await geminiFetch<GeminiModelsResponse>(
      config,
      '/v1beta/models',
      { method: 'GET' },
      {},
    );
    const body = res.json;
    if (!body || !Array.isArray(body.models)) {
      throw errors.invalidResponse('gemini', undefined, 'Resposta /v1beta/models sem array models.');
    }
    return body.models
      .filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
      .map((m) => {
        const technicalId = m.name.replace(/^models\//, '');
        return {
          id: `${config.id}:${technicalId}`,
          providerId: config.id,
          technicalId,
          displayName: m.displayName ?? technicalId,
          active: true,
          supportsStreaming: true,
        };
      });
  },

  async generate(
    request: GenerationRequest,
    configIn: ProviderConfig,
  ): Promise<GenerationResult> {
    const config = { ...configIn, timeoutMs: configIn.timeoutMs ?? DEFAULT_TIMEOUT_MS };
    const { model, userPrompt, systemPrompt, parameters } = request;
    const { allowed } = filterParameters('GEMINI', parameters);

    const contents: Array<{ role: string; parts: GeminiPart[] }> = [];
    if (systemPrompt) {
      contents.push({ role: 'user', parts: [{ text: systemPrompt }] });
      contents.push({ role: 'model', parts: [{ text: 'Entendido.' }] });
    }
    contents.push({ role: 'user', parts: [{ text: userPrompt }] });

    const payload: Record<string, unknown> = {
      contents,
    };
    const generationConfig: Record<string, unknown> = {};
    if (allowed.temperature !== undefined) generationConfig.temperature = allowed.temperature;
    if (allowed.maxTokens !== undefined) generationConfig.maxOutputTokens = allowed.maxTokens;
    if (allowed.topP !== undefined) generationConfig.topP = allowed.topP;
    if (allowed.stop !== undefined) generationConfig.stopSequences = allowed.stop;
    if (allowed.responseFormat !== undefined && allowed.responseFormat === 'json') {
      generationConfig.responseMimeType = 'application/json';
    }
    if (Object.keys(generationConfig).length > 0) payload.generationConfig = generationConfig;

    const path = `/v1beta/models/${encodeURIComponent(model.technicalId)}:generateContent`;

    const startedAt = Date.now();
    try {
      const res = await geminiFetch<GeminiResponse>(
        config,
        path,
        { method: 'POST', body: JSON.stringify(payload) },
        { model: model.technicalId },
      );
      const body = res.json;
      if (!body || !isGeminiResponse(body)) {
        const is404 = res.status === 404;
        if (is404) {
          throw new ProviderError({
            code: ErrorCodes.NOT_FOUND,
            message: `Modelo ${model.technicalId} nao encontrado no Gemini.`,
            provider: 'gemini',
            model: model.technicalId,
            statusCode: 404,
            retryable: false,
          });
        }
        throw errors.invalidResponse('gemini', model.technicalId, 'Resposta fora do formato esperado.');
      }
      const content = extractText(body.candidates);
      const inputTokens = body.usageMetadata?.promptTokenCount;
      const outputTokens = body.usageMetadata?.candidatesTokenCount;

      return buildResult({
        provider: { id: config.id, name: config.name, type: 'GEMINI' as GenerationResult['providerType'] },
        model,
        content,
        inputTokens,
        outputTokens,
        latencyMs: Date.now() - startedAt,
        finishReason: body.candidates?.[0]?.finishReason ?? 'STOP',
        usedStreaming: false,
        rawMetadata: body as unknown as Record<string, unknown>,
      });
    } catch (err) {
      throw normalizeError(err, { provider: 'gemini', model: model.technicalId, baseUrl: config.baseUrl });
    }
  },
};