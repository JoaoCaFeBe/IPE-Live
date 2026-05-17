# Riscos Operacionais de Runtime — IPE Live

> **Data:** 2026-05-17
> **Modo:** baseline estatico (sem executar servidor)
> **Skill global usada:** `incident-debugger` (via subagente)
> **Escopo:** runtime, resilience, observabilidade, concorrencia SQLite, PM2, acoplamento Live↔Liturgia

## Topologia de Deploy

- **Pasta local (Google Drive):** dev/testes apenas. `watch:true` problematico aqui, mas nao afeta producao.
- **Liturgia/:** VPS publica → deploy provavelmente via git pull. `watch:true` aceitavel se nao houver Drive/rsync no path; ainda assim recomenda-se `false`.
- **Live/:** servidor fisico da igreja → fora do Drive em producao. `watch:true` aceitavel; risco menor que LAN sincronizada.

Implicacoes que mudam a priorizacao:

- Risco #1 (`watch:true`) e dev-only se VPS e servidor da igreja nao estiverem no Drive. **Confirmar com operador o metodo de deploy (git pull? rsync? scp manual? FTP?).**
- Risco #4 (acoplamento Live↔Liturgia) aumenta: Live (LAN igreja) chama Liturgia (VPS internet). Se VPS cair ou internet da igreja oscilar, painel do operador fica sem dados. **Latencia LAN↔Internet** entra no jogo.

## Resumo Executivo

Dois processos Node.js independentes (`Live` :3001 e `Liturgia` :3000) que se comunicam exclusivamente via HTTP/JSON **a partir do navegador** — nao ha cliente HTTP no Node falando com o outro processo. O `Live/server.js` e um broadcast router Socket.IO simples (`socket.onAny → io.emit`) sem auth/rate-limit/error handling. Integracao com OBS WebSocket e toda client-side (isola o Node de falhas do OBS). Principais riscos: SQLite sem WAL com writes nao-transacionais em `/dados/salvar-liturgia`, `JSON.parse` desprotegido, ausencia de log/rotacao no PM2, perda total de estado a cada restart, e `watch:true` no PM2 que reinicia em qualquer escrita.

## Top 5 Riscos por Impacto Operacional

| # | Risco | Local | Impacto |
| --- | --- | --- | --- |
| 1 | `watch:true` no PM2 com `instances:1` reinicia em qualquer alteracao de arquivo. Pasta em **Google Drive Sync** amplifica risco — Drive pode tocar metadata e disparar reload no meio do culto. | `Live/ecosystem.config.js:6`, `Liturgia/ecosystem.config.js:6` | Alto durante culto ao vivo |
| 2 | Socket.IO como broadcast router cego (`socket.onAny → io.emit` sem try/catch, sem validacao). Cliente malformado ou loop causa storm. | `Live/server.js:240-246` | Alto (paralisa todas as telas) |
| 3 | `/dados/salvar-liturgia` faz multiplos writes em SQLite sem transacao e sem WAL. Crash no meio deixa estado inconsistente (musica atualizada, culto nao). | `Liturgia/server.js:389-468` | Alto (corrompe liturgia em edicao) |
| 4 | Liturgia depende do navegador para fazer ponte com Live — sem retry/cache/heartbeat no Node. Se `CULTOS_URL` cair, so o alerta jQuery em `Painel.js:292` aparece. | `Live/public/js/Painel.js:78,292`, `Live/server.js:73-87` | Medio-Alto |
| 5 | `JSON.parse` desprotegido em hot-paths de leitura. Erros caem no `catch` generico sem `console.error` — corrupcao silenciosa. | `Liturgia/server.js:295,309,316,399,782` | Medio |

## Mapa de Dependencias Externas

### Entrada (quem chama)

- Navegadores na LAN com CORS whitelist em `Live/server.js:227-238` (`transmissao`, `localhost`, `192.168.1.43`, `10.0.0.253`, `ipe.live.test`).
- Navegadores com CORS aberto (`*`) em `Liturgia/server.js:116`.

### Saida (quem o Node chama)

