# IPE Live — Instruções para Agentes de IA

## Visão Geral

Sistema de projeção, controle e legendas ao vivo para cultos da Igreja Presbiteriana da Encruzilhada (IPE). O projeto possui uma arquitetura **híbrida** (em duas fases/ambientes) para atender ao planejamento e à operação em tempo real:

1. **Preparação (Público/Nuvem)**: A pasta `Liturgia` hospeda um sistema acessível ao público (ou à equipe de liturgia) na internet para construir a pauta do culto com antecedência.
2. **Exibição (Servidor Local)**: O aplicativo em `live` e seu servidor de websockets (`Chat.JS`) rodam no servidor multimídia local da igreja. Ele lê os arquivos gerados pela Liturgia online e controla a projeção em tempo real.

## Arquitetura e Interações entre Pastas

O fluxo de dados segue este ciclo:

```ascii
[PÚBLICO / INTERNET]             [SINCRONIZAÇÃO/FS]                   [SERVIDOR LOCAL DA IGREJA]
  Liturgia/ (Node.js)                                                   Live/Painel.php (PHP)
  Criação do Culto      ───grava──▶  Liturgia/cultos/   ◀───lê───    Lê JSON do culto
         │                              YYYY-MM-DD.json                         │
         │                                                                   socket.emit
         ▼                                                                      │
  Bancos SQLite locais                                                          ▼
  (Bibliotecas e Hinários)                                    Chat.JS/ (Node.js - Socket.IO :3000)
                                                              Servidor de Broadcast (IPE.Transmissão)
                                                                                │
                                                                           broadcast
                                                                                ▼
                                                                Telas de Exibição (Projetor / TVs / OBS)
```

### O que cada pasta faz

- **`Liturgia/` (Editor Público Online)**
  - É uma aplicação web em Node.js independente que pode ser acessada externamente pela equipe.
  - Oferece UI (Single Page Application) para construir o culto do dia.
  - Pesquisa Bíblias e Hinários autonomamente em seus bancos (`Liturgia/Biblias/` e `Liturgia/Hinarios/`).
  - Gera o arquivo primário com os dados consolidados: `Liturgia/cultos/YYYY-MM-DD.json`.
- **Integração Liturgia → Local**
  - O arquivo gerado online fica disponível para o sistema local (provavelmente mapeado por sincronização de nuvem / Cloud Docs ou network drive). O PHP (em `live`) acessa esses arquivos na própria estrutura do sistema.

- **`Live/` (Controle e Exibição Local - PHP)**
  - Hospedado no servidor multimidia da igreja (localhost do templo).
  - **`Painel.php`**: É o "cérebro" do operador local. Ele busca a liturgia do dia na URL configurada (variável `$CULTOS_URL` no `.env` que aponta para a pasta pública) e constrói um painel de controle (accordions com hinos, músicas e bíblias).
  - **`Projetor.php` e `Televisao.php`**: Ficam nos telões e TVs de retorno no salão, aguardando ordens do Painel.
  - **`Legendas.php` e `LegendasAoVivo.php`**: Executados pelo Browser Source do OBS Studio. Adaptados visualmente (fundo verde/chroma e transparências) para servir como lower-thirds e placares na transmissão.
  - **`Biblia.php` e `dados.php`**: Como o ambiente local é focado em exibição e não dependente da internet, ele tem seus próprios bancos SQLite na pasta `Live/Biblias/` para o operador conseguir puxar versículos na hora de forma independente através do recurso (Popup "Bíblico" no Painel).

- **`Chat.JS/` (Servidor de Streaming Interno)**
  - Servidor Node.js embutido de baixo consumo rodando Socket.IO na porta local (3000).
  - Atua apenas como _broadcast router_. Todos os cliques e seleções que o operador faz no `Live/Painel.php` acionam um evento que passa pelo `Chat.JS/index.js` e é reemitido obrigatoriamente para as telas (`Projetor.php`, etc.).

- **`Audio/` (Experimental)**
  - Painel de monitoramento do áudio que usa OBS WebSockets. Ainda não está no pipeline base.

### ⚠️ Regra de Ouro: Sincronização Nuclear entre Liturgia e Live

O **núcleo base** do projeto é a simbiose entre esses dois ambientes:

1. **A `Liturgia` administra (cadastra, formata)** a estrutura e gera o arquivo JSON estruturado.
2. **O ambiente `live` carrega e apresenta** no momento do culto, enviando via sockets para projeção.

