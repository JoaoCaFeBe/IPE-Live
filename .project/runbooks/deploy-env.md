# Deploy de variaveis de ambiente — Liturgia (VPS) e Live (igreja)

> Procedimento para configurar `.env` em producao apos os fixes da spec
> [2026-05-17-hardening-credenciais-canais](../specs/2026-05-17-hardening-credenciais-canais/).
> **Sempre fazer entre cultos** quando possivel. Idealmente em horario sem demanda.

## Visao geral

| Onde | App | Arquivo | Variaveis criticas |
| --- | --- | --- | --- |
| VPS publica | Liturgia | `Liturgia/.env` (gitignored) ou `export` no shell | `VAGALUME_API_KEY` |
| Servidor da igreja | Live | `Live/.env` (gitignored) | `SOCKET_TOKEN`, `SOCKET_AUTH_GRACE_UNTIL`, `SOCKET_SCHEMA_MODE`, `SOCKET_AUTH_BYPASS_FILE` + as antigas |

## Bloco A — Liturgia (VPS)

### 1. Gerar chave Vagalume

1. Acessar https://auth.vagalume.com.br com conta da igreja.
2. Painel do desenvolvedor → gerar nova API key.
3. **Nao** revogue a chave antiga ainda — feito apenas no passo 6.

### 2. Configurar no servidor VPS

Opcao A (recomendada: shell export propagado pelo PM2):

```bash
# Como usuario do PM2 (provavelmente nao root)
export VAGALUME_API_KEY='<CHAVE_NOVA>'
echo 'export VAGALUME_API_KEY="<CHAVE_NOVA>"' >> ~/.bashrc   # persistencia
```

Opcao B (arquivo `.env`):

```bash
cd /caminho/para/Liturgia
cat >> .env <<'EOF'
VAGALUME_API_KEY=<CHAVE_NOVA>
EOF
chmod 600 .env
```

Nota: a Liturgia hoje **nao** carrega `.env` automaticamente (sem `dotenv`).
A opcao A (shell export) e o caminho efetivo. O `ecosystem.config.js` propaga
`VAGALUME_API_KEY` do `process.env` para o app.

### 3. Reiniciar PM2

```bash
pm2 restart IPE-Liturgia --update-env
pm2 logs IPE-Liturgia --lines 5 --nostream
```

Verificar que **nao** aparece `[vagalume] VAGALUME_API_KEY ausente`.

### 4. Smoke

Do navegador (Painel do Live em outra rede):

1. Abrir Painel.
2. Procurar uma musica via Vagalume (sea-search bar de pesquisa).
3. Confirmar que retorna resultados (HTTP 200) e nao 503.

### 5. Auditoria pos-deploy

```bash
curl -s 'http://<IP_VPS>:3000/api/vagalume/buscar?q=teste' | head -c 200
```

Resposta esperada: JSON da Vagalume. Se vier `503 Vagalume desabilitado` -> env nao chegou ao processo. Conferir `pm2 env IPE-Liturgia`.

### 6. Revogar chave antiga

No painel Vagalume → remover/desativar a chave `c1563d...`.

### 7. Registrar conclusao

`.project/artifacts/sec-011-rotacao-vagalume-<data>.md` com:

- Data/hora do deploy.
- Quem executou.
- Confirmacao de revogacao da chave antiga.
- **Nao** incluir valores de chave.

## Bloco B — Live (servidor da igreja)

### 1. Gerar SOCKET_TOKEN

No servidor da igreja, como usuario do PM2:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copiar a string de 64 caracteres hex. **Nao** colar em chat, doc ou commit.

### 2. Configurar Live/.env

```bash
cd /caminho/para/Live
cp .env.example .env   # se ainda nao existir
chmod 600 .env
nano .env              # ou vi
```

Editar e preencher:

```text
SOCKET_TOKEN=<TOKEN_DE_64_HEX>
SOCKET_AUTH_GRACE_UNTIL=<DATA_ISO_+14_DIAS>
SOCKET_SCHEMA_MODE=warn
SOCKET_AUTH_BYPASS_FILE=/tmp/ipe-bypass-auth
```

