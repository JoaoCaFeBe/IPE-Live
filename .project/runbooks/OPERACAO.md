# Operação - IPE Live

Data da análise: 2026-05-02

## Escopo

Este runbook documenta operação segura a partir dos arquivos do projeto. Nesta análise não foram executados servidores, PM2, deploy, SSH, FTP, migrations, npm install ou acesso a banco real/produção.

## Aplicações

| App | Pasta | Porta padrão | Entrada | Descrição |
|---|---|---:|---|---|
| IPE-Liturgia | `Liturgia/` | `3000` | `server.js` | Cadastro/preparação da liturgia. |
| IPE-Live | `Live/` | `3001` | `server.js` | Painel local, projeção, legendas, Bíblia e áudio. |

## Pré-requisitos

- Node.js compatível com dependências atuais. Na análise local foi observado `node v22.22.1`.
- npm com suporte a lockfile v3.
- Arquivos SQLite esperados em `Liturgia/database/` e `Live/database/`.
- Para monitor de áudio: OBS Studio com OBS WebSocket v5 acessível.
- Para operação local: variáveis de `Live/.env` configuradas a partir de `Live/.env.example`.

## Configuração

### Liturgia

Variáveis usadas por `Liturgia/server.js`:

- `PORT`
- `CULTOS_DB_PATH`

Se `CULTOS_DB_PATH` não for definido, usa `Liturgia/database/Cultos.sqlite`.

### Live

Variáveis usadas por `Live/server.js` e views:

- `PORT`
- `SOCKET_SERVER`
- `SOCKET_NAMESPACE`
- `CULTOS_URL`
- `CULTOS_DIR`
- `OBS_WS_HOST`
- `OBS_WS_PORT`
- `OBS_WS_PASS`

Não copie valores reais para documentação, chat, commit ou print. `Live/.env` está ignorado pelo Git.

## Como Rodar Localmente

Não executar estes comandos sem autorização quando a sessão atual estiver em modo de análise/documentação.

### Liturgia

```bash
cd Liturgia
npm install
npm run dev
```

Alternativa de produção/local:

```bash
cd Liturgia
npm start
```

Acesso esperado:

- `http://localhost:3000`
- `http://localhost:3000/Cultos`

### Live

```bash
cd Live
npm install
npm run dev
```

Alternativa de produção/local:

```bash
cd Live
npm start
```

Acessos esperados:

- `http://localhost:3001/Painel`
- `http://localhost:3001/Projetor`
- `http://localhost:3001/Televisao`
- `http://localhost:3001/Legendas`
- `http://localhost:3001/LegendasAoVivo`
- `http://localhost:3001/Audio`

## PM2

Configurações encontradas:

- `Liturgia/ecosystem.config.js`
  - app `IPE-Liturgia`
  - `script: server.js`
  - `watch: true`
  - ignora `database`, `cultos`, `node_modules`, `public/img`
  - `max_memory_restart: 200M`

- `Live/ecosystem.config.js`
  - app `IPE-Live`
  - `script: server.js`
  - `watch: true`
  - ignora `database`, `node_modules`, `public/img`
  - `max_memory_restart: 300M`
  - `NODE_ENV=production`

Comandos PM2 exigem aprovação explícita:

```bash
cd Liturgia && pm2 start ecosystem.config.js
cd Live && pm2 start ecosystem.config.js
pm2 restart IPE-Liturgia
pm2 restart IPE-Live
pm2 reload IPE-Liturgia
pm2 reload IPE-Live
```

## Validação Segura Sem Subir Serviço

Comandos seguros para análise/documentação:

```bash
git status --short
git diff --check
rg -n '^(<<<<<<<|=======|>>>>>>>)$' .project .ai AGENTS.md CLAUDE.md GEMINI.md
node --check Liturgia/server.js
node --check Live/server.js
```

Observação: `node --check` valida sintaxe de JS, mas não valida EJS, Socket.IO, SQLite nem integração com OBS.

## Validação Manual Após Alterações De Código

Executar somente com aprovação para iniciar servidores.

