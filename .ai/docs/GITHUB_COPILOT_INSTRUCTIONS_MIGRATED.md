# GitHub Copilot instructions migrado

# IPE Live — Instruções para Agentes de IA

## Visão Geral

Sistema de projeção, controle e legendas ao vivo para cultos da Igreja Presbiteriana da Encruzilhada (IPE). O projeto possui uma arquitetura **100% Node.js** (em duas aplicações/ambientes) para atender ao planejamento e à operação em tempo real:

1. **Preparação (Público/Nuvem)**: A pasta `Liturgia/` hospeda um sistema acessível à equipe de liturgia pela internet para construir a pauta do culto com antecedência. Roda na **porta 3000**.
2. **Exibição (Servidor Local)**: A pasta `Live/` roda no servidor multimídia local da igreja. Lê os dados via API do Liturgia e controla a projeção em tempo real. O servidor Socket.IO é **embutido** no mesmo processo. Roda na **porta 3001**.

## Arquitetura e Interações entre Pastas

O fluxo de dados segue este ciclo:

```ascii
[PÚBLICO / INTERNET]                [BANCO SQLite]                   [SERVIDOR LOCAL DA IGREJA]
  Liturgia/ (Node.js :3000)                                           Live/ (Node.js :3001)
  Criação do Culto      ──grava──▶  Liturgia/database/               Live/server.js
         │                            Cultos.sqlite                   Lê via GET /Cultos/:data
         │                                                                     │
         ▼                                                              socket.emit
  Bancos SQLite locais                                                         │
  (Bíblias e Hinários)                                                    broadcast
  database/Biblias/                                                            │
  database/Hinarios/                                                           ▼
                                                                Telas de Exibição (EJS)
                                                                Projetor / Televisão / Legendas / OBS
```

### O que cada pasta faz

- **`Liturgia/` (Editor Público Online)**
  - Aplicação **Node.js/Express** independente (porta 3000).
  - Oferece UI (Single Page Application) para construir o culto do dia.
  - Pesquisa Bíblias e Hinários nos bancos locais (`Liturgia/database/Biblias/` e `Liturgia/database/Hinarios/`).
  - Persiste os cultos e músicas no **banco SQLite**: `Liturgia/database/Cultos.sqlite`.
  - Integra com a API do **Vagalume** para pesquisar letras de músicas online.

- **Integração Liturgia → Live**
  - O `Live/` acessa os cultos via **HTTP** — a URL é configurada em `CULTOS_URL` no `.env` (ex: `http://localhost:3000/Cultos`). A rota `GET /Cultos/:arquivo` no Liturgia expande as referências (`louvor_id`, `coral_id`, hinos) e devolve o JSON completo.

- **`Live/` (Controle e Exibição Local — Node.js/Express + EJS)**
  - Servidor Node.js/Express com **Socket.IO embutido** (porta 3001).
  - **`views/Painel.ejs`**: Template do painel de controle do operador. Monta accordions com hinos, louvores, corais e passagens bíblicas a partir do JSON do culto.
  - **`views/Projetor.ejs` e `views/Televisao.ejs`**: Telas para projetor/TVs de retorno no salão.
  - **`views/Legendas.ejs` e `views/LegendasAoVivo.ejs`**: Browser Source do OBS Studio, com fundo transparente/chroma para lower-thirds.
  - **`views/Biblia.ejs`**: Pop-up de navegação bíblica por capítulo/versículo — acessada pelo Painel.
  - **`views/Audio.ejs`**: Monitor de áudio integrado via OBS WebSocket.
  - **`views/includes/bibliotecas.ejs`**: Partial compartilhado que carrega jQuery, Bootstrap 5, Font Awesome, Bootbox, Animate.css, Socket.IO e as variáveis JS globais (`servidor`, `empresa`, `cultosUrl`).

- **Socket.IO (Embutido em `Live/server.js`)**
  - Seção `SOCKET.IO EMBUTIDO` no `Live/server.js`. Escuta na mesma porta do Express (3001).
  - Atua como _broadcast router_: `socket.onAny()` reemite tudo para todos os clientes conectados.
  - **Não existe mais o diretório `Chat.JS/`** — foi unificado.

