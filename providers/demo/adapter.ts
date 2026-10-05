import type {
  AIProviderAdapter,
  AdapterType,
  ConnectionTestResult,
  GenerationRequest,
  GenerationResult,
  ProviderConfig,
  ProviderModel,
} from '@/lib/providers/types';
import { errors } from '@/lib/providers/errors';
import {
  combineTimeoutSignal,
  withAbortGuard,
} from '@/lib/providers/http';
import { filterParameters } from '@/lib/providers/capabilities/capabilities';
import { buildResult } from '@/lib/providers/responses';
import { DEMO_MODELS, DEMO_PROVIDER_CONFIG } from './mock-models';

/**
 * Adaptador DEMO: nao faz chamada de rede. Simula latencias variaveis,
 * respostas mockadas, custos e erros ocasionais para fins de demonstracao
 * e testes de UI sem credenciais.
 */

const ERROR_RATE = 0.08; // 8% de chance de erro para testar estados de falha

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

function buildMockContent(
  model: ProviderModel,
  userPrompt: string,
  hasSeed: boolean,
  ignoredParams: string[],
): string {
  const tag = model.technicalId.replace(/^demo-/, '');
  const paramLine = hasSeed ? '(seed)' : '(aleatorio)';
  const ignoredLine =
    ignoredParams.length > 0 ? `- parametros ignorados: ${ignoredParams.join(', ')}` : '';
  return [
    `# Resposta simulada por ${model.displayName}`,
    ``,
    `> Adaptador DEMO. Nenhuma API real foi chamada.`,
    ``,
    `You asked: ${userPrompt.slice(0, 200)}${userPrompt.length > 200 ? '...' : ''}`,
    ``,
    `- modelo: \`${tag}\``,
    `- contexto maximo: ${model.maxContext ?? 'n/d'}`,
    `- parametros: ${paramLine}`,
    ignoredLine,
    ``,
    `## Resposta`,
    ``,
    `Aqui estaria a resposta do modelo. O adaptador demo apenas simula o formato`,
    `para permitir testar a interface sem credenciais.`,
  ].join('\n');
}

export const demoAdapter: AIProviderAdapter = {
  adapterType: 'DEMO' as AdapterType,

  async testConnection(_: ProviderConfig): Promise<ConnectionTestResult> {
    return {
      ok: true,
      message: 'Modo demo ativo. Nenhuma credencial necessaria.',
      models: DEMO_MODELS,
    };
  },

  async listModels(_: ProviderConfig): Promise<ProviderModel[]> {
    return DEMO_MODELS;
  },

  async generate(request: GenerationRequest, config: ProviderConfig): Promise<GenerationResult> {
    const { model, userPrompt, parameters, signal } = request;

    // Filtra parametros nao suportados (no caso, todos sao suportados em DEMO,
    // mas exercitamos o contratos para manter a camada uniforme).
    const { allowed, ignored } = filterParameters('DEMO', parameters);

    // ~8% de chance de erro simulado para testar estados de falha
    if (Math.random() < ERROR_RATE) {
      throw errors.rateLimit(config.name, model.technicalId, 429);
    }

    const latencyMs = randomBetween(400, 2500);
    const startedAt = Date.now();
    const combined = combineTimeoutSignal(config.timeoutMs ?? 30_000, signal);

    try {
      // Simula processo que leva latencyMs metros
      await withAbortGuard(
        new Promise<void>((resolve) => setTimeout(resolve, latencyMs)),
        combined,
        config.name,
        model.technicalId,
      );
    } catch (err) {
      // withAbortGuard joga errors.timeout/errors.canceled; mantem como esta
      throw err;
    } finally {
      combined.cleanup();
    }

    const measuredLatency = Date.now() - startedAt;
    const content = buildMockContent(
      model,
      userPrompt,
      allowed.seed !== undefined,
      ignored.map(String),
    );
    const inputTokens = estimateTokens(`${request.systemPrompt ?? ''}\n${userPrompt}`);
    const outputTokens = estimateTokens(content);

    const result = buildResult({
      provider: {
        id: config.id,
        name: config.name,
        type: 'DEMO' as GenerationResult['providerType'],
      },
      model: {
        technicalId: model.technicalId,
        displayName: model.displayName,
        inputPricePer1M: model.inputPricePer1M,
        outputPricePer1M: model.outputPricePer1M,
      },
      content,
      inputTokens,
      outputTokens,
      latencyMs: measuredLatency,
      timeToFirstTokenMs: Math.floor(measuredLatency * 0.2),
      finishReason: 'stop',
      usedStreaming: model.supportsStreaming ?? true,
      rawMetadata: { demo: true, params: allowed, ignored },
    });

    return result;
  },
};

// Mantem a config default exportada para compat com quem ja usa (rotas de teste).
export { DEMO_PROVIDER_CONFIG };