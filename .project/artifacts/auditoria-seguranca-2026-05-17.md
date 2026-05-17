# Auditoria de Seguranca — IPE Live

> **Data:** 2026-05-17
> **Modo:** baseline estatico (sem executar servidor)
> **Skill global usada:** `appsec-auditor` (via subagente)
> **Escopo:** `Live/server.js`, `Liturgia/server.js`, views EJS, JS de cliente, `package-lock.json`, configs de ambiente
> **Severidade geral:** **Critical** para `Liturgia/` (VPS publica na internet); **High** para `Live/` (rede interna da igreja); pasta atual e dev/testes (Google Drive)

## Topologia de Deploy

- **Pasta local (Google Drive):** dev/testes apenas. Nao e producao.
- **Liturgia/:** deploy em VPS publica → **acessivel da internet**. Modelo de ameaca = mundo aberto. SEC-005 (auth ausente), SEC-007 (CORS aberto), SEC-008 (sem validacao em POST) viram **Critical** aqui.
- **Live/:** deploy no servidor fisico da igreja → rede interna. Modelo de ameaca = LAN + visitantes. Severidade LAN se aplica. SEC-001 (Socket.IO broadcaster) continua Critical mesmo em LAN porque o publico de visitantes da igreja varia.

## Resumo Executivo

A aplicacao apresenta postura de seguranca fraca condizente com sistema interno de igreja sem autenticacao, mas executando em todas as interfaces (`0.0.0.0`) com superficie exposta. Nao ha autenticacao em nenhum endpoint, nao ha helmet/CSP/rate-limit, o `express-session` usa secret hardcoded, o CORS e totalmente aberto em `Liturgia` e o Socket.IO atua como **broadcaster cego** que ecoa qualquer payload de qualquer cliente para todos os outros — combinado com sinks de `innerHTML` no cliente, isso e XSS persistente trivial. Ha um path traversal real em `Live/server.js:73-87` (CULTOS_DIR), uma senha de WebSocket OBS injetada literalmente em JavaScript inline, dependencias com CVEs conhecidas e nenhuma validacao de schema em rotas POST.

## Achados por Severidade

### Critical

| ID | Titulo | Local | Status |
| --- | --- | --- | --- |
| SEC-001 | Socket.IO broadcaster cego (XSS persistente + injecao de comandos no front) | `Live/server.js:240-246`, `Live/public/js/Base.js:253-258` | **[Resolvido]** spec [2026-05-17-hardening-credenciais-canais](../specs/2026-05-17-hardening-credenciais-canais/) commit `41f029a` |

**Exploit (SEC-001):** Qualquer cliente que alcance a porta 3001 conecta no Socket.IO (sem auth) e emite payload com `<img onerror=...>`. O servidor faz `io.emit(empresa, funcao, args)` para todos os clientes (Painel, Projetor, Televisao, Legendas). Em `Base.js`, o conteudo cai em `.html()`/`innerHTML` sem sanitizacao — executa JS arbitrario em todas as telas.

**Fix sugerido:** Auth no `io.use((socket,next)=>{...})`; substituir `onAny` por handlers especificos com schema Zod/Joi; sanitizar com DOMPurify no cliente; restringir `cors.origin`.

### High

| ID | Titulo | Local | Status |
| --- | --- | --- | --- |
| SEC-002 | Path traversal em `/api/cultos/:arquivo` | `Live/server.js:73-87` | Aberto |
| SEC-003 | `express-session` secret hardcoded + cookie sem flags | `Live/server.js:40-46` | Aberto |
| SEC-004 | Senha OBS WebSocket renderizada cru em JS inline servido a anonimos | `Live/views/Audio.ejs:362-364` + `Live/server.js:26-28` | Aberto |
| SEC-005 | Nenhum endpoint autenticado; servidor escuta em `0.0.0.0` | `Live/server.js:248`, `Liturgia/server.js:800` | Aberto |
| SEC-006 | Dependencias com CVEs (`path-to-regexp`, `socket.io-parser`, `picomatch`, `brace-expansion`) | `Live/package-lock.json`, `Liturgia/package-lock.json` | Aberto |

**SEC-002:** `req.params.arquivo` vai direto para `path.join(cultosDir, arquivo)` sem `path.basename`. URL-encoded `..` resolve upward. Fix: `path.basename` + validacao regex ou `res.sendFile(safe, { root, dotfiles: 'deny' })`.

**SEC-003:** Secret `"ipe-live-secret-key-12345"` versionado. Cookie sem `httpOnly`/`sameSite`/`secure`. `saveUninitialized: true` cria sessao para qualquer visitante. Fix: `process.env.SESSION_SECRET` + cookie flags + `saveUninitialized: false` + store persistente.

