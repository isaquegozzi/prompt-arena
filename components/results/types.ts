export type RunResultStatus =
  | 'COMPLETED'
  | 'FAILED'
  | 'TIMEOUT'
  | 'CANCELED'
  | 'RATE_LIMITED'
  | 'AUTH_ERROR';

export interface RunResultItem {
  id: string;
  runId: string;
  promptTitle: string;
  systemPrompt?: string;
  finalPrompt: string;
  promptSnapshot?: string;
  parameters: Record<string, unknown>;
  modelTechnicalId: string;
  modelName: string;
  providerName: string;
  status: RunResultStatus;
  content?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  latencyMs?: number;
  timeToFirstTokenMs?: number;
  estimatedCost?: number;
  finishReason?: string;
  errorCode?: string;
  errorMessage?: string;
  errorProvider?: string;
  statusCode?: number;
  retryable?: boolean;
  favorite?: boolean;
  createdAt: string;
}

export interface RunSummary {
  id: string;
  title: string;
  createdAt: string;
  items: RunResultItem[];
}

export const STATUS_LABEL: Record<RunResultStatus, string> = {
  COMPLETED: 'Concluido',
  FAILED: 'Falhou',
  TIMEOUT: 'Timeout',
  CANCELED: 'Cancelado',
  RATE_LIMITED: 'Rate limit',
  AUTH_ERROR: 'Erro de autenticacao',
};

export const STATUS_TONE: Record<RunResultStatus, string> = {
  COMPLETED: 'bg-success/15 text-success',
  FAILED: 'bg-destructive/15 text-destructive',
  TIMEOUT: 'bg-warning/15 text-warning',
  CANCELED: 'bg-muted text-muted-foreground',
  RATE_LIMITED: 'bg-warning/15 text-warning',
  AUTH_ERROR: 'bg-destructive/15 text-destructive',
};