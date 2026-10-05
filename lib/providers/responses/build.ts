import { randomUUID } from 'node:crypto';
import type { GenerationResult, ProviderModel } from '../types';
import { calculateCost } from '@/lib/pricing/cost';
import { errors } from '../errors/normalize';

export interface BuildResultInput {
  provider: { id: string; name: string; type: GenerationResult['providerType'] };
  model: Pick<ProviderModel, 'technicalId' | 'displayName' | 'inputPricePer1M' | 'outputPricePer1M'>;
  content: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
  timeToFirstTokenMs?: number;
  finishReason?: string;
  usedStreaming?: boolean;
  rawMetadata?: Record<string, unknown>;
}

/**
 * Monta um GenerationResult normalizado e recalcula o custo se faltar.
 * Nunca inventa valores de tokens ou custo.
 *
 * Se o conteudo for vazio, lanca errors.emptyResponse para o chamador tratar.
 */
export function buildResult(input: BuildResultInput): GenerationResult {
  const content = input.content?.trim() ?? '';
  if (!content) {
    throw errors.emptyResponse(input.provider.name, input.model.displayName);
  }

  const estimatedCost =
    input.inputTokens !== undefined || input.outputTokens !== undefined
      ? calculateCost(input.model, input.inputTokens, input.outputTokens)
      : undefined;

  const totalTokens =
    input.inputTokens !== undefined && input.outputTokens !== undefined
      ? input.inputTokens + input.outputTokens
      : input.inputTokens !== undefined
        ? input.inputTokens
        : input.outputTokens;

  return {
    id: randomUUID(),
    providerId: input.provider.id,
    providerName: input.provider.name,
    providerType: input.provider.type,
    modelTechnicalId: input.model.technicalId,
    modelName: input.model.displayName,
    content,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    totalTokens,
    latencyMs: input.latencyMs,
    timeToFirstTokenMs: input.timeToFirstTokenMs,
    estimatedCost,
    finishReason: input.finishReason ?? 'stop',
    usedStreaming: input.usedStreaming ?? false,
    rawMetadata: input.rawMetadata,
  };
}