# Politica de Seguranca

## Versao suportada

Apenas a versao mais recente do `main` recebe correcoes de seguranca.

## Reportando uma vulnerabilidade

Nao abra uma issue publica para reportar vulnerabilidades de seguranca.

Envie um email privado para: security@prompt-arena.dev (substitua pelo endereco real do mantenedor).

Inclua:
- Descricao do problema
- Passos para reproduzir
- Impacto estimado
- Sugerencia de mitigacao (se houver)

Resposta esperada em ate 72 horas.

## Escopo

- Exposicao de credenciais
- Bypass de criptografia em repouso
- XSS via respostas de LLM
- SSRF via URL base de provedor configuravel
- Quebra de isolamento entre runs

## Fora de escopo

- Ataques que exigam credenciais validas
- DOS sem impacto pratico

## Medidas implementadas

- Credenciais criptografadas em repouso (AES-256-GCM)
- Mascaramento de chaves em logs e erros
- Chaves nunca enviadas ao cliente
- Validacao de URL base
- Timeout e cancelamento de requisicoes
- Sanitizacao de Markdown (sem HTML cru)

> A criptografia atual e voltada para uso local. Ambientes publicos devem usar um gerenciador de segredos adequado (AWS Secrets Manager, Vault, etc.).