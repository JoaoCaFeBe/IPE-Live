# PRD — Hardening de Credenciais e Canais

> **Data:** 2026-05-17 (ajustada apos sabatina grill em 2026-05-17)
> **Origem:** auditoria em `.project/artifacts/auditoria-seguranca-2026-05-17.md`
> **Achados cobertos:** SEC-001 (Critical), SEC-011 (High), SEC-013 (Medium — XSS DOM-based no fluxo Liturgia → Painel, incluido apos grill, Opcao B)
> **Topologia afetada:** Liturgia em VPS publica (internet) + Live em servidor da igreja (LAN)

## Problema

Tres falhas de seguranca confirmadas pelo audit precisam ser corrigidas antes de qualquer feature nova:

1. **SEC-011 — API key da Vagalume hardcoded:** o valor `c1563d6845dc6623fe573ef39989d329` esta versionado em `Liturgia/server.js:660,666`, exposto no historico git do repositorio publico. Usuario ja confirmou rotacao.
2. **SEC-001 — Socket.IO broadcaster cego:** o servidor `Live` aceita conexao anonima na porta 3001 e, via `socket.onAny → io.emit`, ecoa qualquer payload para todos os clientes conectados. Combinado com sinks de atribuicao DOM no cliente, permite XSS persistente em todas as telas de projecao durante o culto.
3. **SEC-013 — XSS DOM-based via Liturgia → Painel:** o `Painel.js` consome dados do `Liturgia` (VPS publica) via `getJSON` e injeta HTML no DOM via `$.append`. Como a Liturgia esta exposta na internet sem auth, atacante grava conteudo malicioso em `cultos.sqlite` que e renderizado sem sanitizacao no Painel — bypassando o canal Socket.IO completamente.

## Objetivo

Eliminar as tres exposicoes acima sem quebrar:

- Compatibilidade com as 7 views EJS atuais (`Audio.ejs`, `Biblia.ejs`, `Legendas.ejs`, `LegendasAoVivo.ejs`, `Painel.ejs`, `Projetor.ejs`, `Televisao.ejs`).
- Operacao normal do culto ao vivo (sem janela de manutencao maior que ~30 minutos entre cultos).
- Atualizacao dinamica de letras/passagens via Socket.IO durante a transmissao.
- Renderizacao do destacador `{st}...{/st}` (palavra em amarelo bold), tags `<strong>` (cabecalho de cantor) e `<br/>` (quebra de linha) usadas pelo `agruparLinhasEmPares`.

## Fora de Escopo

- Demais achados do audit (SEC-002 a SEC-010, SEC-012, SEC-014 a SEC-016). Cada um demanda spec propria.
- Reescrita do `Base.js`, `Painel.js` ou de qualquer view EJS para framework moderno.
- Implementacao de auth de usuario (login/logout) — apenas auth tecnica para o canal Socket.IO.
- Limpeza retroativa do historico git (`git filter-repo`) — registrar como pendencia, decidir em spec separada.
- Trocar a Vagalume por outra API.

## Requisitos

### Funcionais

1. **R1:** apos a correcao, nenhuma chave da Vagalume aparece no codigo-fonte versionado. A chave nova fica em `Liturgia/.env` (gitignored).
2. **R2:** se `VAGALUME_API_KEY` nao estiver configurada, o servidor `Liturgia` ainda inicia, mas as rotas `/api/vagalume/*` retornam HTTP 503 com mensagem clara ao operador.
3. **R3:** o Socket.IO do `Live` so aceita conexao de clientes que apresentem um token compartilhado (pre-shared key) configurado em `Live/.env`.
4. **R4:** clientes existentes (3 entradas Socket.IO: `Base.js`, `Painel.js`, `Biblia.js`) continuam funcionando sem alteracao de comportamento perceptivel ao operador apos a correcao. As views recebem o token automaticamente do servidor via `bibliotecas.ejs`.
5. **R5:** payloads emitidos via Socket.IO sao validados contra um schema minimo (`tipo`, `titulo`, `corpo`) antes de serem retransmitidos. Eventos com `tipo` fora de uma allowlist (`hino`, `coral`, `louvor`, `passagem`, `Alerta`, `fecharJanela`, `fecharBiblia`, `obsSceneChanged`) sao descartados com log no servidor.
6. **R6:** o conteudo HTML embutido em `conteudo.corpo` e sanitizado no cliente antes de ir para o DOM. Tags permitidas: `<span>` (com `style` limitado a cor e font-weight), `<br>`, `<strong>` — necessarias para `{st}...{/st}`, separadores e cabecalhos de cantor.
7. **R7 (novo, Opcao B do grill):** o HTML construido em `Painel.js` a partir de dados do `Liturgia` (`definicao.titulo`, `slide.texto`, `letraTag`) e sanitizado antes do `$.append`. Tags permitidas: `<span>`, `<br>`, `<strong>`, `<i>`.
8. **R8 (bypass quente):** existe mecanismo de bypass do auth Socket.IO via arquivo sentinela (ex.: `touch /tmp/ipe-bypass-auth`) sem precisar restart do servidor. Apenas para emergencia operacional durante culto.

