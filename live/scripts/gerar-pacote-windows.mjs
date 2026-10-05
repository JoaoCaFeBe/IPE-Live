import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const liveDir = resolve(scriptsDir, "..");
const repoDir = resolve(liveDir, "..");
const outputDir = join(liveDir, "dist");
const outputFile = join(outputDir, "IPE-Live-Windows.zip");
const tempDir = mkdtempSync(join(tmpdir(), "ipe-live-windows-"));
const packageDir = join(tempDir, "IPE-Live-Windows");
const payloadDir = join(packageDir, "live");
const manifest = JSON.parse(
  readFileSync(join(scriptsDir, "instalador-manifest.json"), "utf8"),
);

function git(...args) {
  try {
    return execFileSync("git", args, {
      cwd: repoDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function arquivosDaArvore(arvore) {
  const raiz = join(liveDir, arvore.path);
  if (!existsSync(raiz)) throw new Error(`pasta obrigatória ausente: ${arvore.path}`);

  const arquivos = [];
  const visitar = (diretorio) => {
    for (const item of readdirSync(diretorio, { withFileTypes: true })) {
      if (arvore.excludeNames?.includes(item.name)) continue;
      const absoluto = join(diretorio, item.name);
      if (item.isDirectory()) {
        visitar(absoluto);
      } else if (
        item.isFile() &&
        (!arvore.extensions || arvore.extensions.includes(extname(item.name)))
      ) {
        arquivos.push(relative(liveDir, absoluto));
      }
    }
  };

  visitar(raiz);
  if (!arquivos.length) throw new Error(`pasta sem arquivos permitidos: ${arvore.path}`);
  return arquivos;
}

try {
  const arquivos = [
    ...manifest.files,
    ...manifest.installerFiles,
    ...manifest.trees.flatMap(arquivosDaArvore),
  ];

  for (const relativePath of [...new Set(arquivos)].sort()) {
    const source = join(liveDir, relativePath);
    if (!existsSync(source)) throw new Error(`arquivo obrigatório ausente: ${relativePath}`);
    const destination = join(payloadDir, relativePath.normalize("NFC"));
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(source, destination);
  }

  for (const installerPath of manifest.installerFiles) {
    cpSync(join(liveDir, installerPath), join(packageDir, basename(installerPath)));
  }

  const revision = git("rev-parse", "--short", "HEAD") || "pacote local";
  const dirty = git("status", "--short", "--", "live")
    ? " + alterações locais"
    : "";
  writeFileSync(
    join(packageDir, "LEIA-ME.txt"),
    [
      "IPE Live — instalador para Windows 10/11",
      "",
      "1. Extraia todo o conteúdo do ZIP.",
      "2. Dê duplo clique em instalar-windows.bat.",
      "3. Aceite a permissão de administrador e informe o IP fixo e a senha do OBS.",
      "",
      "O instalador usa a internet para Node.js e pacotes npm públicos.",
      "Nenhum acesso ao GitHub é necessário.",
      `Versão: ${revision}${dirty}`,
      "",
    ].join("\r\n"),
    "utf8",
  );

  mkdirSync(outputDir, { recursive: true });
  rmSync(outputFile, { force: true });
  execFileSync("zip", ["-qr", outputFile, basename(packageDir)], { cwd: tempDir });
  console.log(outputFile);
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
