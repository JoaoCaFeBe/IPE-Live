# Skills Catalog

Fonte canonica: `.claude/skills/{nome}/SKILL.md`. `.codex/skills` e symlink de compatibilidade que aponta para `.claude/skills`.

## Skills Locais

| Skill | Caminho | Uso |
| --- | --- | --- |
| `ambiente` | `.claude/skills/ambiente/SKILL.md` | Diagnostica `.env`, `ecosystem.config.js`, banco SQLite e versoes Node/npm. Nao expoe segredos nem altera producao. |
| `node-runtime` | `.claude/skills/node-runtime/SKILL.md` | Use para validacao e manutencao de Liturgia/Live Node. |
| `organizar-artefatos` | `.claude/skills/organizar-artefatos/SKILL.md` | Normaliza `.project/artifacts/` (duraveis) e `.temp/` (descartaveis). |
| `orquestrador` | `.claude/skills/orquestrador/SKILL.md` | Use para auditar wrappers, catalogo, symlinks, residuos e deltas da camada IA/Codex local. |
| `repo-file-governor` | `.claude/skills/repo-file-governor/SKILL.md` | Decide destino correto de arquivos novos entre `Live/`, `Liturgia/`, `.project/`, `.artifacts/` e `.ai/docs/`. |
| `seguranca-config` | `.claude/skills/seguranca-config/SKILL.md` | Use para credenciais, configs, bancos, PM2, metadata, URLs e segredos. |

## Skills Globais Usadas

| Skill | Origem | Uso |
| --- | --- | --- |
| `spec` | global do usuario | Use para PRD/spec, plano e tarefas antes de demandas sensiveis ou ambiguas. Roteamento Node-especifico (Socket.IO, PM2, `.env`, tokens, deploy, banco, integracoes externas) esta em `.ai/INSTRUCTIONS.md`, que tambem delega para `seguranca-config` e `node-runtime`. |
| `grill` | global do usuario | Apoio opcional da `spec` para sabatinar rascunho antes da aprovacao. |
| `ia-bootstrap` | global do usuario | Implanta, audita ou reconcilia a camada de governanca de IA/SDD local. |
| `appsec-auditor` | global do usuario | Apoio em revisao de seguranca de aplicacao (validacao de input, XSS, injection). Complementa `seguranca-config`, que cuida do lado runtime/config. |
| `incident-debugger` | global do usuario | Diagnostica falhas de runtime, logs, stack traces e regressoes em `Live/` ou `Liturgia/`. |

Nao crie `.agent.md`, `.prompt.md` ou arvores paralelas.
