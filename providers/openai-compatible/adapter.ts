import type {
  AIProviderAdapter,
  AdapterType,
  ConnectionTestResult,
  GenerationRequest,
  GenerationResult,
  ProviderConfig,
  ProviderModel,
} from '@/lib/providers/types';
import {
  openaiAdapter,
  testConnectionInternal,
  withConfig as openaiWithConfig,
} from '@/providers/openai/adapter';
import { errors, normalizeError } from '@/lib/providers/errors';

/**
 * Adaptador OpenAI-Compatible.
 *
 * Mesmas rotas do OpenAI (/v1/chat/completions, /v1/models), mas com URL base
 * configuravel por provedor. Muitos provedores compativeis:
 *   - nao tem /v1/models, ou retornam 404/400 -> listModel falha graceful
 *   - username/password diferentes
 *   - nem todos os parametros sao suportados (usam capabilities do OPENAI)
 *
 * A estrategia e detectar MODELS_ENDPOINT_MISSING/NOT_FOUND no testConnection
 * e nao bloquear cadastro de providers - o usuario cadastra modelos manualmente.
 */

export const openaiCompatibleAdapter: AIProviderAdapter = {
  adapterType: 'OPENAI_COMPATIBLE' as AdapterType,

  async testConnection(configIn: ProviderConfig): Promise<ConnectionTestResult> {
    const config = openaiWithConfig(configIn);
    try {
      return await testConnectionInternal(config, 'OPENAI_COMPATIBLE');
    } catch (err) {
      const normalized = normalizeError(err, { provider: 'OPENAI_COMPATIBLE', baseUrl: config.baseUrl });
      if (
        normalized.code === 'NOT_FOUND' ||
        normalized.code === 'INVALID_RESPONSE' ||
        normalized.code === 'BAD_REQUEST'
      ) {
        return {
          ok: false,
          message:
            'Nao foi possivel listar os modelos automaticamente. Cadastre pelo menos um modelo manualmente ou verifique a URL base do provedor.',
        };
      }
      return { ok: false, message: normalized.message };
    }
  },

  async listModels(_config: ProviderConfig): Promise<ProviderModel[]> {
    // OpenAI-Compatible: nem todos tem /v1/models util. Tratamos via testConnection.
    throw errors.modelsEndpointMissing('openai-compatible');
  },

  async generate(
    request: GenerationRequest,
    configIn: ProviderConfig,
  ): Promise<GenerationResult> {
    // Reaproveita toda a logica de generation do openaiAdapter: o contrato
    // de chat/completions e identico. Apenas"Forcamos" o adapterType do
    // resultado para OPENAI_COMPATIBLE.
    if (!configIn.baseUrl || configIn.baseUrl.trim() === '') {
      throw errors.invalidEndpoint('openai-compatible');
    }
    const result = await openaiAdapter.generate(request, configIn);
    return {
      ...result,
      providerType: 'OPENAI_COMPATIBLE' as GenerationResult['providerType'],
    };
  },
};

/** Helper para cadastro manual - retorna lista vazia (permite UI cadastrar) */
export function manualModels(_config: ProviderConfig): ProviderModel[] {
  return [];
}