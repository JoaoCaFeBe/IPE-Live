/**
 * Normalização de títulos e letras da liturgia — usada na importação do legado
 * e ao salvar, para que tudo siga o mesmo padrão:
 *   passagem: "João 3:16-18"      hino: "Louvor a Deus (NC 016)"      louvor: "Grande é o Senhor"
 */

const semAcento = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
const chave = (s) => semAcento(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Espaços, tabs e espaço antes de pontuação ("alegrai-vos !" → "alegrai-vos!") */
function limparEspacos(t) {
  return String(t || "")
    .replace(/\s+/g, " ")
    .replace(/\s+([!?.,;:)])/g, "$1")
    .replace(/\(\s+/g, "(")
    .trim();
}

/* ── título em frase: só a primeira letra maiúscula (decisão do João, 28/09/2026) ── */

const lista = (txt) => new Set(semAcento(txt).toLowerCase().split(/\s+/).filter(Boolean));

// Sempre maiúsculas: nomes e títulos de Deus (convenção da escrita gospel), nomes
// próprios bíblicos, lugares e datas cristãs
const SEMPRE_MAIUSCULA = lista(`
  deus senhor jesus cristo espirito emanuel messias jeova jave yahweh yehovah altissimo
  salvador redentor criador consolador cordeiro mestre trindade god lord christ dei
  maria jose davi salomao moises abraao isaque jaco israel noe adao eva sara ana lazaro marta
  nicodemos zaqueu barnabe elias eliseu paulo pedro andre filipe tome estevao sansao gideao
  calebe bartimeu jairo raabe boaz noemi simeao ismael saul golias jonatas arao josue
  genesis levitico deuteronomio rute samuel esdras neemias ester jo eclesiastes isaias
  jeremias ezequiel daniel oseias joel amos obadias jonas miqueias naum habacuque sofonias
  ageu zacarias malaquias mateus marcos lucas joao romanos corintios galatas efesios
  filipenses colossenses tessalonicenses timoteo tito filemom hebreus tiago judas apocalipse
  siao jerusalem belem nazare galileia jordao egito canaa calvario golgota getsemani betania
  samaria juda sinai babilonia brasil jerico betel emaus ninive eden siloe
  natal pascoa pentecostes`);

// Maiúsculas só quando já vinham assim no meio do título: pronomes e títulos que se
// referem a Deus em uns títulos e não em outros ("Meu Pai" × "meu pai é um presente")
const SE_JA_MAIUSCULA = lista(`
  pai filho rei amigo pastor rocha nome palavra verbo luz
  tu te ti teu tua teus tuas ele dele nele seu sua seus suas vos vosso vossa`);

/**
 * "Vim Para Adorar-Te" → "Vim para adorar-Te"; "EU ME RENDO - Renascer Praise" →
 * "Eu me rendo - Renascer Praise"; "Salmo 98 Vencedores por cristo" → "Salmo 98 vencedores por Cristo".
 * Entre parênteses e depois de " - " (artista, grupo, cantata) fica como veio.
 */
function tituloFrase(titulo) {
  const t = limparEspacos(titulo);
  const m = t.match(/^(.*?\S)(\s[-–]\s.*)$/); // atribuição: "Título - Artista"
  const principal = m ? m[1] : t;
  const atribuicao = m ? m[2] : "";
  const pedacos = principal.split(/(\([^)]*\))/); // ímpares = parênteses, preservados
  // Todo em CAIXA ALTA não informa o que é nome: aí vale só a lista de nomes
  const tudoMaiusculo = emCaixaAlta(pedacos.filter((_, i) => i % 2 === 0).join(" "));

  let inicioDeFrase = true;
  let anterior = "";
  const convertido = pedacos.map((p, i) => {
    // Parênteses (artista, formação) ficam como vieram, salvo se também estão em CAIXA ALTA
    if (i % 2 === 1 && !emCaixaAlta(p)) { inicioDeFrase = false; return p; }
    if (i % 2 === 1) inicioDeFrase = false;
    return p.replace(/[A-Za-zÀ-ÿ]+|[.!?]\s|\s[/+]\s/g, (w) => {
      if (!/[A-Za-zÀ-ÿ]/.test(w)) { inicioDeFrase = true; return w; }
      const k = semAcento(w).toLowerCase();
      const capital = w[0].toUpperCase() + w.slice(1).toLowerCase();
      let saida;
      if (!tudoMaiusculo && w.length >= 2 && w.length <= 4 && w === w.toUpperCase() && !inicioDeFrase) saida = w; // sigla (SAF, HCC)
      else if (inicioDeFrase || SEMPRE_MAIUSCULA.has(k) || (k === "santo" && anterior === "espirito")) saida = capital;
      else if (!tudoMaiusculo && w[0] !== w[0].toLowerCase() && SE_JA_MAIUSCULA.has(k)) saida = capital;
      else saida = w.toLowerCase();
      inicioDeFrase = false;
      anterior = k;
      return saida;
    });
  }).join("");
  // Atribuição em CAIXA ALTA ("- DUETO") também vira minúscula, com os nomes de sempre
  const atrib = emCaixaAlta(atribuicao)
    ? atribuicao.replace(/[A-Za-zÀ-ÿ]+/g, (w) => (SEMPRE_MAIUSCULA.has(semAcento(w).toLowerCase())
      ? w[0] + w.slice(1).toLowerCase() : w.toLowerCase()))
    : atribuicao;
  return convertido + atrib;
}