**INSTRUÇÃO OBRIGATÓRIA PARA A IA:**
Se o usuário solicitar a **criação de um novo tipo** de card/mídia/texto (ex: um tipo "Aviso", "Vídeo" etc.), a **alteração** da estrutura de um tipo existente, ou sua **exclusão**, você **OBRIGATORIAMENTE** deve lidar com a sincronização do código em ambos os lados!
Isto significa que você nunca deve criar suporte de um "tipo" apenas no `live` ou apenas na `Liturgia`. O fluxo completo precisa que:

- O módulo Node em `Liturgia` (ex: `server.js`, `capa.js`) saiba gerar a interface de cadastro e salvar o JSON adequadamente.
- O módulo de controle PHP em `live` (`Painel.php` e arquivos JS de exibição) saiba ler o novo formato do JSON e injetar nas transmissões via Socket.IO.

Eles se completam. Não presuma que mudanças em um lado afetam o outro magicamente de forma orgânica, a implementação de novos formatos afeta ambos.

## Dados e Bancos

- **`Live/Biblias/*.sqlite`** — 14 versões da Bíblia. Tabelas: `book(id, name)`, `verse(book_id, chapter, verse, text)`. A versão ativa é guardada em `$_SESSION['biblia']`.
- **`Live/Hinarios/*.sqlite`** — 4 hinários (Cantor Cristão, Harpa Cristã, etc.).
- **`Liturgia/cultos/YYYY-MM-DD.json`** — Definição do culto do dia (localização canônica). Array de objetos com `tipo` (`hino`, `louvor`, `passagem`, `mensagem`) e campos como `titulo`, `letra[]`, `texto[]`, `topicos[]`, `passagem`. Ignorados pelo Git (apenas `.gitkeep`). O PHP acessa via variável `$CULTOS_URL` do `.env`; o JS acessa via `cultosUrl` injetado por `bibliotecas.php`.

## Comunicação Socket.IO

Todos os eventos usam o padrão: `socket.emit("IPE.Transmissão", nomeEvento, dados)`.

Eventos principais:

| Evento                                      | Direção              | Propósito                                                              |
| ------------------------------------------- | -------------------- | ---------------------------------------------------------------------- |
| `hino` / `louvor` / `passagem` / `mensagem` | Painel → Telas       | Exibir conteúdo (payload: `{tipo, titulo, corpo}`)                     |
| `fecharJanela`                              | Painel → Telas       | Ocultar todo conteúdo visível                                          |
| `fecharBiblia`                              | Painel → Telas       | Ocultar passagem bíblica (no contexto de mensagem, oculta só o rodapé) |
| `obsSceneChanged`                           | OBS/Legendas → Todos | Troca de cena OBS; variável `atual` guarda a cena ativa                |
| `pegarDadosMensagem` / `dadosMensagem`      | Telas ↔ Painel       | Sincronizar dados da mensagem do culto                                 |
| `Alerta`                                    | Painel → Telas       | Exibe alerta temporário (bootbox dialog, 5s)                           |

## Convenções de Código

