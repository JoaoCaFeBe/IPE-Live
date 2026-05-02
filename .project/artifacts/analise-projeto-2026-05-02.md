# Análise Do Projeto - IPE Live

Data: 2026-05-02

## Objetivo

Documentar o projeto inteiro obedecendo a camada local de IA, sem implementar código, sem alterar banco, sem executar serviços, sem deploy e sem copiar segredos.

## Camada Local Lida

- `AGENTS.md`
- `.ai/AI_BOOTSTRAP.md`
- `.ai/INSTRUCTIONS.md`
- `.ai/SKILLS_CATALOG.md`
- `.ai/docs/IA_PORTABILIDADE.md`
- `.codex/skills/node-runtime/SKILL.md`
- `.codex/skills/orquestrador/SKILL.md`
- `.codex/skills/seguranca-config/SKILL.md`

Conclusão: projeto standalone Node, família `node-dual`, com duas apps (`Liturgia` e `Live`). Não aplicar regras de Base.Laravel, `template/main`, Core Protegido ou `template-sync`.

## Arquivos Criados Ou Atualizados

- Criado: `.project/docs/SISTEMA.md`
- Criado: `.project/docs/MODULOS.md`
- Criado: `.project/docs/BANCO_DE_DADOS.md`
- Atualizado: `.project/runbooks/OPERACAO.md`
- Criado: `.project/artifacts/analise-projeto-2026-05-02.md`

## Comandos De Análise Executados

Comandos seguros/read-only usados:

- `git status --short`
- `find` para inventário de arquivos e pastas
- `sed` para leitura de documentação, manifests, servidores, views e scripts
- `rg` para rotas, eventos Socket.IO, chamadas AJAX/fetch e sinais de segredo por nome
- `git ls-files`, `git check-ignore`, `git config core.ignorecase`
- `du` e `stat` para arquivos SQLite
- `sqlite3 <arquivo> .schema` e `PRAGMA table_info`, sem leitura de dados de negócio
- `node --version`
- leitura redigida de chaves `.env` por nome, sem valores

Não executado:

- `npm install`
- `npm start`
- `npm run dev`
- PM2
- deploy
- SSH/FTP/SFTP
- migrations
- banco real/produção
- commit/push

## Principais Descobertas

### Stack

- Node.js/Express em duas aplicações.
- EJS no `Live`.
- jQuery, Bootstrap, Font Awesome e Bootbox no frontend.
- Socket.IO embutido em `Live/server.js`.
- SQLite via `better-sqlite3`.
- PM2 configurado, mas não executado.

### Aplicações

- `Liturgia/`: editor público/de preparação, porta padrão `3000`.
- `Live/`: painel/projeção/local, porta padrão `3001`.

### Banco

- `Liturgia/database/Cultos.sqlite`: banco principal de cultos.
- Bíblias e hinários em SQLite nas duas aplicações.
- `cultos.itens` guarda JSON.
- `louvores` e `coral` guardam letras como JSON stringificado.
- Bíblias têm tabelas `book`, `verse`, `metadata`, `testament`.
- Hinários têm schema compatível com OpenLP/OpenLyrics, com tabela principal `songs`.

### Operação

- `Liturgia/package.json`: `dev` e `start`.
- `Live/package.json`: `dev` e `start`.
- `Liturgia/ecosystem.config.js`: app `IPE-Liturgia`.
- `Live/ecosystem.config.js`: app `IPE-Live`.
- Não foi encontrado script de deploy dedicado.

### Documentação

- Camada IA atualizada existe em `.ai/`.
- Conteúdo histórico migrado existe em `.ai/docs/`.
- `.project/runbooks/OPERACAO.md` era inicial e foi expandido.
- `.project/docs/` foi criado nesta rodada.

## Riscos Identificados

1. Segredo de sessão hardcoded em `Live/server.js`; valor não copiado.
2. Chave Vagalume hardcoded em `Liturgia/server.js`; valor não copiado.
3. `Live/.env` existe localmente e é ignorado; nomes sensíveis incluem `OBS_WS_PASS`.
4. `/Audio` aceita senha OBS via query string `pass`, o que pode vazar em histórico/log.
5. Painel, cadastro e Socket.IO não mostram autenticação no código.
6. Socket.IO reemite qualquer evento recebido.
7. `Cultos.sqlite` está ignorado pelo Git e precisa de política de backup.
8. Relações entre `cultos.itens` e `louvores`/`coral` são lógicas, sem foreign keys.
9. `HNC.sqlite` em `Liturgia/database/Hinarios/` está vazio.
10. Caminhos Git registram `live/` em minúsculo enquanto a árvore local aparece como `Live/`; risco em ambiente case-sensitive.
11. `Liturgia/public/index.html` usa CDNs externos; cadastro pode depender de internet/CDN.

## Lacunas

- Confirmar ambiente real de produção.
- Confirmar se `Cultos.sqlite` local é produção, teste, backup ou cópia.
- Confirmar política de backup/restauração.
- Confirmar se há autenticação/restrição de rede fora do código.
- Confirmar sincronização entre bases `Liturgia` e `Live`.
- Confirmar uso real de `CULTOS_DIR` versus `CULTOS_URL`.
- Confirmar logs PM2/proxy e retenção.

## Aprovações Necessárias Para Aprofundar

- Acesso read-only a banco real/produção ou cópia aprovada.
- Executar `npm install`, se dependências não estiverem instaladas.
- Iniciar servidores locais (`npm run dev`/`npm start`) para teste funcional.
- Acessar PM2/logs reais.
- Acessar OBS WebSocket real.
- Acessar deploy/SSH/FTP/SFTP.
- Rotacionar e migrar segredos hardcoded.
- Criar rotina de backup/validação para `Cultos.sqlite`.

## Evidências De Referência

- Rotas detectadas em `Liturgia/server.js` e `Live/server.js`.
- Eventos detectados em `Live/server.js`, `Live/public/js/Painel.js`, `Live/public/js/Base.js` e `Live/public/js/Biblia.js`.
- Schema SQLite confirmado por `.schema` local.
- Variáveis `.env` registradas apenas por nome.
- Validação final exigida: `git diff --check` e scan de marcadores de conflito.
