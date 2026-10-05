import { z } from 'zod';

export const generationParametersSchema = z
  .object({
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().positive().max(1_000_000).optional(),
    topP: z.number().min(0).max(1).optional(),
    frequencyPenalty: z.number().min(-2).max(2).optional(),
    presencePenalty: z.number().min(-2).max(2).optional(),
    seed: z.number().int().nonnegative().optional(),
    stop: z.array(z.string().max(100)).max(8).optional(),
    responseFormat: z.enum(['text', 'json']).optional(),
  })
  .strict();

export const modelSelectionSchema = z
  .object({
    id: z.string().min(1),
    providerId: z.string().min(1),
    technicalId: z.string().min(1),
    displayName: z.string().min(1),
    maxContext: z.number().int().positive().optional(),
    inputPricePer1M: z.number().min(0).optional(),
    outputPricePer1M: z.number().min(0).optional(),
    currency: z.string().max(8).optional(),
    isLocal: z.boolean().optional(),
    active: z.boolean().optional(),
    supportsStreaming: z.boolean().optional(),
  })
  .strict();

export const providerSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1).max(120),
    type: z.enum([
      'OPENAI',
      'ANTHROPIC',
      'GEMINI',
      'OPENAI_COMPATIBLE',
      'OLLAMA',
      'DEMO',
    ]),
    baseUrl: z.string().url().max(2048).optional().or(z.literal('').optional()),
    apiKey: z.string().max(2048).optional(),
    timeoutMs: z.number().int().min(100).max(600_000).optional(),
    extraHeaders: z.record(z.string(), z.string()).optional(),
  })
  .strict();

export const runRequestSchema = z
  .object({
    systemPrompt: z.string().max(20_000).optional(),
    userPrompt: z.string().min(1).max(50_000),
    parameters: generationParametersSchema,
    models: z.array(modelSelectionSchema).min(1).max(10),
    provider: providerSchema.optional(),
  })
  .strict();

export type RunRequest = z.infer<typeof runRequestSchema>;

export const cancelRequestSchema = z.object({ runId: z.string().min(1) }).strict();

export const testConnectionRequestSchema = z
  .object({
    provider: providerSchema,
  })
  .strict();
export type TestConnectionRequest = z.infer<typeof testConnectionRequestSchema>;