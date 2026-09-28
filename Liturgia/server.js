const express = require("express");
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const cors = require("cors");
const { garantirSchema } = require("./lib/schema");
const normalizar = require("./lib/normalizar");
const app = express();
const PORT = process.env.PORT || 3000;
const VAGALUME_API_KEY = process.env.VAGALUME_API_KEY;
if (!VAGALUME_API_KEY) console.warn("[vagalume] VAGALUME_API_KEY ausente — rotas /api/vagalume/* responderao 503");

// Diretório e banco de dados dos cultos (SQLite gerencia Músicas e Liturgias)
const CULTOS_DB_PATH = process.env.CULTOS_DB_PATH
  ? path.resolve(process.env.CULTOS_DB_PATH)
  : path.join(__dirname, "database", "Cultos.sqlite");

// Diretório dos bancos SQLite das Bíblias
const BIBLIAS_DIR = path.join(__dirname, "database", "Biblias");

// Diretório dos bancos SQLite dos Hinários
const HINARIOS_DIR = path.join(__dirname, "database", "Hinarios");

// Mapa código → arquivo: { HNC: 'Hinário Novo Cântico.sqlite', ... }
let HINARIOS_MAP = null;
function carregarMapaHinarios() {
  if (HINARIOS_MAP) return HINARIOS_MAP;
  HINARIOS_MAP = {};
  fs.readdirSync(HINARIOS_DIR)
    .filter((f) => f.endsWith(".sqlite"))
    .forEach((f) => {
      try {
        const db = new Database(path.join(HINARIOS_DIR, f), { readonly: true });
        const s = db
          .prepare("SELECT title FROM songs ORDER BY id LIMIT 1")
          .get();
        db.close();
        if (s && s.title) {
          const m = s.title.match(/^([A-Z]+)\s*\d+/);
          if (m) HINARIOS_MAP[m[1]] = f;
        }
      } catch (_) { }
    });
  return HINARIOS_MAP;
}
function abrirHinario(codigo) {
  const map = carregarMapaHinarios();
  const file = map[(codigo || "HNC").toUpperCase()];
  if (!file) throw new Error("Hinário não encontrado: " + codigo);
  return new Database(path.join(HINARIOS_DIR, file), { readonly: true });
}

/** Extrai código, número e nome do título de hino.
 * Formatos suportados:
 * - "HNC 001 - Doxologia", "CC 001 Antífona", "HC001 - Chuvas", "HCC 001 Oh!"
 * - "Avante, ó crentes (HNC 311)" */
function parseTituloHino(title) {
  const raw = String(title || "").trim();
  if (!raw) return { codigo: "", num: "", nome: "" };

  const formatoNomeCodigo = raw.match(/^(.*?)\s*\(([A-Z]+)\s*(\d{1,4})\)$/i);
  if (formatoNomeCodigo) {
    return {
      codigo: formatoNomeCodigo[2].toUpperCase(),
      num: String(Number(formatoNomeCodigo[3])).padStart(3, "0"),
      nome: formatoNomeCodigo[1].trim() || raw,
    };
  }

  const formatoCodigoNome = raw.match(/^([A-Z]+)\s*(\d+)\s*[-–]?\s*(.*)$/i);
  if (!formatoCodigoNome) return { codigo: "", num: "", nome: raw };
  return {
    codigo: formatoCodigoNome[1].toUpperCase(),
    num: String(Number(formatoCodigoNome[2])).padStart(3, "0"),
    nome: formatoCodigoNome[3].trim() || raw,
  };
}

/** Parseia XML de letras do OpenLyrics para array no formato do sistema.
 * type="v" → verso; type="c" → refrão (prefixado com "refrao:") */
