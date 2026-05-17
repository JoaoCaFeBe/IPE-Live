# Plano Tecnico — Hardening de Credenciais e Canais

> Acompanha `prd.md` (revisado apos grill 2026-05-17).
> Le tambem `.project/artifacts/auditoria-seguranca-2026-05-17.md`.

## Decisao Tecnica

**Uma spec, dois blocos independentes** — Bloco A (SEC-011, Liturgia/VPS) e Bloco B (SEC-001+SEC-013, Live/LAN). Os dois blocos compartilham o tema "credenciais e canais" e foram diagnosticados juntos, mas sao desacoplados em codigo, deploy e teste. Empacotar em uma spec preserva a narrativa de hardening; separar em `tasks.md` permite mergear SEC-011 antes (rapido, tatico) sem segurar SEC-001+SEC-013 (arquitetural, exige testes manuais de projecao).

A spec foi ampliada (Opcao B do grill) para incluir SEC-013 (XSS DOM-based no fluxo Liturgia → Painel) porque sem isso o canal Socket.IO ficaria fechado mas o vetor de injecao continuaria aberto via dados do culto salvos na Liturgia publica.

## Abordagem

### Bloco A — SEC-011: Rotacao e externalizacao da chave Vagalume

- Mover a chave de literal de URL para `process.env.VAGALUME_API_KEY`.
- Centralizar o uso em uma constante no topo do `Liturgia/server.js` (`const VAGALUME_API_KEY = process.env.VAGALUME_API_KEY;`).
- Adicionar guard no `vagalumeGet`: se a chave nao existir, devolver `503 { error: "Vagalume desabilitado: API key ausente" }`.
- Atualizar `.env.example` da Liturgia com `VAGALUME_API_KEY=` (vazio).
- Sequencia operacional (registrada em `tasks.md`):
  1. Gerar nova chave no painel Vagalume.
  2. Mergear PR com codigo lendo `process.env`.
  3. Configurar `Liturgia/.env` na VPS com chave nova.
  4. Restart do processo PM2 da Liturgia.
  5. Revogar chave antiga.

### Bloco B — SEC-001 + SEC-013: Autenticacao, validacao e sanitizacao

Quatro camadas em defesa em profundidade:

#### Camada 1 — Auth de conexao Socket.IO (`Live/server.js`)

- Adicionar `const SOCKET_TOKEN = process.env.SOCKET_TOKEN;` no topo, ler do `.env`.
- Adicionar `const BYPASS_FILE = process.env.SOCKET_AUTH_BYPASS_FILE || "/tmp/ipe-bypass-auth";`.
- Expor o token nas views via `app.locals.SOCKET_TOKEN = SOCKET_TOKEN;`.
- Implementar `io.use((socket, next) => { ... })` que:
  1. Verifica `fs.existsSync(BYPASS_FILE)` com cache de 1-2s (TTL para reduzir IO): se existir, autoriza com log de warn.
  2. Caso contrario, valida `socket.handshake.auth.token === SOCKET_TOKEN`.
  3. Se invalido e fora do grace period, `next(new Error('auth_required'))`.
- Grace period: variavel `SOCKET_AUTH_GRACE_UNTIL` (data ISO) lida do `.env`. Se hoje < data, autorizar conexao sem token mas logar `console.warn` com IP do cliente.
- Periodo: **14 dias** (2 cultos observados) — ajuste do grill.

#### Camada 2 — Validacao de schema do payload (`Live/server.js`)

- Catalogar primeiro (tarefa B.1): rodar grep + leitura manual em `Live/views/*.ejs` e `Live/public/js/*.js`. Atencao especial a emissoes dinamicas no `Painel.js:355,368,381,394` onde o nome do evento vem de `attr("tipo")`.
- **Allowlist explicita de eventos** (do grep ja feito no grill):
  ```text
  ALLOWED_EVENTS = ["passagem", "Alerta", "fecharJanela", "fecharBiblia", "obsSceneChanged", "hino", "coral", "louvor"]
  ```

- Schema minimo por evento:
  - `passagem`, `hino`, `coral`, `louvor`: `{ tipo: string, titulo: string, corpo: string }`
  - `Alerta`: `string`
  - `fecharJanela`, `fecharBiblia`: sem payload
  - `obsSceneChanged`: `string` (nome da cena)
- Validar com funcao manual (sem dependencia nova, schema pequeno).
- Modo controlado por `SOCKET_SCHEMA_MODE` (`warn` ou `enforce`), default `warn` ate fim do grace period.
- Substituir o `socket.onAny` cego por handlers especificos: `socket.on(evento, handler)` para cada evento da allowlist. Eventos fora da allowlist sao descartados com `console.warn`.

