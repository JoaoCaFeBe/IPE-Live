/**
 * Curadoria do Cultos.sqlite — idempotente, roda depois da importação e sozinha
 * (node scripts/curar.js) sobre o banco em uso, preservando o que foi editado.
 *
 *  1. Hinos: tabela `hinos` com os hinários OpenLP (refrão na ordem cantada). A letra
 *     é sempre a do hinário; dos cultos vem só a data em que o hino foi cantado.
 *     Itens de hino ganham `hino_id` e o título padrão "Nome (NC 016)".
 *  2. Louvores e coral: versões da mesma música (título e letra parecidos) viram
 *     um registro só no catálogo, com a letra mais recente e o título mais usado.
 *     O catálogo tem só o que está nos hinários (decisão do João, 28/09/2026). Hino que
 *     não é de hinário nenhum passa a ser louvor; número do Novo Cântico que falta no
 *     banco do hinário continua hino sem vínculo, com o texto só na data em que foi usado.
 *  3. Títulos normalizados em todos os itens. A letra/texto de cada item continua
 *     sendo a que foi projetada naquele culto.
 */
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const N = require("./normalizar");

const HINARIOS = [
  { codigo: "NC", arquivo: "Hinário Novo Cântico.sqlite" },
  { codigo: "CC", arquivo: "Cantor Cristão.sqlite" },
  { codigo: "HC", arquivo: "Harpa Cristã.sqlite" },
  { codigo: "HCC", arquivo: "Hinário Para o Culto Cristão.sqlite" },
];
const SEMELHANCA_MESMA_MUSICA = 0.8;
// Hino digitado sem número achado pela letra (0,63–0,72 é ruído entre letras em português)
const SEMELHANCA_HINO_PELA_LETRA = 0.9;
// Letras com o mesmo começo são a mesma música com estrofes a mais/menos ou reordenadas
const SEMELHANCA_MESMO_INICIO = 0.6;
const TAMANHO_INICIO = 40;

function mesmaMusica(a, b) {
  const s = N.semelhanca(a, b);
  return s >= SEMELHANCA_MESMA_MUSICA ||
    (s >= SEMELHANCA_MESMO_INICIO && a.slice(0, TAMANHO_INICIO) === b.slice(0, TAMANHO_INICIO));
}

/** "HNC 110(A) - Crer e Observar", "CC 001 Antífona", "HC001 - Chuvas De Graça" */
function lerTituloOpenLP(title) {
  const m = String(title).match(/^[A-Z]+\s*(\d{1,3})\s*(?:\((\w)\))?\s*-?\s*(.*)$/);
  if (!m) return null;
  const variante = m[2] && /^[A-Z]$/i.test(m[2]) ? m[2].toUpperCase() : m[2] ? `-${m[2]}` : "";
  return { numero: Number(m[1]), variante, nome: N.limparEspacos(m[3]) };
}

function carregarHinarios(dirHinarios) {
  // Nomes corrigidos pelo índice que a igreja usa (nomes cortados ou de outra edição no OpenLP)
  const arqNomes = path.join(dirHinarios, "nomes-corrigidos.json");
  const corrigidos = fs.existsSync(arqNomes) ? JSON.parse(fs.readFileSync(arqNomes, "utf8")) : {};
  const hinos = [];
  for (const { codigo, arquivo } of HINARIOS) {
    const caminho = path.join(dirHinarios, arquivo);
    if (!fs.existsSync(caminho) || !fs.statSync(caminho).size) continue;
    const db = new Database(caminho, { readonly: true });
    for (const s of db.prepare("SELECT title, lyrics, verse_order FROM songs ORDER BY id").all()) {
      const t = lerTituloOpenLP(s.title);
      if (!t) continue;
      const nomeCorreto = corrigidos[codigo]?.[`${t.numero}${t.variante}`];
      if (nomeCorreto) t.nome = nomeCorreto;
      t.nome = N.tituloFrase(t.nome); // "Avante, ó Crentes" → "Avante, ó crentes"
      hinos.push({ hinario: codigo, ...t, letra: N.letraOpenLP(s.lyrics, s.verse_order) });
    }
    db.close();
  }
  return { hinos, corrigidos };
}

