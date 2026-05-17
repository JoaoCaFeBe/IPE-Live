---
name: ambiente
description: "Diagnostica setup local de IPE Live: .env de Live, ecosystem.config.js, banco SQLite, versoes Node/npm. Nao expoe segredos nem altera producao."
---

# Ambiente - IPE Live

Use quando o usuario pedir "ambiente", "setup", "config", "banco nao conecta", "env", "porta em uso", "Node nao roda", "Socket.IO nao conecta" ou diagnostico geral antes de mexer em codigo.

## Guard

- Nao copie valores de `Live/.env` para resposta, log, doc ou commit; apenas indique presenca/ausencia de chave.
- Nao execute `pm2 reload`, `pm2 restart`, `pm2 start`, migrations, `rm` em banco, deploy ou rotacao de chave sem pedido explicito.
- Nao crie `.env` novo se ja existir; se faltar, apenas reportar e sugerir copia de `.env.example`.

## Fluxo

1. Leia `.ai/AI_BOOTSTRAP.md` e `.ai/INSTRUCTIONS.md`.
2. Identifique o lado afetado: `Live/`, `Liturgia/` ou ambos.
3. Verifique presenca dos arquivos:
   - `Live/.env` (gitignored) e `Live/.env.example`
   - `Live/ecosystem.config.js` e `Liturgia/ecosystem.config.js`
   - `Live/database/*.db` e `Liturgia/database/*.db` (se aplicavel)
4. Compare chaves de `Live/.env.example` com `Live/.env` listando apenas nomes (nunca valores).
5. Verifique versoes locais: `node --version`, `npm --version`.
6. Confira scripts npm reais (`Live: dev/start`, `Liturgia: dev/start`).
7. Para problemas de porta, sugira `lsof -i :<porta>` mas nao mate processo sem aprovacao.

## Saida

- Status por componente: OK / Degradado / Critico.
- Lista de chaves ausentes em `.env` (somente nomes).
- Recomendacao de ajuste; nunca aplicar producao automatica.
- Pendencias que exigem decisao humana (rotacao de chave, ajuste de porta PM2, reset de banco).
