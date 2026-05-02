# IA Portabilidade - Rodada 4 - IPE Live

Data: 2026-05-02

## Decisao

- Modo: bootstrap com migracao de instrucoes antigas.
- Familia: `node-dual`
- Observacao: Duas apps Node: Liturgia publica e Live local, com sincronizacao obrigatoria entre pastas.

## Acoes

- AGENTS.md atualizado como wrapper fino
- CLAUDE.md criado como wrapper fino
- GEMINI.md criado como wrapper fino
- .github/copilot-instructions.md migrado para .ai/docs e reduzido a compatibilidade
- .gemini/GEMINI.md migrado para .ai/docs e reduzido a compatibilidade
- .ai/INSTRUCTIONS.md e .ai/SKILLS_CATALOG.md atualizados
- .codex/skills criadas: node-runtime, orquestrador, seguranca-config
- criado symlink `/Users/joaocfb/Library/CloudStorage/GoogleDrive-joaocfb@gmail.com/Meu Drive/Desenvol/nodejs/IPE Live/.agents` -> `.codex`
- criado symlink `/Users/joaocfb/Library/CloudStorage/GoogleDrive-joaocfb@gmail.com/Meu Drive/Desenvol/nodejs/IPE Live/.claude/skills` -> `../.codex/skills`

## Chaves Sensiveis Por Nome

- Nenhuma chave obvia detectada pelo scan textual.

## Nao Executado

- Sem deploy.
- Sem banco.
- Sem PM2.
- Sem npm/composer install.
- Sem commit/push.
