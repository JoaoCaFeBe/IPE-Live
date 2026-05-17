---
name: orquestrador
description: "Use para organizar, auditar e reconciliar a camada IA/Codex local deste projeto standalone."
---

# Orquestrador IA - IPE Live

## Auditoria

1. Conferir `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`.
2. Conferir `.ai/AI_BOOTSTRAP.md`, `.ai/INSTRUCTIONS.md`, `.ai/SKILLS_CATALOG.md`.
3. Conferir catalogo contra `.codex/skills/*/SKILL.md`.
4. Conferir `.agents -> .codex` e `.claude/skills -> ../.codex/skills`.
5. Procurar residuos: `.github/copilot-instructions.md`, `.github/instructions`, `.gemini/GEMINI.md`, `*.agent.md`, `*.prompt.md`.
6. Classificar residuos como compatibilidade, util migrado, obsoleto ou sensivel.

Nao portar `template-sync`, `template-guardian`, Core Protegido ou multi-tenant do Base.Laravel.
