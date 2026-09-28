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