- **`Audio/` (Monitor OBS WebSocket)**
  - Rota `/Audio` em `Live/server.js` renderiza `Audio.ejs`. Usa OBS WebSocket para monitorar níveis de áudio.

### ⚠️ Regra de Ouro: Sincronização Nuclear entre Liturgia e Live

O **núcleo base** do projeto é a simbiose entre esses dois ambientes:

1. **A `Liturgia` administra (cadastra, formata)** a estrutura e persiste no banco SQLite.
2. **O ambiente `Live` carrega e apresenta** no momento do culto, enviando via sockets para projeção.

**INSTRUÇÃO OBRIGATÓRIA PARA A IA:**
Se o usuário solicitar a **criação de um novo tipo** de card/mídia/texto (ex: um tipo "Aviso", "Vídeo" etc.), a **alteração** da estrutura de um tipo existente, ou sua **exclusão**, você **OBRIGATORIAMENTE** deve lidar com a sincronização do código em ambos os lados!
Isto significa que você nunca deve criar suporte de um "tipo" apenas no `Live` ou apenas na `Liturgia`. O fluxo completo precisa que:

- O módulo Node em `Liturgia` (`server.js`, `capa.js`) saiba gerar a interface de cadastro e salvar no SQLite adequadamente.
- O módulo Node em `Live` (`server.js`, `Painel.js` e `Base.js`) saiba ler o JSON expandido e transmitir via Socket.IO para as telas.

Eles se completam. Não presuma que mudanças em um lado afetam o outro magicamente.

## Dados e Bancos

### Liturgia (Banco Principal)

- **`Liturgia/database/Cultos.sqlite`** — Banco principal de cultos e músicas. Contém:
  - Tabela `cultos(data_culto TEXT PRIMARY KEY, itens TEXT)` — cada registro guarda um JSON com a lista de itens do culto.
  - Tabela `louvores(id INTEGER PRIMARY KEY, titulo TEXT UNIQUE, letra TEXT)` — músicas avulsas; `letra` é JSON stringificado.
  - Tabela `coral(id INTEGER PRIMARY KEY, titulo TEXT UNIQUE, letra TEXT)` — músicas do coral; mesma estrutura do `louvores`.
- **`Liturgia/database/Biblias/*.sqlite`** — Versões da Bíblia. Tabelas: `book(id, name)`, `verse(book_id, chapter, verse, text)`.
- **`Liturgia/database/Hinarios/*.sqlite`** — Hinários (Novo Cântico, Cantor Cristão, etc.). Tabela: `songs(id, title, lyrics)` onde `lyrics` é XML no formato OpenLyrics.

### Live (Banco Local)

- **`Live/database/Biblias/*.sqlite`** — Cópias locais das Bíblias para consulta offline pelo operador (pop-up Bíblico no Painel). Mesma estrutura de tabelas da Liturgia.
- **`Live/database/Hinarios/*.sqlite`** — 4 hinários locais (mesma estrutura).

### Formato JSON do Culto (API)

Embora os cultos sejam armazenados em SQLite, a API `GET /Cultos/:arquivo` retorna um **array JSON** expandido. A URL é composta como `{cultosUrl}/{YYYY-MM-DD}.json`.

## Comunicação Socket.IO

Todos os eventos usam o padrão: `socket.emit(empresa, nomeEvento, dados)`.

Eventos principais:

| Evento                         | Direção              | Propósito                                               |
| ------------------------------ | -------------------- | ------------------------------------------------------- |
| `hino` / `louvor` / `passagem` | Painel → Telas       | Exibir conteúdo (payload: `{tipo, titulo, corpo}`)      |
| `fecharJanela`                 | Painel → Telas       | Ocultar todo conteúdo visível                           |
| `fecharBiblia`                 | Painel → Telas       | Ocultar passagem bíblica                                |
| `obsSceneChanged`              | OBS/Legendas → Todos | Troca de cena OBS; variável `atual` guarda a cena ativa |
| `Alerta`                       | Painel → Telas       | Exibe alerta temporário (bootbox dialog, 5s)            |

