# Prompt Arena

Compara a saída de modelos de IA em uma única interface. Você escreve um prompt uma vez, ele roda em vários modelos ao mesmo tempo, e a tela mostra resposta, latência, tokens, custo e status de cada um lado a lado.

## Estado atual

Etapa 1 de 7 concluída. Partes das etapas 2, 3, 4, 6 e 7 já estão implementadas, mas essas etapas ainda não foram concluídas.

**O aplicativo funciona em modo demonstração. Os adaptadores de provedores estão implementados, mas falta a interface para configurar e usar provedores reais.**

O que funciona hoje:

- O playground: editor de prompt com variáveis, seleção de vários modelos, painel de parâmetros e execução paralela com tolerância a falhas.
- O modo demonstração: modelos simulados, com latência e erros falsos, sem nenhuma chamada de rede.
- O histórico de execuções, guardado no navegador.
- Seis adaptadores de provedor, todos com testes unitários: OpenAI, Anthropic, Gemini, compatível com OpenAI, Ollama e o modo demonstração.
- Comparação de custo por token, que devolve "custo não disponível" em vez de inventar valor quando o preço não está cadastrado.

O que não funciona:

- **Não há interface para cadastrar provedor nem chave de API.** As telas `/providers` e `/models` ainda não têm essa funcionalidade. Um adaptador compatível com OpenAI chega a pedir que o usuário cadastre um provedor, e não há onde fazer isso.
- **A rota que lista modelos devolve sempre a lista de demonstração**, sem ler o banco.
- **Não há persistência.** O botão de salvar o prompt abre um aviso de que o salvamento chega na etapa 5. O histórico fica só no `localStorage`.
- **Cancelar não aborta a chamada ao provedor.** Só o adaptador de demonstração respeita o sinal de aborto; os outros cinco o descartam.
- **Não há testes de integração nem de ponta a ponta.** As pastas existem, mas estão vazias.
- **Faltam 12 das 15 operações de servidor** descritas na especificação do projeto.

## Funcionalidades implementadas

### Playground

- Editor com suporte a variáveis no formato `{{nome}}`. O editor detecta as variáveis usadas, avisa quais estão sem valor e mostra uma pré-visualização da substituição.
- Seleção múltipla de modelos, com os três primeiros pré-selecionados ao abrir.
- Painel de parâmetros: temperatura, máximo de tokens, `top_p`, penalidade de frequência, penalidade de presença, semente e formato de resposta. O painel avisa que nem todo provedor suporta tudo, e parâmetros incompatíveis são descartados.
- Execução paralela com `Promise.allSettled`: se um provedor falhar, os outros resultados aparecem mesmo assim.
- Cancelar, que aborta a requisição no navegador e avisa o servidor.
- Indicador de carregamento por modelo enquanto a resposta não chega.
- Tema claro e escuro.

### Cartões de resultado

Cada cartão mostra modelo, provedor, status, latência, tokens de entrada, saída e total, custo estimado e tempo até o primeiro token. Tem copiar, copiar como Markdown, favoritar, executar de novo e recolher.

### Camada de provedores

Seis adaptadores registrados, todos usando `fetch` nativo, sem nenhum SDK de provedor:

| Adaptador | Endpoint | Autenticação |
|---|---|---|
| OpenAI | `POST /v1/chat/completions` | `Bearer` |
| Anthropic | `POST /v1/messages` | header `x-api-key` e versão da API |
| Gemini | `POST /v1beta/models/{model}:generateContent` | chave na query |
| Compatível com OpenAI | delega ao adaptador OpenAI, trocando o tipo de provedor | `Bearer` |
| Ollama | `POST /api/chat` | nenhuma |
| Demonstração | nenhuma chamada de rede | nenhuma |

Cada adaptador implementa a mesma interface: gerar resposta, listar modelos e testar a conexão. O modo compatível com OpenAI não lista modelos de propósito e devolve um erro próprio dizendo que o endpoint não existe ali.

### Tratamento de erro

- Quinze códigos de erro, com classificação por status HTTP e marcação de quais são recuperáveis.
- Sanitização que mascara chaves de API e remove credenciais que estejam na URL, com corte em 500 caracteres.
- Mascaramento de segredos em texto, reconhecendo os prefixos `sk-`, `sk-ant-` e `Bearer`.

### Custo

Fórmula de tokens por milhão vezes preço, arredondada a seis casas. Sem preço cadastrado, o custo volta indefinido e a interface mostra "custo não disponível". Nunca há estimativa inventada.

### Validação

