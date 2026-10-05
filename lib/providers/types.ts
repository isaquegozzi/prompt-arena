/**
 * Tipos compartilhados dos adaptadores de provedor de IA.
 *
 * Toda a logica de negocio consome apenas esta interface; os SDKs especificos
 * ficam isolados em cada adaptador dentro de /providers/<name>.
 */

export type AdapterType =
  | 'OPENAI'
  | 'ANTHROPIC'
  | 'GEMINI'
  | 'OPENAI_COMPATIBLE'
  | 'OLLAMA'
  | 'DEMO';

export interface ProviderConfig {
  id: string;
  name: string;
  adapterType: AdapterType;
  baseUrl?: string;
  apiKey?: string;
  extraHeaders?: Record<string, string>;
  timeoutMs?: number;
  active?: boolean;
}

export interface ProviderModel {
  id: string;
  providerId: string;
  technicalId: string;
  displayName: string;
  maxContext?: number;
  inputPricePer1M?: number;
  outputPricePer1M?: number;
  currency?: string;
  isLocal?: boolean;
  active?: boolean;
  supportsStreaming?: boolean;
}

export interface GenerationParameters {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  seed?: number;
  stop?: string[];
  responseFormat?: 'text' | 'json';
}

export interface GenerationRequest {
  systemPrompt?: string;
  userPrompt: string;
  model: ProviderModel;
  parameters: GenerationParameters;
  signal?: AbortSignal;
}

export interface GenerationResult {
  id: string;
  providerId: string;
  providerName: string;
  providerType: AdapterType;
  modelTechnicalId: string;
  modelName: string;
  content: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  latencyMs: number;
  timeToFirstTokenMs?: number;
  estimatedCost?: number;
  finishReason?: string;
  usedStreaming?: boolean;
  rawMetadata?: Record<string, unknown>;
}

export interface ConnectionTestResult {
  ok: boolean;
  message: string;
  models?: ProviderModel[];
}

export interface AIProviderAdapter {
  readonly adapterType: AdapterType;
  testConnection(config: ProviderConfig): Promise<ConnectionTestResult>;
  listModels?(config: ProviderConfig): Promise<ProviderModel[]>;
  generate(request: GenerationRequest, config: ProviderConfig): Promise<GenerationResult>;
}