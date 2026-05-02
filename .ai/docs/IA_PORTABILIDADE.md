# IA Portabilidade - IPE Live

Diagnostico inicial gerado em 2026-05-02 pela skill `ia-portabilidade` a partir do Base.Laravel.

## Classificacao

- Modo: `bootstrap`.
- Familia: `node`.
- Prioridade planejada: 3.
- Remote `template`: (ausente).
- Status no momento do diagnostico: ## Atualização-do-sistema<br>?? .ai/<br>?? AGENTS.md.
- Observacao: Node/subprojeto com .gemini e instrucoes antigas em .github.

## Superficie Encontrada

- `AGENTS.md`
- `.ai`
- `.github/copilot-instructions.md`

## Diagnostico Node

- Scripts npm detectados: Live: dev, start; Liturgia: dev, start
- Configuracao PM2/ecosystem detectada: sim.
- Legado de instrucoes IA: `.github/copilot-instructions.md`.
- Proxima evolucao segura: consolidar instrucoes antigas em `.ai/docs/` e, somente se houver rotina recorrente, criar skills locais em `.codex/skills/`.
- Gate obrigatorio: nao executar `pm2 reload`, `pm2 restart`, deploy ou alteracao de variaveis de ambiente sem pedido explicito.


## Matriz De Capacidades

| Capacidade | Origem Base.Laravel | Decisao inicial | Motivo / acao |
|---|---|---|---|
| Governanca IA | AGENTS.md, .ai, catalogo, symlinks | melhorar existente ou criar adaptada | Manter wrapper fino e .ai como fonte; symlinks so depois de inventario. |
| Orquestracao | agentes / orquestrador | adiar ou melhorar existente | Criar skill local somente se houver rotina recorrente de auditoria de IA. |
| Documentacao | documentation-sync-auditor, .project | criar adaptada | Usar .ai para regras da IA e .project para docs/runbooks quando necessario. |
| Testes | run-tests, ensure-tests, testes | criar adaptada | Usar comandos reais do stack; nao assumir PHPUnit/artisan do Base.Laravel. |
| Ambiente e incidentes | ambiente, environment-doctor, incident-debugger, observabilidade | adiar | Levar quando houver rotina recorrente de logs/setup/producao. |
| Seguranca | appsec-auditor | criar adaptada | Validar segredos, producao/teste e entrada de usuario conforme stack. |
| Dados e migracao | migration-db, schema-analyst, migration-reviewer | condicional | Aplicar apenas se houver banco/migrations reais. |
| Produto | BI, chat IA, relatorios, dashboard, formularios, financeiro, agenda | condicional | Aplicar somente onde existir workflow real no projeto. |
| Template Base.Laravel | template-sync, template-guardian, Core Protegido, multi-tenant do template | nao aplicavel | Standalone nao depende de template/main. |

## Validacao Prevista

- `git status --short`
- `rg -n '^(<<<<<<<|=======|>>>>>>>)$' .`
- `npm scripts detectados: Live: dev, start; Liturgia: dev, start`
- `Nao executar pm2/reload/restart sem aprovacao explicita.`

## Pendencias E Aprovacoes

- Nao foram removidas instrucoes antigas, prompts, `.github`, `.codex` ou outros legados.
- Nao foram criados symlinks `.agents` ou `.claude/skills` nesta rodada inicial.
- Migracoes de conteudo legado para `.ai/`, criacao de `.project/`, skills locais ou symlinks exigem nova aprovacao apos revisao do diagnostico.
- Hooks, deploy, PM2, FTP/SSH, migrations e commits continuam fora do escopo automatico.

## Politica De Aprovacao Para As Proximas Rodadas

Nao e necessario aprovar cada fase operacional. A portabilidade segue sozinha em acoes seguras:

- diagnostico, inventario, matriz de capacidades e comparacao delta;
- criacao de arquivos novos de documentacao em `.ai/docs/` ou `.project/artifacts/`;
- bootstrap minimo quando `AGENTS.md` e `.ai/AI_BOOTSTRAP.md` ainda nao existem;
- revisao de relatorios e comandos de validacao sem executar deploy, migration ou reload.

Aprovacao explicita continua obrigatoria antes de:

- mover, remover ou renomear `.github`, `.ecosistema`, `.codex`, `.agents`, `.claude`, `.project` ou docs legadas;
- substituir diretorio real por symlink;
- sobrescrever skill local existente;
- alterar hooks Git, deploy, PM2, FTP/SFTP/SSH, scripts `.command`, migrations ou producao;
- executar commit, push, deploy, migration ou comandos com credenciais.