**SEC-004:** `/Audio` nao tem auth. View embute `<%- obsWsPass %>` (output raw). Quem carregar `/Audio` baixa HTML com senha do OBS em texto plano. Fix: proxy server-side ou no minimo `<%= JSON.stringify(obsWsPass) %>` + auth.

**SEC-005:** Quem alcanca a porta controla controle de exibicao. `Liturgia` permite POST anonimo em `/dados/salvar-liturgia`. Fix: `express-basic-auth` ou login com sessao; bind em `127.0.0.1` ou IP interno.

**SEC-006:** `npm audit` lista ReDoS em `path-to-regexp <0.1.13`, DoS em `socket.io-parser 4.0.0-4.2.5`, ReDoS em `picomatch <2.3.2`, `brace-expansion`. Fix: `npm audit fix` em cada subprojeto + bump de `express`/`socket.io`.

### Medium

| ID | Titulo | Local | Status |
| --- | --- | --- | --- |
| SEC-007 | CORS totalmente aberto em Liturgia | `Liturgia/server.js:116` | Aberto |
| SEC-008 | Falta validacao em POSTs (prototype pollution / body sem limit) | `Liturgia/server.js:389-468` | Aberto |
| SEC-009 | Headers de seguranca ausentes (helmet/CSP/XFO/HSTS) | ambos `server.js` | Aberto |
| SEC-010 | Sem rate-limit / sem anti-DoS | ambos `server.js` | Aberto |
| SEC-011 | API key Vagalume hardcoded | `Liturgia/server.js:660,666` | **[Resolvido]** commit `7403ca5` |
| SEC-013 | XSS DOM-based no fluxo Liturgia → Painel | `Liturgia/public/js/capa.js:295,297,...` | **[Resolvido parcial]** Painel.js coberto (commit `41f029a`); `capa.js` ainda nao — spec propria |

**SEC-011:** API key `c1563d6845dc6623fe573ef39989d329` versionada. Acao: **tratar como queimada e rotacionar**. Mover para `process.env.VAGALUME_API_KEY`. Considerar `git filter-repo` se historico for sensivel.

### Low / Info

| ID | Titulo | Local |
| --- | --- | --- |
| SEC-012 | `e.message` cru ao cliente (vazamento) | `Live/server.js:124,183`; `Liturgia/server.js` varias linhas |
| SEC-014 | `/Chat.php` redirect estatico para YouTube | `Live/server.js:215-222` |
| SEC-015 | `getBibliaDb` confia em `req.session.biblia` (mitigado por `path.basename`) | `Live/server.js:51-59` |
| SEC-016 | `database/` deve estar em `ignore_watch` do PM2 | `Liturgia/ecosystem.config.js` |

## Mapeamento OWASP/CWE

- **A01 Broken Access Control:** SEC-001, SEC-002, SEC-005
- **A02 Cryptographic Failures:** SEC-003, SEC-004
- **A03 Injection (XSS):** SEC-001, SEC-013
- **A05 Security Misconfiguration:** SEC-003, SEC-007, SEC-009, SEC-012
- **A06 Vulnerable Components:** SEC-006
- **A07 Auth Failures:** SEC-001, SEC-005
- **A08 Software/Data Integrity:** SEC-008
- **A09 Logging/Monitoring:** lacuna geral (sem log estruturado)

## Recomendacoes Gerais (priorizadas)

1. `helmet` + CSP customizado em ambos os apps.
2. `express-rate-limit` em `/dados/*`, `/api/*`.
3. Auth basico para Painel/Audio/`/dados/*`.
4. Schema validation (Zod/Joi) em todas as rotas POST + `{ limit: '1mb' }` em body parsers.
5. DOMPurify no cliente antes de `innerHTML`; `escHtml` em todo output dinamico.
6. Auth middleware Socket.IO + handlers especificos com schema.
7. Secrets via env: `SESSION_SECRET`, `VAGALUME_API_KEY`, `OBS_WS_PASS` (nunca no HTML).
8. `npm audit fix` + pipeline CI com `npm audit --audit-level=high`.
9. Bind privado (`127.0.0.1`/IP interno) ou proxy reverso com TLS + auth.
10. Logger estruturado (`pino`) com `req-id`, trilha de auditoria de `cultos.sqlite`.
11. `app.disable('x-powered-by')`.
12. `saveUninitialized: false` + cookie flags.

## Pendencias

- Confirmar rotacao da chave Vagalume (SEC-011 — bloqueante para limpeza de credencial vazada).
- Auditar historico git: `git log -p --all -- Liturgia/server.js | grep -i apikey`.
- Decidir se Painel/Audio terao auth basica imediata ou aguardar feature de login.
- Acao em `package-lock.json` exige `npm install` (gate operacional — pedido explicito necessario).