## Convenções de Código

- **Stack**: 100% Node.js — Express + EJS no backend, jQuery + vanilla JS no frontend. **Não há PHP no projeto.**
- **Idioma**: código e variáveis em português (`titulo`, `corpo`, `empresa`, `servidor`, `rodape`).
- **HTML customizado**: as telas usam tags não-padrão como `<passagem>`, `<louvor>`, `<titulo>`, `<corpo>`, `<rodape>`, `<texto>`, `<pesquisa>`, `<mostrar>` — estilizadas via CSS. Não substituir por `<div>`.
- **jQuery + vanilla JS**: toda manipulação de DOM usa jQuery (`$()`) junto com helpers `query/queryAll/queryId/queryName`. Animações com `fadeIn(200)` / `fadeOut(200)`.
- **Bibliotecas locais**: tudo em `Live/public/Bibliotecas/` (Bootstrap 5, jQuery, Font Awesome, Socket.IO client, Bootbox, Animate.css). Sem CDN, sem bundler, sem npm no frontend.
- **Socket.IO client**: servido pelo próprio backend Node via `/socket.io/socket.io.js` (rota nativa do Socket.IO). No `bibliotecas.ejs` é incluído dessa forma.
- **Caminhos forward-slash**: EJS usa caminhos normais com `/` (ex: `Bibliotecas/jquery.min.js`).
- **Sem framework frontend**: sem React, Vue, etc. Sem Composer. Sem autoload.
- **Parâmetro query string como flag**: `Painel?painelOBS` e `Projetor?telaPrincipal` — as flags alteram comportamento condicional na view/JS.

## Servidor Live (Node.js :3001)

### Iniciar

```bash
cd Live && npm install && node server.js
# PM2: cd Live && pm2 start ecosystem.config.js
# Acesso: http://localhost:3001/Painel
```

### Configuração via `.env`

Todas as variáveis ficam em **`Live/.env`** (ignorado pelo Git; commitar apenas `Live/.env.example`). Lidas via `dotenv` em `server.js`, expostas como `app.locals` e injetadas no frontend via `bibliotecas.ejs`.

| Variável           | Uso                                                    | Exemplo                        |
| ------------------ | ------------------------------------------------------ | ------------------------------ |
| `SOCKET_SERVER`    | Endereço do servidor Socket.IO (pode ser `host:porta`) | `localhost:3001`               |
| `SOCKET_NAMESPACE` | Namespace Socket.IO                                    | `IPE.Transmissão`              |
| `CULTOS_URL`       | URL base da API de Cultos do Liturgia                  | `http://localhost:3000/Cultos` |
| `OBS_WS_HOST`      | Host do OBS WebSocket (monitor de áudio)               | `localhost`                    |
| `OBS_WS_PORT`      | Porta do OBS WebSocket                                 | `4455`                         |
| `OBS_WS_PASS`      | Senha do OBS WebSocket (vazio se não houver)           | _(vazio)_                      |

No JS (via `bibliotecas.ejs`): `servidor` (`SOCKET_SERVER`), `empresa` (`SOCKET_NAMESPACE`), `cultosUrl` (`CULTOS_URL`).

### Rotas

| Método | Rota                   | Propósito                                                               |
| ------ | ---------------------- | ----------------------------------------------------------------------- |
| `GET`  | `/`                    | Redireciona para `/Painel`                                              |
| `GET`  | `/Painel`              | Painel de controle (EJS). Aceita `?painelOBS` e `?biblia=nome.sqlite`   |
| `GET`  | `/Biblia`              | Pop-up de versículos. Query: `nomeLivro`, `livro`, `capitulo`, `biblia` |
| `GET`  | `/Projetor`            | Tela de projeção. Aceita `?telaPrincipal`                               |
| `GET`  | `/Televisao`           | Tela de televisão (com relógio). Aceita `?telaPrincipal`                |
| `GET`  | `/Legendas`            | Legendas OBS (delay 1.5s)                                               |
| `GET`  | `/LegendasAoVivo`      | Legendas ao vivo OBS (sem delay)                                        |
| `GET`  | `/Audio`               | Monitor de áudio OBS WebSocket                                          |
| `GET`  | `/Hora` ou `/Hora.php` | API: relógio do servidor (`{ hora, data, fuso }`)                       |
| `GET`  | `/Chat.php`            | Redireciona para a live do YouTube                                      |

