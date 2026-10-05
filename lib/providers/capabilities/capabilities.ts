import type { AdapterType, GenerationParameters } from '../types';

/**
 * Catalogo de capabilities por adaptador. Declara quais parmetros de geracao
 * cada tipo de provedor suporta nativamente, para que a UI possa desabilitar
 * os incompativeis e a camada de servico possa ignorar com seguranca os
 * parmetros que nao se aplicam a um provedor.
 *
 * Manter isto isolado permite adicionar novos provedores sem tocar na UI ou
 * nos servicos; cada adaptador declara o seu proprio conjunto.
 */

export type ParameterKey = keyof GenerationParameters;

export interface AdapterCapabilities {
  adapterType: AdapterType;
  /** Lista branca de parmetros suportados. */
  supportedParameters: ReadonlySet<ParameterKey>;
  /** Indica se o provedor retorna contagem de tokens. */
  reportsTokenUsage: boolean;
  /** Suporta streaming nativo. */
  supportsStreaming: boolean;
  /** Suporta listagem automatica de modelos via /v1/models ou equivalente. */
  supportsModelListing: boolean;
}

const ALL: ParameterKey[] = [
  'temperature',
  'maxTokens',
  'topP',
  'frequencyPenalty',
  'presencePenalty',
  'seed',
  'stop',
  'responseFormat',
];

function set(...keys: ParameterKey[]): ReadonlySet<ParameterKey> {
  return new Set(keys);
}

const OPENAI_CAPS: AdapterCapabilities = {
  adapterType: 'OPENAI',
  supportedParameters: set('temperature', 'maxTokens', 'topP', 'frequencyPenalty', 'presencePenalty', 'seed', 'stop', 'responseFormat'),
  reportsTokenUsage: true,
  supportsStreaming: true,
  supportsModelListing: true,
};

const ANTHROPIC_CAPS: AdapterCapabilities = {
  adapterType: 'ANTHROPIC',
  supportedParameters: set('temperature', 'maxTokens', 'topP', 'stop'),
  reportsTokenUsage: true,
  supportsStreaming: true,
  supportsModelListing: true,
};

const GEMINI_CAPS: AdapterCapabilities = {
  adapterType: 'GEMINI',
  supportedParameters: set('temperature', 'maxTokens', 'topP', 'stop', 'responseFormat'),
  reportsTokenUsage: true,
  supportsStreaming: true,
  supportsModelListing: true,
};

const OPENAI_COMPATIBLE_CAPS: AdapterCapabilities = {
  adapterType: 'OPENAI_COMPATIBLE',
  supportedParameters: set('temperature', 'maxTokens', 'topP', 'frequencyPenalty', 'presencePenalty', 'seed', 'stop', 'responseFormat'),
  reportsTokenUsage: true, // depende do provedor; alguns nao retornam
  supportsStreaming: true,
  supportsModelListing: false, // pode nao existir; tratado caso a caso
};

const OLLAMA_CAPS: AdapterCapabilities = {
  adapterType: 'OLLAMA',
  supportedParameters: set('temperature', 'maxTokens', 'topP', 'stop', 'seed'),
  reportsTokenUsage: true, // ollama retorna prompt_eval_count e eval_count
  supportsStreaming: true,
  supportsModelListing: true,
};

const DEMO_CAPS: AdapterCapabilities = {
  adapterType: 'DEMO',
  supportedParameters: set(...ALL), // demo aceita tudo para fins de UI
  reportsTokenUsage: true,
  supportsStreaming: true,
  supportsModelListing: true,
};

export const CAPABILITIES: Record<AdapterType, AdapterCapabilities> = {
  OPENAI: OPENAI_CAPS,
  ANTHROPIC: ANTHROPIC_CAPS,
  GEMINI: GEMINI_CAPS,
  OPENAI_COMPATIBLE: OPENAI_COMPATIBLE_CAPS,
  OLLAMA: OLLAMA_CAPS,
  DEMO: DEMO_CAPS,
};

export function getCapabilities(adapterType: AdapterType): AdapterCapabilities {
  const caps = CAPABILITIES[adapterType];
  if (!caps) {
    throw new Error(`No capabilities registered for adapter type: ${adapterType}`);
  }
  return caps;
}

/**
 * Filtra os parmetros recebidos mantendo apenas os suportados pelo adaptador.
 * Retorna tambem a lista de chaves ignoradas para log/aviso.
 *
 * Nao lanca erro: parmetros incompativeis sao apenas descartados com seguranca.
 */
export function filterParameters(
  adapterType: AdapterType,
  parameters: GenerationParameters,
): { allowed: GenerationParameters; ignored: ParameterKey[] } {
  const caps = getCapabilities(adapterType);
  const allowed: GenerationParameters = {};
  const ignored: ParameterKey[] = [];
  for (const key of ALL) {
    const value = parameters[key] as GenerationParameters[ParameterKey];
    if (value === undefined) continue;
    if (caps.supportedParameters.has(key)) {
      (allowed as Record<ParameterKey, GenerationParameters[ParameterKey]>)[key] = value;
    } else {
      ignored.push(key);
    }
  }
  return { allowed, ignored };
}