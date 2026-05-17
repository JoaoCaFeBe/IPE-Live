# Pendencias

> Decisoes adiadas que precisam de aprovacao explicita para virar spec/acao.
> Cada item: contexto, motivo do adiamento, impacto e gatilho de reabertura.
>
> **Ultima reconciliacao:** 2026-05-17 — estado verificado contra repo (commits `7403ca5`, `5b4cb43`, `41f029a`), `Liturgia/public/js/capa.js`, `Live/.env.example` e `.project/specs/2026-05-17-hardening-credenciais-canais/tasks.md`.

## P-001 — Limpeza historico git da chave Vagalume

- **Data:** 2026-05-17
- **Ultima verificacao:** 2026-05-17
- **Origem:** SEC-011 (auditoria 2026-05-17) + spec [2026-05-17-hardening-credenciais-canais](../specs/2026-05-17-hardening-credenciais-canais/)
- **Contexto:** A chave `c1563d6845dc6623fe573ef39989d329` foi externalizada no commit `7403ca5` (`fix(security): externalize Vagalume API key (SEC-011)`). A revogacao no painel Vagalume esta planejada na task `A.4.5` da spec, ainda `[ ]` em `tasks.md`. Enquanto A.4.5 nao for executada, a chave permanece tecnicamente valida no historico; apos revogacao, a string passa a ser inerte.
- **Acao adiada:** `git filter-repo` (ou equivalente) para remover a chave do historico de `Liturgia/server.js`.
- **Motivo do adiamento:** chave revogada perde valor de exploracao; limpeza vira cosmetica/conformidade. Reescrever historico afeta clones e PRs em aberto.
- **Impacto se nao fizermos:** auditores externos (ex.: scanner do GitHub Advanced Security) continuam flaggando o repo. Em repositorio publico, o nome da chave fica visivel mesmo apos revogacao.
- **Pre-requisito:** A.4.5 concluida (revogacao efetiva no painel Vagalume). Limpar historico antes da revogacao nao reduz risco — a chave continuaria valida em qualquer clone existente.
- **Gatilho para reabrir:**
  - Auditoria externa apontar a chave como gap.
  - Repo virar publico com exposicao alta (hoje e codigo de igreja, baixa exposicao).
  - Politica de compliance interna exigir.
- **Acao se reaberto:** abrir spec curta `limpeza-historico-vagalume`, executar `git filter-repo --replace-text` ou `BFG`, force-push apos coordenar com colaboradores.

## P-002 — SEC-013 em `Liturgia/public/js/capa.js`

- **Data:** 2026-05-17
- **Ultima verificacao:** 2026-05-17 (linhas confirmadas via `grep -n innerHTML Liturgia/public/js/capa.js`)
- **Origem:** auditoria 2026-05-17 (SEC-013, linhas 295/297/453/560/632/745/781/811/860/1143)
- **Contexto:** A spec atual cobriu SEC-013 apenas em `Live/public/js/Painel.js` (commit `41f029a`). O `capa.js` da Liturgia tem o mesmo padrao de `innerHTML +=` com conteudo de letra/lyrics — 10 sinks confirmados nas linhas acima. Sinks com conteudo controlado (titulo/icone — linhas 286/444/468/550/744/771) ficam fora do escopo desta pendencia.
- **Acao adiada:** sanitizar todos os sinks em `capa.js` com DOMPurify (mesma allowlist usada em Live/Painel.js).
- **Motivo do adiamento:** spec inicial focou em encerrar o canal Socket.IO (Critical). `capa.js` opera dentro do dominio da Liturgia (VPS publica) e tem superficie de ataque diferente — merece spec propria com testes manuais.
- **Impacto se nao fizermos:** XSS via insercao de HTML malicioso em `cultos.sqlite`. O atacante precisaria de POST autenticado em `/dados/salvar-liturgia` (SEC-005 Aberto — auth ausente facilita).
- **Dependencia cruzada:** [[P-001]] (rotacao Vagalume) nao bloqueia, mas SEC-005 (auth Liturgia) bloqueia parcialmente — sem auth, a sanitizacao client-side e mitigacao incompleta.
- **Gatilho para reabrir:** apos SEC-005 (auth do Liturgia) ou imediatamente se houver pedido formal.
- **Acao se reaberto:** abrir spec `2026-MM-DD-hardening-liturgia-capa-js` reutilizando padrao DOMPurify ja estabelecido em Live/Painel.js.

## P-003 — SOCKET_SERVER 10.0.0.253:3000 — auditar arquitetura e redacao do .env

- **Data:** 2026-05-17
- **Ultima verificacao:** 2026-05-17 (confirmado em `Live/.env.example`; comentario de `SOCKET_TOKEN` ja cita "servico em 10.0.0.253" como cliente)
- **Origem:** grill sabatina + Bloco B (B.0)
- **Contexto:** `Live/.env.example` mantem `SOCKET_SERVER=10.0.0.253:3000`. A porta 3000 e historicamente a Liturgia, nao Socket.IO server. O Bloco B.0 ja confirmou que 10.0.0.253 atua como **cliente** Socket.IO (e nao server alternativo) — inclusive o proprio comentario de `SOCKET_TOKEN` no `.env.example` lista "servico em 10.0.0.253" entre os 3 clientes externos. Resta auditar o que esse cliente faz funcionalmente e se a chave `SOCKET_SERVER` esta com nome enganoso (sugere endereco de server, mas guarda endereco de cliente).
- **Acao adiada:** (a) documentar funcao do servico em 10.0.0.253; (b) decidir se renomeia `SOCKET_SERVER` para algo como `SOCKET_CLIENT_PEER` ou se remove do `.env.example` (caso seja consumido apenas por logica legada).
- **Impacto:** confusao operacional. Nome `SOCKET_SERVER` apontando para cliente faz proximos operadores tentarem apontar o Live para 10.0.0.253:3000 como server e perderem tempo debugando "conexao recusada".
- **Gatilho para reabrir:** ao revisar `.env.example` em proxima manutencao, quando 10.0.0.253 mudar de IP, ou ao migrar o cliente em 10.0.0.253 para outro host.
- **Acao se reaberto:** `grep -rn SOCKET_SERVER Live/` para mapear consumidores reais antes de renomear; atualizar `.env.example` + `Live/.env` em prod com nome semantico correto.