#### Camada 3 — Sanitizacao no Projetor/Televisao/Legendas (`Live/public/js/Base.js`)

- Adicionar DOMPurify (arquivo local em `Live/public/Bibliotecas/dompurify.min.js`).
- **Allowlist baseada no codigo real** (lido durante o grill):
  - Tags: `span`, `br`, `strong`
  - Atributos: `style`, `class`
  - `agruparLinhasEmPares` produz `<br/>`, `<strong>`, `<span class="sep-par">` — todos precisam estar na allowlist.
  - O `{st}...{/st}` decodificado vira `<span style="color: #ffc107 !important; font-weight: bold;">` — precisa permitir `style` em `span`.
- Sanitizar `conteudo.titulo` antes do `$(...titulo).html(...)` em `Base.js:253`.
- Sanitizar `conteudo.corpo` antes da atribuicao DOM em `Base.js:256` e antes do retorno de `agruparLinhasEmPares` em `Base.js:258`.

#### Camada 4 — Sanitizacao no Painel (`Live/public/js/Painel.js`)

- O Painel constroi accordion com `$.append` usando templates literais que interpolam dados do Liturgia (`definicao.titulo`, `slide.texto`, `letraTag`).
- **Sanitizar os valores individuais antes da interpolacao**, nao o template inteiro:
  ```js
  const tituloSafe = DOMPurify.sanitize(definicao.titulo, { ALLOWED_TAGS: [] });
  const textoSafe = DOMPurify.sanitize(slide.texto, { ALLOWED_TAGS: ["span", "br", "strong", "i"] });
  ```

- Pontos a sanitizar em `Painel.js`: linhas 92-110 (hino), 153-170 (coral), 208-225 (louvor), 137, 197, 252 (radio buttons com `titulo` e `corpo`).
- **Nao alterar** a estrutura do accordion (`<input>`, `<label>`, `<button>` ficam como estao — sao template do Painel, nao dados externos).

#### Restricao adicional de CORS

- O CORS de origin do Socket.IO em `Live/server.js:227-238` ja tem whitelist. Confirmar que `https://ipe.live.test` e `http://transmissao` ainda fazem sentido; remover entradas obsoletas se houver.

## Arquivos Provaveis

### Bloco A (SEC-011)

- `Liturgia/server.js:644-667` — `vagalumeGet`, `/api/vagalume/buscar`, `/api/vagalume/letra`.
- `Liturgia/.env.example` — criar/atualizar com `VAGALUME_API_KEY=`.
- `Liturgia/.env` — adicionar `VAGALUME_API_KEY=<chave-nova>` no servidor (nao versionado).
- `Liturgia/README.md` (se existir) — documentar variavel.

### Bloco B (SEC-001 + SEC-013)

- `Live/server.js:1-50, 227-246` — leitura de env, app.locals, `io.use`, handlers especificos, bypass quente.
- `Live/.env` e `Live/.env.example` — adicionar `SOCKET_TOKEN=`, `SOCKET_AUTH_GRACE_UNTIL=`, `SOCKET_SCHEMA_MODE=warn`, `SOCKET_AUTH_BYPASS_FILE=/tmp/ipe-bypass-auth`.
- `Live/views/includes/bibliotecas.ejs` — injetar token + DOMPurify local.
- `Live/views/*.ejs` (verificacao): 6 das 7 ja incluem `bibliotecas.ejs`; `Audio.ejs` nao precisa (nao usa Socket.IO).
- `Live/public/js/Base.js:69, 240-266` — sanitizacao DOMPurify; pegar token de `window.SOCKET_TOKEN` na conexao Socket.IO.
- `Live/public/js/Painel.js:92-252` — sanitizacao DOMPurify nos campos vindos do Liturgia.
- `Live/public/js/Biblia.js:5,11` — token na conexao Socket.IO.
- `Live/public/Bibliotecas/dompurify.min.js` — adicionar (preferencia por local versus CDN externo para projetor sem internet).

## Contratos Afetados

- Cliente Socket.IO → servidor: ganha campo `auth.token` no handshake. Quem usa Socket.IO direto sem token quebra apos o grace period.
- Servidor → cliente Socket.IO: continua emitindo `(empresa, funcao, args)` igual a hoje. Schema interno de `args` validado mas formato externo nao muda.
- API Vagalume (interna): rota `/api/vagalume/*` pode retornar 503 alem dos atuais 200/400/502. Cliente deve tratar.
- `app.locals` ganha `SOCKET_TOKEN` (string). Views ja consomem `app.locals.*` via `<%= %>`.
- Arquivo sentinela `/tmp/ipe-bypass-auth` vira contrato operacional documentado em runbook.