function curar(db, { dirHinarios, dirBiblias }) {
  const cultos = db.prepare("SELECT data_culto, itens FROM cultos ORDER BY data_culto").all()
    .map((c) => ({ data: c.data_culto, itens: JSON.parse(c.itens) }));

  // Livros da Bíblia de referência para o título das passagens
  const ara = fs.readdirSync(dirBiblias).find((f) => / - ARA\.sqlite$/.test(f));
  const bib = new Database(path.join(dirBiblias, ara), { readonly: true });
  const livros = bib.prepare("SELECT id, name FROM book ORDER BY id").all();
  bib.close();

  const rel = { hinos: 0, hinosCantados: 0, hinosVinculados: 0, hinosViraramLouvor: new Map(), hinosForaDoBanco: new Map(),
    divergencias: new Map(), louvoresAntes: 0, louvoresDepois: 0, coralAntes: 0, coralDepois: 0, titulosAlterados: 0, louvoresParaCoral: 0, fusoes: [], possiveis: [] };

  /* 1. Hinos: vincular cada item de hino ao hinário -------------------- */
  const { hinos: catalogoHinos, corrigidos } = carregarHinarios(dirHinarios);
  const porNumero = new Map(catalogoHinos.map((h) => [`${h.hinario}${h.numero}${h.variante}`, h]));
  const porNome = new Map();
  // Busca por nome: Novo Cântico tem prioridade sobre os outros hinários
  [...catalogoHinos].reverse().sort((a, b) => (a.hinario === "NC") - (b.hinario === "NC"))
    .forEach((h) => porNome.set(N.chave(h.nome), h));

  const acharHino = (titulo) => {
    const lido = N.lerNumeroHino(titulo);
    if (lido) {
      const variante = lido.variante && /^[A-Z]$/.test(lido.variante) ? lido.variante : "";
      const h = porNumero.get(`${lido.hinario}${lido.numero}${variante}`);
      if (h) {
        // Número que não bate com o nome digitado não vincula: pode ser outro hinário ou número errado
        const digitado = N.chave(lido.nome), oficial = N.chave(h.nome);
        const bate = !digitado || N.semelhanca(digitado, oficial) >= 0.5 || oficial.includes(digitado) || digitado.includes(oficial);
        if (bate) return h;
        const peloNome = porNome.get(digitado);
        if (!peloNome) rel.divergencias.set(`${N.limparEspacos(titulo)} (o ${h.hinario} ${h.numero} é "${h.nome}")`, true);
        return peloNome || null;
      }
      // Número que não existe no banco (ex.: NC 354A) não cai no hino de mesmo nome (NC 354)
      return null;
    }
    return porNome.get(N.chave(String(titulo).replace(/\(.*?\)/g, ""))) || null;
  };

  // Título digitado sem número nem nome oficial: procura a letra nos hinários
  const acharPelaLetra = (letra) => {
    const texto = N.textoDaLetra(letra);
    if (!texto) return null;
    let melhor = null, maior = 0;
    for (const h of catalogoHinos) {
      if (h.texto === undefined) h.texto = N.textoDaLetra(h.letra);
      const s = N.semelhanca(texto, h.texto, 300);
      if (s > maior) { maior = s; melhor = h; }
    }
    return maior >= SEMELHANCA_HINO_PELA_LETRA ? melhor : null;
  };

  for (const c of cultos) {
    for (const it of c.itens) {
      if (it?.tipo !== "hino") continue;
      let h = acharHino(it.titulo) || acharPelaLetra(it.letra);
      if (h) {
        h.usadoEm = c.data; // a letra padrão é a do hinário; dos cultos vem só a última data cantada
        it._hino = h;
      } else if (N.lerNumeroHino(it.titulo)?.hinario === "NC") {
        // Número do Novo Cântico que falta no banco do hinário (ex.: 354A): continua hino,
        // sem vínculo e fora do catálogo — o texto digitado aparece só na data em que foi usado
        delete it.hino_id;
        const t = N.tituloFrase(it.titulo);
        if (t !== it.titulo) { rel.titulosAlterados++; it.titulo = t; }
        rel.hinosForaDoBanco.set(t, (rel.hinosForaDoBanco.get(t) || 0) + 1);
      } else {
        // Não é de hinário nenhum: passa a ser louvor (decisão do João, 28/09/2026)
        delete it.hino_id;
        it.tipo = "louvor";
        const t = N.tituloLouvor(it.titulo);
        rel.hinosViraramLouvor.set(t, (rel.hinosViraramLouvor.get(t) || 0) + 1);
      }
    }
  }

  // Recria com ids a partir de 1: mesma entrada, mesmos ids em toda rodada
  db.exec("DELETE FROM hinos; DELETE FROM sqlite_sequence WHERE name = 'hinos'");
  const insHino = db.prepare(
    "INSERT INTO hinos (hinario, numero, variante, nome, titulo, letra, origem, usado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
  );
  for (const h of catalogoHinos) {
    h.titulo = N.tituloHino(h.nome, h.hinario, h.numero, h.variante);
    h.id = insHino.get(h.hinario, h.numero, h.variante, h.nome, h.titulo, JSON.stringify(h.letra),
      "hinario", h.usadoEm || null).id;
    rel.hinos++;
    if (h.usadoEm) rel.hinosCantados++;
  }
  for (const c of cultos) {
    for (const it of c.itens) {
      if (!it?._hino) continue;
      it.hino_id = it._hino.id;
      if (it.titulo !== it._hino.titulo) { rel.titulosAlterados++; it.titulo = it._hino.titulo; }
      delete it._hino;
      rel.hinosVinculados++;
    }
  }

  /* 2a. Peças do coral cadastradas como louvor ("MÚSICA 1 – ...", "Música 1. ...") */
  for (const c of cultos) {
    for (const it of c.itens) {
      if (it?.tipo !== "louvor" || !N.ehMusicaDoCoral(it.titulo)) continue;
      it.tipo = "coral";
      it.titulo = N.semPrefixoMusica(it.titulo);
      delete it.louvor_id;
      rel.louvoresParaCoral++;
    }
  }

  /* 2. Louvores e coral: agrupar versões da mesma música ---------------- */
  // Títulos que o João confirmou serem uma música só (versões com começo diferente)
  const arqMesma = path.join(path.dirname(dirHinarios), "mesma-musica.json");
  const mesmaMusicaConfirmada = fs.existsSync(arqMesma) ? JSON.parse(fs.readFileSync(arqMesma, "utf8")) : {};

  const agrupar = (tipo, campoId, tabela) => {
    const confirmados = new Set((mesmaMusicaConfirmada[tipo] || []).map((t) => N.chave(t)));
    rel[tipo === "coral" ? "coralAntes" : "louvoresAntes"] =
      db.prepare(`SELECT COUNT(*) AS n FROM ${tabela}`).get().n;
    const grupos = new Map(); // chave do título -> [{ rep, versoes: [{titulo, letra, data}] }]
    for (const c of cultos) {
      for (const it of c.itens) {
        if (it?.tipo !== tipo || !Array.isArray(it.letra)) continue;
        const k = N.chave(N.tituloLouvor(it.titulo).replace(/\(.*?\)/g, "")) || "sem titulo";
        const texto = N.textoDaLetra(it.letra);
        const lista = grupos.get(k) || [];
        let musica = confirmados.has(k) ? lista[0] : lista.find((m) => mesmaMusica(m.rep, texto));
        if (!musica) { musica = { rep: texto, versoes: [] }; lista.push(musica); }
        musica.versoes.push({ item: it, data: c.data });
        grupos.set(k, lista);
      }
    }
    // Mesmo título com letras parecidas mas começo diferente: não junta, relata para revisão
    for (const lista of grupos.values()) {
      for (let i = 0; i < lista.length; i++) {
        for (let j = i + 1; j < lista.length; j++) {
          if (N.semelhanca(lista[i].rep, lista[j].rep) >= SEMELHANCA_MESMO_INICIO) {
            rel.possiveis.push({ tipo, titulo: N.tituloLouvor(lista[i].versoes[0].item.titulo),
              a: lista[i].rep.slice(0, 45), b: lista[j].rep.slice(0, 45) });
          }
        }
      }
    }
    db.exec(`DELETE FROM ${tabela}; DELETE FROM sqlite_sequence WHERE name = '${tabela}'`);
    const ins = db.prepare(`INSERT INTO ${tabela} (titulo, letra) VALUES (?, ?) RETURNING id`);
    for (const lista of grupos.values()) {
      for (const musica of lista) {
        // Título mais usado entre as versões digitadas normalmente (as em CAIXA ALTA não dizem
        // o que é nome, "REI" × "Rei"); só sem nenhuma delas vale a caixa alta. Empate: a mais recente.
        const digitadas = musica.versoes.filter((v) => !N.emCaixaAlta(v.item.titulo));
        const candidatas = digitadas.length ? digitadas : musica.versoes;
        const titulos = new Map();
        candidatas.forEach((v) => {
          const t = N.tituloLouvor(v.item.titulo);
          titulos.set(t, (titulos.get(t) || 0) + 1);
        });
        let titulo = "", maior = 0;
        candidatas.forEach((v) => {
          const t = N.tituloLouvor(v.item.titulo);
          if (titulos.get(t) >= maior) { maior = titulos.get(t); titulo = t; }
        });
        const recente = musica.versoes[musica.versoes.length - 1].item.letra;
        const id = ins.get(titulo, JSON.stringify(recente)).id;
        const distintas = new Set(musica.versoes.map((v) => JSON.stringify([v.item.titulo, v.item.letra]))).size;
        if (distintas > 1) rel.fusoes.push({ tipo, titulo, versoes: distintas, cultos: musica.versoes.length });
        musica.versoes.forEach((v) => {
          if (v.item.titulo !== titulo) rel.titulosAlterados++;
          v.item.titulo = titulo;
          v.item[campoId] = id;
        });
      }
    }
    rel[tipo === "coral" ? "coralDepois" : "louvoresDepois"] =
      db.prepare(`SELECT COUNT(*) AS n FROM ${tabela}`).get().n;
  };
  agrupar("louvor", "louvor_id", "louvores");
  agrupar("coral", "coral_id", "coral");

  /* 3. Títulos das passagens ------------------------------------------ */
  for (const c of cultos) {
    for (const it of c.itens) {
      if (it?.tipo !== "passagem") continue;
      const novo = N.tituloPassagem(it.titulo, livros);
      if (novo !== it.titulo) { rel.titulosAlterados++; it.titulo = novo; }
    }
  }

  const upd = db.prepare("UPDATE cultos SET itens = ? WHERE data_culto = ?");
  cultos.forEach((c) => upd.run(JSON.stringify(c.itens), c.data));
  return rel;
}

module.exports = { curar };
