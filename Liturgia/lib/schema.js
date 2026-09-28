/**
 * Schema do Cultos.sqlite — criado ou ajustado na subida do servidor e na importação.
 *
 * `louvores` e `coral` são catálogos de busca: títulos podem se repetir, porque
 * músicas diferentes têm o mesmo nome. Bancos antigos tinham `titulo UNIQUE`;
 * a tabela é reconstruída sem a restrição, preservando os ids.
 */
function tituloUnico(db, tabela) {
  return db
    .prepare(`PRAGMA index_list(${tabela})`)
    .all()
    .some((idx) => {
      if (!idx.unique) return false;
      const colunas = db.prepare(`PRAGMA index_info("${idx.name}")`).all();
      return colunas.length === 1 && colunas[0].name === "titulo";
    });
}

function criarCatalogo(db, tabela) {
  db.exec(`CREATE TABLE IF NOT EXISTS ${tabela} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    letra TEXT NOT NULL
  )`);
  db.exec(`CREATE INDEX IF NOT EXISTS ${tabela}_titulo ON ${tabela} (titulo COLLATE NOCASE)`);
}

function garantirSchema(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS cultos (
    data_culto TEXT PRIMARY KEY,
    itens TEXT NOT NULL
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS cultos_legado (
    data_culto TEXT PRIMARY KEY,
    json TEXT NOT NULL,
    importado_em TEXT NOT NULL
  )`);

  // Hinários (OpenLP) com o refrão na ordem cantada; usado_em = última vez que a igreja cantou
  db.exec(`CREATE TABLE IF NOT EXISTS hinos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hinario TEXT NOT NULL,
    numero INTEGER NOT NULL,
    variante TEXT NOT NULL DEFAULT '',
    nome TEXT NOT NULL,
    titulo TEXT NOT NULL,
    letra TEXT NOT NULL,
    origem TEXT NOT NULL DEFAULT 'hinario',
    usado_em TEXT
  )`);
  db.exec("CREATE INDEX IF NOT EXISTS hinos_numero ON hinos (hinario, numero)");

  // Cantatas do coral: nome + músicas em ordem. A música é cadastrada uma vez só no coral e
  // pode estar em várias cantatas, em nenhuma, e até repetir na mesma cantata ("Ajoelhai",
  // 2024, abre e fecha com a mesma música) — por isso a chave é a posição, não a música.
  // coral_id é remapeado pela curadoria quando ela renumera o catálogo.
  db.exec(`CREATE TABLE IF NOT EXISTS cantatas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL
  )`);
  const chaveAntiga = db.prepare("PRAGMA table_info(cantata_musicas)").all()
    .some((c) => c.name === "coral_id" && c.pk > 0);
  if (chaveAntiga) {
    // Banco criado com a chave (cantata, música), que impedia repetir música na cantata
    db.transaction(() => {
      db.exec("ALTER TABLE cantata_musicas RENAME TO cantata_musicas_antiga");
      db.exec(`CREATE TABLE cantata_musicas (
        cantata_id INTEGER NOT NULL,
        ordem INTEGER NOT NULL,
        coral_id INTEGER NOT NULL,
        PRIMARY KEY (cantata_id, ordem)
      )`);
      db.exec("INSERT INTO cantata_musicas (cantata_id, ordem, coral_id) SELECT cantata_id, ordem, coral_id FROM cantata_musicas_antiga");
      db.exec("DROP TABLE cantata_musicas_antiga");
    })();
  }
  db.exec(`CREATE TABLE IF NOT EXISTS cantata_musicas (
    cantata_id INTEGER NOT NULL,
    ordem INTEGER NOT NULL,
    coral_id INTEGER NOT NULL,
    PRIMARY KEY (cantata_id, ordem)
  )`);
  // Marcas de operações que rodam uma vez só (ex.: cantatas iniciais já semeadas)
  db.exec(`CREATE TABLE IF NOT EXISTS config (
    chave TEXT PRIMARY KEY,
    valor TEXT
  )`);

  for (const tabela of ["louvores", "coral"]) {
    const existe = db
      .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?")
      .get(tabela);
    if (existe && tituloUnico(db, tabela)) {
      db.transaction(() => {
        db.exec(`ALTER TABLE ${tabela} RENAME TO ${tabela}_antiga`);
        criarCatalogo(db, tabela);
        db.exec(`INSERT INTO ${tabela} (id, titulo, letra) SELECT id, titulo, letra FROM ${tabela}_antiga`);
        db.exec(`DROP TABLE ${tabela}_antiga`);
      })();
    } else {
      criarCatalogo(db, tabela);
    }
  }
}

module.exports = { garantirSchema };
