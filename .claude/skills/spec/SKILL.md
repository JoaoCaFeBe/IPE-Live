---
name: spec
description: "Cria PRD/spec, plano tecnico e tarefas antes de implementar demandas sensiveis neste projeto Node.js."
---

# Spec

Use quando o usuario escrever `$spec`, pedir PRD/especificacao ou quando uma demanda comum envolver risco alto: runtime Node, Socket.IO/WebSocket, providers de IA, PM2, `.env`, tokens, deploy, banco/cache, logs ou integracoes externas.

Sem `$spec`, siga o fluxo normal. Com `$spec`, nao implemente antes de entregar PRD/spec, plano, tarefas e criterios de validacao.

## Onde Criar

- Specs reais: `.project/specs/{aaaa-mm-dd-slug}/`.
- Evidencias e relatorios: `.project/artifacts/`.
- Nao registre segredos, tokens, chaves, dumps ou logs com credenciais.

## Fluxo

1. Classifique escopo, runtime, servicos externos e risco operacional.
2. Crie `prd.md` com problema, objetivo, escopo, fora de escopo, riscos e aceite.
3. Crie `plan.md` com abordagem, arquivos provaveis, rollback e validacao.
4. Crie `tasks.md` com tarefas verificaveis.
5. Pare para aprovacao antes de implementar.

## Atencoes Node

- PM2, reload/restart, deploy e alteracoes de ambiente exigem aprovacao explicita.
- Mudancas em provider, URL ou segredo devem usar `seguranca-config`.
- Mudancas em codigo Node devem respeitar `node-runtime`.
