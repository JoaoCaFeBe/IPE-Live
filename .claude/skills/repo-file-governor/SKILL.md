---
name: repo-file-governor
description: "Decide destino correto de novos arquivos em IPE Live entre Live/, Liturgia/, .project/, .artifacts/ e .ai/docs/. Evita poluicao da raiz."
---

# Repo File Governor - IPE Live

Use quando o usuario perguntar onde salvar um arquivo, quando aparecerem arquivos soltos na raiz (`.sql`, `.patch`, `.log`, `.md` avulso, relatorio), ou antes de criar artefatos novos.

## Mapa Canonico

| Tipo de conteudo | Destino correto |
|---|---|
| Codigo runtime de projecao ao vivo | `Live/` (Express + Socket.IO + EJS + SQLite) |
| Codigo runtime de liturgia publica | `Liturgia/` (Express + SQLite) |
| Regras globais da IA | `.ai/AI_BOOTSTRAP.md`, `.ai/INSTRUCTIONS.md`, `.ai/SKILLS_CATALOG.md` |
| Docs migradas de IA (legado, copilot, gemini antigo) | `.ai/docs/` |
| Skills locais | `.claude/skills/{nome}/SKILL.md` (fonte canonica; `.codex/skills` e symlink) |
| Contexto, runbooks, especificacoes do projeto | `.project/docs/`, `.project/runbooks/`, `.project/specs/` |
| Evidencias duraveis (relatorios, dumps, screenshots aprovados) | `.project/artifacts/` |
| Temporarios descartaveis (rascunhos, dumps de debug) | `.temp/` (criar com `.gitignore` proprio se nao existir) |
| Wrappers de harness | `AGENTS.md`, `CLAUDE.md`, `GEMINI.md` (finos, sem regra paralela) |

## Guard

- Nao criar `*.agent.md`, `*.prompt.md`, `.github/prompts/`, `.github/agents/`, `.claude/agents/` ou `.claude/commands/` como fonte nova.
- Nao mover arquivo sem listar o caminho antigo, o novo e o motivo.
- Arquivo com segredo nunca vai para `.project/artifacts/` versionado; vai para `.temp/` ou e descartado, com aviso de rotacao.
- Nao salvar nada dentro de `Live/database/` ou `Liturgia/database/` que nao seja o banco real.

## Fluxo

1. Identifique o tipo do arquivo e o autor (humano vs gerado por IA).
2. Consulte o mapa acima; se houver duvida, pergunte.
3. Aplique movimento via `git mv` quando o arquivo ja esta versionado.
4. Atualize referencias diretas se algum doc ou skill apontava para o caminho antigo.

## Saida

- Lista de movimentos propostos: `<origem> -> <destino>` com motivo.
- Lacunas: arquivos ambiguos onde o usuario precisa decidir.