Seis esquemas com validação estrita. O prompt de usuário é limitado a 50.000 caracteres, o de sistema a 20.000, de 1 a 10 modelos por execução, e o tempo limite vai de 100 ms a 600 segundos.

### Parcial

- **Criptografia das chaves**: existe uma implementação de AES-256-GCM com chave derivada por SHA-256, mas **nenhum código da aplicação a chama**. Só os testes usam.
- **Cancelamento**: o servidor aborta, mas o sinal não chega aos provedores reais.
- **Histórico**: funciona, mas só no navegador, com limite de 100 execuções.

### Não implementado

As telas `/prompts`, `/models`, `/providers` e `/settings` mostram apenas "será implementado nas próximas etapas". Também não existem: avaliação por estrelas, modo de comparação cega, exportação em JSON, Markdown ou CSV, biblioteca de prompts, streaming de verdade e integração com o banco.

## Tecnologias

| | Versão |
|---|---|
| Next.js | 14.2.33 |
| React | 18.3.1 |
| Prisma | 5.22.0 |
| SQLite | via Prisma |
| Zod | 3.23.8 |
| Tailwind CSS | 3.4.13 |
| Vitest | 2.1.3 |
| Playwright | 1.48.0 |
| TypeScript | 5.6.2 |

- **App Router** do Next.js, com sete páginas e três rotas de API.
- **Sem SDK de provedor de IA.** Todos os adaptadores falam REST direto com `fetch`.
- TypeScript estrito, com `noUncheckedIndexedAccess` e alias `@/*` apontando para a raiz.
- Preços e custos são gravados no SQLite como texto, e não como número, para evitar imprecisão de ponto flutuante. O cálculo roda em memória.

## Modelo de dados

Oito tabelas em `prisma/schema.prisma`:

| Modelo | O que guarda |
|---|---|
| `Provider` | Nome, tipo de adaptador, URL base, chave cifrada, cabeçalhos extras, tempo limite, ativo |
| `Model` | Provedor, identificador técnico, nome de exibição, contexto máximo, preços, moeda, se é local, se suporta streaming |
| `Prompt` | Título, descrição, prompt de sistema, conteúdo, etiquetas |
| `PromptVariable` | Variável do prompt e valor padrão |
| `Run` | Prompt de origem, prompt final, variáveis usadas, parâmetros, status, se estava em modo demonstração |
| `RunResult` | Resultado por modelo: conteúdo, status, tokens, latência, custo, motivo de fim, se usou streaming, erro |
| `Evaluation` | Estrelas, critérios, comentário, se estava em modo cego |
| `AppSetting` | Pares de chave e valor |

O seed limpa as oito tabelas e insere seis prompts de exemplo, mais uma configuração de primeira execução. Não há chave real no seed.

## Como executar

### Requisitos

Node.js 18 ou superior e npm 9. A CI usa Node 20 e o Dockerfile usa `node:20-alpine`.

### Instalação

```bash
npm install
cp .env.example .env
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

Abra `http://localhost:3000`.

### Variáveis de ambiente

| Variável | Para que serve | Efeito real |
|---|---|---|
| `DATABASE_URL` | Caminho do arquivo SQLite | Usada pelo Prisma |
| `ENCRYPTION_KEY` | Segredo para derivar a chave de cifragem | Usada pelo módulo de criptografia |
| `DEMO_MODE` | Liga o modo demonstração | **Nenhuma leitura no código** |
| `NEXT_PUBLIC_APP_NAME` | Nome exibido na aplicação | **Nenhuma leitura no código** |

As duas últimas estão documentadas, inclusive no `docker-compose.yml`, mas não têm efeito: o título do aplicativo está escrito direto no layout, e o modo demonstração é o padrão de fato, porque o playground não envia provedor na requisição.

### Scripts

