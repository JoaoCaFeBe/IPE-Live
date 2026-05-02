# Banco De Dados - IPE Live

Data da análise: 2026-05-02

## Escopo Da Análise

Foram analisados apenas arquivos SQLite existentes no projeto e queries presentes no código. Não houve acesso a banco externo, produção, PM2, SSH, FTP ou serviços remotos.

Fontes principais:

- `Liturgia/server.js`
- `Live/server.js`
- `Liturgia/database/Cultos.sqlite`
- `Liturgia/database/Biblias/*.sqlite`
- `Liturgia/database/Hinarios/*.sqlite`
- `Live/database/Biblias/*.sqlite`
- `Live/database/Hinarios/*.sqlite`
- `Liturgia/.gitignore`
- `Live/.gitignore`
- `.gitignore`

## Tipo De Banco

Certeza: o projeto usa SQLite por meio da biblioteca `better-sqlite3`.

Certeza: não foram detectados PostgreSQL, MySQL, Firebird, Redis, migrations SQL formais ou ORM.

## Arquivos SQLite Detectados

### Liturgia

- `Liturgia/database/Cultos.sqlite`: banco principal de cultos, louvores e coral.
- `Liturgia/database/Biblias/*.sqlite`: versões bíblicas.
- `Liturgia/database/Hinarios/*.sqlite`: hinários.
- `Liturgia/database/Hinarios/HNC.sqlite`: arquivo vazio, `0 bytes`.

### Live

- `Live/database/Biblias/*.sqlite`: cópias locais de versões bíblicas.
- `Live/database/Hinarios/*.sqlite`: cópias locais de hinários.

Observação de Git:

- `Liturgia/database/Cultos.sqlite` está ignorado por `Liturgia/.gitignore`.
- Vários arquivos de Bíblia/Hinário são versionados.
- O índice Git registra caminhos `live/` em minúsculo, enquanto a árvore local aparece como `Live/`; com `core.ignorecase=true`, isso funciona no macOS, mas deve ser confirmado antes de deploy em filesystem case-sensitive.

## Datas/Limites Das Fontes Locais

Metadados de arquivo observados:

| Arquivo | Modificação local | Tamanho |
|---|---:|---:|
| `Liturgia/database/Cultos.sqlite` | 2026-03-02 08:55:24 -03 | 2514944 bytes |
| `Liturgia/database/Biblias/Almeida Revista e Atualizada - ARA.sqlite` | 2026-02-28 17:55:04 -03 | 4546560 bytes |
| `Liturgia/database/Hinarios/Hinário Novo Cântico.sqlite` | 2026-02-28 17:54:59 -03 | 876544 bytes |
| `Live/database/Biblias/Almeida Revista e Atualizada - ARA.sqlite` | 2025-07-28 12:34:18 -03 | 4546560 bytes |
| `Live/database/Hinarios/Hinário Novo Cântico.sqlite` | 2025-07-28 12:34:19 -03 | 876544 bytes |
| `Liturgia/database/Hinarios/HNC.sqlite` | 2026-03-01 08:13:54 -03 | 0 bytes |

A confirmar: se esses arquivos são produção, cópia local, seed, backup ou snapshot de desenvolvimento.

## Schema: Cultos.sqlite

Fonte: `.schema` de `Liturgia/database/Cultos.sqlite`.

```sql
CREATE TABLE cultos (
    data_culto TEXT PRIMARY KEY,
    itens TEXT NOT NULL
);

CREATE TABLE louvores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL UNIQUE,
    letra TEXT NOT NULL
);

CREATE TABLE coral (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL UNIQUE,
    letra TEXT NOT NULL
);
```

Também existe `sqlite_sequence`, criada pelo autoincrement.

### Tabela `cultos`

Propósito: guarda uma liturgia por data.

Campos críticos:

- `data_culto`: chave primária textual. No código é derivada de nomes como `YYYY-MM-DD.json`.
- `itens`: JSON stringificado com a ordem do culto.

Relacionamentos inferidos:

- `itens` pode conter referências `louvor_id` e `coral_id`.
- Não há foreign keys declaradas entre `cultos.itens` e `louvores`/`coral`; o relacionamento é lógico no JSON.

Queries relevantes:

