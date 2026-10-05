import { validateBaseURL } from '@/lib/providers/http';
import { ErrorCodes } from '@/lib/providers/errors';
import { ProviderError } from '@/lib/errors';
import type {
  AdapterType,
  ProviderConfig,
} from '@/lib/providers/types';
import { DEMO_PROVIDER_CONFIG } from '@/providers/demo/mock-models';

export interface ProviderInput {
  id: string;
  name: string;
  type: AdapterType | string;
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
  extraHeaders?: Record<string, string>;
}

/**
 * Converte o input recebido da API no ProviderConfig usado pelos adaptadores,
 * com validacoes:
 *   - DEMO nao exige baseUrl/apiKey (usa mock)
 *   - OPENAI usa default https://api.openai.com se baseUrl ausente
 *   - ANTHROPIC usa default https://api.anthropic.com se ausente
 *   - GEMINI usa default generativelanguage.googleapis.com
 *   - OLLAMA usa default http://localhost:11434
 *   - OPENAI_COMPATIBLE exige baseUrl explicito
 *
 * URL base, quando presente, e validada (anti-SSRF opcional ativo por default
 * para permitir localhost no MVP local).
 */
const DEFAULT_BASES: Record<AdapterType, string | undefined> = {
  OPENAI: 'https://api.openai.com',
  ANTHROPIC: 'https://api.anthropic.com',
  GEMINI: 'https://generativelanguage.googleapis.com',
  OPENAI_COMPATIBLE: undefined, // exige baseUrl
  OLLAMA: 'http://localhost:11434',
  DEMO: 'mock://demo',
};

export function buildProviderConfig(input: ProviderInput): ProviderConfig {
  const type = input.type as AdapterType;
  let baseUrl = (input.baseUrl ?? '').trim();
  if (baseUrl === '' && DEFAULT_BASES[type]) baseUrl = DEFAULT_BASES[type]!;

  // DEMO e OLLAMA nao exigem api key. OpenAI-compativel exige baseUrl.
  if (type === 'OPENAI_COMPATIBLE' && baseUrl === '') {
    throw new ProviderError({
      code: ErrorCodes.INVALID_ENDPOINT,
      message: 'Provedores compativeis com OpenAI exigem uma URL base explicita.',
      provider: type,
    });
  }

  if (baseUrl && type !== 'DEMO') {
    validateBaseURL(baseUrl);
  }

  // segundo a validacao acima nunca sera undefined quando type !== DEMO
  // (DEMO aceita mock://); mantemos o cast
  return {
    id: input.id,
    name: input.name,
    adapterType: type,
    baseUrl: baseUrl || undefined,
    apiKey: input.apiKey,
    extraHeaders: input.extraHeaders,
    timeoutMs: input.timeoutMs && input.timeoutMs > 0 ? input.timeoutMs : undefined,
    active: true,
  };
}

export function ensureDemoConfig(): ProviderConfig {
  return DEMO_PROVIDER_CONFIG;
}