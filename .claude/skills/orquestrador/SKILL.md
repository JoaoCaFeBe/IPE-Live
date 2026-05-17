---
name: orquestrador
description: "Use para organizar, auditar e reconciliar a camada IA/Codex local deste projeto standalone."
---

# Orquestrador IA - IPE Live

## Auditoria

1. Conferir `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`.
2. Conferir `.ai/AI_BOOTSTRAP.md`, `.ai/INSTRUCTIONS.md`, `.ai/SKILLS_CATALOG.md`.
3. Conferir catalogo contra `.claude/skills/*/SKILL.md` (fonte canonica).
4. Conferir symlinks: `.agents -> .codex` e `.codex/skills -> ../.claude/skills`.
5. Procurar residuos: `.github/copilot-instructions.md`, `.github/instructions`, `.github/prompts`, `.github/agents`, `.claude/agents`, `.claude/commands`, `*.agent.md`, `*.prompt.md`. Conteudo legado ja migrado vive em `.ai/docs/`; nao recriar.
6. Classificar residuos como compatibilidade, util migrado, obsoleto ou sensivel.

Nao portar `template-sync`, `template-guardian`, Core Protegido ou multi-tenant do Base.Laravel.
