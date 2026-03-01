const express = require("express");
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const cors = require("cors");
const app = express();
const PORT = process.env.PORT || 3000;

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
      } catch (_) {}
    });
  return HINARIOS_MAP;
}
function abrirHinario(codigo) {
  const map = carregarMapaHinarios();
  const file = map[(codigo || "HNC").toUpperCase()];
  if (!file) throw new Error("Hinário não encontrado: " + codigo);
  return new Database(path.join(HINARIOS_DIR, file), { readonly: true });
}

/** Extrai número e nome do título armazenado no SQLite.
 * Formatos: "HNC 001 - Doxologia", "CC 001 Antífona", "HC001 - Chuvas", "HCC 001 Oh!" */
function parseTituloHino(title) {
  const m = title.match(/^[A-Z]+\s*(\d+)\s*[-–]?\s*(.*)$/);
  if (!m) return { num: title, nome: title };
  return {
    num: String(Number(m[1])).padStart(3, "0"),
    nome: m[2].trim() || title,
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
    const texto = m[2].trim().replace(/\n/g, "<br/>");
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
app.get("/Cultos/:arquivo", (req, res) => {
  try {
    const dataCulto = req.params.arquivo.replace(".json", "");
    const db = new Database(CULTOS_DB_PATH, { readonly: true });
    const row = db
      .prepare("SELECT itens FROM cultos WHERE data_culto = ?")
      .get(dataCulto);
    if (!row) {
      db.close();
      return res.status(404).json([]);
    }

    let itens = JSON.parse(row.itens);
    const getMusica = db.prepare(
      "SELECT tipo, titulo, letra FROM musicas WHERE id = ?",
    );

    // Expande musicas através do musica_id ou resolvendo Hinos soltos que não foram/foram apagados da tabela de CULTOS_DB
    itens = itens.map((item) => {
      // Se for um item de música pre-salvo (como louvor ou hino recém adicionado)
      if (item && item.musica_id) {
        const m = getMusica.get(item.musica_id);
        if (m) {
          return { ...item, titulo: m.titulo, letra: JSON.parse(m.letra) };
        }
      }

      // Se for hino "legacy" que perdeu a musica_id de cultos.sqlite (Porque limpamos na conversão)
      if (
        item &&
        item.tipo === "hino" &&
        item.titulo &&
        (!item.letra || item.letra.length === 0)
      ) {
        try {
          const { num } = parseTituloHino(item.titulo);
          const m = item.titulo.match(/^([A-Z]+)\s*\d+/);
          if (m) {
            const hdb = abrirHinario(m[1]);
            // Procura o hino pelo numero, como a tabela songs guarda
            const row = hdb
              .prepare("SELECT lyrics FROM songs WHERE title LIKE ? LIMIT 1")
              .get(`% ${Number(num)} %`);
            if (!row) {
              // Tentar wildcard sem o número exato
              const fb = hdb
                .prepare("SELECT lyrics FROM songs WHERE title LIKE ? LIMIT 1")
                .get(`${m[1]} ${num}%`);
              if (fb) {
                item.letra = parseLyricsXml(fb.lyrics);
              }
            } else {
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

    db.close();
    res.json(itens);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===========================================================================
// DADOS
// ===========================================================================

/** Cria novo arquivo de liturgia vazio no banco */
app.post("/dados/nova-liturgia", (req, res) => {
  const arquivo = path.basename(
    (req.body.arquivo || "").replace(/^cultos\//, ""),
  );
  if (!arquivo) return res.status(400).send("Arquivo inválido");

  const dataCulto = arquivo.replace(".json", "");
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
  try {
    let itens = JSON.parse(dados);
    const db = new Database(CULTOS_DB_PATH);
    const insertMusica = db.prepare(
      "INSERT INTO musicas (tipo, titulo, letra) VALUES (?, ?, ?) " +
        "ON CONFLICT(tipo, titulo) DO UPDATE SET letra=excluded.letra RETURNING id",
    );

    itens = itens.map((item) => {
      if (!item) return item;
      // Se for louvor (que a gente gerencia localmente), inserimos na tabela Músicas
      if (item.tipo === "louvor" && Array.isArray(item.letra)) {
        const result = insertMusica.get(
          item.tipo,
          item.titulo || "Sem título",
          JSON.stringify(item.letra),
        );
        return { tipo: item.tipo, musica_id: result.id };
      }

      // Se for hino (nós NUNCA salvamos Hinos na tabela musicas, pois eles são pegos diretamente de Hinarios.sqlite)
      // Nós podemos apenas manter o item original (que já tem o `titulo` tipo "HNC 001 - Doxologia"), mas sem a array enorme let para poupar espaço
      if (item.tipo === "hino") {
        return { tipo: "hino", titulo: item.titulo };
      }

      return item;
    });

    db.prepare(
      "INSERT OR REPLACE INTO cultos (data_culto, itens) VALUES (?, ?)",
    ).run(dataCulto, JSON.stringify(itens));
    db.close();
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: "JSON inválido: " + e.message });
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
<div class="input-group">
  <input type="text" class="form-control" id="titulo" placeholder="Digite o título"
    style="background-color:bisque;" onchange="arrumarLouvor();">
  <button class="btn btn-success" type="button"
    onclick="pesquisarLouvor($('#titulo').val());">
    <i class="fas fa-search limpo"></i>
  </button>
</div>
<texto style="display:grid;grid-template-rows:1fr 40%;grid-row-gap:.25rem;">
  <textarea class="form-control" id="original"
    placeholder="Cole a letra aqui&#10;Estrofes separadas por linha em branco"
    onchange="arrumarLouvor();" style="resize:none;"></textarea>
  <textarea class="form-control text-nowrap" id="final" style="resize:none;"></textarea>
</texto>`);
});

app.post("/formularios/mensagem", (_req, res) => {
  res.send(/* html */ `
<div>
  <input type="text" class="form-control" id="titulo" placeholder="Digite o título"
    style="background-color:bisque;margin-bottom:.225rem;" onchange="arrumarMensagem();">
  <input type="text" class="form-control" id="passagem" placeholder="Digite a passagem"
    style="background-color:bisque;" onchange="arrumarMensagem();">
</div>
<texto style="display:grid;grid-template-rows:1fr 40%;grid-row-gap:.25rem;">
  <div style="display:grid;grid-template-columns:1fr 1fr;grid-column-gap:.25rem;">
    <textarea class="form-control" id="originalMsg"
      placeholder="Tópicos — um por linha" onchange="arrumarMensagem();" style="resize:none;"></textarea>
    <textarea class="form-control" id="originalPas"
      placeholder="Cole o texto bíblico aqui" onchange="arrumarMensagem();" style="resize:none;"></textarea>
  </div>
  <textarea class="form-control text-nowrap" id="final" style="resize:none;"></textarea>
</texto>`);
});

app.post("/formularios/extra", (_req, res) => {
  res.send(/* html */ `
<div>Extra</div>
<texto style="display:grid;grid-template-rows:1fr 40%;grid-row-gap:.25rem;height:100%;">
  <div style="display:grid;grid-template-columns:1fr 1fr;grid-column-gap:.25rem;">
    <textarea class="form-control" id="originalImagem"
      placeholder='Imagens — uma por linha:&#10;{"arquivo":"","titulo":""}'
      onchange="arrumarExtra();" style="resize:none;"></textarea>
    <textarea class="form-control" id="originalVideo"
      placeholder='Vídeos — um por linha:&#10;{"arquivo":"","titulo":""}'
      onchange="arrumarExtra();" style="resize:none;"></textarea>
  </div>
  <textarea class="form-control text-nowrap" id="final" style="resize:none;"></textarea>
</texto>`);
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
    .map((l, i) => `<li codigo="${i}">${escHtml(l.titulo)}</li>`)
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

/** Coleta todos os itens de um tipo disponíveis no banco (buscando da tabela musicas) */
function carregarItens(tipo) {
  try {
    const db = new Database(CULTOS_DB_PATH, { readonly: true });
    // NOCASE permite ignorar acentos/maiúsculas ao ordenar no SQLite
    const rows = db
      .prepare(
        "SELECT titulo, letra FROM musicas WHERE tipo = ? ORDER BY titulo COLLATE NOCASE",
      )
      .all(tipo);
    db.close();

    return rows.map((r) => ({
      tipo: tipo,
      titulo: r.titulo,
      letra: JSON.parse(r.letra),
    }));
  } catch (e) {
    return [];
  }
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
app.listen(PORT, () => {
  console.log(`✓ IPE-Liturgia: http://localhost:${PORT}`);
  console.log(`  Banco de dados: ${CULTOS_DB_PATH}`);
});
