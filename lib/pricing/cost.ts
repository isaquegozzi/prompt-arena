import type { GenerationResult, ProviderModel } from '@/lib/providers/types';

const NO_PRICE = undefined;
const NO_TOKENS_MESSAGE = 'Tokens nao fornecidos pelo provedor.';
const NO_PRICE_MESSAGE = 'Custo nao disponivel.';

export const CostMessages = {
  noTokens: NO_TOKENS_MESSAGE,
  noPrice: NO_PRICE_MESSAGE,
};

/**
 * Calcula o custo estimado com base nos tokens e nos precos do modelo.
 * Retorna undefined quando o preco nao esta configurado.
 * Nunca inventa valores.
 */
export function calculateCost(
  model: Pick<ProviderModel, 'inputPricePer1M' | 'outputPricePer1M'>,
  inputTokens: number | undefined,
  outputTokens: number | undefined,
): number | undefined {
  if (inputTokens === undefined && outputTokens === undefined) return NO_PRICE;
  const hasInputPrice = model.inputPricePer1M !== undefined && model.inputPricePer1M !== null;
  const hasOutputPrice = model.outputPricePer1M !== undefined && model.outputPricePer1M !== null;
  if (!hasInputPrice && !hasOutputPrice) return NO_PRICE;

  const input = inputTokens ?? 0;
  const output = outputTokens ?? 0;

  const inputCost = hasInputPrice
    ? (input / 1_000_000) * (model.inputPricePer1M ?? 0)
    : 0;
  const outputCost = hasOutputPrice
    ? (output / 1_000_000) * (model.outputPricePer1M ?? 0)
    : 0;

  return Number((inputCost + outputCost).toFixed(6));
}

export function describeCost(result: Pick<GenerationResult, 'estimatedCost' | 'inputTokens' | 'outputTokens'>): string {
  if (result.estimatedCost === undefined) {
    if (result.inputTokens === undefined && result.outputTokens === undefined) {
      return NO_TOKENS_MESSAGE;
    }
    return NO_PRICE_MESSAGE;
  }
  return `$${result.estimatedCost.toFixed(6)}`;
}