### Estrutura de arquivos JS do Live

```
Live/public/js/
  Base.js           — Lógica compartilhada entre TODAS as telas de exibição
  Painel.js         — Lógica do painel do operador (carrega culto, accordions, emite eventos)
  Biblia.js         — Lógica do pop-up bíblico
  Projetor.js       — Configuração mínima (chama inicializarTela)
  Televisao.js      — Configuração + relógio sincronizado
  Legendas.js       — Configuração (delay=1500, integracaoOBS, juntarLinhasEmPares)
  LegendasAoVivo.js — Configuração (delay=0, integracaoOBS, juntarLinhasEmPares)
```

#### Padrão `Base.js` + `inicializarTela(config)`

Todas as telas de exibição compartilham a lógica de `Base.js`. Cada tela define seu comportamento chamando `inicializarTela(config)` com as seguintes opções:

```javascript
inicializarTela({
  elementoConteudo: "corpo", // 'corpo' | 'rodape'
  temAlerta: false, // true = exibir alertas via bootbox
  delayEventos: 0, // 0 | 1500 ms — atraso no processamento de eventos
  callbackFadeIn: null, // função chamada após fadeIn de conteúdo
  aoIniciar: null, // código extra executado ao carregar
  integracaoOBS: false, // true = integração direta com OBS Studio
  juntarLinhasEmPares: false, // true = agrupar linhas curtas em pares (legendas)
});
```

**IMPORTANTE**: Ao adicionar ou alterar um comportamento em `Base.js`, todas as telas de exibição serão afetadas. Se a mudança for específica de uma tela, colocar no JS individual daquela tela.

---

## Estrutura de um JSON de Culto e Tipos Atuais Suportados

A base de dados temporária de um culto rodando no aplicativo é definida pelo array JSON retornado por `GET /Cultos/:data.json`.

> ⚠️ **INSTRUÇÃO OBRIGATÓRIA PARA A IA:** Qualquer inclusão de um novo `tipo` de card, ou alteração no funcionamento de um dos listados abaixo (como adição/remoção de keys dentro dos objetos), **DEVE ser obrigatoriamente documentada e atualizada nesta exata seção deste arquivo (`copilot-instructions.md`)**. Este arquivo é a ÚNICA fonte de verdade.

Atualmente, o sistema suporta **4 (quatro)** tipos distintos. Abaixo está a documentação completa da estrutura correspondente a cada um deles:

### 1. `hino` (Hinários Tradicionais)

Hinos formatados e puxados primariamente dos bancos de dados SQLite (como Novo Cântico, Cantor Cristão).

```json
{
  "tipo": "hino",
  "titulo": "Doxologia (HNC 001)",
  "letra": [
    "A Deus, supremo Benfeitor,",
    "refrao:A Deus, supremo Benfeitor",
    "A Deus, o Pai, o Criador;"
  ]
}
```

