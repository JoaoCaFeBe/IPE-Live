# Incidente Socket.IO — Auth bloqueando durante culto

> Procedimento de emergencia se o auth do Socket.IO (SEC-001) impedir clientes legitimos
> de conectar no servidor da igreja durante um culto.
> **Tempo alvo:** restauracao em ate 5 segundos sem restart do PM2.

## Sintoma

- Operador no Painel reporta que Projetor / Televisao / Legendas nao atualizam.
- Console do browser do cliente mostra: `Error: auth_required` ou `connection refused`.
- Log do PM2 do Live mostra linhas tipo: `[socket][reject] auth_required — ip=X token=[missing]`.

## Diagnostico rapido

```bash
pm2 logs IPE-Live --lines 50 --nostream | grep -i socket
```

Procurar padroes:

- `[socket][reject]` -> cliente sem token ou com token errado.
- `[socket][grace]` -> grace period ativo, cliente aceito mesmo sem token (nao e incidente).
- `[socket][bypass]` -> bypass ja ativo (nao e incidente).
- `[socket][schema]` -> payload invalido (eventos podem nao chegar).

## Acao 1 — Bypass quente (preferida, sem restart)

```bash
touch /tmp/ipe-bypass-auth
```

Apos no maximo 2 segundos, o cache TTL expira e novas conexoes passam direto.
Sem afetar conexoes ja abertas. Sem reload do PM2.

Confirmar no log:

```bash
pm2 logs IPE-Live --lines 5 --nostream | grep bypass
```

Espera ver `[socket][bypass] conexao aceita via arquivo sentinela`.

## Acao 2 — Restaurar protecao apos o culto

```bash
rm /tmp/ipe-bypass-auth
```

Apos 2s, o cache TTL expira e a checagem volta. Conferir que o log para de emitir `[socket][bypass]`.

## Acao 3 — Se bypass nao resolver (fallback)

Provavel: o token configurado no servidor nao bate com nenhum cliente, ou o cliente nem esta tentando enviar token.

1. Desabilitar auth completamente sem restart:
   ```bash
   pm2 stop IPE-Live
   pm2 start ecosystem.config.js --update-env
   ```
   Antes do `start`, edite `Live/.env` removendo (ou comentando) `SOCKET_TOKEN=...`. Servidor entra em modo legacy (aceita sem checar) e avisa nos logs.

2. Apos o culto:
   - Investigar qual cliente nao tem o token (Mobile? OBS? 10.0.0.253?).
   - Reaplicar `SOCKET_TOKEN` em todos.
   - `pm2 restart IPE-Live --update-env`.

## Acao 4 — Verificar grace period

Se a data atual ainda esta dentro de `SOCKET_AUTH_GRACE_UNTIL`:

```bash
grep SOCKET_AUTH_GRACE_UNTIL Live/.env
```

Dentro do grace, conexoes sem token sao aceitas com warn. Se mesmo assim cliente nao conecta, **nao** e problema de auth. Investigar:

- Console do browser: erro de rede? CORS? socket.io.js nao carregou?
- Firewall/rede entre cliente e porta 3001.
- Servidor Live esta rodando? (`pm2 status`)

## Pos-incidente

- Registrar em `.project/artifacts/incidente-socket-{data}.md`: sintoma, qual acao resolveu, causa raiz, prevencao.
- Se incidente recorrente: considerar reverter a spec ou ajustar configuracao (ex.: estender grace period, ajustar TTL do cache do bypass).

## Referencias

- `Live/server.js` (linhas do `io.use` middleware)
- `.project/specs/2026-05-17-hardening-credenciais-canais/`
- `.project/runbooks/OPERACAO.md`
- `.project/runbooks/deploy-env.md`
