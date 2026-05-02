# Módulos - IPE Live

Data da análise: 2026-05-02

## Visão Geral

O sistema possui duas aplicações Node sincronizadas por contrato de dados:

- `Liturgia`: cria e persiste a liturgia.
- `Live`: carrega a liturgia e opera projeção/legendas em tempo real.

Sempre que um tipo de conteúdo for criado, alterado ou removido, o impacto deve ser avaliado nos dois lados.

## Módulo: Editor De Liturgia

Nome: Editor de liturgia

Propósito: permitir que a equipe monte a ordem do culto por data, adicionando passagens, hinos, louvores e coral.

Arquivos principais:

- `Liturgia/server.js`
- `Liturgia/public/index.html`
- `Liturgia/public/js/app.js`
- `Liturgia/public/js/capa.js`
- `Liturgia/public/css/app.css`

Tabelas/fontes de dados:

- `Liturgia/database/Cultos.sqlite`
- Tabela `cultos`
- Tabela `louvores`
- Tabela `coral`
- APIs de Bíblia e hinário do próprio `Liturgia/server.js`

Telas/endpoints/eventos:

- `GET /Cultos`
- `GET /Cultos/:arquivo`
- `POST /dados/nova-liturgia`
- `POST /dados/salvar-liturgia`
- `POST /dados/renomear-liturgia`
- UI principal em `/`

Regras importantes:

- `documento` no frontend guarda apenas o nome do arquivo lógico, por exemplo `2026-03-01.json`.
- O arquivo JSON é uma abstração de compatibilidade; a persistência real é SQLite.
- `salvar()` preserva `louvor_id` e `coral_id` já existentes quando o formulário não os traz de volta.
- Alterar ordem (`up`, `down`) salva imediatamente a liturgia.

Riscos e pontos frágeis:

- Não há autenticação visível no código.
- `Cultos.sqlite` está ignorado pelo Git; perda local pode apagar liturgias se não houver backup.
- O conteúdo de `cultos.itens` é JSON em `TEXT`, sem validação de schema formal.
- Como os formulários são fragmentos HTML enviados pelo backend, mudanças de DOM podem quebrar funções globais em `capa.js`.

Como validar manualmente:

- Abrir `Liturgia` localmente após aprovação para executar servidor.
- Criar liturgia de teste.
- Adicionar uma passagem, um hino, um louvor e um coral.
- Salvar, reabrir a liturgia e confirmar que os itens continuam.
- Renomear uma liturgia e confirmar conflito quando a data já existir.

## Módulo: Passagens Bíblicas Na Liturgia

Nome: Passagens bíblicas

Propósito: pesquisar e inserir trechos bíblicos no culto.

Arquivos principais:

- `Liturgia/server.js`
- `Liturgia/public/js/capa.js`
- `Liturgia/database/Biblias/*.sqlite`

Tabelas/fontes de dados:

- `book`
- `verse`
- `metadata`
- `testament`

Telas/endpoints/eventos:

- `GET /biblia/versoes`
- `GET /biblia/livros`
- `GET /biblia/capitulos`
- `GET /biblia/versiculos-count`
- `GET /biblia/versiculos`
- Funções frontend: `bibliaIniciar`, `bibliaBuscar`, `passagemEscolher`, `pmBuscar`

Regras importantes:

- Suporta intervalo dentro do mesmo capítulo e intervalo entre capítulos.
- O texto é montado no formato interno `[Livro.capitulo.versiculo] texto`.
- Ao projetar, `Base.js` remove prefixos técnicos e exibe numeração amigável.

Riscos e pontos frágeis:

- As tabelas de Bíblia não possuem chaves primárias/índices declarados no schema observado; performance depende do tamanho e uso real.
- Os arquivos têm nomes com acentos e normalização Unicode; isso pode causar problemas em deploys case-sensitive ou sistemas que alterem normalização.

Como validar manualmente:

- Listar versões no seletor.
- Selecionar livro, capítulo inicial/final e versículos.
- Confirmar título gerado.
- Salvar passagem e verificar no `Live/Painel` se aparece no culto do dia.

## Módulo: Hinários

Nome: Hinários

Propósito: pesquisar hinos por hinário, número ou título e inserir letra formatada na liturgia.

Arquivos principais:

- `Liturgia/server.js`
- `Liturgia/public/js/capa.js`
- `Liturgia/database/Hinarios/*.sqlite`

Tabelas/fontes de dados:

- `songs`
- `metadata`
- `authors`
- `song_books`
- `topics`
- tabelas relacionais do schema OpenLP/OpenLyrics

Telas/endpoints/eventos:

- `GET /hinario/lista`
- `GET /hinario/buscar`
- `GET /hinario/hino`
- Funções frontend: `hinarioCarregarLista`, `hinarioBuscar`, `hinarioSelecionarHino`, `hinoLocal`

Regras importantes:

- `carregarMapaHinarios()` tenta inferir código do hinário pelo título do primeiro hino.
- `parseTituloHino()` entende formatos como `HNC 001 - Doxologia` e `Nome (HNC 311)`.
- `parseLyricsXml()` transforma XML/OpenLyrics em array de estrofes, prefixando refrões com `refrao:`.
- Hinos não são salvos na tabela `louvores`; a liturgia preserva `tipo: hino` e `titulo`.

Riscos e pontos frágeis:

- `Liturgia/database/Hinarios/HNC.sqlite` está vazio, embora exista outro arquivo de Novo Cântico válido.
- A inferência de código por regex depende do título do primeiro hino.
- XML de letras é parseado por expressão regular; variações do OpenLyrics podem escapar.

Como validar manualmente:

- Abrir modal de hino.
- Buscar por número e por palavra.
- Selecionar hino com refrão e confirmar a marcação visual.
- Salvar e verificar no `Live/Painel`.

## Módulo: Louvores E Coral

Nome: Louvores e coral

Propósito: cadastrar/reutilizar letras de músicas avulsas e coral.

Arquivos principais:

- `Liturgia/server.js`
- `Liturgia/public/js/capa.js`
- `Liturgia/database/Cultos.sqlite`

Tabelas/fontes de dados:

- `louvores`
- `coral`

Telas/endpoints/eventos:

- `POST /formularios/louvor`
- `POST /formularios/coral`
- `GET /formularios/pesquisar-louvor-local`
- `GET /formularios/pesquisar-coral-local`
- `POST /dados/salvar-liturgia`

Regras importantes:

- Títulos são únicos em cada tabela.
- `POST /dados/salvar-liturgia` usa `ON CONFLICT(titulo) DO UPDATE` para louvores/coral sem ID.
- Se houver `louvor_id` ou `coral_id`, atualiza pelo ID.
- Refrões são indicados por `refrao:`.

Riscos e pontos frágeis:

- Atualização por título pode sobrescrever letra existente se duas músicas diferentes tiverem o mesmo título.
- Não há histórico/versionamento de letras.
- O campo `letra` é JSON em `TEXT`, sem schema formal.

Como validar manualmente:

- Criar novo louvor e novo coral.
- Editar letra e salvar.
- Reabrir busca local e confirmar reutilização.
- Confirmar que IDs permanecem depois de salvar novamente.

## Módulo: Proxy Vagalume

Nome: Busca online de letras

Propósito: permitir pesquisa de músicas na Vagalume sem chamada direta do browser.

Arquivos principais:

- `Liturgia/server.js`
- `Liturgia/public/js/capa.js`

Fontes de dados:

- API externa Vagalume.

Telas/endpoints/eventos:

- `GET /api/vagalume/buscar`
- `GET /api/vagalume/letra`
- Funções frontend: `pesquisarLouvor`, `pesquisaMusica`

Regras importantes:

- A rota exige `q` para busca e `musid` para letra.
- A resposta remota é parseada como JSON.

Riscos e pontos frágeis:

- Chave de API hardcoded e versionada em `Liturgia/server.js`. O valor não deve ser copiado; recomenda-se rotação e migração para variável de ambiente.
- Sem timeout explícito na chamada `https.get`.
- Dependência externa pode afetar a operação de cadastro.

Como validar manualmente:

- Buscar música conhecida.
- Selecionar resultado.
- Confirmar preenchimento do título e letra.
- Validar comportamento quando a API está fora ou sem resultado.

## Módulo: Painel Live

Nome: Painel do operador

Propósito: carregar o culto do dia e permitir ao operador enviar slides, passagens e alertas às telas.

Arquivos principais:

- `Live/server.js`
- `Live/views/Painel.ejs`
- `Live/public/js/Painel.js`
- `Live/public/css/Painel.css`

Tabelas/fontes de dados:

- `Live/database/Biblias/*.sqlite`
- JSON de culto via `cultosUrl`, que aponta para `/api/cultos`
- Sessão Express para versão bíblica selecionada

Telas/endpoints/eventos:

- `GET /Painel`
- `GET /api/cultos/:arquivo`
- Eventos Socket.IO: `hino`, `louvor`, `passagem`, `Alerta`, `fecharJanela`, `fecharBiblia`

Regras importantes:

