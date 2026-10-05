/**
 * Codigos de erro padronizados para todos os adaptadores.
 *
 * Os nomes sao estaveis e podem ser serializados/inspecionados pela UI e por
 * testes. Mensagens brutas de SDK nunca sao expostas diretamente; passam pela
 * sanitizacao antes de chegar ao cliente.
 */

export const ErrorCodes = {
  AUTH_ERROR: 'AUTH_ERROR',            // credenciais invalidas (401/403)
  RATE_LIMIT: 'RATE_LIMIT',            // 429
  TIMEOUT: 'TIMEOUT',                  // requisicao excedeu timeout
  CANCELED: 'CANCELED',                // abortada pelo usuario
  BAD_REQUEST: 'BAD_REQUEST',          // 400 / formato invalido
  NOT_FOUND: 'NOT_FOUND',               // 404 / modelo inexistente
  CONTEXT_LENGTH: 'CONTEXT_LENGTH',    // prompt excede o contexto
  PROVIDER_UNAVAILABLE: 'PROVIDER_UNAVAILABLE', // 503 / 5xx
  INVALID_ENDPOINT: 'INVALID_ENDPOINT',           // URL base invalida
  EMPTY_RESPONSE: 'EMPTY_RESPONSE',               // sem conteudo
  INVALID_RESPONSE: 'INVALID_RESPONSE',           //resposta fora do formato
  CONNECTION_REFUSED: 'CONNECTION_REFUSED',        // ECONNREFUSED
  NETWORK_ERROR: 'NETWORK_ERROR',                  // outro erro de rede
  MODELS_ENDPOINT_MISSING: 'MODELS_ENDPOINT_MISSING',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Codigo padrao de erro mostrado na UI.
 */
export const DEFAULT_ERROR_MESSAGE =
  'Ocorreu um erro ao chamar o provedor. Verifique a configuracao e tente novamente.';