- **Formato canônico do título**: `Nome do Hino (SIGLA NNN)` — ex.: `Avante, ó crentes (HNC 311)`. O código do hinário e o número ficam entre parênteses **ao final**, separados por espaço, com número de 3 dígitos com zero à esquerda. **NUNCA** usar o formato antigo `SIGLA NNN - Nome`.
- **Hinários suportados e suas siglas**: `HNC` (Hinário Novo Cântico), `HCC` (Hinário Para o Culto Cristão), `CC` (Cantor Cristão), `HC` (Harpa Cristã). A sigla deve estar em maiúsculas.
- **Detalhe Principal**: O campo `letra` é um array de estrofes (strings). Quando um item começa com a flag `refrao:`, o sistema entende como o refrão/coro. No Painel, os botões de slides de refrão recebem a classe `.btn-info`.
- **Armazenamento compacto**: ao salvar, o servidor descarta o array `letra` e guarda apenas `{ tipo: "hino", titulo }` no `cultos.itens`. A letra é **re-expandida dinamicamente** a partir dos hinários SQLite via `parseTituloHino()` + `parseLyricsXml()` ao servir via `GET /Cultos/:arquivo`.
- **Busca no hinário**: `parseTituloHino(titulo)` suporta **ambos** os formatos (antigo e novo) ao parsear. Ao **gerar** novos títulos, usar **sempre** o formato `Nome (SIGLA NNN)`.

### 2. `louvor` (Músicas Avulsas)

Serve para músicas contemporâneas/avulsas cuja letra é colada manualmente ou importada do Vagalume.

```json
{
  "tipo": "louvor",
  "titulo": "Me Amou Primeiro",
  "letra": [
    "Eu tenho tantas bênçãos...",
    "refrao:E eu sei que me amou primeiro..."
  ]
}
```

- A flag `refrao:` funciona exatamente igual ao do `hino`.
- **Armazenamento**: ao salvar, o servidor faz `INSERT INTO louvores ON CONFLICT(titulo) DO UPDATE` (novo) ou `UPDATE louvores SET ... WHERE id=?` (edição via `louvor_id`). O `cultos.itens` guarda apenas `{ tipo: "louvor", louvor_id: N }`.
- **Expansão**: ao carregar o culto, a rota `GET /Cultos/:arquivo` expande `louvor_id` buscando `titulo` e `letra` na tabela `louvores`.
- **Funções JS**: `mostraLouvor(codigo)`, `arrumarLouvor()`, `louvorLocal()`, `louvorAbrirEditor(tipo)`.
- **Rota de formulário**: `POST /formularios/louvor`, `POST /formularios/pesquisar-louvor`, `GET /formularios/pesquisar-louvor-local`.

### 3. `passagem` (Versículos e Leitura Bíblica)

Responsável pelas leituras bíblicas isoladas durante o culto.

```json
{
  "tipo": "passagem",
  "titulo": "Gênesis 1.1-3",
  "texto": [
    "No princípio, criou Deus os céus e a terra.",
    "A terra, porém, estava sem forma e vazia...",
    "Disse Deus: Haja luz; e houve luz."
  ]
}
```

- **Detalhe Principal**: Cada índice do array `texto` equivale tipicamente a um versículo que o operador pode avançar com os botões no Painel. Cada verso é formatado como `"livro.capítulo.versículo. texto"` internamente e o prefixo de referência é removido no display via regex.
- **Armazenamento**: passagens são salvas inline (com `tipo`, `titulo` e `texto`) diretamente no `cultos.itens` — sem tabela separada.
- **Seleção no editor**: Modal com seletores de versão, livro, capítulo e versículo (início/fim), suportando intervalos multi-capítulo.

### 4. `coral` (Músicas do Coral)

Funciona de forma idêntica ao `louvor`, mas os dados são gravados e lidos da tabela `coral` (SQLite) em vez de `louvores`. O campo que indexa o item no culto é `coral_id`.

```json
{
  "tipo": "coral",
  "titulo": "Cantai ao Senhor",
  "letra": ["Cantai ao Senhor um cântico novo...", "refrao:Aleluia, aleluia!"]
}
```

- A flag `refrao:` funciona exatamente igual à do `hino` e do `louvor`.
- **Armazenamento**: ao salvar, o servidor faz `INSERT INTO coral ON CONFLICT(titulo) DO UPDATE` (novo) ou `UPDATE coral SET ... WHERE id=?` (edição existente via `coral_id`).
- **Expansão**: ao carregar o culto, a rota `GET /Cultos/:arquivo` expande `coral_id` buscando `titulo` e `letra` na tabela `coral`.
- **Funções JS**: `mostraCoral(codigo)`, `arrumarCoral()`, `coralLocal()` (seleção local com botão Novo).
- **Rota de formulário**: `POST /formularios/coral` e `GET /formularios/pesquisar-coral-local`.