| Origem | Destino | Protocolo | Tolerancia |
| --- | --- | --- | --- |
| `Liturgia/server.js:647-655` | `api.vagalume.com.br` | `https.get` **sem timeout, sem retry** | erro vira 502; resposta nao-JSON vira 502; resposta pendurada **trava o pedido** |
| `Live/server.js:73-87` | Filesystem (`CULTOS_DIR`) ou redirect 302 para `CULTOS_URL` | `fs.existsSync` + `res.sendFile` ou redirect | sem fallback se redirect falhar |
| Ambos | `better-sqlite3` arquivos locais | Sincrono | `try/catch` por rota, sem log estruturado |

**Nota chave:** O Node do Live **nao consome a Liturgia diretamente**. Acoplamento Live↔Liturgia acontece todo no browser. Se Liturgia cair, Live continua up; falha aparece so no painel do operador.

**OBS WebSocket** nao e dependencia do Node — estabelecida no browser (`views/Audio.ejs:535-610`). Node so injeta host/porta/senha no template.

## Falhas Silenciosas Detectadas

| Arquivo:linha | Padrao |
| --- | --- |
| `Liturgia/server.js:39` | `catch (_) { }` no carregamento do mapa de hinarios — `.sqlite` corrompido sumi sem log |
| `Liturgia/server.js:350-352` | Hino legacy nao resolvido: lista vazia silenciosa |
| `Liturgia/server.js:651-654` | Falha Vagalume: nao loga payload bruto |
| `Liturgia/server.js:654` | `.on("error", ...)` sem log |
| `Liturgia/server.js:784-786` | DB corrompido: `carregarItens` retorna `[]` indistinto de "sem dados" |
| `Liturgia/server.js` (12 locais) | Rotas com `catch (e) { res.status(500).json({ error: e.message }) }` **sem `console.error`** |
| `Live/server.js:182-184` | `/Biblia` nao loga (rota `/Painel` loga, esta nao) |
| `Live/server.js:240-246` | Handler `socket.onAny` **sem try/catch** |
| `Live/server.js:241` | `console.log` por conexao sem ID/IP; sem disconnect log |

**Lacunas explicitas:**

- Sem `process.on('uncaughtException')` ou `unhandledRejection` em ambos servers.
- Sem `PRAGMA journal_mode=WAL` em nenhum DB.
- Sem `db.transaction()` em writes multi-tabela.
- Sem timer leaks (nao ha `setInterval` no backend).

## Crash Paths

| Local | Risco |
| --- | --- |
| `Live/server.js:15,19,20,26-28`, `Liturgia/server.js:8,11-13` | **Sem crash path por env faltando** — todas com fallback. Bom. |
| `Liturgia/server.js:295` | `JSON.parse(row.itens)` corrompido cai no catch da rota, sem log |
| `Liturgia/server.js:309,316,346` | `JSON.parse(m.letra)` dentro de `.map()` — uma musica malformada quebra a rota inteira |
| `Liturgia/server.js:402-408` | `INSERT ... ON CONFLICT(titulo) DO UPDATE` depende de `UNIQUE(titulo)` na schema; nao auditado |
| `Live/server.js:56-58` | `new Database(...readonly:true)` se arquivo Biblia sumir lanca; capturado no catch |
| `Liturgia/server.js` varias linhas | `new Database()` aberto a cada request; `SQLITE_BUSY` possivel em backup/cópia, default timeout 5000ms |

## Resource Leaks

| Item | Avaliacao |
| --- | --- |
| `db.close()` em todas as rotas SQLite | Presente — verificado. **Bom.** |
| `prepare()` reutilizado | Criado a cada request (ineficiente, **nao vaza** porque `db.close()` libera) |
| Socket.IO `disconnect` handler | Ausente — nao vaza memoria, mas perde observabilidade |
| `HINARIOS_MAP` cache global | `Liturgia/server.js:22-42` carregado uma vez, nunca invalidado. Novo hinario exige restart. |
| `https.get` Vagalume | **Sem timeout** — socket pendurado fica ate TCP timeout do SO (~2 min) |

## Concorrencia SQLite

- **WAL nao habilitado** — default `delete`. Writes bloqueiam reads. Em LAN com poucos clientes possivelmente invisivel, risco arquitetural.
- **Sem transacao multi-tabela** em `salvar-liturgia` (`Liturgia/server.js:389-468`).
- **Cada request abre `new Database`** — sem pooling. Sincrono ocupa event loop, mas evita race de conexao.

## PM2 / Deploy