/** Louvor que é peça do coral: "MÚSICA 1 – Vem celebrar Cristo", "Música 1. um segredinho" */
const ehMusicaDoCoral = (t) => /^\s*m[uú]sica(?![a-zà-ÿ])/i.test(t);
/** Tira o prefixo "Música N –" das peças do coral */
const semPrefixoMusica = (t) => limparEspacos(t).replace(/^m[uú]sica\s*\d*\s*[.:–-]*\s*/i, "");

/** Título de louvor/coral: sem numeração na frente, sem caixa alta, sem espaço sobrando */
function tituloLouvor(t) {
  const s = limparEspacos(t)
    .replace(/^\d{1,3}\s*(?:[-–.)]\s*|\s+)(?=\D)/, "") // "01 - ", "2-", "08 "
    .trim();
  return s ? tituloFrase(s) : "Sem título";
}

/* ── hinos ─────────────────────────────────────────────────────────────── */

const CODIGOS_HINARIO = { HNC: "NC", NC: "NC", CC: "CC", HC: "HC", HCC: "HCC" };
// Nomes por extenso que aparecem nos títulos digitados
const HINARIO_POR_NOME = [
  [/harpa\s+crist[aã]/i, "HC"],
  [/cantor\s+crist[aã]o/i, "CC"],
  [/novo\s+c[aâ]ntico/i, "NC"],
];

/**
 * Número de hino a partir do título digitado:
 * "Avante (NC 311)", "Crer e observar (NC 110-A)", "95 - Somente Cristo",
 * "CONTEMPLAÇÃO NC 13", "Coração Quebrantado - 67", "Abrigo no Temporal HC - 137",
 * "Grato a Ti - 370 Harpa Cristã". Devolve { hinario, numero, variante, nome } ou null.
 */
function lerNumeroHino(titulo) {
  const t = limparEspacos(titulo);
  let hinario = "NC";
  for (const [re, cod] of HINARIO_POR_NOME) if (re.test(t)) hinario = cod;
  const padroes = [
    // "Nome (NC 016)" / "Nome (NC 110-A)"
    /^(.*?)\s*\(\s*([A-Za-z]{2,3})\s*[-.]?\s*(\d{1,3})\s*-?\s*([A-Za-z])?\s*\)\s*$/,
    // "Nome NC 13" / "Nome HC - 137"
    /^(.*?)\s+([A-Za-z]{2,3})\s*[-.]?\s*(\d{1,3})\s*-?\s*([A-Za-z])?\s*$/,
  ];
  for (const re of padroes) {
    const m = t.match(re);
    if (m && CODIGOS_HINARIO[m[2].toUpperCase()]) {
      return { hinario: CODIGOS_HINARIO[m[2].toUpperCase()], numero: Number(m[3]), variante: (m[4] || "").toUpperCase(), nome: m[1] };
    }
  }
  let m = t.match(/^(\d{1,3})\s*[-–.]\s*(.+)$/); // "95 - Somente Cristo"
  if (m) return { hinario, numero: Number(m[1]), variante: "", nome: m[2] };
  m = t.match(/^(.+?)\s*[-–]\s*(\d{1,3})(?:\s+.*)?$/); // "Coração Quebrantado - 67", "Grato a Ti - 370 Harpa Cristã"
  if (m) return { hinario, numero: Number(m[2]), variante: "", nome: m[1] };
  return null;
}

/** "Louvor a Deus (NC 016)", "Crer e Observar (NC 110A)" */
function tituloHino(nome, hinario, numero, variante = "") {
  return `${tituloFrase(nome)} (${hinario} ${String(numero).padStart(3, "0")}${variante || ""})`;
}

/**
 * Letra do OpenLP (XML) na ordem em que se canta (verse_order "v1 c1 v2 c1"),
 * no formato da liturgia: estrofes com <br/>, refrão prefixado com "refrao:".
 */
function letraOpenLP(xml, ordem) {
  const blocos = {};
  const sequencia = [];
  const re = /<verse([^>]*)><!\[CDATA\[([\s\S]*?)\]\]><\/verse>/g;
  const atributo = (attrs, nome) => (attrs.match(new RegExp(`${nome}="([^"]*)"`)) || [])[1] || "";
  let m;
  while ((m = re.exec(xml)) !== null) {
    const label = atributo(m[1], "label") || "1";
    const tipo = (atributo(m[1], "type") || "v").toLowerCase();
    const texto = m[2]
      .replace(/\{\/?\w+\}/g, "")
      .split("\n")
      .map((l) => limparEspacos(l))
      .filter(Boolean)
      .join("<br/>");
    if (!texto) continue;
    const id = tipo + label;
    blocos[id] = tipo === "c" ? "refrao:" + texto : texto;
    sequencia.push(id);
  }
  const passos = String(ordem || "").trim().toLowerCase().split(/\s+/).filter((p) => blocos[p]);
  return (passos.length ? passos : sequencia).map((p) => blocos[p]);
}