| Script | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Gera o client do Prisma e faz o build |
| `npm run start` | Serve o build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc` sem emitir arquivos |
| `npm test` | Roda os testes unitários uma vez |
| `npm run test:watch` | Testes em modo interativo |
| `npm run test:e2e` | Playwright |
| `npm run format` | Prettier |
| `npm run prisma:generate` | Gera o client |
| `npm run prisma:migrate` | Cria e aplica migração |
| `npm run prisma:migrate:deploy` | Aplica migrações existentes |
| `npm run prisma:seed` | Popula o banco com exemplos |
| `npm run prisma:studio` | Abre o Prisma Studio |

### Com Docker

```bash
docker compose up --build
```

Imagem em múltiplas etapas sobre `node:20-alpine`, rodando como usuário não-root, expondo a porta 3000 e com um volume para o diretório do Prisma. O comando de inicialização aplica as migrações a cada boot e depois inicia o servidor. O `docker-compose.yml` define as quatro variáveis de ambiente com valores padrão.

**Um problema conhecido:** o Dockerfile copia a pasta `public/` do estágio de build, e a pasta estava vazia. Como o Git não versiona diretório vazio, um clone limpo quebra nessa linha. Foi criado um arquivo `public/.gitkeep` na publicação para resolver.

## Como usar

1. Abra o playground. Os três primeiros modelos de demonstração já vêm selecionados.
2. Escreva o prompt de sistema e o prompt do usuário. Se usar `{{variavel}}`, o editor detecta e avisa sobre as que estão sem valor.
3. Ajuste os parâmetros se quiser.
4. Clique em **Executar comparação**. O botão só habilita com prompt não vazio, pelo menos um modelo e nenhuma variável faltando.
5. Os resultados voltam de uma vez, não em streaming: a execução paralelela só responde depois que todos terminam. Durante a espera, cada modelo mostra seu próprio skeleton.
6. Compare os cartões: latência, tokens, custo, status.
7. Use **Copiar como Markdown** para levar a resposta embora.
8. A execução é salva no histórico, que fica na página `/history`.

Ainda não é possível configurar provedores reais pela interface. Os adaptadores estão implementados e possuem testes unitários, mas falta a tela de configuração. A existência desses testes não confirma que eles passam atualmente.

## Organização do projeto

| Pasta | Responsabilidade |
|---|---|
| `app/` | Sete páginas e três rotas de API: `runs`, `models` e `cancel` |
| `components/` | Playground, cartões de resultado, componentes de interface, barra lateral e tema |
| `lib/providers/` | Tipos, registro, capacidades, erros e utilitários HTTP, com README próprio |
| `lib/services/` | Execução da comparação, armazenamento em memória, configuração de provedor |
| `lib/crypto/` | Cifragem AES e mascaramento de segredos |
| `lib/pricing/` | Cálculo e descrição de custo |
| `lib/validation/` | Esquemas Zod |
| `providers/` | Os seis adaptadores, com registro automático |
| `prisma/` | Schema, seed e migração inicial |
| `tests/unit/` | Dezoito arquivos de teste unitário |
| `tests/integration/` e `tests/e2e/` | Vazias, mas com configuração pronta |
| `docs/ROADMAP.md` | O roadmap do projeto |

## Limitações e pendências

### Defeitos conhecidos

- **O `AbortSignal` do cliente é descartado pelos cinco adaptadores reais.** Cancelar no navegador não aborta a chamada ao provedor; só o modo demonstração respeita o sinal.
- **A criptografia das chaves nunca é chamada.** A implementação de AES-256-GCM existe e tem teste, mas a aplicação não a usa para guardar credenciais.
- **`DEMO_MODE` e `NEXT_PUBLIC_APP_NAME` não têm efeito.**
- **O `docker-compose.yml` tem um valor padrão literal para `ENCRYPTION_KEY`**, e a aplicação sobe sem erro visível usando esse valor previsível.
- **A pasta `public/` estava vazia**, o que quebrava o build do Docker num clone limpo.
- **O README original apontava para `docs/screenshot.png`, que não existe.** A referência foi removida na publicação.
- **A limpeza do listener de aborto registra uma função nova**, então o listener externo nunca é removido de verdade.
- **O `package.json` declara `husky` no script `prepare`, mas não existe pasta `.husky`**, então nenhum hook está instalado. O `|| true` faz o script nunca falhar.
- **A tela "Sobre" e o checklist do README ainda dizem "etapa 1"**, o que não reflete o código.
- **`CONTRIBUTING.md` tem um caractere corrompido** numa frase sobre aguardar feedback.
- **O e-mail de reporte de segurança é um placeholder.**
- **A URL de clone nos documentos é um placeholder** (`seu-usuario`).
- **A fonte Inter vem do Google**, então o build falha sem acesso à rede.

### Decisões que limitam o uso

- **O cancelamento por execução só funciona no mesmo processo.** O próprio código avisa que, em ambiente serverless, cada instância teria seu próprio mapa. Para o MVP local isso basta.
- **A proteção contra acesso a endereços privados está desligada por padrão**, para permitir Ollama rodando na máquina.
- **A criptografia é declarada como sendo para uso local.** Em ambiente público, o próprio projeto orienta usar um gerenciador de segredos.
- **A CI não roda os testes de ponta a ponta**, nem a verificação de formatação, nem o seed.

### Funcionalidade ainda não implementada

As quatro telas de prompt, modelos, provedores e configuração. A persistência no banco, que é a etapa 5. A avaliação por estrelas, o modo cego e a exportação. Streaming de verdade, apesar de o catálogo de capacidades declarar suporte a streaming. E 12 das 15 operações de servidor da especificação: cadastrar, alterar e excluir provedor, testar conexão, salvar prompt, salvar avaliação, excluir execução e exportar.

## Próximos passos

Do roadmap do próprio projeto, em `docs/ROADMAP.md` e na especificação:

**As etapas restantes do plano**

- Etapa 5, persistência: provedores, modelos, prompts, execuções e avaliações.
- Fechar as etapas 2, 3, 4, 6 e 7, que estão parcialmente implementadas.

A especificação tem uma regra explícita: não avançar para uma etapa posterior com a anterior quebrada.

**Funcionalidades previstas no roadmap**

- Comparação avançada: julgamento por LLM, conjuntos de teste, execução em lote, benchmark automatizado.
- Prompts: versionamento, teste de prompt, compartilhamento por link.
- Observabilidade: gráficos de custo, gráficos de latência, rastreamento.
- Colaboração: autenticação, equipes, integração com GitHub e CI.
- Capacidades: imagens, áudio, uso de ferramentas, cache semântico, gateways de IA.

A especificação também prevê um onboarding de seis passos na primeira execução e importar e exportar prompts em JSON.

**Trabalhos de qualidade que os documentos apontam**

Corrigir o cancelamento dos adaptadores, ligar a criptografia ao caminho de configuração de provedores, remover as duas variáveis de ambiente sem efeito, popular `public/` ou ajustar o Dockerfile, e corrigir o estado declarado nas telas e no checklist.

## Testes

### Testes unitários

Dezoito arquivos em `tests/unit/`, rodados com Vitest em ambiente Node, sem chamada de rede real. Cobrem:

- Os adaptadores de Anthropic, Gemini, Ollama, OpenAI, compatível com OpenAI e demonstração.
- O registro de adaptadores.
- O catálogo de capacidades e o filtro de parâmetros.
- A classificação e normalização de erros, e a classe de erro do provedor.
- O `fetch` com tempo limite e cabeçalhos extras.
- Utilitários HTTP: combinação de sinais de aborto e validação de URL base.
- A cifragem AES, incluindo erro sem a variável de ambiente e adulteração da tag de autenticação.
- O mascaramento de segredos.
- O cálculo e a descrição de custo.
- O serviço de execução: paralelismo, isolamento de falhas e classificação de status.
- A sanitização de erro.
- A extração e substituição de variáveis do template.

```bash
npm test
```

### Testes de integração e de ponta a ponta

**Não existem.** As pastas estão lá, e a configuração do Playwright está completa, com `baseURL`, servidor web automático, projeto Chromium, traces na primeira repetição e reporter HTML. Mas `tests/integration/` e `tests/e2e/` estão vazias.

```bash
npm run test:e2e
```

Esse comando está disponível e não encontra testes para executar.

### Integração contínua

`.github/workflows/ci.yml` dispara em push e pull request para a branch `main`. Um único job em `ubuntu-latest`, com limite de 20 minutos:

1. Checkout
2. Node 20 com cache de npm
3. `npm ci`
4. `prisma generate`
5. `prisma migrate deploy`
6. `npm run lint`
7. `npm run typecheck`
8. `npm test`
9. `npm run build`

O job define `DATABASE_URL` apontando para um arquivo SQLite, um `ENCRYPTION_KEY` marcado como valor de teste e `DEMO_MODE` ligado.

A CI não roda os testes de ponta a ponta. Também não há badge de status nem resultado arquivado no repositório, então **não é possível confirmar aqui que a suíte passa hoje**.

## Contribuindo

O `CONTRIBUTING.md` pede abrir uma issue antes de contribuir e aguardar retorno antes de um pull request grande. Antes do PR, quatro comandos têm de passar:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

As regras de estilo pedem TypeScript estrito, nada de `any` sem justificativa, nunca expor chaves ou credenciais em log, commit ou resposta, teste para regra de negócio nova e dependências mínimas. Os commits seguem o estilo curto e convencional, com prefixos como `feat:`, `fix:`, `docs:`, `test:` e `refactor:`.

O `CODE_OF_CONDUCT.md` é uma adaptação do Contributor Covenant, cobrindo identidade de gênero, orientação sexual, raça, etnia, nacionalidade, religião, idade, aparência, capacidade e nível de experiência. Não há endereço de contato para violações.

## Segurança

O `SECURITY.md` cobre apenas a branch `main`, orienta a não abrir issue pública para vulnerabilidade e promete resposta em até 72 horas. O endereço de contato é um placeholder.

## Licença

MIT. Ver `LICENSE`.
