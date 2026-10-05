# Contribuindo para o Prompt Arena

Obrigado por considerar contribuir! Este projeto segue um fluxo simples.

## Antes de contribuir

1. Abra uma issue descrevendo o que voce pretende mudar (bug, feature, refactor).
2. Aguarde o feedback dos mantenedores antes de abrir um PR grande.
3. Siga o estilo de codigo existente (Prettier + ESLint).

## Fluxo

```bash
git clone https://github.com/seu-usuario/prompt-arena.git
cd prompt-arena
npm install
npm run prisma:migrate
npm run dev
```

Antes de enviar um PR:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Todos precisam passar.

## Padroes

- TypeScript estrito; nao use `any` sem justificativa.
- Nao exponha chaves/credenciais em logs, commits ou respostas.
- Adicione testes para novas regras de negocio.
- Mantenha dependencias minimas.

## Commits

Mensagens curtas no estilo: `feat: ...`, `fix: ...`, `docs: ...`, `test: ...`, `refactor: ...`.

## Code of Conduct

Veja [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).