---

## Módulo Liturgia (Editor)

Aplicação **Node.js/Express** independente localizada em `Liturgia/`. Seu propósito é criar e editar os cultos que o `Live/Painel.ejs` consome via API.

### Iniciar

```bash
cd Liturgia && npm install && node server.js
# PM2: cd Liturgia && pm2 start ecosystem.config.js
# Acesso: http://localhost:3000
```

### Estrutura

```
Liturgia/
  server.js          — Servidor Express (porta 3000)
  package.json
  ecosystem.config.js — Configuração PM2
  database/
    Cultos.sqlite    — Banco principal (cultos, louvores, coral)
    Biblias/         — Bancos SQLite das Bíblias
    Hinarios/        — Bancos SQLite dos Hinários (OpenLyrics)
  public/
    index.html       — SPA com layout de 3 colunas
    css/app.css
    img/             — Logomarca etc.
    js/
      app.js         — Utilitários (jQuery extensions, helpers de string/data)
      capa.js        — Lógica principal da aplicação
```

### Rotas do servidor (`server.js`)

#### Cultos

| Método | Rota                       | Propósito                                                                   |
| ------ | -------------------------- | --------------------------------------------------------------------------- |
| `GET`  | `/Cultos`                  | Lista todos os cultos (ordem decrescente de data)                           |
| `GET`  | `/Cultos/:arquivo`         | Retorna JSON expandido de um culto (expande `louvor_id`, `coral_id`, hinos) |
| `POST` | `/dados/nova-liturgia`     | Cria registro vazio no SQLite (`{ arquivo }`)                               |
| `POST` | `/dados/salvar-liturgia`   | Persiste o culto condensando músicas no SQLite (`{ arquivo, data }`)        |
| `POST` | `/dados/renomear-liturgia` | Renomeia (troca a data de) um culto (`{ antigo, novo }`)                    |

#### Formulários (retornam fragmentos HTML)

| Método | Rota                                  | Propósito                                                          |
| ------ | ------------------------------------- | ------------------------------------------------------------------ |
| `POST` | `/formularios/passagem`               | Formulário de passagem bíblica                                     |
| `POST` | `/formularios/hino`                   | Formulário de hino                                                 |
| `POST` | `/formularios/louvor`                 | Formulário de louvor (com botão de pesquisa Vagalume)              |
| `POST` | `/formularios/coral`                  | Formulário de coral                                                |
| `POST` | `/formularios/pesquisar-louvor`       | Modal de pesquisa online (Vagalume)                                |
| `GET`  | `/formularios/pesquisar-louvor-local` | Lista de louvores existentes no banco (`{ formulario, louvores }`) |
| `GET`  | `/formularios/pesquisar-coral-local`  | Lista de corais existentes no banco (`{ formulario, corais }`)     |
| `GET`  | `/formularios/pesquisar-hino-local`   | Lista de hinos usados nos cultos (`{ formulario, hinos }`)         |

#### Bíblia (API JSON)

| Método | Rota                       | Propósito                                                      |
| ------ | -------------------------- | -------------------------------------------------------------- |
| `GET`  | `/biblia/versoes`          | Lista versões disponíveis (`[{ codigo, nome }]`)               |
| `GET`  | `/biblia/livros`           | Lista livros de uma versão (`?versao=ARA`)                     |
| `GET`  | `/biblia/capitulos`        | Total de capítulos de um livro (`?versao&livro`)               |
| `GET`  | `/biblia/versiculos-count` | Total de versículos de um capítulo (`?versao&livro&capitulo`)  |
| `GET`  | `/biblia/versiculos`       | Busca versículos (`?versao&livro&capInicio&capFim&inicio&fim`) |

#### Hinário (API JSON)