/* ── passagens ─────────────────────────────────────────────────────────── */

const ABREVIACOES = ["gn", "ex", "lv", "nm", "dt", "js", "jz", "rt", "1sm", "2sm", "1rs", "2rs", "1cr", "2cr",
  "ed", "ne", "et", "jo*", "sl", "pv", "ec", "ct", "is", "jr", "lm", "ez", "dn", "os", "jl", "am", "ob", "jn",
  "mq", "na", "hc", "sf", "ag", "zc", "ml", "mt", "mc", "lc", "jo", "at", "rm", "1co", "2co", "gl", "ef", "fp",
  "cl", "1ts", "2ts", "1tm", "2tm", "tt", "fm", "hb", "tg", "1pe", "2pe", "1jo", "2jo", "3jo", "jd", "ap"];
const APELIDOS = { salmo: 19, cantares: 22, atos: 44, apocalipse: 66 };

/**
 * "Ester 4. 1-17" → "Ester 4:1-17"; "1Coríntios 13:1-13" → "1 Coríntios 13:1-13";
 * "Efésios 3:20,21" → "Efésios 3:20-21". `livros` = [{id, name}] da Bíblia de referência.
 * Devolve o título original (só com espaços limpos) quando não reconhece o livro.
 */
function tituloPassagem(titulo, livros) {
  const t = limparEspacos(titulo);
  const m = t.match(/^([1-3]?\s*[^\d\s][^\d]*?)\s*(\d+)(?:\s*[:.]\s*(.+))?$/);
  if (!m) return t;
  const k = chave(m[1]).replace(/ /g, "");
  const comAcento = (s) => String(s).toLowerCase().replace(/[\s.]/g, "");
  // Com acento decide sozinho ("Jó"); sem acento, abreviação vem antes do nome ("Jo" = João)
  let livro = livros.find((l) => comAcento(l.name) === comAcento(m[1]));
  if (!livro) {
    const i = ABREVIACOES.indexOf(k);
    if (i >= 0) livro = livros.find((l) => l.id === i + 1);
  }
  if (!livro) livro = livros.find((l) => chave(l.name).replace(/ /g, "") === k);
  if (!livro && APELIDOS[k]) livro = livros.find((l) => l.id === APELIDOS[k]);
  if (!livro) {
    const c = livros.filter((l) => chave(l.name).replace(/ /g, "").startsWith(k));
    if (c.length === 1) livro = c[0];
  }
  if (!livro) return t;
  const resto = (m[3] || "").replace(/\s+/g, "");
  if (!resto) return `${livro.name} ${m[2]}`;
  // "20,21" consecutivos viram "20-21"; demais listas ficam como estão
  const lista = resto.split(",");
  let versos = resto;
  if (lista.length > 1 && lista.every((p) => /^\d+$/.test(p))) {
    const n = lista.map(Number);
    if (n.every((v, i) => i === 0 || v === n[i - 1] + 1)) versos = `${n[0]}-${n[n.length - 1]}`;
  }
  return `${livro.name} ${m[2]}:${versos}`;
}

/* ── semelhança de letras (curadoria dos louvores) ─────────────────────── */

function textoDaLetra(letra) {
  return chave((letra || []).join(" ").replace(/refrao:/g, " ").replace(/<br\s*\/?>/gi, " "));
}

/** Coeficiente de Dice sobre bigramas do início da letra (0..1) */
function semelhanca(a, b, limite = 500) {
  a = a.slice(0, limite);
  b = b.slice(0, limite);
  if (!a.length || !b.length) return a === b ? 1 : 0;
  const bigramas = (s) => {
    const m = new Map();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      m.set(g, (m.get(g) || 0) + 1);
    }
    return m;
  };
  const x = bigramas(a);
  const y = bigramas(b);
  let comum = 0;
  for (const [g, n] of x) comum += Math.min(n, y.get(g) || 0);
  return (2 * comum) / (Math.max(a.length - 1, 0) + Math.max(b.length - 1, 0) || 1);
}

/** Título digitado todo em CAIXA ALTA (não diz quais palavras são nomes) */
function emCaixaAlta(t) {
  const letras = String(t || "").replace(/[^A-Za-zÀ-ÿ]/g, "");
  return letras.length > 3 && letras === letras.toUpperCase();
}

module.exports = {
  emCaixaAlta,
  chave,
  limparEspacos,
  tituloLouvor,
  tituloFrase,
  ehMusicaDoCoral,
  semPrefixoMusica,
  lerNumeroHino,
  tituloHino,
  letraOpenLP,
  tituloPassagem,
  textoDaLetra,
  semelhanca,
};
