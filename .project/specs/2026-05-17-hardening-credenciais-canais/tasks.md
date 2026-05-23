# Tarefas — Hardening de Credenciais e Canais

> Pre-requisito: `prd.md` e `plan.md` aprovados (versao revisada pos-grill 2026-05-17).
> Cada bloco abaixo tem aprovacao propria. Pode ser deployado independentemente.

## Bloco A — SEC-011 (Vagalume, tatico, ~30 min de codigo)

### A.1 Preparacao

- [ ] **A.1.1** Confirmar com operador: nova chave Vagalume ja foi gerada? Anotar (apenas confirmacao, nao colar valor aqui).
- [ ] **A.1.2** Conferir `.gitignore` na raiz e em `Liturgia/`: `Liturgia/.env` esta ignorado?
- [ ] **A.1.3** Verificar se `Liturgia/.env.example` existe; criar se nao existir.

### A.2 Implementacao

- [ ] **A.2.1** Em `Liturgia/server.js`, adicionar perto do topo:
  ```js
  const VAGALUME_API_KEY = process.env.VAGALUME_API_KEY;
  if (!VAGALUME_API_KEY) console.warn("[vagalume] VAGALUME_API_KEY ausente — rotas /api/vagalume/* responderao 503");
  ```

- [ ] **A.2.2** Em `vagalumeGet` (linha ~646), receber a chave ou retornar 503 quando ausente. Substituir as URLs literais nas rotas `:660` e `:666` por interpolacao com `VAGALUME_API_KEY`.
- [ ] **A.2.3** Atualizar `Liturgia/.env.example` adicionando `VAGALUME_API_KEY=`.

### A.3 Validacao local

- [ ] **A.3.1** `node --check Liturgia/server.js` retorna sem erro.
- [ ] **A.3.2** `grep -n c1563d6845dc6623fe573ef39989d329 Liturgia/server.js` retorna 0.
- [ ] **A.3.3** Subir Liturgia local sem `VAGALUME_API_KEY` no `.env`: `curl 'http://localhost:3000/api/vagalume/buscar?q=teste'` → HTTP 503.
- [ ] **A.3.4** Subir Liturgia local com `VAGALUME_API_KEY` (chave de testes): `curl 'http://localhost:3000/api/vagalume/buscar?q=teste'` → HTTP 200 com JSON da Vagalume.

### A.4 Deploy SEC-011

- [ ] **A.4.1** Commit + PR isolado para SEC-011. Titulo: `fix(security): externalize Vagalume API key (SEC-011)`.
- [ ] **A.4.2** Apos merge: operador configura `VAGALUME_API_KEY` no `.env` da VPS.
- [ ] **A.4.3** Operador restarta processo PM2 da Liturgia: `pm2 restart ipe-liturgia` (ou nome real do processo).
- [ ] **A.4.4** Smoke producao: acessar uma busca real via Painel da Live e confirmar funcionamento.
- [ ] **A.4.5** Revogar chave antiga no painel Vagalume.
- [ ] **A.4.6** Registrar conclusao em `.project/artifacts/sec-011-rotacao-vagalume-{data}.md` (resumo, sem incluir valores de chave).

## Bloco B — SEC-001 + SEC-013 (Live, arquitetural, ~3-5h codigo + testes manuais)

### B.0 Catalogacao de clientes externos (novo, do grill)

- [ ] **B.0.1** Perguntar ao operador: existem clientes Socket.IO fora destas 3 entradas internas (`Base.js`, `Painel.js`, `Biblia.js`)?
  - Mobile/tablet com app proprio?
  - OBS plugin que conecta via Socket.IO?
  - Scripts externos (cron, automacao)?
  - Servico externo no IP `10.0.0.253` (referencia em `.env.example`)?
- [ ] **B.0.2** Para cada cliente externo identificado, listar e providenciar token proprio em B.5.

### B.1 Catalogacao de eventos Socket.IO

- [ ] **B.1.1** Rascunho ja feito no grill — catalogo inicial:
  ```text
  Eventos emitidos pelos clientes:
  - passagem        (Biblia.js:11, payload: { tipo, titulo, corpo })
  - obsSceneChanged (Base.js:283, payload: string)
  - Alerta          (Painel.js:74, payload: string)
  - fecharJanela    (Painel.js:300)
  - fecharBiblia    (Painel.js:459)
  - hino|coral|louvor (Painel.js:355,368,381,394 — dinamico via attr("tipo"))
  ```

- [ ] **B.1.2** Documentar em `.project/artifacts/socket-events-2026-05-17.md` o catalogo final apos validacao com operador.
- [ ] **B.1.3** Validar com operador se o catalogo bate com fluxo real do culto.

### B.2 Server-side auth + handlers especificos + bypass quente