1. Subir `Liturgia`.
2. Abrir `http://localhost:3000`.
3. Criar ou abrir liturgia de teste.
4. Adicionar passagem, hino, louvor e coral.
5. Salvar e reabrir a liturgia.
6. Subir `Live`.
7. Abrir `/Painel` e uma tela `/Projetor` ou `/Televisao`.
8. Enviar título, estrofes e passagem.
9. Conferir `fecharJanela` ao fechar accordion.
10. Abrir `/Legendas` e `/LegendasAoVivo` se a mudança tocar OBS/legendas.
11. Abrir `/Audio` se a mudança tocar OBS WebSocket ou variáveis OBS.

## Publicação/Deploy

Não foi encontrado script de deploy dedicado.

O projeto possui apenas configurações PM2. A rotina real de publicação precisa ser confirmada antes de qualquer execução:

- host/diretório real;
- usuário de deploy;
- se usa PM2, proxy reverso, Apache/Nginx ou systemd;
- como `Live/.env` é provisionado;
- como `Cultos.sqlite` é preservado;
- se `Liturgia` e `Live` rodam na mesma máquina ou em máquinas diferentes.

## Logs

Logs observáveis pelo código:

- `Liturgia/server.js` imprime URL e caminho do banco ao iniciar.
- `Live/server.js` imprime porta, URL do painel e URL de áudio ao iniciar.
- `Live/server.js` imprime nova conexão Socket.IO.
- `Live/views/Audio.ejs` imprime eventos OBS no console do browser.

A confirmar:

- Local dos logs PM2 em produção.
- Retenção/rotação de logs.
- Se logs HTTP/proxy armazenam query string, especialmente `/Audio?pass=...`.

## Comandos Que Exigem Aprovação Antes De Executar

- `npm install`, quando baixar dependências.
- `npm start` ou `npm run dev`, se iniciar serviço local.
- Qualquer `pm2 start`, `pm2 restart`, `pm2 reload`, `pm2 delete`, `pm2 save`.
- Deploy, SSH, FTP/SFTP, rsync, scp.
- Alteração de `.env`, credenciais, portas ou variáveis de produção.
- Acesso a banco real/produção.
- Cópia, restauração ou substituição de `Cultos.sqlite`.
- Scripts destrutivos ou limpeza de arquivos.
- Commit, push ou abertura de PR.

## Segurança Operacional

Credenciais/chaves por nome, sem valores:

- `OBS_WS_PASS` em `Live/.env`/`Live/.env.example`.
- `session.secret` em `Live/server.js`.
- `apikey` da Vagalume em `Liturgia/server.js`.

Recomendações:

- Rotacionar a chave Vagalume e o segredo de sessão porque estão versionados.
- Migrar segredos hardcoded para variáveis de ambiente.
- Evitar usar `/Audio?pass=...`; preferir variável de ambiente local protegida.
- Restringir acesso a `/Painel`, `/Audio` e Socket.IO por rede, proxy ou autenticação.
- Definir backup regular para `Liturgia/database/Cultos.sqlite`.

## Incidentes Comuns

### Painel Não Carrega Culto Do Dia

Verificar:

- Data local do navegador.
- `CULTOS_URL`/`CULTOS_DIR`.
- Se `Liturgia` responde `GET /Cultos/:arquivo`.
- Se o culto existe em `Cultos.sqlite`.

### Projeção Não Atualiza

Verificar:

- Se `/Painel` e tela (`/Projetor`, `/Televisao`, `/Legendas`) estão conectados ao mesmo `SOCKET_SERVER`.
- Se `SOCKET_NAMESPACE` é igual em todos os clientes.
- Console do browser para erros de Socket.IO.
- CORS/origem se acessando por IP/domínio diferente.

### Bíblia Não Abre Ou Não Busca

Verificar:

- Arquivos em `Live/database/Biblias/`.
- Query `biblia` recebida em `/Painel` ou `/Biblia`.
- Popup bloqueado pelo navegador.

### Áudio Não Conecta Ao OBS

Verificar:

- OBS aberto e WebSocket habilitado.
- `OBS_WS_HOST` e `OBS_WS_PORT`.
- `OBS_WS_PASS`, sem expor valor.
- Firewall/rede local.
- Console do browser em `/Audio`.

## Referências

- `.project/docs/SISTEMA.md`
- `.project/docs/MODULOS.md`
- `.project/docs/BANCO_DE_DADOS.md`
- `Liturgia/server.js`
- `Live/server.js`
- `Liturgia/ecosystem.config.js`
- `Live/ecosystem.config.js`
