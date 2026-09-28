#!/usr/bin/env node
/**
 * Importa as liturgias do sistema antigo (PHP, um JSON por data) para o Cultos.sqlite.
 *
 * Reconstrói o banco inteiro a partir do legado — reexecutável no dia da virada.
 * O banco anterior é preservado como `<banco>.antes-importacao-<carimbo>`.
 *
 * Uso:
 *   node scripts/importar-legado.js --de-url https://ipe.desklaser.cloud [--banco database/Cultos.sqlite]
 *   node scripts/importar-legado.js --de-pasta /caminho/cultos         [--banco database/Cultos.sqlite]
 *
 * Regras da conversão:
 *  - Cada item guarda a própria letra/texto (retrato do que foi projetado naquele dia),
 *    porque há músicas diferentes com o mesmo título ("Família", "Glória"...).
 *  - Louvores alimentam o catálogo `louvores` (sem título único): um registro por
 *    par título + letra idênticos; o item aponta para ele por `louvor_id`.
 *  - `mensagem` e `extra` não existem no sistema novo: saem de `itens`, mas o JSON
 *    original de cada data fica inteiro em `cultos_legado`.
 *  - Arquivo vazio ou inválido no legado é relatado e pulado.
 */
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { garantirSchema } = require("../lib/schema");

const TIPOS_MIGRADOS = new Set(["passagem", "hino", "louvor"]);