- [ ] **B.2.1** Em `Live/.env.example`, adicionar:
  ```text
  SOCKET_TOKEN=
  SOCKET_AUTH_GRACE_UNTIL=2026-05-31T23:59:59-03:00
  SOCKET_SCHEMA_MODE=warn
  SOCKET_AUTH_BYPASS_FILE=/tmp/ipe-bypass-auth
  ```
  (Grace period de 14 dias — ajuste do grill #3)
- [ ] **B.2.2** Em `Live/server.js`, ler as 4 variaveis e expor `SOCKET_TOKEN` em `app.locals.SOCKET_TOKEN`.
- [ ] **B.2.3** Implementar `io.use((socket, next) => { ... })`:
  1. Check de bypass file (com cache TTL 1-2s para reduzir IO).
  2. Validacao do token contra `SOCKET_TOKEN`.
  3. Grace period: se hoje < `SOCKET_AUTH_GRACE_UNTIL`, autorizar com warn.
  4. Fora de tudo: `next(new Error('auth_required'))`.
- [ ] **B.2.4** Substituir `socket.onAny` por handlers especificos para cada evento da **allowlist explicita**: `["passagem", "Alerta", "fecharJanela", "fecharBiblia", "obsSceneChanged", "hino", "coral", "louvor"]`. Eventos fora da allowlist sao descartados com warn.
- [ ] **B.2.5** Cada handler valida schema minimo antes de fazer `io.emit`:
  - `passagem`/`hino`/`coral`/`louvor`: `args` deve ser objeto com `tipo`, `titulo`, `corpo` (todas strings).
  - `Alerta`/`obsSceneChanged`: `args` deve ser string.
  - `fecharJanela`/`fecharBiblia`: sem `args`.
- [ ] **B.2.6** Adicionar handler `socket.on('disconnect', (reason) => console.log(...))` para observabilidade.
- [ ] **B.2.7** Embrulhar handlers em `try/catch` com `console.error`.

### B.3 Client-side sanitization (Base.js — SEC-001 lado Projetor)

- [ ] **B.3.0** Verificar tags reais usadas (ja feito no grill): `<span>`, `<br>`, `<strong>` + `style` (color, font-weight) + `class` (`sep-par`).
- [ ] **B.3.1** Baixar DOMPurify standalone (versao estavel mais recente, `purify.min.js`) para `Live/public/Bibliotecas/dompurify.min.js`.
- [ ] **B.3.2** Em `Live/views/includes/bibliotecas.ejs`, adicionar `<script src="/Bibliotecas/dompurify.min.js"></script>` e:
  ```html
  <script>window.SOCKET_TOKEN = "<%= SOCKET_TOKEN || '' %>";</script>
  ```

- [ ] **B.3.3** Em `Live/public/js/Base.js:21` (e `Biblia.js:5`, `Painel.js:7`), na inicializacao do Socket.IO, passar `auth: { token: window.SOCKET_TOKEN }` no `io(url, { auth: { ... } })`.
- [ ] **B.3.4** Definir constante de allowlist no topo do `Base.js`:
  ```js
  const SANITIZE_CONFIG = {
    ALLOWED_TAGS: ['span', 'br', 'strong'],
    ALLOWED_ATTR: ['style', 'class']
  };
  ```

- [ ] **B.3.5** Em `Base.js:253`, sanitizar `conteudo.titulo` antes do `.html(...)`.
- [ ] **B.3.6** Em `Base.js:256` e `:258`, sanitizar `conteudo.corpo` antes da atribuicao DOM e antes do retorno de `agruparLinhasEmPares`.

### B.4 Client-side sanitization (Painel.js — SEC-013, novo)

- [ ] **B.4.1** Definir constante de allowlist no topo do `Painel.js`:
  ```js
  const SANITIZE_TITULO = { ALLOWED_TAGS: [] };  // titulo nunca tem HTML
  const SANITIZE_TEXTO = { ALLOWED_TAGS: ['span', 'br', 'strong', 'i'], ALLOWED_ATTR: ['style', 'class'] };
  ```

- [ ] **B.4.2** Em `Painel.js:92-110, 153-170, 208-225` (linhas dos accordion items), sanitizar `definicao.titulo` antes da interpolacao no template literal.
- [ ] **B.4.3** Em `Painel.js:137, 197, 252` (radio buttons), sanitizar `definicao.titulo`, `slide.texto` e `letraTag` antes da interpolacao.
- [ ] **B.4.4** Confirmar que `encodeURIComponent(textoCorpo)` continua sendo aplicado em `corpo=...` para preservar comportamento de transporte; sanitizacao e adicional, nao substitui.

### B.5 Validacao local SEC-001 + SEC-013

- [ ] **B.5.1** `node --check Live/server.js && node --check Live/public/js/Base.js && node --check Live/public/js/Painel.js && node --check Live/public/js/Biblia.js`.
- [ ] **B.5.2** Subir Live local e abrir 2 abas: `/Painel` e `/Projetor`. Emitir um versiculo com `{st}palavra{/st}` e confirmar exibicao amarela.
- [ ] **B.5.3** Emitir louvor com cantor `<strong>` e quebras `<br/>` — confirmar renderizacao identica ao atual.
- [ ] **B.5.4** Em DevTools do Projetor, abrir console e tentar `io("http://localhost:3001")` sem token: confirmar disconnect com motivo `auth_required` (fora do grace period) ou warn no log do servidor (dentro do grace).
- [ ] **B.5.5** Pelo Painel, emitir `{ tipo: 'passagem', titulo: '<img src=x onerror=alert(1)>', corpo: 'teste' }` e confirmar que `<img>` aparece como texto literal e nao dispara alert.
- [ ] **B.5.6** **SEC-013:** salvar liturgia no Liturgia local com `definicao.titulo = "<img src=x onerror=alert(1)>"` em algum item, abrir Painel e confirmar texto literal no accordion.
- [ ] **B.5.7** **Bypass quente:** com token configurado, parar de enviar token e tentar conectar (deve falhar); `touch /tmp/ipe-bypass-auth` (deve passar em ate 2s); `rm /tmp/ipe-bypass-auth` (deve voltar a falhar).
- [ ] **B.5.8** Eventos fora da allowlist: emitir `socket.emit('IPE.Transmissão', 'evento_inexistente', {})` — confirmar descarte com warn.

### B.6 Deploy SEC-001 + SEC-013

- [ ] **B.6.1** Commit + PR isolado para SEC-001+SEC-013. Titulo: `fix(security): authenticate Socket.IO + sanitize DOM in Live (SEC-001, SEC-013)`.
- [ ] **B.6.2** Apos merge: operador gera `SOCKET_TOKEN` no servidor da igreja com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
- [ ] **B.6.3** Operador configura as 4 variaveis em `Live/.env` do servidor da igreja.
- [ ] **B.6.4** Operador restarta processo PM2 do Live: `pm2 restart ipe-live`.
- [ ] **B.6.5** Smoke producao: operador testa Painel + Projetor + Televisao + Legendas com 1 versiculo real + 1 hino.
- [ ] **B.6.6** Monitorar log do PM2 por 14 dias: contar warnings de payload invalido, eventos fora da allowlist, conexoes sem token.

### B.7 Pos grace period (D+14)

- [ ] **B.7.1** Revisar log dos 14 dias (2 cultos): validar que nenhum cliente legitimo conecta sem token e nenhum evento legitimo foi descartado.
- [ ] **B.7.2** Atualizar `Live/.env` removendo `SOCKET_AUTH_GRACE_UNTIL` ou colocando data passada.
- [ ] **B.7.3** Mudar `SOCKET_SCHEMA_MODE` para `enforce`.
- [ ] **B.7.4** Restart Live.
- [ ] **B.7.5** Registrar conclusao em `.project/artifacts/sec-001-sec-013-socket-auth-{data-conclusao}.md`.

## Bloco C — Encerramento

- [ ] **C.1** Atualizar `.project/artifacts/auditoria-seguranca-2026-05-17.md` marcando SEC-001, SEC-011 e SEC-013 como `[Resolvido]` com link para esta spec.
- [ ] **C.2** Registrar em `.project/runbooks/pendencias.md` a pendencia "limpeza historico git da Vagalume" (cosmetica, baixa prioridade).
- [ ] **C.3** Criar `.project/runbooks/incidente-socket-auth.md` com procedimento de bypass quente para uso emergencial durante culto.
- [ ] **C.4** Criar `.project/runbooks/deploy-env.md` com passos para configurar `.env` na VPS (Liturgia) e no servidor da igreja (Live).

## Aprovacoes Necessarias

- [ ] **Aprovacao A** (gate Vagalume): liberar Bloco A para implementacao apos confirmacao de RS-3 (sequencia rotacao).
- [ ] **Aprovacao B** (gate Socket.IO + Painel): liberar Bloco B para implementacao apos catalogo B.1.2 validado e B.0 respondido.
- [ ] **Aprovacao deploy A**: liberar deploy SEC-011 na VPS.
- [ ] **Aprovacao deploy B**: liberar deploy SEC-001+SEC-013 no servidor da igreja (preferencialmente entre cultos).
- [ ] **Aprovacao pos-grace**: liberar virada para `enforce` apos D+14.

## Evidencias Esperadas

- `.project/artifacts/socket-events-2026-05-17.md` (catalogo de eventos validado)
- `.project/artifacts/sec-011-rotacao-vagalume-{data}.md` (conclusao Bloco A)
- `.project/artifacts/sec-001-sec-013-socket-auth-{data}.md` (conclusao Bloco B)
- Audit `.project/artifacts/auditoria-seguranca-2026-05-17.md` atualizado com `[Resolvido]`
- Runbook `.project/runbooks/incidente-socket-auth.md`
- Runbook `.project/runbooks/deploy-env.md`
