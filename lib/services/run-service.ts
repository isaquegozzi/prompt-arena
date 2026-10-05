import { getAdapter } from '@/lib/providers/registry';
import { isProviderError } from '@/lib/errors';
import { calculateCost } from '@/lib/pricing/cost';
import type {
  GenerationParameters,
  GenerationResult,
  ProviderConfig,
  ProviderModel,
} from '@/lib/providers/types';

export type RunResultStatus =
  | 'COMPLETED'
  | 'FAILED'
  | 'TIMEOUT'
  | 'CANCELED'
  | 'RATE_LIMITED'
  | 'AUTH_ERROR';

export interface ExecutionInput {
  systemPrompt?: string;
  userPrompt: string;
  parameters: GenerationParameters;
  models: ProviderModel[];
  config: ProviderConfig;
  signal?: AbortSignal;
}

export interface ExecutionOutcome {
  results: Array<
    | { status: 'fulfilled'; value: GenerationResult }
    | { status: 'rejected'; reason: ExecutionFailure }
  >;
}

export interface ExecutionFailure {
  modelTechnicalId: string;
  modelName: string;
  errorCode: string;
  errorMessage: string;
  errorProvider: string;
  statusCode?: number;
  retryable: boolean;
  latencyMs: number;
}

/**
 * Executa o prompt em todos os modelos em paralelo usando Promise.allSettled.
 * Uma falha em um modelo NAO interrompe os outros.
 */
export async function runComparison(input: ExecutionInput): Promise<ExecutionOutcome> {
  const adapter = getAdapter(input.config.adapterType);

  const settled = await Promise.allSettled(
    input.models.map(async (model): Promise<GenerationResult> => {
      const startedAt = Date.now();
      try {
        const result = await adapter.generate(
          {
            systemPrompt: input.systemPrompt,
            userPrompt: input.userPrompt,
            model,
            parameters: input.parameters,
            signal: input.signal,
          },
          input.config,
        );
        // Recalcula o custo caso o adaptador nao tenha feito
        if (result.estimatedCost === undefined) {
          const cost = calculateCost(model, result.inputTokens, result.outputTokens);
          if (cost !== undefined) result.estimatedCost = cost;
        }
        return result;
      } catch (err) {
        const latencyMs = Date.now() - startedAt;
        if (isProviderError(err)) {
          throw {
            modelTechnicalId: model.technicalId,
            modelName: model.displayName,
            errorCode: err.code,
            errorMessage: err.message,
            errorProvider: err.provider,
            statusCode: err.statusCode,
            retryable: err.retryable,
            latencyMs,
          } satisfies ExecutionFailure;
        }
        throw {
          modelTechnicalId: model.technicalId,
          modelName: model.displayName,
          errorCode: 'INTERNAL_ERROR',
          errorMessage: err instanceof Error ? err.message : String(err),
          errorProvider: input.config.adapterType,
          retryable: false,
          latencyMs,
        } satisfies ExecutionFailure;
      }
    }),
  );

  return { results: settled };
}

export function classifyStatus(
  failure?: ExecutionFailure,
): RunResultStatus {
  if (!failure) return 'COMPLETED';
  if (failure.errorCode === 'TIMEOUT') return 'TIMEOUT';
  if (failure.errorCode === 'CANCELED') return 'CANCELED';
  if (failure.errorCode === 'RATE_LIMIT') return 'RATE_LIMITED';
  if (failure.errorCode === 'AUTH_ERROR') return 'AUTH_ERROR';
  return 'FAILED';
}