### Nao funcionais

9. **R9:** o restart pos-correcao do `Live` no servidor da igreja deve ser feito por gate explicito do operador (sem deploy automatico).
10. **R10:** mensagens de erro do servidor nao expoem stack traces nem o token Socket.IO ao cliente.
11. **R11:** as tres correcoes podem ser deployadas independentemente: SEC-011 (so Liturgia) pode ir antes; SEC-001+SEC-013 (Live + views + Base.js + Painel.js) podem ir depois.

## Riscos

| ID | Risco | Mitigacao |
| --- | --- | --- |
| RS-1 | Sanitizacao DOMPurify quebra renderizacao de algum elemento (`{st}...{/st}`, `<br/>`, `<strong>` de cantor). | Allowlist explicita: `<span>` + style `color`/`font-weight`, `<br>`, `<strong>`. Testar manualmente com 3 versiculos + 1 hino com destacador + 1 louvor com cantor antes de promover. |
| RS-2 | Token Socket.IO mal distribuido derruba uma das telas no culto. | Token injetado via `bibliotecas.ejs` (6 views ja incluem; Audio.ejs nao usa Socket.IO entao nao precisa). Grace period de **14 dias** (2 cultos observados). Bypass quente disponivel via arquivo sentinela. |
| RS-3 | Rotacao Vagalume invalidada antes do deploy do codigo novo. | Sequencia: (a) gerar chave nova; (b) deploy do codigo lendo `process.env.VAGALUME_API_KEY`; (c) configurar `.env` da VPS com chave nova; (d) restart; (e) revogar chave antiga. |
| RS-4 | Historico git ainda exibe a chave Vagalume antiga apos rotacao. | Documentar como pendencia separada em `.project/runbooks/pendencias.md`. Chave antiga ja revogada apos R3 mitiga risco real; limpeza historica e cosmetica/conformidade. |
| RS-5 | Schema/allowlist muito restritivo derruba evento legitimo nao documentado. | Catalogar eventos emitidos hoje antes de definir schema (B.1). Allowlist explicita + modo `warn-only` por **14 dias** (loga mas nao bloqueia) antes de virar `enforce`. |
| RS-6 (novo) | Cliente Socket.IO externo nao catalogado (mobile, OBS plugin, script externo no IP `10.0.0.253`) quebra apos grace period. | **Tarefa B.0:** confirmar com operador todos os clientes externos antes de iniciar implementacao. Cada cliente externo recebe seu proprio token via `.env`. |
| RS-7 (novo, Opcao B) | Sanitizacao no Painel.js quebra construcao de accordion (estrutura Bootstrap com `<input>`, `<label>`, `<button>`). | Sanitizar apenas os campos vindos do Liturgia (`definicao.titulo`, `slide.texto`, `letraTag`), nao a estrutura do template. Manter `$.append` mas com valores ja sanitizados. |

## Criterios de Aceite

- [ ] `grep -r c1563d6845dc6623fe573ef39989d329 .` retorna 0 ocorrencias (excluindo `.project/artifacts/` que documenta o achado).
- [ ] `grep -nE "apikey=" Liturgia/server.js` retorna 0 ocorrencias.
- [ ] Liturgia inicia mesmo sem `VAGALUME_API_KEY` em `.env`; rotas `/api/vagalume/*` retornam 503.
- [ ] Cliente Socket.IO sem token recebe `disconnect` com motivo `auth_required` (ou opera em modo legacy se grace period ativo).
- [ ] Payload com `tipo` fora da allowlist e descartado com log `console.warn` no servidor.
- [ ] DOMPurify sanitiza `<img src=x onerror=...>` para texto inerte em todas as 6 views Socket.IO.
- [ ] Renderizacao do `{st}palavra{/st}` continua exibindo palavra em amarelo bold.
- [ ] Renderizacao de cantor (`<strong>`) e quebra de linha (`<br/>`) em louvores continua funcionando.
- [ ] Bypass quente: `touch /tmp/ipe-bypass-auth` permite conexao sem token em ate 2 segundos; remocao do arquivo restaura a checagem.
- [ ] **Painel.js (SEC-013):** payload do Liturgia contendo HTML malicioso em `definicao.titulo`/`slide.texto` aparece como texto literal no Painel, sem executar.
- [ ] Teste manual: passar 3 versiculos + 1 hino com `{st}` + 1 louvor com cantor pelo painel e verificar projetor/televisao/legendas.

