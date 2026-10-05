# Provider Architecture

A camada de provedores e a fronteira entre o Prompt Arena e os servicos externos
de IA. A logica de negocio nunca conhece detalhes de SDK; consome apenas a
interface `AIProviderAdapter` definida em `lib/providers/types.ts`.

## Mapa

```
lib/providers/
  types.ts                - interfaces/contratos publicos
  registry.ts             - registro de adaptadores por AdapterType
  capabilities/
    capabilities.ts       - catalogo de parametros suportados por provedor
  errors/
    codes.ts              - ErrorCodes padronizados
    sanitize.ts           - sanitizacao de mensagens (mascara chaves/headers)
    normalize.ts          - mapeia thrown value -> ProviderError normalizado
  http/
    signal.ts             - combineTimeoutSignal + withAbortGuard
    url.ts                - validateBaseURL (anti-SSRF opcional)
    fetch-with-timeout.ts - fetch REST com timeout/cancel/erros padronizados
  responses/
    build.ts              - monta GenerationResult + calcula custo
providers/
  demo/adapter.ts         - implementacao de referencia (mock)
  <real>/adapter.ts       - (Etapa 4) OpenAI, Anthropic, Gemini, etc.
  index.ts                - ensureAdaptersRegistered
```

## Contratos

### `AIProviderAdapter`
Interface que todo provedor implementa:

```ts
interface AIProviderAdapter {
  readonly adapterType: AdapterType;
  testConnection(config: ProviderConfig): Promise<ConnectionTestResult>;
  listModels?(config: ProviderConfig): Promise<ProviderModel[]>;
  generate(request: GenerationRequest, config: ProviderConfig): Promise<GenerationResult>;
}
```

### `GenerationResult`
Saida normalizada comunes a todos os provedores. Custo e total de tokens sao
preenchidos por `buildResult` quando o adaptador nao o faz.

### `ProviderError`
Erro normalizado com `code` estavel (ver `ErrorCodes`), `provider`, `model`,
`retryable` e `statusCode`.

## Codigos de erro

| Codigo | Significado | Retryable |
|---|---|---|
| AUTH_ERROR | 401/403 | nao |
| RATE_LIMIT | 429 | sim |
| TIMEOUT | timeout | sim |
| CANCELED | abortado pelo usuario | nao |
| BAD_REQUEST | 400 | nao |
| NOT_FOUND | 404 / modelo inexistente | nao |
| CONTEXT_LENGTH | 413 / prompt excede contexto | nao |
| PROVIDER_UNAVAILABLE | 503 / 5xx | sim |
| INVALID_ENDPOINT | URL base invalida | nao |
| EMPTY_RESPONSE | sem conteudo | sim |
| INVALID_RESPONSE | formato inesperado | nao |
| CONNECTION_REFUSED | ECONNREFUSED | sim |
| NETWORK_ERROR | outro erro de rede | sim |
| MODELS_ENDPOINT_MISSING | /v1/models ausente (OpenAI-compatible) | nao |
| INTERNAL_ERROR | fallback generico | nao |

## Como adicionar um provedor

1. Criar `providers/<nome>/adapter.ts` que implementa `AIProviderAdapter`.
   Use `fetchWithTimeout`, `combineTimeoutSignal`, `buildResult` e
   `normalizeError` para nao reinventar tratamento de erros/timeout.
2. (Opcional) Ajustar capabilities em `lib/providers/capabilities/capabilities.ts`
   caso o provedor traga parametros/padroes novos.
3. Registrar em `providers/index.ts` via `registerAdapter(...)`.
4. Adicionar o `AdapterType` ao union em `types.ts` se ainda nao existir.

A logica de negocio (UI e servicos) nao precisa mudar.

## Seguranca

- `sanitizeMessage` mascara chaves (`sk-...`, `Bearer ...`, `x-api-key: ...`)
  e credenciais embutidas em URLs antes de qualquer mensagem chegar ao cliente.
- `validateBaseURL` bloqueia schemes arbitrarios e (opcionalmente) hosts privados
  para evitar SSRF.
- Api keys permanecem no server; sao injetadas em `Authorization: Bearer ...`
  no `fetchWithTimeout` sem filtrar logs do provedor.