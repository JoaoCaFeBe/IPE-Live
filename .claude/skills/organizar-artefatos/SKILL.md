---
name: organizar-artefatos
description: "Normaliza .project/artifacts (duraveis) e .temp (descartaveis) em IPE Live. Move evidencias, relatorios e tempor­arios para o lugar correto."
---

# Organizar Artefatos - IPE Live

Use quando aparecerem arquivos auxiliares na raiz (`.sql`, `.patch`, `.log`, relatorios `.md`, dumps), quando o usuario pedir "organizar artefatos", "limpar raiz" ou ao final de uma rodada de spec/diagnostico que gerou evidencias.

## Estrutura Alvo

- `.project/artifacts/`: evidencias **duraveis** que documentam decisao, diagnostico ou estado historico. Versionado.
- `.project/artifacts/{rodada-ou-tema}/`: agrupar por contexto (ex.: `ia-portabilidade/`, `spec-2026-05/`).
- `.temp/`: rascunhos **descartaveis**, dumps de debug, saidas brutas. Tem `.gitignore` proprio que ignora tudo exceto o proprio `.gitignore`.

## Guard

- Nao mover banco real (`Live/database/*.db`, `Liturgia/database/*.db`) para artefatos.
- Nao incluir `.env`, tokens ou chaves em `.project/artifacts/`; se aparecer, mover para `.temp/` e alertar rotacao.
- Nao remover artefato historico existente em `.project/artifacts/` sem aprovacao; preferir mover para subpasta `arquivado/`.
- Para arquivos ambiguos (gerado por IA, sem dono claro), perguntar antes de mover.

## Fluxo

1. Liste arquivos da raiz que nao deveriam estar la (qualquer `.sql`, `.patch`, `.log`, `.tmp`, `relatorio-*.md`, `output-*.txt`).
2. Para cada arquivo, classifique:
   - **duravel** -> `.project/artifacts/{contexto}/`
   - **descartavel** -> `.temp/` ou deletar com aprovacao
   - **sensivel** -> `.temp/` + recomendar rotacao
   - **ambiguo** -> registrar para decisao humana
3. Use `git mv` para itens versionados.
4. Crie `.temp/.gitignore` se ainda nao existir, com conteudo:
   ```
   *
   !.gitignore
   ```
5. Atualize `.project/artifacts/README.md` (se existir) com indice das pastas.

## Saida

- Movimentos aplicados: `<origem> -> <destino>` com classificacao.
- Pendencias: itens ambiguos ou que exigem aprovacao explicita.