| Item | Live | Liturgia |
| --- | --- | --- |
| `instances` | 1 | 1 |
| `autorestart` | true | true |
| `max_memory_restart` | 300M | 200M |
| `watch` | **true (perigoso)** | true |
| `ignore_watch` | `database`, `node_modules`, `public/img` | `database`, `cultos`, `node_modules`, `public/img` |
| Logs (`out_file`/`error_file`/`log_date_format`) | **ausente** | **ausente** |
| Logrotate | **nao configurado** | **nao configurado** |
| Cluster | nao (fork) | nao (fork) |

**Implicacoes:**

- Logs em `~/.pm2/logs/` default sem rotacao — **crescem indefinidamente**.
- `watch:true` + pasta `CloudStorage/GoogleDrive` = reload espurio quase certo.
- `max_memory_restart` baixo derruba todos os clientes Socket.IO no restart.

## Estado em Memoria (perdido a cada restart)

| Estado | Local | Perdido em restart? |
| --- | --- | --- |
| `express-session` (escolha de Biblia) | MemoryStore default | **Sim** |
| Conexoes Socket.IO ativas | memoria do `io` | Sim — clientes reconectam, mas **servidor nao guarda estado atual da transmissao** (so e roteador). Cliente novo pos-restart entra em branco ate operador re-emitir. |
| `HINARIOS_MAP` | `Liturgia/server.js:22` | Sim, mas e recarregavel (lazy) |

Sem Redis, sem cache persistido. **Restart durante culto exige o operador clicar de novo no item atual** para repovoar telas.

## Recomendacoes Priorizadas

### Imediatas (custo baixo, alto retorno)

1. **Desligar `watch:true` em producao** nos dois `ecosystem.config.js`.
2. **`pm2-logrotate`** (`pm2 install pm2-logrotate` + `pm2 set pm2-logrotate:max_size 10M`) + definir `out_file`/`error_file`/`merge_logs:true`/`log_date_format`.
3. **Adicionar `console.error(e)`** em todos os `catch` que so retornam 500 (listados em "Falhas Silenciosas"). Custo trivial.
4. **Habilitar WAL** — `db.pragma('journal_mode = WAL')` apos `new Database(CULTOS_DB_PATH)`.
5. **Envolver writes do `salvar-liturgia` em `db.transaction()`** (`Liturgia/server.js:400-456`).

### Medio prazo

6. `process.on('uncaughtException')` e `unhandledRejection` em ambos.
7. Try/catch no `socket.onAny` (`Live/server.js:243`).
8. Timeout no `https.get` Vagalume (`Liturgia/server.js:647`): `req.setTimeout(5000, () => req.destroy())`.
9. Persistir "estado atual da transmissao" no Live (ultimo slide por categoria).
10. Logar `disconnect` no Socket.IO com motivo.

### Longo prazo / arquitetural

11. Substituir MemoryStore por `better-sqlite3-session-store` (ja ha SQLite).
12. Logging estruturado (`pino` ou `winston`) com `req-id`.
13. Health-check endpoint (`/healthz` retornando `{ db: 'ok' }`).
14. Testes minimos para `parseTituloHino` e `parseLyricsXml`.

## Confianca e Lacunas

**Alta confianca:**

- Analise estatica completa dos dois `server.js` e dos dois `ecosystem.config.js`.
- Inventario de dependencias externas (Node Live nao consome Liturgia diretamente; OBS e client-side).

**Confianca parcial / nao verificado:**

- Schema real dos SQLite (`Cultos.sqlite` em particular) — `UNIQUE(titulo)` e inferido do codigo.
- `Liturgia/public/` nao inspecionado integralmente.
- Versoes reais PM2 no host de producao e se `pm2-logrotate` ja esta instalado.
- Carga real (numero de clientes Socket.IO simultaneos).

## Perguntas para o Operador

1. O servico roda em pasta sincronizada pelo Google Drive? Se sim, `watch:true` quase certamente causa reload espurio.
2. Existe host externo hospedando `SOCKET_SERVER` (`.env.example: 10.0.0.253:3000`) ou Socket e sempre o proprio Live? O exemplo aponta porta 3000 (Liturgia), o que sugere confusao historica.
3. Existe procedimento de backup do `Cultos.sqlite`? E o unico arquivo write-heavy sem replica.
