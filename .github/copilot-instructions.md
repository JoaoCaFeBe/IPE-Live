# IPE Live — Instruções para Agentes de IA

## Visão Geral

Sistema de projeção e legendas ao vivo para cultos da Igreja Presbiteriana da Encruzilhada (IPE). Arquitetura pub/sub em tempo real: um **Painel** de controle envia comandos via Socket.IO para múltiplas telas de exibição (Projetor, Televisão, Legendas).

## Arquitetura

```
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

## Ao Editar

- Manter a estrutura de tags customizadas HTML — não converter para divs semânticas.
- O conteúdo do `corpo` é transmitido via `encodeURI()` e decodificado com `decodeURI()` nas telas.
- A variável `atual` (cena OBS ativa) controla se passagens bíblicas aparecem como conteúdo principal ou como rodapé dentro de `<mensagem>`.
- `Televisao.js` é praticamente idêntico a `Projetor.js`, mas adiciona relógio via `Hora.php`. `LegendasAoVivo.js` é idêntico a `Legendas.js` com integração OBS direta.
- Ao adicionar ou alterar um comportamento em `Projetor.js`, verificar se a mesma alteração se aplica a `Televisao.js`, `Legendas.js` e `LegendasAoVivo.js` — eles compartilham a mesma lógica base com variações pontuais.
