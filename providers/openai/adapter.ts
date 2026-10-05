import type {
  AIProviderAdapter,
  AdapterType,
  ConnectionTestResult,
  GenerationRequest,
  GenerationResult,
  ProviderConfig,
  ProviderModel,
} from '@/lib/providers/types';
import { fetchWithTimeout } from '@/lib/providers/http';
import { buildResult } from '@/lib/providers/responses/build';
import { filterParameters } from '@/lib/providers/capabilities/capabilities';
import { errors, normalizeError } from '@/lib/providers/errors';

/**
 * Adaptador OpenAI - usa a REST API publica.
 *
 * Endpoints:
 *   - POST /v1/chat/completions
 *   - GET  /v1/models
 *
 * Auth: Authorization: Bearer <apiKey> (injetado por fetchWithTimeout)
 */

const DEFAULT_BASE_URL = 'https://api.openai.com';
const DEFAULT_TIMEOUT_MS = 60_000;
const OPENAI_COMPATIBLE_DEFAULTS = true; // OpenAI nunca usa x-api-key

interface OpenAIChoice {
  message?: { role?: string; content?: string };
  finish_reason?: string;
}

interface OpenAIResponse {
  id?: string;
  model?: string;
  choices?: OpenAIChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

interface OpenAIModelsResponse {
  data?: Array<{ id: string; owned_by?: string }>;
}

function isOpenAIResponse(value: unknown): value is OpenAIResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'choices' in value &&
    Array.isArray((value as OpenAIResponse).choices)
  );
}

function parseContent(body: OpenAIResponse): string {
  const first = body.choices?.[0];
  return first?.message?.content ?? '';
}

export const openaiAdapter: AIProviderAdapter = {
  adapterType: 'OPENAI' as AdapterType,

  async testConnection(config: ProviderConfig): Promise<ConnectionTestResult> {
    return testConnectionInternal(config);
  },

  async listModels(config: ProviderConfig): Promise<ProviderModel[]> {
    const res = await fetchWithTimeout<OpenAIModelsResponse>(
      { config: withConfig(config), path: '/v1/models', method: 'GET' },
      { provider: 'openai' },
    );
    const body = res.json;
    if (!body || !Array.isArray(body.data)) {
      throw errors.invalidResponse('openai', undefined, 'Resposta /v1/models sem array data.');
    }
    return body.data.map((m) => ({
      id: `${config.id}:${m.id}`,
      providerId: config.id,
      technicalId: m.id,
      displayName: m.id,
      active: true,
      supportsStreaming: true,
    }));
  },

  async generate(
    request: GenerationRequest,
    configIn: ProviderConfig,
  ): Promise<GenerationResult> {
    const config = withConfig(configIn);
    const { model, userPrompt, systemPrompt, parameters, signal } = request;
    const { allowed } = filterParameters('OPENAI', parameters);

    const messages: Array<{ role: string; content: string }> = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: userPrompt });

    const payload: Record<string, unknown> = {
      model: model.technicalId,
      messages,
      stream: false,
    };
    if (allowed.temperature !== undefined) payload.temperature = allowed.temperature;
    if (allowed.maxTokens !== undefined) payload.max_tokens = allowed.maxTokens;
    if (allowed.topP !== undefined) payload.top_p = allowed.topP;
    if (allowed.frequencyPenalty !== undefined) payload.frequency_penalty = allowed.frequencyPenalty;
    if (allowed.presencePenalty !== undefined) payload.presence_penalty = allowed.presencePenalty;
    if (allowed.seed !== undefined) payload.seed = allowed.seed;
    if (allowed.stop !== undefined) payload.stop = allowed.stop;
    if (allowed.responseFormat !== undefined) {
      payload.response_format = { type: allowed.responseFormat };
    }

    const startedAt = Date.now();
    try {
      const res = await fetchWithTimeout<OpenAIResponse>(
        {
          config,
          path: '/v1/chat/completions',
          method: 'POST',
          body: JSON.stringify(payload),
        },
        { provider: 'openai', model: model.technicalId },
      );
      void signal;

      const body = res.json;
      if (!body || !isOpenAIResponse(body)) {
        throw errors.invalidResponse('openai', model.technicalId, 'Resposta fora do formato esperado.');
      }
      const content = parseContent(body);
      const inputTokens = body.usage?.prompt_tokens;
      const outputTokens = body.usage?.completion_tokens;

      return buildResult({
        provider: { id: config.id, name: config.name, type: 'OPENAI' as GenerationResult['providerType'] },
        model,
        content,
        inputTokens,
        outputTokens,
        latencyMs: Date.now() - startedAt,
        finishReason: body.choices?.[0]?.finish_reason,
        usedStreaming: false,
        rawMetadata: body as unknown as Record<string, unknown>,
      });
    } catch (err) {
      throw normalizeError(err, { provider: 'openai', model: model.technicalId, baseUrl: config.baseUrl });
    }
  },
};

/**
 * Implementacao compartilhada entre openai e openai-compatible.
 */
export async function testConnectionInternal(
  configIn: ProviderConfig,
  adapterType: AdapterType = 'OPENAI',
): Promise<ConnectionTestResult> {
  const config = withConfig(configIn);
  try {
    const res = await fetchWithTimeout<OpenAIModelsResponse>(
      { config, path: '/v1/models', method: 'GET' },
      { provider: adapterType },
    );
    const body = res.json;
    if (!body || !Array.isArray(body.data)) {
      return {
        ok: false,
        message: 'Endpoint /v1/models respondeu, mas sem lista de modelos. Cadastre modelos manualmente.',
      };
    }
    const models: ProviderModel[] = body.data.map((m) => ({
      id: `${config.id}:${m.id}`,
      providerId: config.id,
      technicalId: m.id,
      displayName: m.id,
      active: true,
      supportsStreaming: true,
    }));
    return { ok: true, message: 'Conectado com sucesso.', models };
  } catch (err) {
    const normalized = normalizeError(err, { provider: adapterType, baseUrl: config.baseUrl });
    if (
      normalized.code === 'NOT_FOUND' ||
      normalized.code === 'MODELS_ENDPOINT_MISSING' ||
      normalized.code === 'BAD_REQUEST' ||
      normalized.code === 'INVALID_RESPONSE'
    ) {
      return {
        ok: false,
        message:
          'Nao foi possivel listar os modelos automaticamente. Cadastre pelo menos um modelo manualmente ou verifique a URL base do provedor.',
      };
    }
    return { ok: false, message: normalized.message };
  }
}

/**
 * Normaliza a configuracao. openai nao permite sobrescrever a baseURL
 * (default), a menos que tenha sido explicitamente definida pelo usuario.
 */
export function withConfig(config: ProviderConfig): ProviderConfig {
  return {
    ...config,
    baseUrl: config.baseUrl && config.baseUrl.trim() !== '' ? config.baseUrl : DEFAULT_BASE_URL,
    timeoutMs: config.timeoutMs && config.timeoutMs > 0 ? config.timeoutMs : DEFAULT_TIMEOUT_MS,
  };
}

void OPENAI_COMPATIBLE_DEFAULTS;