Data D+14 sugerida: `node -e "const d=new Date(Date.now()+14*86400000); d.setHours(23,59,59); console.log(d.toISOString())"`.

### 3. Distribuir o MESMO token para clientes externos

Os 3 clientes externos catalogados (B.0.1) precisam do mesmo token:

| Cliente | Como receber o token |
| --- | --- |
| Mobile/tablet (app proprio) | Configurar no app via env/config. Detalhe depende da implementacao. |
| OBS plugin | Dependendo do plugin, configurar em `obs-websocket` settings ou no script de bridge. |
| Servico em 10.0.0.253 | Acessar maquina e configurar `.env` (ou similar) com o mesmo `SOCKET_TOKEN`. |

Internos (Base.js, Painel.js, Biblia.js) recebem token automaticamente via `bibliotecas.ejs`.

### 4. Reiniciar PM2

```bash
pm2 restart IPE-Live --update-env
pm2 logs IPE-Live --lines 10 --nostream
```

Espera ver: `🚀 IPE Live Back-end Rodando na porta 3001`.
**Nao** deve aparecer `[socket] SOCKET_TOKEN ausente — modo legacy`.

### 5. Smoke entre cultos

1. Abrir `/Painel` em um browser.
2. Abrir `/Projetor` em outro.
3. Emitir 1 versiculo + 1 hino com `{st}palavra{/st}` + 1 louvor com cantor `<strong>` + quebra `<br/>`.
4. Confirmar exibicao correta em projetor.
5. Em DevTools do Projetor, tentar `io("http://<IP>:3001")` sem token: dentro de grace, deve conectar com warn no log do servidor.
6. Verificar log: `pm2 logs IPE-Live --lines 20 --nostream`.

### 6. Monitorar por 14 dias (D+14)

```bash
pm2 logs IPE-Live --lines 200 --nostream | grep -E 'socket.\[(grace|reject|schema|reject-event)\]'
```

- `[grace]` ocasional: esperado (cliente externo ainda nao atualizado).
- `[grace]` constante: investigar qual cliente; reconfigurar token.
- `[reject]` no meio do culto: aplicar [incidente-socket-auth.md](incidente-socket-auth.md) imediato.
- `[schema]` ou `[reject-event]`: payload corrompido ou cliente emitindo fora da allowlist. Investigar antes do D+14.

### 7. Apos D+14 sem regressao — virar enforce

```bash
nano Live/.env
# editar:
#   SOCKET_SCHEMA_MODE=enforce
#   SOCKET_AUTH_GRACE_UNTIL=2020-01-01T00:00:00Z   (data passada)
pm2 restart IPE-Live --update-env
```

Confirmar nos logs que ainda nao aparecem `[reject]` legitimos.

### 8. Registrar conclusao

`.project/artifacts/sec-001-sec-013-socket-auth-<data>.md` com:

- Data do deploy inicial (warn).
- Data do D+14 (enforce).
- Numero de warns observados durante grace.
- Quaisquer ajustes feitos.

## Tabela resumo de gates

| # | Gate | Quem aprova |
| --- | --- | --- |
| A.2 | Configurar VAGALUME_API_KEY na VPS | Operador |
| A.3 | `pm2 restart IPE-Liturgia` | Operador |
| A.6 | Revogar chave antiga Vagalume | Operador |
| B.2 | Gerar SOCKET_TOKEN | Operador |
| B.3 | Distribuir token para 3 clientes externos | Operador |
| B.4 | `pm2 restart IPE-Live` | Operador |
| B.7 | Virar `enforce` apos D+14 | Operador |

## Comandos de emergencia

Bypass auth sem restart (se incidente durante culto):

```bash
touch /tmp/ipe-bypass-auth   # libera
rm /tmp/ipe-bypass-auth      # restaura
```

Detalhes em [incidente-socket-auth.md](incidente-socket-auth.md).

## Referencias

- `.project/specs/2026-05-17-hardening-credenciais-canais/`
- `.project/runbooks/OPERACAO.md`
- `.project/runbooks/incidente-socket-auth.md`
- `.project/runbooks/pendencias.md`
- `Live/.env.example`
- `Liturgia/ecosystem.config.js`