function argumentos() {
  const args = process.argv.slice(2);
  const valor = (nome) => {
    const i = args.indexOf(nome);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const opcoes = {
    url: valor("--de-url"),
    pasta: valor("--de-pasta"),
    banco: path.resolve(
      valor("--banco") || path.join(__dirname, "..", "database", "Cultos.sqlite"),
    ),
  };
  if (!opcoes.url === !opcoes.pasta) {
    console.error("Informe exatamente um: --de-url <site> ou --de-pasta <dir>");
    process.exit(1);
  }
  return opcoes;
}

/** Lê os arquivos do legado: devolve [{ data, conteudo }] com conteudo em texto. */
async function lerDaUrl(base) {
  base = base.replace(/\/+$/, "");
  // A lista de datas só existe na capa do módulo, que exige a sessão PHP do index.
  const inicio = await fetch(`${base}/`);
  const cookie = (inicio.headers.getSetCookie?.() || [])
    .map((c) => c.split(";")[0])
    .join("; ");
  const capa = await fetch(`${base}/.liturgia/capa.php`, {
    headers: { cookie, referer: `${base}/` },
  });
  if (!capa.ok) throw new Error(`capa.php respondeu ${capa.status}`);
  const html = await capa.text();
  const arquivos = [...new Set(html.match(/\d{4}-\d{2}-\d{2}\.json/g) || [])];
  if (!arquivos.length) throw new Error("Nenhuma liturgia encontrada na capa do legado");

  const lidos = [];
  for (let i = 0; i < arquivos.length; i += 6) {
    const lote = arquivos.slice(i, i + 6);
    const respostas = await Promise.all(
      lote.map(async (arquivo) => {
        const r = await fetch(`${base}/.liturgia/cultos/${arquivo}`);
        if (!r.ok) throw new Error(`${arquivo}: HTTP ${r.status}`);
        return { data: arquivo.replace(".json", ""), conteudo: await r.text() };
      }),
    );
    lidos.push(...respostas);
  }
  return lidos;
}

function lerDaPasta(pasta) {
  return fs
    .readdirSync(pasta)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .map((f) => ({
      data: f.replace(".json", ""),
      conteudo: fs.readFileSync(path.join(pasta, f), "utf8"),
    }));
}

const normalizarTitulo = (t) => String(t || "").replace(/\s+/g, " ").trim();

function importar(lidos, destino) {
  const db = new Database(destino);
  garantirSchema(db);

  const inserirLouvor = db.prepare(
    "INSERT INTO louvores (titulo, letra) VALUES (?, ?) RETURNING id",
  );
  const inserirCulto = db.prepare(
    "INSERT INTO cultos (data_culto, itens) VALUES (?, ?)",
  );
  const inserirLegado = db.prepare(
    "INSERT INTO cultos_legado (data_culto, json, importado_em) VALUES (?, ?, ?)",
  );

  const catalogo = new Map(); // "titulo\u0000letra" -> id
  const relatorio = { cultos: 0, itens: 0, louvores: 0, descartados: {}, pulados: [] };
  const agora = new Date().toISOString();

  const executar = db.transaction(() => {
    for (const { data, conteudo } of lidos.sort((a, b) => a.data.localeCompare(b.data))) {
      let itens;
      try {
        itens = JSON.parse(conteudo);
        if (!Array.isArray(itens)) throw new Error("não é lista");
      } catch (e) {
        relatorio.pulados.push(`${data} (${conteudo.length ? e.message : "arquivo vazio"})`);
        continue;
      }

      const convertidos = [];
      for (const item of itens) {
        if (!item || typeof item !== "object") continue;
        if (!TIPOS_MIGRADOS.has(item.tipo)) {
          relatorio.descartados[item.tipo] = (relatorio.descartados[item.tipo] || 0) + 1;
          continue;
        }
        const titulo = normalizarTitulo(item.titulo);
        if (item.tipo === "passagem") {
          convertidos.push({ tipo: "passagem", titulo, texto: item.texto || [] });
          continue;
        }
        const letra = Array.isArray(item.letra) ? item.letra : [];
        if (item.tipo === "hino") {
          convertidos.push({ tipo: "hino", titulo, letra });
          continue;
        }
        const chave = titulo + "\u0000" + JSON.stringify(letra);
        let id = catalogo.get(chave);
        if (!id) {
          id = inserirLouvor.get(titulo, JSON.stringify(letra)).id;
          catalogo.set(chave, id);
          relatorio.louvores++;
        }
        convertidos.push({ tipo: "louvor", titulo, letra, louvor_id: id });
      }

      inserirCulto.run(data, JSON.stringify(convertidos));
      inserirLegado.run(data, conteudo, agora);
      relatorio.cultos++;
      relatorio.itens += convertidos.length;
    }
  });
  executar();
  db.close();
  return relatorio;
}

async function main() {
  const { url, pasta, banco } = argumentos();
  const lidos = url ? await lerDaUrl(url) : lerDaPasta(pasta);
  console.log(`Lidas ${lidos.length} liturgias de ${url || pasta}`);

  // Datas que só existem no banco atual (criadas no sistema novo) vão se perder: avisa.
  if (fs.existsSync(banco)) {
    const atual = new Database(banco, { readonly: true });
    const datas = atual.prepare("SELECT data_culto FROM cultos").all().map((r) => r.data_culto);
    atual.close();
    const legado = new Set(lidos.map((l) => l.data));
    const perdidas = datas.filter((d) => !legado.has(d));
    if (perdidas.length) console.warn(`Aviso: só existiam no banco atual e ficam no backup: ${perdidas.join(", ")}`);
  }

  const temporario = `${banco}.importando`;
  fs.rmSync(temporario, { force: true });
  const relatorio = importar(lidos, temporario);

  if (fs.existsSync(banco)) {
    const carimbo = new Date().toISOString().replace(/[:.]/g, "-");
    fs.renameSync(banco, `${banco}.antes-importacao-${carimbo}`);
  }
  fs.renameSync(temporario, banco);

  console.log(`Cultos: ${relatorio.cultos} | itens: ${relatorio.itens} | louvores no catálogo: ${relatorio.louvores}`);
  console.log(`Fora do sistema novo (guardados em cultos_legado): ${JSON.stringify(relatorio.descartados)}`);
  if (relatorio.pulados.length) console.log(`Pulados: ${relatorio.pulados.join("; ")}`);
  console.log(`Banco: ${banco}`);
}

main().catch((e) => {
  console.error("Falha na importação:", e.message);
  process.exit(1);
});