## Validacao

Comandos (a executar no projeto local de dev/testes antes de promover):

```bash
# 1. Conferir que a chave antiga sumiu
grep -r c1563d6845dc6623fe573ef39989d329 . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.project/artifacts

# 2. Conferir que apikey nao esta hardcoded em rotas
grep -nE 'apikey=' Liturgia/server.js

# 3. Conferir que process.env.VAGALUME_API_KEY e usado
grep -n VAGALUME_API_KEY Liturgia/server.js Liturgia/.env.example

# 4. Conferir que Socket.IO tem auth
grep -nE 'io.use|io\.on.*connection' Live/server.js

# 5. Conferir que DOMPurify foi adicionado
grep -rn DOMPurify Live/public/js Live/views

# 6. Conferir que sanitizacao foi aplicada no Painel.js
grep -nE 'DOMPurify\.sanitize|sanitize\(' Live/public/js/Painel.js

# 7. Rodar lint Node basico nos arquivos alterados
node --check Live/server.js
node --check Liturgia/server.js
node --check Live/public/js/Base.js
node --check Live/public/js/Painel.js
```

Testes manuais obrigatorios:

1. Subir `Liturgia` local sem `.env`: confirmar 503 em `/api/vagalume/buscar?q=teste`.
2. Subir `Liturgia` local com `.env` valido: confirmar resposta normal.
3. Subir `Live` local, abrir `/Painel` em um browser e `/Projetor` em outro; emitir um versiculo e confirmar exibicao com `{st}` amarelo.
4. Com `/Projetor` aberto, tentar conectar Socket.IO de um console DevTools externo sem token: confirmar disconnect.
5. Emitir payload `{ tipo: 'passagem', titulo: '<img src=x onerror=alert(1)>', corpo: 'normal' }` via cliente autorizado: confirmar que o titulo aparece como texto literal, sem alert.
6. Emitir louvor com cantor (`<strong>`) e quebra de linha (`<br/>`): confirmar renderizacao correta.
7. **SEC-013:** salvar liturgia no Liturgia com `definicao.titulo = "<img src=x onerror=alert(1)>"` e abrir Painel: confirmar texto literal.
8. **Bypass quente:** com SOCKET_TOKEN configurado, parar de enviar token e tentar conectar: deve falhar. `touch /tmp/ipe-bypass-auth`: deve passar em ate 2s. `rm /tmp/ipe-bypass-auth`: deve voltar a falhar.

## Decisoes (resolvidas no grill)

1. ✅ **Empacotamento:** uma spec com 2 blocos (A: SEC-011 tatico, B: SEC-001+SEC-013 arquitetural).
2. ✅ **Grace period:** 14 dias (2 cultos observados), nao 7.
3. ✅ **Modo do schema:** warn-only por 14 dias.
4. ✅ **DOMPurify allowlist:** `<span>` (style: color/font-weight) + `<br>` + `<strong>`. `<i>` adicionado para Painel.js.
5. ✅ **Rollback durante culto:** bypass quente via arquivo sentinela (sem restart).
6. ✅ **Escopo Painel.js:** incluido (Opcao B). Spec cobre o vetor completo do canal de transmissao.

## Decisoes Abertas

- Catalogo de eventos Socket.IO: rascunho da B.1.2 (a confirmar com operador). Eventos identificados pelo grep + analise dinamica:
  - **Emitidos:** `passagem`, `Alerta`, `fecharJanela`, `fecharBiblia`, `obsSceneChanged`, e eventos dinamicos `hino`/`coral`/`louvor` derivados de `$(this).parents(".accordion-item").attr("tipo")` no `Painel.js:355,368,381,394`.
- Limpeza historico git: registrar em `.project/runbooks/pendencias.md`, adiar para spec separada.
- Quem configura `.env` no servidor da igreja e na VPS: operador. Documentar em `.project/runbooks/` se ainda nao houver.

## Sabatina Grill

Executada em 2026-05-17. Resultado: aprovar com ajustes obrigatorios (2, 3, 4, 6, 8). Decidido manter 1 spec com escopo ampliado (Opcao B) cobrindo tambem SEC-013.
