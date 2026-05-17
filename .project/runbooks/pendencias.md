# Pendencias

> Decisoes adiadas que precisam de aprovacao explicita para virar spec/acao.
> Cada item: contexto, motivo do adiamento, impacto e gatilho de reabertura.

## P-001 — Limpeza historico git da chave Vagalume

- **Data:** 2026-05-17
- **Origem:** SEC-011 (auditoria 2026-05-17) + spec [2026-05-17-hardening-credenciais-canais](../specs/2026-05-17-hardening-credenciais-canais/)
- **Contexto:** A chave `c1563d6845dc6623fe573ef39989d329` foi externalizada no commit `7403ca5` e sera revogada no painel Vagalume durante o deploy A.4.5. Apos revogacao, a string no historico git e inerte.
- **Acao adiada:** `git filter-repo` (ou equivalente) para remover a chave do historico de `Liturgia/server.js`.
- **Motivo do adiamento:** chave revogada perde valor de exploracao; limpeza vira cosmetica/conformidade. Reescrever historico afeta clones e PRs em aberto.
- **Impacto se nao fizermos:** auditores externos (ex.: scanner do GitHub Advanced Security) continuam flaggando o repo. Em repositorio publico, o nome da chave fica visivel mesmo apos revogacao.
- **Gatilho para reabrir:**
  - Auditoria externa apontar a chave como gap.
  - Repo virar publico (hoje e publico mas e codigo de igreja, baixa exposicao).
  - Politica de compliance interna exigir.
- **Acao se reaberto:** abrir spec curta `limpeza-historico-vagalume`, executar `git filter-repo --replace-text` ou `BFG`, force-push apos coordenar com colaboradores.

## P-002 — SEC-013 em `Liturgia/public/js/capa.js`

- **Data:** 2026-05-17
- **Origem:** auditoria 2026-05-17 (SEC-013, linhas 295/297/453/560/632/745/781/811/860/1143)
- **Contexto:** A spec atual cobriu SEC-013 apenas no Painel.js (Live). O `capa.js` da Liturgia tem o mesmo padrao de `innerHTML +=` com conteudo de letra/lyrics.
- **Acao adiada:** sanitizar todos os sinks em `capa.js` com DOMPurify (mesma allowlist usada em Live/Painel.js).
- **Motivo do adiamento:** spec inicial focou em encerrar o canal Socket.IO (Critical). `capa.js` opera dentro do dominio da Liturgia (VPS publica) e tem superficie de ataque diferente — merece spec propria com testes manuais.
- **Impacto se nao fizermos:** XSS via insercao de HTML malicioso em `cultos.sqlite`. O atacante precisaria de POST autenticado em `/dados/salvar-liturgia` (SEC-005 Aberto — auth ausente facilita).
- **Gatilho para reabrir:** apos SEC-005 (auth do Liturgia) ou imediatamente se houver pedido formal.
- **Acao se reaberto:** abrir spec `2026-MM-DD-hardening-liturgia-capa-js` reutilizando padrao DOMPurify ja estabelecido em Live/Painel.js.

## P-003 — SOCKET_SERVER 10.0.0.253:3000 — verificar uso real

- **Data:** 2026-05-17
- **Origem:** grill sabatina + Bloco B
- **Contexto:** `.env.example` do Live referencia `SOCKET_SERVER=10.0.0.253:3000`. A porta 3000 e historicamente a Liturgia, nao Socket.IO. Operador confirmou no Bloco B (B.0) que existe um servico em 10.0.0.253 como cliente Socket.IO.
- **Acao adiada:** auditar arquitetura: o que e o servico em 10.0.0.253? E um Socket.IO server alternativo (historico) ou cliente real? O `.env.example` esta com valor enganoso?
- **Impacto:** confusao operacional. Se 10.0.0.253:3000 nao for Socket.IO server, deixar no `.env.example` confunde proximos operadores.
- **Gatilho para reabrir:** ao revisar `.env.example` em proxima manutencao ou quando 10.0.0.253 mudar de IP.