- **Idioma**: código e variáveis em português (`titulo`, `corpo`, `empresa`, `servidor`, `rodape`).
- **HTML customizado**: as telas usam tags não-padrão como `<passagem>`, `<louvor>`, `<mensagem>`, `<titulo>`, `<corpo>`, `<rodape>` — estilizadas via CSS. Não substituir por `<div>`.
- **jQuery + vanilla JS**: toda manipulação de DOM usa jQuery (`$()`) junto com helpers `query/queryAll/queryId`. Animações com `fadeIn(200)` / `fadeOut(200)`.
- **Bibliotecas locais**: tudo em `Live/Bibliotecas/` (Bootstrap 5, jQuery, Font Awesome, Socket.IO client, Bootbox, Animate.css). Sem CDN, sem bundler, sem npm no frontend.
- **Caminhos Windows-style**: nos `src/href` do PHP usa-se `\` (backslash) — ex.: `Bibliotecas\jquery.min.js`. Manter este padrão nos arquivos PHP.
- **Sem framework backend**: PHP puro, sem autoload, sem Composer. `dados.php` é incluído via `include_once`.
- **Parâmetro query string como flag**: `Painel.php?painelOBS` e `Projetor.php?telaPrincipal` — o `array_key_first($_GET)` extrai a flag, que altera comportamento no JS (modo OBS, alertas).

## Servidor Socket.IO (Chat.JS)

```bash
cd Chat.JS && npm install && node index.js
```

O servidor escuta em `0.0.0.0:3000`.

### Configuração via `.env`

Todas as variáveis de ambiente ficam em **`Live/.env`** (ignorado pelo Git; commitar apenas `Live/.env.example`). O arquivo é lido por `Live/config.php` (usa `vlucas/phpdotenv` ou `parse_ini_file`) e os valores são injetados como variáveis JS globais por `Live/includes/bibliotecas.php`.

Variáveis disponíveis:

| Variável           | Uso                                              | Exemplo              |
| ------------------ | ------------------------------------------------ | -------------------- |
| `SOCKET_SERVER`    | Endereço `host:porta` do servidor Socket.IO      | `10.0.0.253:3000`    |
| `SOCKET_NAMESPACE` | Namespace Socket.IO                              | `IPE.Transmissão`    |
| `CULTOS_URL`       | Caminho (relativo ao `Live/`) dos JSONs de culto | `../Liturgia/cultos` |

No PHP: `$SOCKET_SERVER`, `$SOCKET_NAMESPACE`, `$CULTOS_URL`. No JS (via `bibliotecas.php`): `servidor`, `empresa`, `cultosUrl`.

O `Liturgia/server.js` usa `process.env.CULTOS_DIR` (com fallback para `path.join(__dirname, 'cultos')`) — não lê o mesmo `.env` do PHP.

## Estrutura de um JSON de Culto e Tipos Atuais Suportados

A base de dados temporária de um culto rodando no aplicativo é totalmente definida por um array JSON (ex: `Liturgia/cultos/2026-03-01.json`).

> ⚠️ **INSTRUÇÃO OBRIGATÓRIA PARA A IA:** Qualquer inclusão de um novo `tipo` de card, ou alteração no funcionamento de um dos listados abaixo (como adição/remoção de keys dentro dos objetos), **DEVE ser obrigatoriamente documentada e atualizada nesta exata seção deste arquivo (`copilot-instructions.md`)**. Este arquivo é a ÚNICA fonte de verdade.

Atualmente, o sistema suporta **5 (cinco)** tipos distintos. Abaixo está a documentação completa da estrutura correspondente a cada um deles:

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
- **Detalhe Principal**: O campo `letra` é um array de estrofes (strings). Quando um item começa com a flag literal `refrao:`, o sistema entende como o refrão/coro. Isso faz o Painel pintar os botões com a classe `.btn-info` para visualização rápida.
- **Busca no hinário**: A função `parseTituloHino(titulo)` em `Liturgia/server.js` suporta **ambos** os formatos (antigo e novo) ao parsear, retornando `{codigo, num, nome}`. Ao **gerar** novos títulos, usar **sempre** o formato `Nome (SIGLA NNN)`.

### 2. `louvor` (Músicas Avulsas)

Semelhante aos hinos, mas serve para músicas contemporâneas/avulsas cuja letra é colada manualmente no formatação livre, estrofe por estrofe.

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

- O conceito da flag `refrao:` funciona exatamente igual ao do `hino`.

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

- **Detalhe Principal**: Cada índice do array `texto` equivale tipicamente a um parágrafo/versículo que o operador pode avançar com as setas para a próxima tela do projetor.

### 4. `mensagem` (Estrutura do Sermão)

Modelo mais híbrido do sistema, projetado para a hora da pregação.

```json
{
  "tipo": "mensagem",
  "titulo": "Sermão do Monte",
  "passagem": "Mateus 5.1-3",
  "topicos": ["1. As Bem-Aventuranças", "2. Sal da terra e Luz do mundo"],
  "texto": ["Vendo Jesus as multidões, subiu ao monte..."]
}
```

- Exibe o Título do Sermão, permite intercalar seus `topicos` principais e ter o texto bíblico-base (`passagem` e `texto`). Na interface da TV/Projetor eles se intercalam inteligentemente baseados na transição de foco guiada pelo pregador.

---

## Módulo Liturgia (Editor)

Aplicação **Node.js/Express** independente localizada em `Liturgia/`. Seu propósito é criar e editar os arquivos JSON de liturgia que o `Live/Painel.php` consome.

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

| Método | Rota                                  | Propósito                                                                                             |
| ------ | ------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `GET`  | `/cultos`                             | Lista todos os arquivos de liturgia (ordem decrescente)                                               |
| `GET`  | `/cultos/:arquivo`                    | Retorna o JSON de uma liturgia específica                                                             |
| `POST` | `/dados/nova-liturgia`                | Cria arquivo `YYYY-MM-DD.json` vazio                                                                  |
| `POST` | `/dados/salvar-liturgia`              | Persiste o conteúdo JSON de uma liturgia                                                              |
| `POST` | `/dados/renomear-liturgia`            | Renomeia o arquivo `YYYY-MM-DD.json` (use: `{ de, para }`)                                            |
| `POST` | `/formularios/:tipo`                  | Retorna fragmento HTML do formulário de cada tipo (`passagem`, `hino`, `louvor`, `mensagem`) |
| `GET`  | `/formularios/pesquisar-louvor`       | Busca música por título (modal de pesquisa externa)                                                   |
| `GET`  | `/formularios/pesquisar-louvor-local` | Retorna lista de louvores ya existentes nos cultos + HTML da UI                                       |
| `GET`  | `/formularios/pesquisar-hino-local`   | Retorna lista de hinos já existentes nos cultos + HTML da UI                                          |

### Armazenamento de dados

Os JSONs de liturgia são gravados em **`Liturgia/cultos/`** — dentro do próprio workspace `IPE Live`. O caminho é configurado via variável de ambiente `CULTOS_DIR` no processo Node.js (com fallback `path.join(__dirname, 'cultos')`). `IPE_DIR` permanece apenas para resolver `/lib` e `/img` estáticos.

### Compartilhamento de bibliotecas

- `/lib` → `IPE/lib/` (Bootstrap, jQuery, Font Awesome, Bootbox — mesmas versões do `Live/Bibliotecas/`)
- `/img` → `IPE/.img/` (logomarca etc.)

### Interface (`public/`)

Layout SPA em 3 colunas:

1. **Lista de liturgias** — arquivos JSON existentes. Botão `+` cria nova liturgia com prompt de data.
2. **Itens da liturgia** — lista dos itens do culto selecionado. Dropdown `+` permite adicionar `Passagem`, `Hino`, `Louvor` ou `Mensagem`.
3. **Formulário de edição** — carregado via AJAX (`/formularios/:tipo`); exibe campos adequados ao tipo selecionado.

### Convenções do módulo

- Usa as mesmas extensões jQuery definidas em `app.js` (`$.filtra`, `$.downloadObj`, `$.passarObjeto`, etc.).
- Formulários são fragmentos HTML retornados pelo servidor e inseridos no DOM via AJAX — não são páginas completas.
- A função `carregarItens(tipo)` no `server.js` varre todos os JSONs de culto e retorna itens únicos por título, usada para as buscas locais de hinos e louvores.
- As transformações de texto (formatar passagens, letras de hinos/louvores, mensagens) ocorrem no cliente via funções `arrumar*()` em `capa.js`.
- **Feedback visual**: `mostrarToast(mensagem, tipo)` exibe toast Bootstrap canto inferior direito (2,5 s). Usar em todas as operações assíncronas.
- **Renomear liturgia**: duplo clique no item da lista abre `bootbox.prompt` → `POST /dados/renomear-liturgia`.
- **Atalhos de teclado**: `Ctrl+S` → `salvar()`; `Delete` (fora de inputs) → `excluir()` com confirmação.

### Identidade visual por tipo

As cores abaixo são usadas tanto nos `<li>` da lista de itens da Liturgia quanto nos accordions do `Live/Painel.css`. Ao criar ou editar elementos visuais associados a tipos, manter esta paleta:

| Tipo       | Fundo (recolhido) | Fundo (expandido/ativo) | Texto     |
| ---------- | ----------------- | ----------------------- | --------- |
| `hino`     | `#3d1f6d`         | `#5b2d99`               | `#e0d0ff` |
| `louvor`   | `#1a5632`         | `#23784a`               | `#c8f0d4` |
| `passagem` | `#14506e`         | `#1a6d96`               | `#c4e3f5` |
| `mensagem` | `#7a2517`         | `#a43220`               | `#fdd8d2` |

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