## Dados / Migracao

- Nenhuma migracao SQLite envolvida.
- Nenhuma alteracao de schema de banco.
- Apenas configuracao de ambiente.

## Seguranca

- `SOCKET_TOKEN` gerado com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Comprimento minimo: 32 bytes hex.
- `VAGALUME_API_KEY` nova gerada no painel Vagalume.
- Ambos os tokens devem entrar em `.env` (gitignored), nunca em commits.
- Tokens devem ser distintos entre dev/testes e producao. Pasta atual (dev) tem tokens proprios.
- Log do servidor NUNCA escreve o token: usar `socket.handshake.auth.token ? '[present]' : '[missing]'` em logs.
- Confirmar `.gitignore` ja exclui `Live/.env` e `Liturgia/.env`.
- **Bypass quente:** o arquivo `/tmp/ipe-bypass-auth` deve ter permissao restrita (`chmod 600`, dono = usuario do PM2). Documentar que existencia do arquivo desabilita auth — risco se atacante ganhar acesso a `/tmp` do servidor da igreja.

## Testes

Projeto nao tem testes automatizados; nao introduzir framework de teste nesta spec. Validacoes sao:

- **Lint estatico**: `node --check` nos JS alterados.
- **Smoke local**: subir Liturgia e Live na pasta dev/testes, exercitar fluxo de versiculo + hino + louvor.
- **Teste manual de XSS Socket.IO**: tentar emitir payload com `<img src=x onerror=...>` de um cliente Socket.IO autenticado e confirmar que DOM nao executa.
- **Teste manual de XSS Painel**: salvar liturgia com titulo malicioso na Liturgia e confirmar que Painel mostra texto literal.
- **Teste manual de auth**: tentar conectar Socket.IO sem token apos grace period e confirmar disconnect.
- **Teste manual de bypass quente**: `touch /tmp/ipe-bypass-auth` libera conexao sem restart; `rm` reativa checagem.
- **Teste manual de regressao**: emitir 3 versiculos com `{st}...{/st}` + 1 louvor com cantor `<strong>` + 1 hino com quebras `<br/>` e confirmar renderizacao identica ao atual.

Comandos de validacao listados em `prd.md` na secao Validacao.

## Rollback

### Bloco A (SEC-011)

Reverter commit. A chave antiga ja foi revogada — para rollback completo seria preciso gerar uma terceira chave. Mais simples: corrigir o codigo novo se houver bug.

### Bloco B (SEC-001 + SEC-013)

- **Rollback emergencial durante culto:** `touch /tmp/ipe-bypass-auth` libera conexoes sem restart (~2s). Mais rapido que stop/start.
- **Rollback do servidor:** reverter commit do `Live/server.js` + tirar `SOCKET_TOKEN` do `.env`. Restart PM2.
- **Rollback do cliente:** o `Base.js` novo com DOMPurify e compativel com servidor antigo (sanitizacao client-side nao depende de auth). Se algum problema no cliente, rollback so do `Base.js` deixa servidor com auth + cliente sem sanitizacao — aceitavel temporariamente.
- **Plano de contingencia detalhado** documentado em `.project/runbooks/incidente-socket-auth.md`.

## Validacao

Detalhada em `prd.md`. Sumario:

1. Auditoria de string: `grep` confirma ausencia de chave Vagalume e padrao `apikey=`.
2. Smoke estatico: `node --check` em 4 arquivos.
3. Smoke runtime local: 503 sem env, 200 com env (Liturgia); disconnect sem token, conexao normal com token, bypass via sentinela (Live).
4. Teste manual de XSS via Socket.IO **e** via Liturgia/Painel.
5. Teste manual de regressao em 3 versiculos + 1 hino + 1 louvor.

## Decisao De Empacotamento (final, pos-grill)

Mantida uma spec com 2 blocos. Opcao B escolhida no grill — escopo ampliado para incluir SEC-013 (fluxo Liturgia → Painel). Justificativa: deixar SEC-013 para depois cria janela onde Socket.IO esta seguro mas Painel continua vulneravel ao Liturgia comprometido.

Se durante implementacao surgir complexidade inesperada em SEC-013 que ameace o cronograma, considerar split tardio: deploy SEC-001 primeiro (canal), SEC-013 em PR subsequente.
