#!/usr/bin/env node
/**
 * Normaliza títulos, monta o catálogo de hinos e junta louvores duplicados no
 * Cultos.sqlite em uso (lib/curadoria.js). Idempotente; o banco anterior fica
 * preservado como `<banco>.antes-curadoria-<carimbo>`.
 *
 * Uso: node scripts/curar.js [--banco database/Cultos.sqlite] [--relatorio arquivo.md]
 */
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { garantirSchema } = require("../lib/schema");
const { curar } = require("../lib/curadoria");

const args = process.argv.slice(2);
const valor = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const raiz = path.join(__dirname, "..");
const banco = path.resolve(valor("--banco") || path.join(raiz, "database", "Cultos.sqlite"));
const arquivoRelatorio = valor("--relatorio");

function executarCuradoria(caminhoBanco) {
  const db = new Database(caminhoBanco);
  garantirSchema(db);
  let rel;
  db.transaction(() => {
    rel = curar(db, {
      dirHinarios: path.join(raiz, "database", "Hinarios"),
      dirBiblias: path.join(raiz, "database", "Biblias"),
    });
  })();
  db.close();
  return rel;
}

function relatorioMarkdown(rel) {
  const linhas = [
    "# Curadoria do banco da liturgia",
    "",
    `- Hinos no catálogo: ${rel.hinos} (já cantados pela igreja: ${rel.hinosCantados}; letra sempre a do hinário)`,
    `- Itens de hino vinculados ao hinário: ${rel.hinosVinculados}`,
    `- Louvores no catálogo: ${rel.louvoresAntes} → ${rel.louvoresDepois}`,
    `- Coral no catálogo: ${rel.coralAntes} → ${rel.coralDepois} (itens "Música…"/"Cantata Infantil" passados ao coral: ${rel.louvoresParaCoral})`,
    `- Cantatas criadas nesta rodada: ${rel.cantatasCriadas.join("; ") || "nenhuma"}`,
    `- Músicas de cantata sem correspondência no coral (perdidas): ${rel.cantataMusicasPerdidas}`,
    `- Eventos sem música só do coral (não viraram cantata): ${rel.eventosSemMusicaDoCoral.join("; ") || "nenhum"}`,
    `- Títulos de itens alterados: ${rel.titulosAlterados}`,
    "",
    "## Hinos que não são de hinário nenhum — passaram a louvor",
    "",
    ...[...rel.hinosViraramLouvor].map(([t, n]) => `- ${t} (${n}×)`),
    "",
    "## Hinos do Novo Cântico que faltam no banco do hinário — sem vínculo, texto só na data",
    "",
    ...[...rel.hinosForaDoBanco].map(([t, n]) => `- ${t} (${n}×)`),
    "",
    "## Número do hino não bate com o nome digitado (não vinculado — conferir)",
    "",
    ...[...rel.divergencias.keys()].map((t) => `- ${t}`),
    "",
    "## Possíveis duplicados — mesmo título, letras parecidas, começo diferente (não juntados)",
    "",
    ...rel.possiveis.map((p) => `- **${p.titulo}**: "${p.a}…" × "${p.b}…"`),
    "",
    "## Louvores com versões juntadas",
    "",
    "| Título | versões diferentes | cultos |",
    "|---|---:|---:|",
    ...rel.fusoes.sort((a, b) => b.versoes - a.versoes).map((f) => `| ${f.titulo} | ${f.versoes} | ${f.cultos} |`),
  ];
  return linhas.join("\n") + "\n";
}

if (require.main === module) {
  const carimbo = new Date().toISOString().replace(/[:.]/g, "-");
  fs.copyFileSync(banco, `${banco}.antes-curadoria-${carimbo}`);
  const rel = executarCuradoria(banco);
  console.log(`Hinos: ${rel.hinos} (já cantados: ${rel.hinosCantados}) | itens de hino vinculados: ${rel.hinosVinculados}`);
  console.log(`Louvores: ${rel.louvoresAntes} → ${rel.louvoresDepois} | coral: ${rel.coralAntes} → ${rel.coralDepois} (Música… → coral: ${rel.louvoresParaCoral})`);
  console.log(`Cantatas criadas: ${rel.cantatasCriadas.join("; ") || "nenhuma"} | vínculos de cantata perdidos: ${rel.cantataMusicasPerdidas}`);
  console.log(`Títulos alterados: ${rel.titulosAlterados} | viraram louvor: ${rel.hinosViraramLouvor.size} | fora do banco: ${rel.hinosForaDoBanco.size} | divergências: ${rel.divergencias.size}`);
  if (arquivoRelatorio) {
    fs.writeFileSync(arquivoRelatorio, relatorioMarkdown(rel));
    console.log(`Relatório: ${arquivoRelatorio}`);
  }
}

module.exports = { executarCuradoria, relatorioMarkdown };
