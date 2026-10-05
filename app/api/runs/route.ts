import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { ensureAdaptersRegistered } from '@/providers';
import { runComparison, type ExecutionFailure, type RunResultStatus } from '@/lib/services/run-service';
import { runRequestSchema, type RunRequest } from '@/lib/validation/schemas';
import { buildProviderConfig, ensureDemoConfig } from '@/lib/services/provider-config';
import { registerRun, unregisterRun } from '@/lib/services/run-store';
import { normalizeError } from '@/lib/providers/errors';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ResponseItem =
  | {
      status: 'COMPLETED';
      modelTechnicalId: string;
      modelName: string;
      providerName: string;
      content: string;
      inputTokens?: number;
      outputTokens?: number;
      totalTokens?: number;
      latencyMs: number;
      timeToFirstTokenMs?: number;
      estimatedCost?: number;
      finishReason?: string;
    }
  | {
      status: Exclude<RunResultStatus, 'COMPLETED'>;
      modelTechnicalId: string;
      modelName: string;
      errorCode: string;
      errorMessage: string;
      errorProvider: string;
      statusCode?: number;
      retryable: boolean;
      latencyMs: number;
    };

export async function POST(request: Request) {
  ensureAdaptersRegistered();

  let body: RunRequest;
  try {
    const json = await request.json();
    body = runRequestSchema.parse(json);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', issues: err.issues },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  // Resolve o ProviderConfig: usa o enviado pelo cliente (chave e URL chegam
  // ja encaminhadas pela rota /api/runs; jamais expostas de volta).
  let config;
  try {
    if (body.provider) {
      config = buildProviderConfig(body.provider);
    } else {
      // Padrao: modo demo (para nao quebrar clientes que ainda enviam sem provider).
      config = ensureDemoConfig();
    }
  } catch (err) {
    const normalized = normalizeError(err, { provider: 'unknown' });
    return NextResponse.json(
      { error: normalized.code, message: normalized.message },
      { status: 400 },
    );
  }

  const runId = randomUUID();
  const controller = new AbortController();
  registerRun(runId, controller);

  try {
    const outcome = await runComparison({
      systemPrompt: body.systemPrompt,
      userPrompt: body.userPrompt,
      parameters: body.parameters,
      models: body.models,
      config,
      signal: controller.signal,
    });

    const items: ResponseItem[] = outcome.results.map((r) => {
      if (r.status === 'fulfilled') {
        const v = r.value;
        return {
          status: 'COMPLETED' as const,
          modelTechnicalId: v.modelTechnicalId,
          modelName: v.modelName,
          providerName: v.providerName,
          content: v.content,
          inputTokens: v.inputTokens,
          outputTokens: v.outputTokens,
          totalTokens: v.totalTokens,
          latencyMs: v.latencyMs,
          timeToFirstTokenMs: v.timeToFirstTokenMs,
          estimatedCost: v.estimatedCost,
          finishReason: v.finishReason,
        };
      }
      const f = r.reason as ExecutionFailure;
      const status: Exclude<RunResultStatus, 'COMPLETED'> =
        f.errorCode === 'TIMEOUT'
          ? 'TIMEOUT'
          : f.errorCode === 'CANCELED'
            ? 'CANCELED'
            : f.errorCode === 'RATE_LIMIT'
              ? 'RATE_LIMITED'
              : f.errorCode === 'AUTH_ERROR'
                ? 'AUTH_ERROR'
                : 'FAILED';
      return {
        status,
        modelTechnicalId: f.modelTechnicalId,
        modelName: f.modelName,
        errorCode: f.errorCode,
        errorMessage: f.errorMessage,
        errorProvider: f.errorProvider,
        statusCode: f.statusCode,
        retryable: f.retryable,
        latencyMs: f.latencyMs,
      };
    });

    return NextResponse.json({ runId, items });
  } finally {
    unregisterRun(runId);
  }
}