function parseLyricsXml(xml) {
  const re =
    /<verse[^>]*type="([vc])"[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/verse>/g;
  const verses = [];
  let m;
  while ((m = re.exec(xml)) !== null) {
    const texto = m[2].trim()
      .replace(/\{\/?\w+\}/g, "")   // remove tags OpenLyrics: {it}, {/it}, {b}, {/b}, etc.
      .replace(/\n/g, "<br/>");
    if (texto) verses.push(m[1] === "c" ? "refrao:" + texto : texto);
  }
  return verses;
}

/**
 * Abre o banco SQLite de uma versão da Bíblia.
 * Aceita o código curto (ex: 'ARA') e localiza o arquivo correspondente.
 */
function abrirBiblia(versao) {
  const codigo = (versao || "ARA").toUpperCase().trim();
  const files = fs
    .readdirSync(BIBLIAS_DIR)
    .filter((f) => f.endsWith(".sqlite"));
  // Tenta match exato: "ARA.sqlite"
  let file = files.find((f) => f === `${codigo}.sqlite`);
  // Tenta padrão "Nome - ARA.sqlite"
  if (!file)
    file = files.find((f) => {
      const m = f.match(/- ([A-Z0-9]+)\.sqlite$/);
      return m && m[1] === codigo;
    });
  if (!file) throw new Error(`Versão '${codigo}' não encontrada`);
  return new Database(path.join(BIBLIAS_DIR, file), { readonly: true });
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Sem cache para JS locais (app.js, capa.js) — evita versão desatualizada em cache
app.use("/js", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

// Arquivos estáticos do próprio projeto (public/)
app.use(express.static(path.join(__dirname, "public")));

// Imagens da aplicação (agora isoladas e locais em public/img)
app.use("/img", express.static(path.join(__dirname, "public", "img")));

// Garantir que a pasta database existe (não falhar ao procurar SQLite)
const dbDir = path.join(__dirname, "database");
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// ===========================================================================
// CORAL E CANTATAS
// ===========================================================================

/** Catálogo do coral: { cantatas: [{id, nome, musicas: [coral_id em ordem]}], musicas: [{id, titulo, letra}] } */
app.get("/coral/catalogo", (_req, res) => {
  try {
    const db = new Database(CULTOS_DB_PATH, { readonly: true });
    const musicas = db.prepare("SELECT id, titulo, letra FROM coral ORDER BY titulo COLLATE NOCASE")
      .all().map((m) => ({ ...m, letra: JSON.parse(m.letra) }));
    const cantatas = db.prepare("SELECT id, nome FROM cantatas ORDER BY nome COLLATE NOCASE").all();
    const vinculo = db.prepare("SELECT coral_id FROM cantata_musicas WHERE cantata_id = ? ORDER BY ordem");
    cantatas.forEach((c) => { c.musicas = vinculo.all(c.id).map((r) => r.coral_id); });
    db.close();
    res.json({ cantatas, musicas });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const letraValida = (l) => Array.isArray(l) && l.length && l.every((x) => typeof x === "string" && x.trim());

/** Música do coral cadastrada fora de uma liturgia: POST /coral {titulo, letra: [..], cantata_id?} */
app.post("/coral", (req, res) => {
  const titulo = normalizar.tituloLouvor(req.body.titulo || "");
  const letra = req.body.letra;
  if (!req.body.titulo || !letraValida(letra)) return res.status(400).json({ error: "Informe o título e a letra." });
  try {
    const db = new Database(CULTOS_DB_PATH);
    const json = JSON.stringify(letra);
    const igual = db.prepare("SELECT id FROM coral WHERE titulo = ? AND letra = ?").get(titulo, json);
    const id = igual ? igual.id
      : db.prepare("INSERT INTO coral (titulo, letra) VALUES (?, ?) RETURNING id").get(titulo, json).id;
    const cantataId = Number(req.body.cantata_id) || 0;
    if (cantataId && db.prepare("SELECT 1 FROM cantatas WHERE id = ?").get(cantataId)) {
      const { n } = db.prepare("SELECT COALESCE(MAX(ordem), 0) AS n FROM cantata_musicas WHERE cantata_id = ?").get(cantataId);
      db.prepare("INSERT INTO cantata_musicas (cantata_id, coral_id, ordem) VALUES (?, ?, ?)").run(cantataId, id, n + 1);
    }
    db.close();
    res.json({ ok: true, id, titulo });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Nova cantata: POST /cantatas {nome} */
app.post("/cantatas", (req, res) => {
  const nome = normalizar.limparEspacos(req.body.nome || "");
  if (!nome) return res.status(400).json({ error: "Informe o nome da cantata." });
  try {
    const db = new Database(CULTOS_DB_PATH);
    const existe = db.prepare("SELECT id FROM cantatas WHERE nome = ? COLLATE NOCASE").get(nome);
    if (existe) { db.close(); return res.status(409).json({ error: "Já existe uma cantata com esse nome." }); }
    const id = db.prepare("INSERT INTO cantatas (nome) VALUES (?) RETURNING id").get(nome).id;
    db.close();
    res.json({ ok: true, id, nome });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Renomeia e define as músicas (na ordem, podendo repetir): PUT /cantatas/:id {nome, musicas: [coral_id, ...]} */
app.put("/cantatas/:id", (req, res) => {
  const id = Number(req.params.id);
  const nome = normalizar.limparEspacos(req.body.nome || "");
  const musicas = Array.isArray(req.body.musicas) ? req.body.musicas.map(Number).filter(Boolean) : null;
  if (!nome || !musicas) return res.status(400).json({ error: "Dados inválidos." });
  try {
    const db = new Database(CULTOS_DB_PATH);
    if (!db.prepare("SELECT 1 FROM cantatas WHERE id = ?").get(id)) { db.close(); return res.status(404).json({ error: "Cantata não encontrada." }); }
    const outra = db.prepare("SELECT id FROM cantatas WHERE nome = ? COLLATE NOCASE AND id <> ?").get(nome, id);
    if (outra) { db.close(); return res.status(409).json({ error: "Já existe uma cantata com esse nome." }); }
    db.transaction(() => {
      db.prepare("UPDATE cantatas SET nome = ? WHERE id = ?").run(nome, id);
      db.prepare("DELETE FROM cantata_musicas WHERE cantata_id = ?").run(id);
      const ins = db.prepare("INSERT OR IGNORE INTO cantata_musicas (cantata_id, coral_id, ordem) VALUES (?, ?, ?)");
      const existeMusica = db.prepare("SELECT 1 FROM coral WHERE id = ?");
      musicas.filter((m) => existeMusica.get(m)).forEach((m, i) => ins.run(id, m, i + 1));
    })();
    db.close();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Exclui a cantata (as músicas continuam no coral): DELETE /cantatas/:id */
app.delete("/cantatas/:id", (req, res) => {
  try {
    const db = new Database(CULTOS_DB_PATH);
    db.transaction(() => {
      db.prepare("DELETE FROM cantata_musicas WHERE cantata_id = ?").run(Number(req.params.id));
      db.prepare("DELETE FROM cantatas WHERE id = ?").run(Number(req.params.id));
    })();
    db.close();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===========================================================================
// BÍBLIA
// ===========================================================================

/** Lista todas as versões disponíveis (arquivos em Liturgia/Biblias/) */
app.get("/biblia/versoes", (_req, res) => {
  try {
    const files = fs
      .readdirSync(BIBLIAS_DIR)
      .filter((f) => f.endsWith(".sqlite"));
    const versoes = files
      .map((f) => {
        const nome = f.replace(".sqlite", "");
        const m = nome.match(/- ([A-Z0-9]+)$/);
        const codigo = m ? m[1] : nome;
        return { codigo, nome };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    res.json(versoes);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Lista os livros de uma versão: GET /biblia/livros?versao=ARA */
app.get("/biblia/livros", (req, res) => {
  try {
    const db = abrirBiblia(req.query.versao || "ARA");
    const livros = db.prepare("SELECT id, name FROM book ORDER BY id").all();
    db.close();
    res.json(livros);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Total de capítulos de um livro: GET /biblia/capitulos?versao=ARA&livro=1 */
app.get("/biblia/capitulos", (req, res) => {
  try {
    const db = abrirBiblia(req.query.versao || "ARA");
    const row = db
      .prepare("SELECT MAX(chapter) AS total FROM verse WHERE book_id = ?")
      .get(Number(req.query.livro));
    db.close();
    res.json({ total: row ? row.total : 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Total de versículos de um capítulo: GET /biblia/versiculos-count?versao=ARA&livro=1&capitulo=1 */
app.get("/biblia/versiculos-count", (req, res) => {
  try {
    const db = abrirBiblia(req.query.versao || "ARA");
    const row = db
      .prepare(
        "SELECT MAX(verse) AS total FROM verse WHERE book_id = ? AND chapter = ?",
      )
      .get(Number(req.query.livro), Number(req.query.capitulo));
    db.close();
    res.json({ total: row ? row.total : 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Busca versículos: GET /biblia/versiculos?versao=ARA&livro=1&capInicio=1&capFim=2&inicio=5&fim=3 */
app.get("/biblia/versiculos", (req, res) => {
  try {
    const db = abrirBiblia(req.query.versao || "ARA");
    const livroId = Number(req.query.livro);
    // Suporte a parâmetro legado 'capitulo' e novo 'capInicio/capFim'
    const capInicio = Number(req.query.capInicio || req.query.capitulo || 1);
    const capFim = Number(req.query.capFim || req.query.capitulo || capInicio);
    const inicio = req.query.inicio ? Number(req.query.inicio) : null;
    const fim = req.query.fim ? Number(req.query.fim) : null;
    const livro = db.prepare("SELECT name FROM book WHERE id = ?").get(livroId);
    const nomeLivro = livro ? livro.name : "";

    let rows = [];
    if (capInicio === capFim) {
      // Mesmo capítulo
      if (inicio !== null && fim !== null) {
        rows = db
          .prepare(
            "SELECT chapter, verse, text FROM verse WHERE book_id=? AND chapter=? AND verse>=? AND verse<=? ORDER BY chapter, verse",
          )
          .all(livroId, capInicio, inicio, fim);
      } else {
        rows = db
          .prepare(
            "SELECT chapter, verse, text FROM verse WHERE book_id=? AND chapter=? ORDER BY chapter, verse",
          )
          .all(livroId, capInicio);
      }
    } else {
      // Intervalo multi-capítulo
      rows = db
        .prepare(
          `
        SELECT chapter, verse, text FROM verse
        WHERE book_id = ?
          AND (
            (chapter = ? AND verse >= ?) OR
            (chapter > ? AND chapter < ?) OR
            (chapter = ? AND verse <= ?)
          )
        ORDER BY chapter, verse`,
        )
        .all(
          livroId,
          capInicio,
          inicio ?? 1,
          capInicio,
          capFim,
          capFim,
          fim ?? 999,
        );
    }
    db.close();
    res.json({ livro: nomeLivro, capInicio, capFim, versiculos: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===========================================================================
// CULTOS
// ===========================================================================

/** Lista todos os cultos (ordem decrescente) */
app.get("/Cultos", (_req, res) => {
  try {
    const db = new Database(CULTOS_DB_PATH, { readonly: true });
    const rows = db
      .prepare("SELECT data_culto FROM cultos ORDER BY data_culto DESC")
      .all();
    db.close();
    res.json(rows.map((r) => r.data_culto + ".json"));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Serve o JSON de um culto específico expandindo as referências das músicas */
/** Itens do culto como a tela e o Live usam: hino vinculado com o texto do banco,
 *  louvor/coral antigos sem letra expandidos pelo catálogo. null se a data não existe. */
function lerCultoExpandido(db, dataCulto) {
  const row = db.prepare("SELECT itens FROM cultos WHERE data_culto = ?").get(dataCulto);
  if (!row) return null;
  let itens = JSON.parse(row.itens);
  const getLouvor = db.prepare(
    "SELECT titulo, letra FROM louvores WHERE id = ?",
  );
  const getCoral = db.prepare(
    "SELECT titulo, letra FROM coral WHERE id = ?",
  );

  const getHino = db.prepare("SELECT titulo, letra FROM hinos WHERE id = ?");

  // Hino vinculado ao hinário mostra sempre o texto do banco (decisão do João, 28/09/2026:
  // o que foi projetado diferente não é o padrão). Nos demais itens, a letra gravada
  // é o que foi projetado naquele culto e prevalece; itens antigos sem letra são
  // expandidos pelo catálogo (louvor_id/coral_id) ou pelo hinário.
  itens = itens.map((item) => {
    if (item && item.tipo === "hino" && item.hino_id) {
      const h = getHino.get(item.hino_id);
      if (h) return { ...item, titulo: h.titulo, letra: JSON.parse(h.letra) };
    }
    if (item && Array.isArray(item.letra) && item.letra.length) return item;
    // Louvor
    if (item && item.louvor_id) {
      const m = getLouvor.get(item.louvor_id);
      if (m) {
        return { ...item, titulo: m.titulo, letra: JSON.parse(m.letra) };
      }
    }
    // Coral
    if (item && item.coral_id) {
      const m = getCoral.get(item.coral_id);
      if (m) {
        return { ...item, titulo: m.titulo, letra: JSON.parse(m.letra) };
      }
    }

    // Se for hino "legacy" que perdeu a louvor_id de cultos.sqlite (Porque limpamos na conversão)
    if (
      item &&
      item.tipo === "hino" &&
      item.titulo &&
      (!item.letra || item.letra.length === 0)
    ) {
      try {
        const { codigo, num, nome } = parseTituloHino(item.titulo);
        if (codigo && num) {
          const hdb = abrirHinario(codigo);
          // Procura o hino pelo numero, como a tabela songs guarda
          let row = hdb
            .prepare("SELECT lyrics FROM songs WHERE title LIKE ? LIMIT 1")
            .get(`${codigo}%${Number(num)}%`);
          if (!row) {
            row = hdb
              .prepare("SELECT lyrics FROM songs WHERE title LIKE ? LIMIT 1")
              .get(`%${codigo}%${Number(num)}%`);
          }
          if (!row && nome) {
            row = hdb
              .prepare("SELECT lyrics FROM songs WHERE title LIKE ? LIMIT 1")
              .get(`%${nome}%`);
          }
          if (row) {
            item.letra = parseLyricsXml(row.lyrics);
          }
          hdb.close();
        }
      } catch (e) {
        /* Silencioso se não achar, envia o vazio */
      }
    }
    return item;
  });
  return itens;
}

app.get("/Cultos/:arquivo", (req, res) => {
  try {
    const dataCulto = req.params.arquivo.replace(".json", "");
    const db = new Database(CULTOS_DB_PATH, { readonly: true });
    const itens = lerCultoExpandido(db, dataCulto);
    db.close();
    if (!itens) return res.status(404).json([]);
    res.json(itens);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===========================================================================
// DADOS
// ===========================================================================

/* ── Dia passado é só para consulta (decisão do João, 28/09/2026) ─────────── */

/** "AAAA-MM-DD" de hoje no fuso da igreja */
function hojeNaIgreja() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Recife" }).format(new Date());
}
const ehPassada = (dataCulto) => String(dataCulto) < hojeNaIgreja();
const MSG_SO_CONSULTA = "Liturgia de dia passado é só para consulta. Use Duplicar para levá-la a outra data.";

app.get("/dados/hoje", (_req, res) => res.json({ hoje: hojeNaIgreja() }));

/** Cria novo arquivo de liturgia vazio no banco */
app.post("/dados/nova-liturgia", (req, res) => {
  const arquivo = path.basename(
    (req.body.arquivo || "").replace(/^cultos\//, ""),
  );
  if (!arquivo) return res.status(400).send("Arquivo inválido");

  const dataCulto = arquivo.replace(".json", "");
  if (ehPassada(dataCulto)) return res.status(403).json({ error: "Não é possível criar liturgia em dia passado." });
  try {
    const db = new Database(CULTOS_DB_PATH);
    db.prepare(
      "INSERT OR IGNORE INTO cultos (data_culto, itens) VALUES (?, '[]')",
    ).run(dataCulto);
    db.close();
    res.json({ ok: true, arquivo });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Salva o conteúdo JSON condensando as músicas para o banco */
app.post("/dados/salvar-liturgia", (req, res) => {
  const arquivo = path.basename(
    (req.body.arquivo || "").replace(/^cultos\//, ""),
  );
  const dados = req.body.data;
  if (!arquivo || !dados)
    return res.status(400).json({ error: "Dados inválidos" });

  const dataCulto = arquivo.replace(".json", "");
  if (ehPassada(dataCulto)) return res.status(403).json({ error: MSG_SO_CONSULTA });
  try {
    let itens = JSON.parse(dados);
    const db = new Database(CULTOS_DB_PATH);

    // Louvor e coral: o item guarda título e letra (retrato do culto) e aponta para o
    // catálogo. Títulos se repetem entre músicas diferentes, então o catálogo nunca é
    // localizado pelo título sozinho: edição vai pelo id; item novo reaproveita só
    // registro com título E letra idênticos.
    const catalogar = (tabela, item) => {
      const titulo = (item.titulo || "Sem título").trim();
      const letra = JSON.stringify(item.letra);
      const campoId = tabela === "coral" ? "coral_id" : "louvor_id";
      const id = Number(item[campoId]) || 0;
      // A curadoria (scripts/curar.js) renumera o catálogo: um id vindo de uma tela aberta
      // antes dela pode apontar para outra música. Só atualiza se o registro é o mesmo título.
      const doId = id && db.prepare(`SELECT titulo FROM ${tabela} WHERE id = ?`).get(id);
      if (doId && normalizar.chave(doId.titulo) === normalizar.chave(titulo)) {
        db.prepare(`UPDATE ${tabela} SET titulo = ?, letra = ? WHERE id = ?`).run(titulo, letra, id);
        return id;
      }
      const igual = db
        .prepare(`SELECT id FROM ${tabela} WHERE titulo = ? AND letra = ?`)
        .get(titulo, letra);
      if (igual) return igual.id;
      return db
        .prepare(`INSERT INTO ${tabela} (titulo, letra) VALUES (?, ?) RETURNING id`)
        .get(titulo, letra).id;
    };

    itens = itens.map((item) => {
      if (!item) return item;
      // Título no padrão da curadoria (sem numeração, sem caixa alta, sem espaço sobrando)
      if (item.tipo === "coral" && Array.isArray(item.letra)) {
        const titulo = normalizar.tituloLouvor(item.titulo);
        return { tipo: "coral", titulo, letra: item.letra, coral_id: catalogar("coral", { ...item, titulo }) };
      }
      if (item.tipo === "louvor" && Array.isArray(item.letra)) {
        const titulo = normalizar.tituloLouvor(item.titulo);
        return { tipo: "louvor", titulo, letra: item.letra, louvor_id: catalogar("louvores", { ...item, titulo }) };
      }
      // Hino guarda a letra escolhida: resolver de novo pelo título no hinário
      // já trocou hinos na migração de março/2026.
      if (item.tipo === "hino") {
        const hino = { tipo: "hino", titulo: normalizar.limparEspacos(item.titulo), letra: Array.isArray(item.letra) ? item.letra : [] };
        if (item.hino_id) hino.hino_id = Number(item.hino_id);
        return hino;
      }
      return item;
    });

    db.prepare(
      "INSERT OR REPLACE INTO cultos (data_culto, itens) VALUES (?, ?)",
    ).run(dataCulto, JSON.stringify(itens));
    db.close();
    // Devolve os IDs gerados para o cliente atualizar a memória
    const idMap = itens.map(item => {
      if (!item) return {};
      if (item.louvor_id) return { louvor_id: item.louvor_id, titulo: item.titulo };
      if (item.coral_id) return { coral_id: item.coral_id, titulo: item.titulo };
      return {};
    });
    res.json({ ok: true, idMap });
  } catch (e) {
    res.status(400).json({ error: "JSON inválido: " + e.message });
  }
});

/**
 * Duplica a liturgia de uma data para outra (hoje ou futura). Se o destino já tem
 * itens, só acrescenta o que ainda não está lá — mesmo hino/louvor/coral (pelo
 * vínculo ou pelo título) ou mesma passagem não entra de novo.
 */
app.post("/dados/duplicar-liturgia", (req, res) => {
  const origem = String(req.body.origem || "").replace(".json", "");
  const destino = String(req.body.destino || "").replace(".json", "");
  const valida = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d);
  if (!valida(origem) || !valida(destino)) return res.status(400).json({ error: "Datas inválidas" });
  if (origem === destino) return res.status(400).json({ error: "Escolha uma data diferente da original." });
  if (ehPassada(destino)) return res.status(403).json({ error: "O destino precisa ser hoje ou uma data futura." });
  try {
    const db = new Database(CULTOS_DB_PATH);
    const copiar = lerCultoExpandido(db, origem);
    if (!copiar) { db.close(); return res.status(404).json({ error: "Liturgia de origem não encontrada." }); }
    const row = db.prepare("SELECT itens FROM cultos WHERE data_culto = ?").get(destino);
    const destinoItens = row ? JSON.parse(row.itens) : [];

    // Identidades de um item: pelo vínculo com o catálogo e pelo tipo + título
    const identidades = (it) => {
      const k = [`${it.tipo}:${normalizar.chave(it.titulo)}`];
      if (it.hino_id) k.push(`hino#${it.hino_id}`);
      if (it.louvor_id) k.push(`louvor#${it.louvor_id}`);
      if (it.coral_id) k.push(`coral#${it.coral_id}`);
      return k;
    };
    const existentes = new Set(destinoItens.filter(Boolean).flatMap(identidades));
    const acrescentados = [];
    let repetidos = 0;
    for (const it of copiar) {
      if (!it) continue;
      if (identidades(it).some((k) => existentes.has(k))) { repetidos++; continue; }
      identidades(it).forEach((k) => existentes.add(k));
      const novo = { ...it };
      if (novo.tipo === "hino" && novo.hino_id) delete novo.letra; // texto vem sempre do banco
      acrescentados.push(novo);
    }
    db.prepare("INSERT OR REPLACE INTO cultos (data_culto, itens) VALUES (?, ?)")
      .run(destino, JSON.stringify(destinoItens.concat(acrescentados)));
    db.close();
    res.json({ ok: true, arquivo: destino + ".json", acrescentados: acrescentados.length, repetidos, criada: !row });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Renomeia (troca a data de) um culto no SQLite */
app.post("/dados/renomear-liturgia", (req, res) => {
  const antigo = path
    .basename((req.body.antigo || "").replace(/^cultos\//, ""))
    .replace(".json", "");
  const novo = path
    .basename((req.body.novo || "").replace(/^cultos\//, ""))
    .replace(".json", "");
  if (!antigo || !novo)
    return res.status(400).json({ error: "Dados inválidos" });
  if (ehPassada(antigo)) return res.status(403).json({ error: MSG_SO_CONSULTA });
  if (ehPassada(novo)) return res.status(403).json({ error: "Não é possível mover a liturgia para um dia passado." });

  try {
    const db = new Database(CULTOS_DB_PATH);
    const existeRow = db
      .prepare("SELECT 1 FROM cultos WHERE data_culto = ?")
      .get(novo);
    if (existeRow) {
      db.close();
      return res
        .status(409)
        .json({ error: "Já existe uma liturgia nessa data" });
    }
    const stmt = db
      .prepare("UPDATE cultos SET data_culto = ? WHERE data_culto = ?")
      .run(novo, antigo);
    db.close();
    if (stmt.changes === 0)
      return res.status(404).json({ error: "Arquivo não encontrado" });
    res.json({ ok: true, arquivo: novo + ".json" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===========================================================================
// HINÁRIO
// ===========================================================================

/* ── Catálogo de hinos do banco (lib/curadoria.js monta a partir dos hinários) ── */

const NOMES_HINARIOS = { NC: "Novo Cântico", CC: "Cantor Cristão", HC: "Harpa Cristã", HCC: "Hinário para o Culto Cristão" };

/** Hinários com hinos no banco: GET /hinos/hinarios */
app.get("/hinos/hinarios", (_req, res) => {
  const db = new Database(CULTOS_DB_PATH, { readonly: true });
  const rows = db.prepare("SELECT hinario, COUNT(*) AS total FROM hinos GROUP BY hinario").all();
  db.close();
  const ordem = Object.keys(NOMES_HINARIOS);
  res.json(rows
    .map((r) => ({ codigo: r.hinario, nome: NOMES_HINARIOS[r.hinario] || r.hinario, total: r.total }))
    .sort((a, b) => ordem.indexOf(a.codigo) - ordem.indexOf(b.codigo)));
});

/** Busca por número, nome ou trecho da letra: GET /hinos?hinario=NC&q=amor */
app.get("/hinos", (req, res) => {
  const hinario = String(req.query.hinario || "NC");
  const q = normalizar.chave(req.query.q || "");
  const db = new Database(CULTOS_DB_PATH, { readonly: true });
  const rows = db
    .prepare("SELECT id, hinario, numero, variante, nome, titulo, letra, origem, usado_em FROM hinos WHERE hinario = ? ORDER BY numero, variante")
    .all(hinario);
  db.close();
  const numero = /^\d+\s*[a-z]?$/.test(q) ? q.replace(/\s/g, "") : null;
  const lista = rows
    .map((r) => {
      let onde = "";
      if (!q) onde = "todos";
      else if (numero && `${r.numero}${r.variante}`.toLowerCase() === numero) onde = "exato";
      else if (numero && `${r.numero}${r.variante}`.toLowerCase().startsWith(numero)) onde = "numero";
      else if (normalizar.chave(r.nome).includes(q)) onde = "nome";
      else if (q.length >= 4 && normalizar.chave(JSON.parse(r.letra).join(" ").replace(/refrao:|<br\/?>/g, " ")).includes(q)) onde = "letra";
      return onde && { id: r.id, hinario: r.hinario, numero: r.numero, variante: r.variante, nome: r.nome,
        titulo: r.titulo, origem: r.origem, usado_em: r.usado_em, encontrado: onde };
    })
    .filter(Boolean);
  const peso = { exato: 0, numero: 1, nome: 2, letra: 3, todos: 0 };
  res.json(lista.sort((a, b) => peso[a.encontrado] - peso[b.encontrado]));
});

/** Hino completo: GET /hinos/12 */
app.get("/hinos/:id", (req, res) => {
  const db = new Database(CULTOS_DB_PATH, { readonly: true });
  const r = db.prepare("SELECT * FROM hinos WHERE id = ?").get(Number(req.params.id));
  db.close();
  if (!r) return res.status(404).json({ error: "Hino não encontrado" });
  res.json({ ...r, letra: JSON.parse(r.letra) });
});

/** Lista todos os hinários disponíveis */
app.get("/hinario/lista", (_req, res) => {
  const map = carregarMapaHinarios();
  const result = Object.entries(map)
    .map(([codigo, file]) => ({ codigo, nome: file.replace(".sqlite", "") }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  res.json(result);
});

/** Busca hinos por número ou título: GET /hinario/buscar?hinario=HNC&q=amor */
app.get("/hinario/buscar", (req, res) => {
  const codigo = req.query.hinario || "HNC";
  const q = (req.query.q || "").toLowerCase().trim();
  try {
    const db = abrirHinario(codigo);
    const todos = db
      .prepare("SELECT id, title FROM songs ORDER BY title")
      .all();
    db.close();
    const filtrados = todos
      .map((s) => {
        const { num, nome } = parseTituloHino(s.title);
        return {
          id: s.id,
          num,
          nome,
          tituloForm: `${nome} (${codigo} ${num})`,
        };
      })
      .filter(
        (s) => !q || s.nome.toLowerCase().includes(q) || s.num.includes(q),
      );
    res.json(filtrados.slice(0, q ? 80 : 500));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Retorna dados completos de um hino: GET /hinario/hino?hinario=HNC&id=3 */
app.get("/hinario/hino", (req, res) => {
  const codigo = req.query.hinario || "HNC";
  try {
    const db = abrirHinario(codigo);
    const song = db
      .prepare("SELECT id, title, lyrics FROM songs WHERE id = ?")
      .get(Number(req.query.id));
    db.close();
    if (!song) return res.status(404).json({ error: "Hino não encontrado" });
    const { num, nome } = parseTituloHino(song.title);
    const letra = parseLyricsXml(song.lyrics);
    res.json({
      id: song.id,
      num,
      nome,
      tituloForm: `${nome} (${codigo} ${num})`,
      letra,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===========================================================================
// FORMULÁRIOS — retornam fragmentos HTML inseridos no DOM via AJAX
// ===========================================================================

app.post("/formularios/passagem", (_req, res) => {
  res.send(/* html */ `
<div class="d-flex align-items-center gap-2 mb-1">
  <strong id="tituloPass" class="flex-grow-1 px-2 py-1"
    style="background:bisque;border-radius:.25rem;min-height:2.1rem;font-size:1.05rem;display:block;"></strong>
  <button class="btn btn-sm btn-secondary" onclick="passagemAlterar()">
    <i class="fas fa-exchange-alt me-1"></i>Alterar
  </button>
</div>
<texto style="overflow-y:auto;padding:.5rem .75rem;">
  <div id="textoPass" style="line-height:2;"></div>
  <textarea id="final" style="display:none;"></textarea>
</texto>`);
});

app.post("/formularios/hino", (_req, res) => {
  res.send(/* html */ `
<div class="d-flex align-items-center gap-2 mb-1">
  <strong id="tituloHino" class="flex-grow-1 px-2 py-1"
    style="background:bisque;border-radius:.25rem;min-height:2.1rem;font-size:1.05rem;display:block;"></strong>
  <button class="btn btn-sm btn-secondary" onclick="hinoAlterar()">
    <i class="fas fa-exchange-alt me-1"></i>Alterar
  </button>
</div>
<texto style="overflow-y:auto;padding:.5rem .75rem;">
  <div id="letraHino" style="line-height:2;"></div>
  <textarea id="final" style="display:none;"></textarea>
</texto>`);
});

app.post("/formularios/louvor", (_req, res) => {
  res.send(/* html */ `
<div class="d-flex align-items-center gap-2 mb-1">
  <strong id="tituloLouvor" class="flex-grow-1 px-2 py-1"
    style="background:bisque;border-radius:.25rem;min-height:2.1rem;font-size:1.05rem;display:block;"></strong>
  <button class="btn btn-sm btn-outline-secondary" title="Editar letra" onclick="louvorAbrirEditor('louvor');">
    <i class="fas fa-edit limpo"></i>
  </button>
  <button class="btn btn-sm btn-success" title="Pesquisar" onclick="pesquisarLouvor($('#titulo').val());">
    <i class="fas fa-search limpo"></i>
  </button>
</div>
<texto style="overflow-y:auto;padding:.5rem .75rem;">
  <div id="letraLouvor" style="line-height:2;"></div>
  <textarea id="titulo" style="display:none;"></textarea>
  <textarea id="original" style="display:none;"></textarea>
  <textarea id="final" style="display:none;"></textarea>
</texto>`);
});

app.post("/formularios/coral", (_req, res) => {
  res.send(/* html */ `
<div class="d-flex align-items-center gap-2 mb-1">
  <strong id="tituloLouvor" class="flex-grow-1 px-2 py-1"
    style="background:bisque;border-radius:.25rem;min-height:2.1rem;font-size:1.05rem;display:block;"></strong>
  <button class="btn btn-sm btn-outline-secondary" title="Editar letra" onclick="louvorAbrirEditor('coral');">
    <i class="fas fa-edit limpo"></i>
  </button>
</div>
<texto style="overflow-y:auto;padding:.5rem .75rem;">
  <div id="letraLouvor" style="line-height:2;"></div>
  <textarea id="titulo" style="display:none;"></textarea>
  <textarea id="original" style="display:none;"></textarea>
  <textarea id="final" style="display:none;"></textarea>
</texto>`);
});

// ---------------------------------------------------------------------------
// Proxy Vagalume (evita bloqueio CORS no browser)
// ---------------------------------------------------------------------------
const https = require("https");

const VAGALUME_API = "https://api.vagalume.com.br";
const VAGALUME_TIMEOUT_MS = 5000;

function vagalumeGet(endpoint, params, res) {
  if (!VAGALUME_API_KEY) {
    return res.status(503).json({ error: "Vagalume desabilitado: API key ausente" });
  }
  const qs = new URLSearchParams({ ...params, apikey: VAGALUME_API_KEY }).toString();
  const url = `${VAGALUME_API}${endpoint}?${qs}`;

  const req = https.get(url, (remote) => {
    let data = "";
    remote.on("data", (chunk) => { data += chunk; });
    remote.on("end", () => {
      try { res.json(JSON.parse(data)); }
      catch (_) { res.status(502).json({ error: "Resposta inválida da Vagalume" }); }
    });
  });

  req.setTimeout(VAGALUME_TIMEOUT_MS, () => {
    console.error(`[vagalume] timeout apos ${VAGALUME_TIMEOUT_MS}ms — ${endpoint}`);
    req.destroy();
    if (!res.headersSent) res.status(504).json({ error: "Vagalume nao respondeu a tempo" });
  });

  req.on("error", (err) => {
    console.error(`[vagalume] erro de rede — ${endpoint} — ${err && err.message}`);
    if (!res.headersSent) res.status(502).json({ error: "Falha ao conectar à Vagalume" });
  });
}

app.get("/api/vagalume/buscar", (req, res) => {
  const q = (req.query.q || "").trim();
  if (!q) return res.status(400).json({ error: "Parâmetro q obrigatório" });
  vagalumeGet("/search.mus", { q }, res);
});

app.get("/api/vagalume/letra", (req, res) => {
  const musid = (req.query.musid || "").trim();
  if (!musid) return res.status(400).json({ error: "Parâmetro musid obrigatório" });
  vagalumeGet("/search.php", { musid }, res);
});

app.post("/formularios/pesquisar-louvor", (req, res) => {
  const titulo = escHtml(req.body.titulo || "");
  res.send(/* html */ `
<div style="display:grid;grid-template-rows:auto auto;grid-row-gap:.25rem;">
  <div class="input-group">
    <input id="pesquisaTitulo" type="text" class="form-control"
      placeholder="Nome da música / artista" value="${titulo}" autofocus>
    <button class="btn btn-success" type="button"
      onclick="pesquisaMusica($('#pesquisaTitulo').val());">
      <i class="fas fa-search"></i>
    </button>
  </div>
  <div id="mostrarMusicas" class="d-none"
    style="display:grid;grid-template-columns:35% 1fr;grid-column-gap:.25rem;">
    <ul id="listaMusicas" class="ulMenu selecionavel"
      style="border:1px solid silver;border-radius:.25rem;margin:0;"></ul>
    <textarea class="form-control text-nowrap" id="letra" style="resize:none;"></textarea>
  </div>
</div>`);
});

/** Retorna { formulario: HTML, louvores: [] } */
app.get("/formularios/pesquisar-louvor-local", (_req, res) => {
  const louvores = carregarItens("louvor");
  const listaHtml = louvores
    .map((l, i) => `<li codigo="${i}">${escHtml(l.titulo)}${inicioLetra(l.letra)}</li>`)
    .join("\n");
  res.json({
    formulario: /* html */ `
<louvores style="display:grid;grid-template-columns:30% 1fr;grid-column-gap:.25rem;height:70vh;">
  <pesquisa class="border-end" style="display:grid;grid-template-rows:1fr auto;overflow-y:auto;">
    <ul id="louvores" class="ulMenu selecionavel w-100 p-1"
      style="overflow-y:auto;margin-bottom:0;padding-bottom:0;">${listaHtml}</ul>
    <div class="input-group input-group-sm border-top p-1">
      <input type="text" class="form-control" placeholder="Pesquisar louvor"
        oninput="$('#louvores').filtra(this.value);" autofocus>
      <span class="input-group-text"><i class="fa fa-search"></i></span>
    </div>
  </pesquisa>
  <mostrar style="overflow:auto;"></mostrar>
</louvores>`,
    louvores,
  });
});

/** Retorna { formulario: HTML, corais: [] } */
app.get("/formularios/pesquisar-coral-local", (_req, res) => {
  const corais = carregarItens("coral");
  const listaHtml = corais
    .map((l, i) => `<li codigo="${i}">${escHtml(l.titulo)}${inicioLetra(l.letra)}</li>`)
    .join("\n");
  res.json({
    formulario: /* html */ `
<corais style="display:grid;grid-template-columns:30% 1fr;grid-column-gap:.25rem;height:70vh;">
  <pesquisa class="border-end" style="display:grid;grid-template-rows:1fr auto;overflow-y:auto;">
    <ul id="corais" class="ulMenu selecionavel w-100 p-1"
      style="overflow-y:auto;margin-bottom:0;padding-bottom:0;">${listaHtml}</ul>
    <div class="input-group input-group-sm border-top p-1">
      <input type="text" class="form-control" placeholder="Pesquisar coral"
        oninput="$('#corais').filtra(this.value);" autofocus>
      <span class="input-group-text"><i class="fa fa-search"></i></span>
    </div>
  </pesquisa>
  <mostrar style="overflow:auto;"></mostrar>
</corais>`,
    corais,
  });
});

/** Retorna { formulario: HTML, hinos: [] } */
app.get("/formularios/pesquisar-hino-local", (_req, res) => {
  const hinos = carregarItens("hino");
  const listaHtml = hinos
    .map((h, i) => `<li codigo="${i}">${escHtml(h.titulo)}</li>`)
    .join("\n");
  res.json({
    formulario: /* html */ `
<hinos style="display:grid;grid-template-columns:30% 1fr;grid-column-gap:.25rem;height:70vh;">
  <pesquisa class="border-end" style="display:grid;grid-template-rows:1fr auto;overflow-y:auto;">
    <ul id="hinos" class="ulMenu selecionavel w-100 p-1"
      style="overflow-y:auto;margin-bottom:0;padding-bottom:0;">${listaHtml}</ul>
    <div class="input-group input-group-sm border-top p-1">
      <input type="text" class="form-control" placeholder="Pesquisar hino"
        oninput="$('#hinos').filtra(this.value);" autofocus>
      <span class="input-group-text"><i class="fa fa-search"></i></span>
    </div>
  </pesquisa>
  <mostrar style="overflow:auto;"></mostrar>
</hinos>`,
    hinos,
  });
});

// ===========================================================================
// HELPERS
// ===========================================================================

/** Coleta todos os itens de um tipo disponíveis no banco */
function carregarItens(tipo) {
  if (tipo !== "louvor" && tipo !== "coral") return [];
  const tabela = tipo === "coral" ? "coral" : "louvores";
  try {
    const db = new Database(CULTOS_DB_PATH, { readonly: true });
    const rows = db
      .prepare(
        `SELECT id, titulo, letra FROM ${tabela} ORDER BY titulo COLLATE NOCASE, id DESC`,
      )
      .all();
    db.close();

    return rows.map((r) => ({
      tipo,
      titulo: r.titulo,
      letra: JSON.parse(r.letra),
      [tipo === "coral" ? "coral_id" : "louvor_id"]: r.id,
    }));
  } catch (e) {
    return [];
  }
}

/** Início da letra, para distinguir na lista músicas diferentes com o mesmo título */
function inicioLetra(letra) {
  const primeira = String((letra || [])[0] || "")
    .replace(/^refrao:/, "")
    .split(/<br\s*\/?>/i)[0]
    .trim();
  return primeira ? ` <small class="text-muted">— ${escHtml(primeira.slice(0, 40))}</small>` : "";
}

function escHtml(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ===========================================================================
// INICIAR
// ===========================================================================
{
  const db = new Database(CULTOS_DB_PATH);
  garantirSchema(db);
  db.close();
}

app.listen(PORT, () => {
  console.log(`✓ IPE-Liturgia: http://localhost:${PORT}`);
  console.log(`  Banco de dados: ${CULTOS_DB_PATH}`);
});
