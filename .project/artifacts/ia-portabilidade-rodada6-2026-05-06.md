# IA Portabilidade - Rodada 6 - IPE Live

Data: 2026-05-06

## Modo Executado

- Modo: `reconciliacao-delta`.
- Stack detectado: `js-simple`.
- Git: ## Atualização-do-sistema...origin/Atualização-do-sistema.
- Observacao: Node monorepo ja portado.

## Estrutura IA

- Skills locais: `node-runtime`, `orquestrador`, `seguranca-config`.
- Catalogo apontando para skills ausentes: (nenhuma divergencia detectada).
- `.agents`: ok.
- `.claude/skills`: ok.

## Acoes

- delta registrado em .project/artifacts

## Matriz De Capacidades

| Capacidade Base | Origem | Decisao | Motivo/acao |
|---|---|---|---|
| Governanca IA | AGENTS.md, .ai, catalogo, symlinks | Aplicavel | wrapper fino, .ai canonico, .codex/skills e compatibilidade por symlink |
| Orquestracao | agentes/orquestrador | Adaptavel | auditar catalogo, residuos, symlinks e deltas por capacidade |
| Documentacao sync | documentation-sync-auditor, .project | Adaptavel | separar regra de IA em .ai e operacao/evidencia em .project |
| Testes | run-tests, ensure-tests, testes | Adaptavel | usar comandos reais do stack; nao assumir artisan/PHPUnit do Base |
| Ambiente/incidentes | ambiente, incident-debugger, observabilidade | Adaptavel/adiar | levar quando houver rotina recorrente de setup, logs, RCA ou producao |
| Seguranca | appsec-auditor | Adaptavel | preservar segredos fora de docs e bloquear deploy/credenciais sem pedido |
| Dados/migracao | migration-db, schema-analyst | Condicional | aplicar apenas quando houver banco/migrations reais no alvo |
| Produto | BI, AI Chat, relatorios, dashboard, formularios | Condicional | so portar quando o produto tiver fluxo equivalente |
| Template | template-sync, template-guardian, Core Protegido, multi-tenant do template | Nao aplicavel | standalone nao depende de template/main |

## Nao Executado

- Nenhum deploy, migration, PM2, SSH/FTP, instalacao de dependencia, commit ou push.
- Nenhuma remocao de legado.
- Nenhuma sobrescrita de skill local existente fora desta rodada/bootstrap.