| Método | Rota              | Propósito                                                |
| ------ | ----------------- | -------------------------------------------------------- |
| `GET`  | `/hinario/lista`  | Lista hinários disponíveis (`[{ codigo, nome }]`)        |
| `GET`  | `/hinario/buscar` | Busca hinos por título ou número (`?hinario=HNC&q=amor`) |
| `GET`  | `/hinario/hino`   | Letra completa de um hino (`?hinario=HNC&id=3`)          |

#### Vagalume (Proxy)

| Método | Rota                   | Propósito                             |
| ------ | ---------------------- | ------------------------------------- |
| `GET`  | `/api/vagalume/buscar` | Busca músicas na Vagalume (`?q=nome`) |
| `GET`  | `/api/vagalume/letra`  | Obtém letra completa (`?musid=id`)    |

### Interface (`public/`)

Layout SPA em 3 colunas:

1. **Lista de liturgias** — cultos existentes no SQLite. Botão `+` cria nova liturgia com prompt de data.
2. **Itens da liturgia** — lista dos itens do culto selecionado. Dropdown `+` permite adicionar `Passagem`, `Hino`, `Louvor` ou `Coral`.
3. **Formulário de edição** — carregado via AJAX (`POST /formularios/:tipo`); exibe campos adequados ao tipo selecionado.

### Convenções do módulo

- Usa as mesmas extensões jQuery definidas em `app.js` (`$.filtra`, `$.downloadObj`, `$.passarObjeto`, etc.).
- Formulários são fragmentos HTML retornados pelo servidor e inseridos no DOM via AJAX — não são páginas completas.
- A função `carregarItens(tipo)` no `server.js` consulta diretamente as tabelas `louvores` ou `coral` do SQLite, retornando itens únicos por título, usada para as buscas locais.
- As transformações de texto (formatar passagens, letras de hinos/louvores) ocorrem no cliente via funções `arrumar*()` em `capa.js`.
- **Feedback visual**: `mostrarToast(mensagem, tipo)` exibe toast Bootstrap canto inferior direito (2,5 s). Usar em todas as operações assíncronas.
- **Renomear liturgia**: duplo clique no item da lista abre `bootbox.prompt` → `POST /dados/renomear-liturgia` com `{ antigo, novo }`.
- **Atalhos de teclado**: `Ctrl+S` → `salvar()`; `Delete` (fora de inputs) → `excluir()` com confirmação.
- **Salvar**: ao salvar, o servidor retorna `{ ok: true, idMap: [...] }` com os IDs gerados/existentes para atualizar a memória do cliente.

### Identidade visual por tipo

As cores abaixo são usadas tanto nos `<li>` da lista de itens da Liturgia quanto nos accordions do `Live/public/css/Painel.css`. Ao criar ou editar elementos visuais associados a tipos, manter esta paleta:

| Tipo       | Fundo (recolhido) | Fundo (expandido/ativo) | Texto     |
| ---------- | ----------------- | ----------------------- | --------- |
| `hino`     | `#3d1f6d`         | `#5b2d99`               | `#e0d0ff` |
| `louvor`   | `#1a5632`         | `#23784a`               | `#c8f0d4` |
| `passagem` | `#14506e`         | `#1a6d96`               | `#c4e3f5` |
| `coral`    | `#5c3200`         | `#7e4600`               | `#ffe5c8` |

### Forma de trabalho no módulo Liturgia

