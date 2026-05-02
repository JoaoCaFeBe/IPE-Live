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

## Sinais Da Rodada 4

- Chaves com aparencia sensivel detectadas pelo scan textual: nenhuma chave obvia detectada.
- Valores foram omitidos de proposito.