---

## Arquivos Temporários

> ⚠️ **INSTRUÇÃO OBRIGATÓRIA PARA A IA:** Todo arquivo criado para fins temporários — diagnóstico, análise de dados, migração, teste, script pontual, verificação ou qualquer outra finalidade que **não** seja parte permanente do projeto — **DEVE ser excluído imediatamente após o uso**, ainda dentro da mesma sessão de trabalho.

### Regras

1. **Criação com nome explicitamente temporário**: prefixar sempre com `.tmp_` (ex.: `.tmp_normalizar_titulos.py`, `.tmp_diagnostico.sql`). Isso torna a intenção inequívoca e facilita limpeza em lote se necessário.
2. **Exclusão imediata**: ao final da operação para a qual o arquivo foi criado, executar `rm -f <arquivo>` ou `rm -rf <pasta>` antes de encerrar a tarefa.
3. **Nunca commitar**: arquivos `.tmp_*` estão cobertos pelo `.gitignore` raiz — confirmar que a regra `**/.tmp_*` ou equivalente esteja presente antes de criar qualquer temporário.
4. **Sem exceções**: mesmo que o arquivo ainda possa "ser útil depois", não deixar no workspace. Se a lógica for relevante para o projeto, incorporá-la ao código permanente apropriado em vez de manter um script solto.
