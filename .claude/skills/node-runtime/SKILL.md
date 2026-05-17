---
name: node-runtime
description: "Use ao alterar Liturgia, Live, Express, EJS, Socket.IO, SQLite, PM2 ou fluxo de projecao ao vivo."
---

# Node Runtime - IPE Live

## Guard

1. Leia `.ai/AI_BOOTSTRAP.md` e `.ai/INSTRUCTIONS.md`.
2. Determine se a mudanca toca `Liturgia/`, `Live/` ou ambos.
3. Para novo tipo de conteudo, alteracao de estrutura ou exclusao, avalie obrigatoriamente os dois lados: cadastro em `Liturgia` e exibicao em `Live`.
4. Nao substituir tags HTML customizadas por `div` sem necessidade real.
5. Nao executar PM2, deploy ou alteracao de ambiente sem pedido explicito.

## Validacao

- `node --check <arquivo.js>` nos JS alterados.
- Conferir scripts em `Live/package.json` e `Liturgia/package.json`.
- Validar manualmente painel/projecao quando houver mudanca visual ou Socket.IO.
