const express = require("express");
const app = express();
const http = require("http").createServer(app);
const { Server } = require("socket.io");
const session = require("express-session");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const cors = require("cors");

// Lê o arquivo .env
require("dotenv").config({ path: path.join(__dirname, ".env") });

// A Liturgia já usa a 3000, logo este servidor local deverá usar a 3001
const PORT = process.env.PORT || 3001;

// Configurar as variáveis globais para o Front-End importadas do `.env`
// Se estiver rodando o Socket no mesmo Node, ele chamará a mesma máquina sem precisar informar domínio complexo
app.locals.SOCKET_SERVER = process.env.SOCKET_SERVER || "http://localhost:3000";
app.locals.SOCKET_NAMESPACE = process.env.SOCKET_NAMESPACE || "IPE.Transmissão";
app.locals.CULTOS_URL = process.env.CULTOS_URL || "/Liturgia/cultos";

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Exposição das Subpastas Essenciais (CSS, Scripts e libs)
app.use(express.static(path.join(__dirname, "public"), { index: false })); // Segurança: Expor apenas os arquivos da pasta /public/

// Middlewares Modernos
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: "ipe-live-secret-key-12345",
    resave: false,
    saveUninitialized: true,
  }),
);

// ==========================================
// FUNÇÕES HELPERS DO ANTIGO `dados.php`
// ==========================================
const getBibliaDb = (req) => {
  let bibliaName =
    req.session.biblia || "Almeida Revista e Atualizada - ARA.sqlite";
  // Proteção de path
  bibliaName = path.basename(bibliaName);
  return new Database(path.join(__dirname, "database", "Biblias", bibliaName), {
    readonly: true,
  });
};

const getArquivosBiblia = () => {
  return fs
    .readdirSync(path.join(__dirname, "database", "Biblias"))
    .filter((f) => f.endsWith(".sqlite"))
    .sort();
};

// ==========================================
// ROTEAMENTO (SUBSTITUI OS ARQUIVOS .PHP)
// ==========================================

app.get("/", (req, res) => res.redirect("/Painel"));

// 1. Painel Administrativo de Controle O.B.S./Tela
app.get("/Painel", (req, res) => {
  // Caso a Bíblia seja alternada pelo Dropdown
  if (req.query.biblia) {
    req.session.biblia = req.query.biblia;
  }
  const currentBiblia =
    req.session.biblia || "Almeida Revista e Atualizada - ARA.sqlite";

  try {
    const db = getBibliaDb(req);
    const arquivos = getArquivosBiblia();

    // Consulta todos os livros e limites de capitulos
    const stmt = db.prepare(
      "SELECT verse.book_id as id, book.name, max(verse.chapter) as capitulos FROM verse INNER JOIN book ON (verse.book_id = book.id) GROUP BY verse.book_id",
    );
    const livros = stmt.all();
    db.close();

    // Flag para alternar recursos do OBS Studio
    const painelOBS = Object.keys(req.query).includes("painelOBS");

    res.render("Painel", {
      livros,
      arquivos,
      currentBiblia,
      painelOBS,
    });
  } catch (e) {
    console.error("Erro na rota Painel:", e);
    res
      .status(500)
      .send("🔧 Erro ao carregar o Banco SQLite local: " + e.message);
  }
});

// 2. Bíblia (O Pop-up de Versículos de Capítulo)
app.get("/Biblia", (req, res) => {
  // Quando ele clica num botão de buscar capitulo, definimos a sessão para garantir leitura!
  if (req.query.biblia) req.session.biblia = req.query.biblia;

  const nomeLivro = req.query.nomeLivro || "";
  const livro = parseInt(req.query.livro) || 0;
  const capitulo = parseInt(req.query.capitulo) || 0;

  try {
    const db = getBibliaDb(req);
    const stmt = db.prepare(
      "SELECT book.name, verse.verse, verse.text FROM verse INNER JOIN book on (verse.book_id=book.id) WHERE verse.book_id=? AND verse.chapter=?",
    );
    const versiculos = stmt.all(livro, capitulo);
    db.close();

    res.render("Biblia", { nomeLivro, livro, capitulo, versiculos });
  } catch (e) {
    res.status(500).send("🔧 Erro ao pesquisar os versos: " + e.message);
  }
});

// 3. Telas de Projeção / Multi-Telas
app.get("/Projetor", (req, res) => {
  const telaPrincipal = Object.keys(req.query).includes("telaPrincipal");
  res.render("Projetor", { telaPrincipal });
});

app.get("/Televisao", (req, res) => {
  const telaPrincipal = Object.keys(req.query).includes("telaPrincipal");
  res.render("Televisao", { telaPrincipal });
});

app.get("/Legendas", (req, res) => res.render("Legendas"));
app.get("/LegendasAoVivo", (req, res) => res.render("LegendasAoVivo"));

// 4. API Utilitária: Retornar Relógio Servidor
app.get(["/Hora.php", "/Hora"], (req, res) => {
  const data = new Date();
  res.json({
    hora: data.toTimeString().slice(0, 8),
    data: data.toISOString().slice(0, 10),
    fuso: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
});

// 5. Integração com o Link da Live no seu Canal
app.get("/Chat.php", (req, res) => {
  // Opcional: Aqui podíamos replicar o logic para ver a API do youtube!
  // Ele procurava seu live_chat diretamente no canal da church.
  const channelId = "UCIjAWGccTvvw9QW0r_6ZY4A";
  const liveUrl = `https://www.youtube.com/channel/${channelId}/live`;
  // Encaminhando de base (futuramente você implementa log de crawler mais sofisticado se necessário)
  res.redirect(liveUrl);
});

// ==========================================
// SOCKET.IO EMBUTIDO (ANTIGO CHAT.JS)
// ==========================================
const io = new Server(http, {
  cors: {
    origin: [
      "http://transmissao",
      "http://localhost",
      "http://localhost:8080",
      "http://192.168.1.43",
      "http://10.0.0.253",
      "https://ipe.live.test",
    ],
  },
});

io.on("connection", (socket) => {
  console.log("⚡ Nova Conexão no Painel Node/IO: " + socket.id);
  // Atua como 'broadcast router' repetindo as informações
  socket.onAny((empresa, funcao, args = false) => {
    io.emit(empresa, funcao, args);
  });
});

http.listen(PORT, "0.0.0.0", () => {
  console.log(`=========================================`);
  console.log(`🚀 IPE Live Back-end Rodando na porta ${PORT}`);
  console.log(`🖥️  Acesse: http://localhost:${PORT}/Painel`);
  console.log(`=========================================`);
});