- O arquivo do culto do dia é calculado por data local no browser.
- O painel monta accordions por tipo.
- Letras são agrupadas em slides de até 4 linhas.
- Atalhos por letras A-Z alternam estrofes com `data-letra`.
- `?painelOBS` filtra grupos conforme evento `obsSceneChanged`.

Riscos e pontos frágeis:

- Sem autenticação visível.
- A data do culto depende do relógio/timezone do browser.
- Se `cultosUrl` falhar, o culto não carrega.
- O servidor Socket.IO aceita broadcast genérico.

Como validar manualmente:

- Abrir `/Painel`.
- Confirmar carregamento do culto do dia.
- Enviar título e estrofes.
- Enviar alerta.
- Abrir popup Bíblia e navegar por teclado.

## Módulo: Socket.IO E Broadcast

Nome: Roteador Socket.IO

Propósito: repetir em tempo real eventos enviados pelo painel para todas as telas conectadas.

Arquivos principais:

- `Live/server.js`
- `Live/public/js/Base.js`
- `Live/public/js/Painel.js`
- `Live/public/js/Biblia.js`

Fontes de dados:

- Payloads enviados por browser.

Telas/endpoints/eventos:

- Socket.IO embutido no mesmo HTTP server de `Live/server.js`.
- `socket.onAny((empresa, funcao, args) => io.emit(empresa, funcao, args))`.

Regras importantes:

- O primeiro argumento lógico é `empresa`, vindo de `SOCKET_NAMESPACE`.
- `Base.js` só processa eventos cujo primeiro argumento bate com `empresa`.

Riscos e pontos frágeis:

- Sem autenticação/autorização por cliente.
- CORS lista origens específicas, mas isso não substitui autenticação.
- Qualquer evento recebido é reemitido, incluindo nomes inesperados.

Como validar manualmente:

- Abrir `/Painel` e `/Projetor` em dois navegadores.
- Enviar uma passagem e confirmar atualização.
- Fechar accordion e confirmar `fecharJanela`.

## Módulo: Telas De Projeção

Nome: Projetor e Televisão

Propósito: exibir conteúdo selecionado pelo operador em tela grande e TV de retorno.

Arquivos principais:

- `Live/views/Projetor.ejs`
- `Live/views/Televisao.ejs`
- `Live/public/js/Base.js`
- `Live/public/js/Projetor.js`
- `Live/public/js/Televisao.js`
- `Live/public/css/Projetor.css`
- `Live/public/css/Televisao.css`

Fontes de dados:

- Eventos Socket.IO.
- `GET /Hora` para relógio da televisão.

Telas/endpoints/eventos:

- `GET /Projetor`
- `GET /Televisao`
- `GET /Hora` e `/Hora.php`
- Eventos: `hino`, `louvor`, `passagem`, `fecharJanela`, `fecharBiblia`, `Alerta` para TV.

Regras importantes:

- `Projetor.js` usa `elementoConteudo: corpo` e não exibe alertas.
- `Televisao.js` exibe relógio quando não há conteúdo.
- `Base.js` manipula tags customizadas `<passagem>` e `<louvor>`.

Riscos e pontos frágeis:

- Tags customizadas são parte do contrato visual; troca de HTML pode quebrar CSS/JS.
- Relógio depende de sincronização periódica com o servidor.

Como validar manualmente:

- Abrir `/Projetor` e `/Televisao`.
- Enviar passagem, louvor e fechamento pelo painel.
- Confirmar relógio na televisão quando não houver conteúdo.

## Módulo: Legendas Para OBS

Nome: Legendas e LegendasAoVivo

Propósito: exibir conteúdo em lower-third/rodapé para OBS.

Arquivos principais:

- `Live/views/Legendas.ejs`
- `Live/views/LegendasAoVivo.ejs`
- `Live/public/js/Base.js`
- `Live/public/js/Legendas.js`
- `Live/public/js/LegendasAoVivo.js`
- `Live/public/css/Legendas.css`

Fontes de dados:

- Eventos Socket.IO.
- Evento OBS `obsSceneChanged` via `window.obsstudio`, quando disponível.

Telas/endpoints/eventos:

- `GET /Legendas`
- `GET /LegendasAoVivo`
- `obsSceneChanged`
- `hino`, `louvor`, `passagem`

Regras importantes:

- `Legendas.js` aplica delay de 1500 ms.
- `LegendasAoVivo.js` não aplica delay.
- Ambas usam `elementoConteudo: rodape`, `integracaoOBS: true` e `juntarLinhasEmPares: true`.

Riscos e pontos frágeis:

- Depende de ambiente OBS/browser source para `window.obsstudio`.
- Agrupamento de linhas mede largura real do elemento; alterações de CSS podem afetar quebra.

