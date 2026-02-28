# IPE Live — Instruções para Agentes de IA

## Visão Geral

Sistema de projeção e legendas ao vivo para cultos da Igreja Presbiteriana da Encruzilhada (IPE). Arquitetura pub/sub em tempo real: um **Painel** de controle envia comandos via Socket.IO para múltiplas telas de exibição (Projetor, Televisão, Legendas).

## Arquitetura

```
[Liturgia/] Editor de liturgia ──grava JSON──▶ IPE/.liturgia/cultos/YYYY-MM-DD.json
                                                         │
                            (arquivo copiado/acessado)  ▼
Painel.php (controle) ──socket.emit──▶ Chat.JS/index.js (Socket.IO server :3000) ──broadcast──▶ Projetor.php / Televisao.php / Legendas.php / LegendasAoVivo.php
```

- **Chat.JS/index.js** — Servidor Node.js Socket.IO na porta 3000. Faz broadcast total: todo evento recebido é reemitido para todos os clientes. Namespace único: `IPE.Transmissão`.
- **live/Painel.php** — Painel do operador. Carrega o JSON do culto do dia (`cultos/YYYY-MM-DD.json`), exibe hinos, louvores, passagens e mensagens como botões de rádio/checkbox dentro de accordions Bootstrap.
- **live/Projetor.php** — Tela de projeção principal; exibe conteúdo em tags HTML customizadas (`<passagem>`, `<louvor>`, `<mensagem>`).
- **live/Televisao.php** — Similar ao Projetor, com relógio (`Hora.php`) e CSS adicional (`Televisao.css`).
- **live/Legendas.php** e **LegendasAoVivo.php** — Telas para legendas, usadas via OBS Browser Source; detectam `window.obsstudio` para integração com OBS.
- **live/Biblia.php** — Popup aberto pelo Painel para selecionar versículos bíblicos.
- **live/dados.php** — Classe PHP `dados` (abstrata/estática) que abre bancos SQLite das Bíblias/Hinários via PDO.
- **Audio/index.html** — (Experimental) Monitor de níveis de áudio OBS via WebSocket (`ws://localhost:4455`). Usa autenticação com CryptoJS. Ainda não integrado ao fluxo principal.
- **Liturgia/** — Aplicação Node.js/Express standalone para **criação e edição** de liturgias (ver seção dedicada abaixo).

## Dados e Bancos

- **`live/Biblias/*.sqlite`** — 14 versões da Bíblia. Tabelas: `book(id, name)`, `verse(book_id, chapter, verse, text)`. A versão ativa é guardada em `$_SESSION['biblia']`.
- **`live/Hinarios/*.sqlite`** — 4 hinários (Cantor Cristão, Harpa Cristã, etc.).
- **`cultos/YYYY-MM-DD.json`** — Definição do culto do dia. Array de objetos com `tipo` (`hino`, `louvor`, `passagem`, `mensagem`, `extra`) e campos como `titulo`, `letra[]`, `texto[]`, `topicos[]`, `passagem`. Ignorados pelo Git (apenas `.gitkeep`).

## Comunicação Socket.IO

Todos os eventos usam o padrão: `socket.emit("IPE.Transmissão", nomeEvento, dados)`.

Eventos principais:

| Evento | Direção | Propósito |
|---|---|---|
| `hino` / `louvor` / `passagem` / `mensagem` | Painel → Telas | Exibir conteúdo (payload: `{tipo, titulo, corpo}`) |
| `fecharJanela` | Painel → Telas | Ocultar todo conteúdo visível |
| `fecharBiblia` | Painel → Telas | Ocultar passagem bíblica (no contexto de mensagem, oculta só o rodapé) |
| `obsSceneChanged` | OBS/Legendas → Todos | Troca de cena OBS; variável `atual` guarda a cena ativa |
| `pegarDadosMensagem` / `dadosMensagem` | Telas ↔ Painel | Sincronizar dados da mensagem do culto |
| `Alerta` | Painel → Telas | Exibe alerta temporário (bootbox dialog, 5s) |

## Convenções de Código

- **Idioma**: código e variáveis em português (`titulo`, `corpo`, `empresa`, `servidor`, `rodape`).
- **HTML customizado**: as telas usam tags não-padrão como `<passagem>`, `<louvor>`, `<mensagem>`, `<titulo>`, `<corpo>`, `<rodape>` — estilizadas via CSS. Não substituir por `<div>`.
- **jQuery + vanilla JS**: toda manipulação de DOM usa jQuery (`$()`) junto com helpers `query/queryAll/queryId`. Animações com `fadeIn(200)` / `fadeOut(200)`.
- **Bibliotecas locais**: tudo em `live/Bibliotecas/` (Bootstrap 5, jQuery, Font Awesome, Socket.IO client, Bootbox, Animate.css). Sem CDN, sem bundler, sem npm no frontend.
- **Caminhos Windows-style**: nos `src/href` do PHP usa-se `\` (backslash) — ex.: `Bibliotecas\jquery.min.js`. Manter este padrão nos arquivos PHP.
- **Sem framework backend**: PHP puro, sem autoload, sem Composer. `dados.php` é incluído via `include_once`.
- **Parâmetro query string como flag**: `Painel.php?painelOBS` e `Projetor.php?telaPrincipal` — o `array_key_first($_GET)` extrai a flag, que altera comportamento no JS (modo OBS, alertas).

## Servidor Socket.IO (Chat.JS)

```bash
cd Chat.JS && npm install && node index.js
```

O servidor escuta em `0.0.0.0:3000`.

### Configuração do endereço do servidor

O endereço do servidor Socket.IO é definido pela variável `servidor` nos arquivos JS (`Painel.js`, `Projetor.js`, `Televisao.js`, `Legendas.js`, `LegendasAoVivo.js`, `Biblia.js`). Atualmente está hardcoded como `10.0.0.253:3000`.

**Meta**: migrar para variáveis de ambiente via arquivo `.env` na raiz do projeto, permitindo configurar o endereço sem editar código. Ao implementar essa migração, usar um `.env` com chave `SOCKET_SERVER` (ex.: `SOCKET_SERVER=10.0.0.253:3000`) e injetar o valor via PHP nos arquivos `.php` que carregam os scripts, ou via um endpoint JS de configuração. Não esquecer de adicionar `.env` ao `.gitignore`.

## Estrutura de um JSON de Culto

```json
[
  { "tipo": "hino", "titulo": "Hino 001", "letra": ["Estrofe 1", "refrao:Refrão aqui", "Estrofe 2"] },
  { "tipo": "louvor", "titulo": "Nome do Louvor", "letra": ["Verso 1", "refrao:Coro"] },
  { "tipo": "passagem", "titulo": "João 3:16", "texto": ["Versículo completo"] },
  { "tipo": "mensagem", "titulo": "Tema", "passagem": "Ref. bíblica", "topicos": ["Tópico 1"], "texto": ["Texto da passagem"] }
]
```

- Prefixo `refrao:` em `letra[]` indica refrão (renderizado com cor diferente `btn-info` no Painel).

## Módulo Liturgia (Editor)

Aplicação **Node.js/Express** independente localizada em `Liturgia/`. Seu propósito é criar e editar os arquivos JSON de liturgia que o `live/Painel.php` consome.

### Iniciar

```bash
cd Liturgia && npm install && node server.js
# Acesso: http://localhost:3000
```

### Estrutura

```
Liturgia/
  server.js          — Servidor Express (porta 3000)
  package.json
  public/
    index.html       — SPA com layout de 3 colunas
    css/app.css
    js/
      app.js         — Utilitários (jQuery extensions, helpers de string/data)
      capa.js        — Lógica principal da aplicação
```

### Rotas do servidor (`server.js`)

| Método | Rota | Propósito |
|---|---|---|
| `GET` | `/cultos` | Lista todos os arquivos de liturgia (ordem decrescente) |
| `GET` | `/cultos/:arquivo` | Retorna o JSON de uma liturgia específica |
| `POST` | `/dados/nova-liturgia` | Cria arquivo `YYYY-MM-DD.json` vazio |
| `POST` | `/dados/salvar-liturgia` | Persiste o conteúdo JSON de uma liturgia |
| `POST` | `/formularios/:tipo` | Retorna fragmento HTML do formulário de cada tipo (`passagem`, `hino`, `louvor`, `mensagem`, `extra`) |
| `GET` | `/formularios/pesquisar-louvor` | Busca música por título (modal de pesquisa externa) |
| `GET` | `/formularios/pesquisar-louvor-local` | Retorna lista de louvores ya existentes nos cultos + HTML da UI |
| `GET` | `/formularios/pesquisar-hino-local` | Retorna lista de hinos já existentes nos cultos + HTML da UI |

### Armazenamento de dados

Os JSONs de liturgia são gravados em **`IPE/.liturgia/cultos/`** — um diretório no projeto PHP irmão (`IPE`), não dentro do workspace `IPE Live`. O caminho base é configurado via constante `IPE_DIR` no `server.js`. Ao mudar de ambiente, ajustar `IPE_DIR`.

### Compartilhamento de bibliotecas

- `/lib` → `IPE/lib/` (Bootstrap, jQuery, Font Awesome, Bootbox — mesmas versões do `live/Bibliotecas/`)
- `/img` → `IPE/.img/` (logomarca etc.)

### Interface (`public/`)

Layout SPA em 3 colunas:

1. **Lista de liturgias** — arquivos JSON existentes. Botão `+` cria nova liturgia com prompt de data.
2. **Itens da liturgia** — lista dos itens do culto selecionado. Dropdown `+` permite adicionar `Passagem`, `Hino`, `Louvor`, `Mensagem` ou `Extra`.
3. **Formulário de edição** — carregado via AJAX (`/formularios/:tipo`); exibe campos adequados ao tipo selecionado.

### Convenções do módulo

- Usa as mesmas extensões jQuery definidas em `app.js` (`$.filtra`, `$.downloadObj`, etc.).
- Formulários são fragmentos HTML retornados pelo servidor e inseridos no DOM via AJAX — não são páginas completas.
- A função `carregarItens(tipo)` no `server.js` varre todos os JSONs de culto e retorna itens únicos por título, usada para as buscas locais de hinos e louvores.
- As transformações de texto (formatar passagens, letras de hinos/louvores, mensagens) ocorrem no cliente via funções `arrumar*()` em `capa.js`.

### Identidade visual por tipo

As cores abaixo são usadas tanto nos `<li>` da lista de itens da Liturgia quanto nos accordions do `live/Painel.css`. Ao criar ou editar elementos visuais associados a tipos, manter esta paleta:

| Tipo | Fundo (recolhido) | Fundo (expandido/ativo) | Texto |
|---|---|---|---|
| `hino` | `#3d1f6d` | `#5b2d99` | `#e0d0ff` |
| `louvor` | `#1a5632` | `#23784a` | `#c8f0d4` |
| `passagem` | `#14506e` | `#1a6d96` | `#c4e3f5` |
| `mensagem` | `#7a2517` | `#a43220` | `#fdd8d2` |
| `extra` | `#3a3a3a` | `#555555` | `#e0e0e0` |

### Forma de trabalho no módulo Liturgia

1. **Leia sempre os três arquivos principais antes de editar**: `server.js`, `public/js/capa.js` e `public/css/app.css`. O `index.html` raramente muda.
2. **Alterações no servidor** (`server.js`): afetam rotas e geração de fragmentos HTML. Qualquer nova rota deve seguir o padrão REST já existente e retornar HTML (para `/formularios/*`) ou JSON (para `/cultos/*` e `/dados/*`).
3. **Alterações no cliente** (`capa.js`): cada tipo tem um par de funções — `mostra<Tipo>(codigo)` carrega o formulário via AJAX e popula os campos; `arrumar<Tipo>()` lê os campos e monta o JSON final no `#final`. Ao adicionar um novo tipo, criar ambas as funções.
4. **Fragmentos de formulário**: são HTML puro retornado pelo servidor e inserido com `insertAdjacentHTML('afterbegin', …)`. Usar as tags customizadas `<texto>` para o container editor, e `#titulo`, `#original`, `#final` como IDs padrão dos campos.
5. **Salvar**: sempre via `$.post('/dados/salvar-liturgia', { arquivo: documento, data: JSON.stringify(Liturgia) })`. O array `Liturgia` é a fonte única de verdade em memória.
6. **Cores**: aplicar sempre a paleta da tabela acima nos elementos visuais associados a tipos. O item selecionado recebe `bg-warning` (Bootstrap) sobrepondo a cor do tipo.
7. **Não usar CDN, bundlers ou TypeScript** — o frontend usa apenas as bibliotecas em `/lib` servidas pelo Express.

---

## Ao Editar

- Manter a estrutura de tags customizadas HTML — não converter para divs semânticas.
- O conteúdo do `corpo` é transmitido via `encodeURI()` e decodificado com `decodeURI()` nas telas.
- A variável `atual` (cena OBS ativa) controla se passagens bíblicas aparecem como conteúdo principal ou como rodapé dentro de `<mensagem>`.
- `Televisao.js` é praticamente idêntico a `Projetor.js`, mas adiciona relógio via `Hora.php`. `LegendasAoVivo.js` é idêntico a `Legendas.js` com integração OBS direta.
- Ao adicionar ou alterar um comportamento em `Projetor.js`, verificar se a mesma alteração se aplica a `Televisao.js`, `Legendas.js` e `LegendasAoVivo.js` — eles compartilham a mesma lógica base com variações pontuais.