- Listar cultos: `SELECT data_culto FROM cultos ORDER BY data_culto DESC`
- Carregar culto: `SELECT itens FROM cultos WHERE data_culto = ?`
- Criar liturgia: `INSERT OR IGNORE INTO cultos (data_culto, itens) VALUES (?, '[]')`
- Salvar liturgia: `INSERT OR REPLACE INTO cultos (data_culto, itens) VALUES (?, ?)`
- Renomear: `UPDATE cultos SET data_culto = ? WHERE data_culto = ?`

Riscos:

- JSON sem validação formal.
- Sem histórico de alteração.
- `INSERT OR REPLACE` pode substituir o registro inteiro.
- Referências `louvor_id`/`coral_id` podem ficar órfãs logicamente se os itens forem editados manualmente.

### Tabela `louvores`

Propósito: catálogo local de louvores reutilizáveis.

Campos críticos:

- `id`: chave primária autoincrement.
- `titulo`: único.
- `letra`: JSON stringificado.

Queries relevantes:

- Inserir/atualizar por título:
  - `INSERT INTO louvores (titulo, letra) VALUES (?, ?) ON CONFLICT(titulo) DO UPDATE SET letra=excluded.letra RETURNING id`
- Atualizar por ID:
  - `UPDATE louvores SET titulo=?, letra=? WHERE id=?`
- Listar:
  - `SELECT titulo, letra FROM louvores ORDER BY titulo COLLATE NOCASE`

Riscos:

- Unicidade por título pode agrupar músicas diferentes com mesmo título.
- Sem auditoria de quem alterou e quando.
- Sem validação JSON do campo `letra`.

### Tabela `coral`

Propósito: catálogo local de músicas do coral.

Campos críticos e riscos: iguais a `louvores`, com tabela separada.

Queries relevantes:

- Inserir/atualizar por título.
- Atualizar por ID.
- Listar por título.

## Schema: Bíblias SQLite

Fonte: `.schema` em arquivos representativos de `Liturgia/database/Biblias/` e `Live/database/Biblias/`.

```sql
CREATE TABLE book (
    id INTEGER,
    book_reference_id INTEGER,
    testament_reference_id INTEGER,
    name TEXT
);

CREATE TABLE metadata (
    key TEXT,
    value TEXT
);

CREATE TABLE testament (
    id INTEGER,
    name TEXT
);

CREATE TABLE verse (
    id INTEGER,
    book_id INTEGER,
    chapter INTEGER,
    verse INTEGER,
    text TEXT
);
```

Chaves de metadata observadas, sem copiar valores:

- `book_name_language`
- `copyright`
- `language_id`
- `name`
- `permissions`
- `version`

Relacionamentos inferidos:

- `verse.book_id` referencia logicamente `book.id`.
- `book.testament_reference_id` referencia logicamente `testament.id`.
- Não foram vistas foreign keys declaradas no schema.

Queries relevantes em `Liturgia/server.js`:

- `SELECT id, name FROM book ORDER BY id`
- `SELECT MAX(chapter) AS total FROM verse WHERE book_id = ?`
- `SELECT MAX(verse) AS total FROM verse WHERE book_id = ? AND chapter = ?`
- Busca de versículos por livro, capítulo e intervalo.

Queries relevantes em `Live/server.js`:

- Lista de livros e capítulos máximos com `INNER JOIN` entre `verse` e `book`.
- Busca de versículos de um capítulo.
- Busca de livros anterior/próximo.

Riscos:

- Sem índices declarados no schema observado; consultas podem ficar mais lentas dependendo do volume.
- Dependência de nomes de arquivos para escolher versão.
- Arquivos duplicados entre `Liturgia` e `Live` podem divergir.
- A ausência de constraints formais exige validação por conteúdo real.

## Schema: Hinários SQLite

Fonte: `.schema` em arquivos representativos de `Liturgia/database/Hinarios/` e `Live/database/Hinarios/`.

Tabelas principais:

- `metadata`
- `authors`
- `song_books`
- `songs`
- `topics`
- `media_files`
- `authors_songs`
- `songs_songbooks`
- `songs_topics`

Tabela crítica:

```sql
CREATE TABLE songs (
    id INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    alternate_title VARCHAR(255),
    lyrics TEXT NOT NULL,
    verse_order VARCHAR(128),
    copyright VARCHAR(255),
    comments TEXT,
    ccli_number VARCHAR(64),
    theme_name VARCHAR(128),
    search_title VARCHAR(255) NOT NULL,
    search_lyrics TEXT NOT NULL,
    create_date DATETIME,
    last_modified DATETIME,
    temporary BOOLEAN,
    PRIMARY KEY (id),
    CHECK ("temporary" IN (0, 1))
);
```

Índices observados:

- `ix_authors_display_name`
- `ix_songs_search_title`
- `ix_topics_name`

Chaves de metadata observadas, sem copiar valores:

- `version`

Queries relevantes:

- Inferir código do hinário:
  - `SELECT title FROM songs ORDER BY id LIMIT 1`
- Buscar por título/número:
  - `SELECT id, title FROM songs ORDER BY title`
- Carregar hino:
  - `SELECT id, title, lyrics FROM songs WHERE id = ?`
- Resolver hino legado por título:
  - `SELECT lyrics FROM songs WHERE title LIKE ? LIMIT 1`

Riscos:

- Parse de letras XML/OpenLyrics por regex, sem parser XML.
- Busca por `LIKE` pode retornar hino errado em casos ambíguos.
- `HNC.sqlite` vazio pode confundir leitura de diretório e mapeamento.

## Contrato JSON Do Culto

Fonte: `Liturgia/server.js`, `Liturgia/public/js/capa.js`, `Live/public/js/Painel.js`.

Itens conhecidos:

### Passagem

Campos inferidos:

- `tipo: "passagem"`
- `titulo`
- `texto`: array de linhas/versículos

### Hino

Campos inferidos:

- `tipo: "hino"`
- `titulo`
- `letra`: array expandido ao servir `GET /Cultos/:arquivo`

Persistência:

- No banco, hino pode ser salvo apenas com `tipo` e `titulo`.
- Ao carregar, `Liturgia/server.js` tenta resolver letra via hinário.

### Louvor

Campos inferidos:

- `tipo: "louvor"`
- `titulo`
- `letra`: array
- `louvor_id`: referência lógica opcional

Persistência:

- `letra` é salva em `louvores`.
- `cultos.itens` preserva referência `louvor_id`.

### Coral

Campos inferidos:

- `tipo: "coral"`
- `titulo`
- `letra`: array
- `coral_id`: referência lógica opcional

Persistência:

- `letra` é salva em `coral`.
- `cultos.itens` preserva referência `coral_id`.

## Pontos Onde O Schema Precisa Ser Confirmado Em Banco Real

- Se `Cultos.sqlite` local é o banco atualmente em uso em produção.
- Quantidade real de cultos, louvores e corais.
- Existência de registros órfãos lógicos em `cultos.itens`.
- Formatos reais encontrados em `itens` para cultos antigos.
- Divergência entre bases `Liturgia/database/Biblias` e `Live/database/Biblias`.
- Divergência entre bases `Liturgia/database/Hinarios` e `Live/database/Hinarios`.
- Se há backups periódicos do banco principal.

## Integridade E Segurança

Riscos de integridade:

- JSON em `TEXT` sem constraints.
- Relações lógicas sem foreign keys.
- Atualização de louvor/coral por título.
- Arquivo de banco principal ignorado pelo Git.
- Bases SQLite duplicadas entre apps.
- Arquivo `HNC.sqlite` vazio.

Riscos de segurança:

- Chave Vagalume hardcoded versionada em `Liturgia/server.js`.
- Segredo de sessão hardcoded versionado em `Live/server.js`.
- `Live/.env` existe localmente e está ignorado; nomes de variáveis sensíveis incluem `OBS_WS_PASS`.
- `Audio.ejs` aceita senha OBS por query string `pass`.

Recomendações, sem executar:

- Migrar segredos hardcoded para variáveis de ambiente.
- Rotacionar a chave Vagalume e o segredo de sessão porque estão versionados.
- Definir backup e restauração do `Cultos.sqlite`.
- Criar rotina read-only para validar JSON de `cultos.itens`.
- Confirmar e remover/recuperar `Liturgia/database/Hinarios/HNC.sqlite`.
- Formalizar sincronização entre bases de `Liturgia` e `Live`.
