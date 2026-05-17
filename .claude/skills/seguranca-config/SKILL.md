---
name: seguranca-config
description: "Use ao tocar em credenciais, Config.php, .env, ecosystem.config.js, metadata SQL, URLs, tokens, banco, PM2 ou producao."
---

# Seguranca De Configuracao - IPE Live

## Guard

- Nunca copie valores de segredo para docs, relatorios, commits ou respostas.
- Se segredo aparecer em arquivo versionado, trate como risco e recomende rotacao.
- Nao alterar banco, PM2, deploy, SSH, FTP ou producao sem pedido explicito.
- Para metadata SQL, registre caminho e uso, mas nao assuma que ela esta atual sem validar.

## Arquivos Sensiveis Conhecidos

- `Live/.env` (gitignored; contem segredos reais de runtime; nunca copiar valores).
- `Live/.env.example` (versionado; deve manter apenas placeholders, nunca valores reais).
- `Liturgia/ecosystem.config.js` e `Live/ecosystem.config.js` (PM2 — nao alterar nomes, portas, scripts ou cwd sem aprovacao).

## Sinais Da Rodada 4

- Chaves com aparencia sensivel detectadas pelo scan textual: nenhuma chave obvia detectada.
- Valores foram omitidos de proposito.
