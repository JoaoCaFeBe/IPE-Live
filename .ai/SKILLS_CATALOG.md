# Skills Catalog

Fonte canonica: `.claude/skills/{nome}/SKILL.md`. `.codex/skills` e symlink de compatibilidade que aponta para `.claude/skills`.

## Skills Locais

| Skill | Caminho | Uso |
|---|---|---|
| `node-runtime` | `.claude/skills/node-runtime/SKILL.md` | Use para validacao e manutencao de Liturgia/Live Node. |
| `orquestrador` | `.claude/skills/orquestrador/SKILL.md` | Use para auditar wrappers, catalogo, symlinks, residuos e deltas da camada IA/Codex local. |
| `seguranca-config` | `.claude/skills/seguranca-config/SKILL.md` | Use para credenciais, configs, bancos, PM2, metadata, URLs e segredos. |

## Skills Globais Usadas

| Skill | Origem | Uso |
|---|---|---|
| `spec` | global do usuario | Use para PRD/spec, plano e tarefas antes de demandas sensiveis ou ambiguas. Roteamento Node-especifico (Socket.IO, PM2, `.env`, tokens, deploy, banco, integracoes externas) esta em `.ai/INSTRUCTIONS.md`, que tambem delega para `seguranca-config` e `node-runtime`. |
| `grill` | global do usuario | Apoio opcional da `spec` para sabatinar rascunho antes da aprovacao. |
| `ia-bootstrap` | global do usuario | Implanta, audita ou reconcilia a camada de governanca de IA/SDD local. |

Nao crie `.agent.md`, `.prompt.md` ou arvores paralelas.