1. **Leia sempre os três arquivos principais antes de editar**: `server.js`, `public/js/capa.js` e `public/css/app.css`. O `index.html` raramente muda.
2. **Alterações no servidor** (`server.js`): afetam rotas e geração de fragmentos HTML. Qualquer nova rota deve seguir o padrão REST já existente e retornar HTML (para `/formularios/*`) ou JSON (para `/cultos/*`, `/dados/*`, `/biblia/*`, `/hinario/*`).
3. **Alterações no cliente** (`capa.js`): cada tipo tem um par de funções — `mostra<Tipo>(codigo)` carrega o formulário via AJAX e popula os campos; `arrumar<Tipo>()` lê os campos e monta o JSON final no `#final`. Ao adicionar um novo tipo, criar ambas as funções.
4. **Fragmentos de formulário**: são HTML puro retornado pelo servidor e inserido com `insertAdjacentHTML('afterbegin', …)`. Usar as tags customizadas `<texto>` para o container editor, e `#titulo`, `#original`, `#final` como IDs padrão dos campos.
5. **Salvar**: sempre via `$.post('/dados/salvar-liturgia', { arquivo: documento, data: JSON.stringify(Liturgia) })`. O array `Liturgia` é a fonte única de verdade em memória.
6. **Cores**: aplicar sempre a paleta da tabela acima nos elementos visuais associados a tipos. O item selecionado recebe `bg-warning` (Bootstrap) sobrepondo a cor do tipo.
7. **Não usar CDN, bundlers ou TypeScript** — o frontend usa apenas as bibliotecas em `Live/public/Bibliotecas/` ou servidas pelo Express estático.

---

## Ao Editar (Módulo Live)

- Manter a estrutura de tags customizadas HTML — não converter para divs semânticas.
- O conteúdo do `corpo` é transmitido via `encodeURI()` e decodificado com `decodeURI()` nas telas.
- A variável `atual` (cena OBS ativa) é monitorada em `Base.js` para controles futuros.
- **`Base.js` é o núcleo de exibição** — contém `processarConteudo()`, `agruparLinhasEmPares()`, todos os handlers de eventos Socket.IO e a função `inicio()`.
- Cada tela individual (`Projetor.js`, `Televisao.js`, `Legendas.js`, `LegendasAoVivo.js`) apenas chama `inicializarTela(config)` com as opções específicas. `Televisao.js` é a exceção — adiciona lógica de relógio sincronizado via `/Hora`.
- **Ao alterar algo em `Base.js`**, todas as telas serão afetadas. Se a mudança for para uma tela específica, colocar no JS individual.
- `Painel.js` é independente de `Base.js` — ele tem sua própria lógica de accordions, emissão de eventos e carregamento do culto via `$.getJSON(cultosUrl/arquivo.json)`.
- A função `agruparEmSlides(letra, max)` no `Painel.js` quebra a letra em slides de no máximo `max` linhas para os botões dos accordions.

---

## PM2 (Gerenciamento de Processos)

Ambos os módulos possuem `ecosystem.config.js` para rodar com PM2 em produção:

| Módulo     | Nome PM2       | Porta | Watch ignora                                       |
| ---------- | -------------- | ----- | -------------------------------------------------- |
| `Liturgia` | `IPE-Liturgia` | 3000  | `database`, `cultos`, `node_modules`, `public/img` |
| `Live`     | `IPE-Live`     | 3001  | `database`, `node_modules`, `public/img`           |

---

## Arquivos Temporários

> ⚠️ **INSTRUÇÃO OBRIGATÓRIA PARA A IA:** Todo arquivo criado para fins temporários — diagnóstico, análise de dados, migração, teste, script pontual, verificação ou qualquer outra finalidade que **não** seja parte permanente do projeto — **DEVE ser excluído imediatamente após o uso**, ainda dentro da mesma sessão de trabalho.

### Regras

1. **Criação com nome explicitamente temporário**: prefixar sempre com `.tmp_` (ex.: `.tmp_normalizar_titulos.py`, `.tmp_diagnostico.sql`). Isso torna a intenção inequívoca e facilita limpeza em lote se necessário.
2. **Exclusão imediata**: ao final da operação para a qual o arquivo foi criado, executar `rm -f <arquivo>` ou `rm -rf <pasta>` antes de encerrar a tarefa.
3. **Nunca commitar**: arquivos `.tmp_*` estão cobertos pelo `.gitignore` raiz — confirmar que a regra `**/.tmp_*` ou equivalente esteja presente antes de criar qualquer temporário.
4. **Sem exceções**: mesmo que o arquivo ainda possa "ser útil depois", não deixar no workspace. Se a lógica for relevante para o projeto, incorporá-la ao código permanente apropriado em vez de manter um script solto.
