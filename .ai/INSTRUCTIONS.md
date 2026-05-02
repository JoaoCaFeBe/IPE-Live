# INSTRUCTIONS - IPE Live

Projeto standalone migrado pela Rodada 4 da `ia-portabilidade`.

## Contexto

- Familia: `node-dual`
- Observacao: Duas apps Node: Liturgia publica e Live local, com sincronizacao obrigatoria entre pastas.

## Roteamento

- Mudancas em `Liturgia/` ou `Live/`: use `node-runtime`.
- Qualquer novo tipo de card/midia/texto deve avaliar os dois lados: `Liturgia` e `Live`.
- Mudancas em `.github`, `.gemini`, `.ai`, `.codex`, wrappers ou catalogo: use `orquestrador`.
- Mudancas em PM2, `.env`, URLs, tokens, bancos SQLite ou APIs externas: use `seguranca-config`.

## Validacao

Scripts npm detectados:

- `Liturgia: dev: nodemon server.js, start: node server.js`
- `Live: dev: node --watch server.js, start: node server.js`

PM2/ecosystem:

- `Liturgia/ecosystem.config.js`
- `Live/ecosystem.config.js`

Nao executar `npm start`, PM2, deploy ou alteracao de ambiente sem pedido explicito.

## Limites

- Nao usar `template/main`, `template-sync`, Core Protegido ou regras multi-tenant do Base.Laravel.
- Nao remover conteudo historico sem preservar copia em `.ai/docs/` ou `.project/`.
- Nao executar deploy, banco, PM2, composer/npm install, commit ou push sem pedido explicito.