Como validar manualmente:

- Abrir as duas rotas como browser source ou navegador.
- Enviar estrofes longas.
- Confirmar delay na rota `/Legendas` e ausência de delay em `/LegendasAoVivo`.

## Módulo: Popup Bíblico Do Live

Nome: Popup Bíblia

Propósito: permitir ao operador navegar por capítulo/versículo e enviar passagem avulsa durante o culto.

Arquivos principais:

- `Live/server.js`
- `Live/views/Biblia.ejs`
- `Live/public/js/Biblia.js`

Tabelas/fontes de dados:

- `Live/database/Biblias/*.sqlite`
- Tabelas `book` e `verse`

Telas/endpoints/eventos:

- `GET /Biblia`
- Evento Socket.IO `passagem`

Regras importantes:

- Usa session para manter versão bíblica selecionada.
- Navega com setas entre versículos, capítulos e livros.
- Ao mudar versículo, emite `passagem` imediatamente.

Riscos e pontos frágeis:

- Nome do arquivo de Bíblia vem de query/session, protegido por `path.basename`, mas ainda depende de arquivo local válido.
- Popup usa `window.open`; bloqueadores de popup podem interferir.

Como validar manualmente:

- Abrir pelo botão Bíblia no painel.
- Navegar por setas.
- Confirmar que a projeção recebe cada versículo.

## Módulo: Monitor De Áudio OBS

Nome: Monitor de áudio

Propósito: mostrar medidores de volume por input do OBS via OBS WebSocket.

Arquivos principais:

- `Live/server.js`
- `Live/views/Audio.ejs`

Fontes de dados:

- OBS WebSocket v5.
- Variáveis `OBS_WS_HOST`, `OBS_WS_PORT`, `OBS_WS_PASS`.
- Query string opcional `host`, `port`, `pass`.

Telas/endpoints/eventos:

- `GET /Audio`
- WebSocket `ws://host:port`
- Evento OBS `InputVolumeMeters`

Regras importantes:

- Autenticação OBS usa hash SHA-256 no browser quando o OBS exige senha.
- Reconnect automático a cada 4 segundos após desconexão.
- Exibe canais mono/estéreo com pico e leitura em dB.

Riscos e pontos frágeis:

- Senha via query string `pass` pode vazar em histórico, logs ou prints.
- Sem TLS no WebSocket OBS (`ws://`).
- Se o OBS WebSocket estiver exposto na rede, senha e firewall são críticos.

Como validar manualmente:

- Abrir `/Audio` com OBS WebSocket ativo.
- Confirmar status conectado.
- Falar/tocar áudio e observar medidores.
- Testar desconexão/reconexão.

## Módulo: Integração YouTube

Nome: Redirecionamento do chat/live

Propósito: encaminhar para a live do canal configurado.

Arquivos principais:

- `Live/server.js`

Telas/endpoints/eventos:

- `GET /Chat.php`

Regras importantes:

- Redireciona para `/channel/{channelId}/live`.
- `channelId` é identificador público de canal, não foi tratado como segredo.

Riscos e pontos frágeis:

- Não há validação se há live ativa.
- Se o canal mudar, exige alteração de código/config.

Como validar manualmente:

- Acessar `/Chat.php` em ambiente autorizado.
- Confirmar redirecionamento para o canal correto.

## Módulo: Camada Local De IA

Nome: Governança IA/Codex

Propósito: orientar agentes e preservar instruções locais do projeto.

Arquivos principais:

- `AGENTS.md`
- `CLAUDE.md`
- `GEMINI.md`
- `.ai/AI_BOOTSTRAP.md`
- `.ai/INSTRUCTIONS.md`
- `.ai/SKILLS_CATALOG.md`
- `.ai/docs/*`
- `.codex/skills/*/SKILL.md`

Fontes de dados:

- Documentos locais e symlinks `.agents -> .codex`, `.claude/skills -> ../.codex/skills`.

Regras importantes:

- Projeto standalone.
- Não herdar template Laravel.
- Usar `node-runtime`, `orquestrador` e `seguranca-config` quando aplicável.

Riscos e pontos frágeis:

- `.github/copilot-instructions.md` e `.gemini/GEMINI.md` são compatibilidade; agentes antigos podem ler conteúdo migrado se não seguirem wrappers.
- A camada IA ainda está em arquivos não commitados nesta árvore de trabalho.

Como validar manualmente:

- Conferir wrappers.
- Conferir catálogo contra `.codex/skills/*/SKILL.md`.
- Rodar scan de conflitos em `.ai`, `.project` e wrappers.
