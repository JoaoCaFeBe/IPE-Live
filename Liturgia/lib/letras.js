// Provedores públicos sem chave. A escolha de artista/versão pertence ao usuário.
const normalizar = (texto) => String(texto || "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const temLetra = (texto) => typeof texto === "string" && texto.trim().length > 0;

function criarServicoLetras({ fetchImpl = fetch, timeoutMs = 6000 } = {}) {
  async function consultar(url) {
    const resposta = await fetchImpl(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "User-Agent": "IPE-Liturgia/1.0 (https://ipe.desklaser.cloud)", Accept: "application/json" },
    });
    // 404 é ausência; erros de rede/HTTP/JSON permitem tentar a próxima fonte.
    if (resposta.status === 404) return null;
    if (!resposta.ok) throw new Error("Provedor indisponível");
    return resposta.json();
  }

  const lrclib = (faixa) => ({
    provider: "lrclib", id: String(faixa.id), title: faixa.trackName,
    artist: faixa.artistName, album: faixa.albumName || "", text: faixa.plainLyrics.trim().replace(/\r\n?/g, "\n"),
  });

  async function buscar(q) {
    // O catálogo local anota versões/artistas entre parênteses; isso não é parte do título.
    const consulta = q.replace(/\([^)]*\)/g, " ").replace(/\s+-\s+.+$/, "").replace(/\s+/g, " ").trim() || q;
    const observacao = q.match(/\(([^)]+)\)/)?.[1] || q.match(/\s+-\s+(.+)$/)?.[1] || "";
    const artista = observacao.replace(/\/coral$/i, "").trim();
    const pistaArtista = artista && !/\d|^(coral|quarteto|medley|ao vivo|vers[aã]o|breathe|miscel[aâ]nea)/i.test(artista) ? artista : "";
    const artistaCompativel = (nome) => !pistaArtista || normalizar(nome).includes(normalizar(pistaArtista));
    const prioridade = (faixa) => {
      const texto = normalizar(faixa.plainLyrics);
      const sinais = ["jesus", "cristo", "deus", "senhor", "salvador", "aleluia"];
      const titulo = normalizar(faixa.trackName || faixa.title);
      const procurado = normalizar(consulta);
      const tituloExato = titulo === procurado ? 100 : titulo.includes(procurado) ? 50 : 0;
      return tituloExato + sinais.filter((palavra) => texto.split(" ").includes(palavra)).length;
    };
    let falhas = 0;
    try {
      const parametros = pistaArtista ? { track_name: consulta, artist_name: pistaArtista } : { q: consulta };
      const dados = await consultar(`https://lrclib.net/api/search?${new URLSearchParams(parametros)}`);
      if (dados !== null && !Array.isArray(dados)) throw new Error("Resposta inválida");
      const resultados = (dados || []).filter((faixa) => faixa.id && faixa.trackName && faixa.artistName && artistaCompativel(faixa.artistName) && temLetra(faixa.plainLyrics))
        .sort((a, b) => prioridade(b) - prioridade(a)).map(lrclib);
      if (resultados.length) return { results: resultados, provider: "lrclib" };
    } catch (_) { falhas++; }
    try {
      const dados = await consultar(`https://api.lyrics.ovh/suggest/${encodeURIComponent([consulta, pistaArtista].filter(Boolean).join(" "))}`);
      if (dados !== null && !Array.isArray(dados?.data)) throw new Error("Resposta inválida");
      const candidatos = (dados?.data || []).filter((faixa) => faixa.id && faixa.title && faixa.artist?.name && artistaCompativel(faixa.artist.name))
        .sort((a, b) => prioridade(b) - prioridade(a)).map((faixa) => ({
        provider: "lyricsovh", id: String(faixa.id), title: faixa.title,
        artist: faixa.artist.name, album: faixa.album?.title || "",
      }));
      const resultados = [];
      // A sugestão é apenas metadado. Só exibe depois de carregar o texto.
      // Três consultas por lote limitam a carga e o tempo da pesquisa.
      for (let inicio = 0; inicio < candidatos.length; inicio += 3) {
        const lote = await Promise.all(candidatos.slice(inicio, inicio + 3).map(async (faixa) => {
          try {
            const dadosLetra = await consultar(`https://api.lyrics.ovh/v1/${encodeURIComponent(faixa.artist)}/${encodeURIComponent(faixa.title)}`);
            return temLetra(dadosLetra?.lyrics) ? { ...faixa, text: dadosLetra.lyrics.trim().replace(/\r\n?/g, "\n") } : null;
          } catch (_) { falhas++; return null; }
        }));
        resultados.push(...lote.filter(Boolean));
      }
      if (resultados.length) return { results: resultados, provider: "lyricsovh" };
    } catch (_) { falhas++; }
    if (falhas) return { results: [], error: "Não foi possível concluir a pesquisa nas fontes gratuitas. Tente novamente mais tarde.", status: 502 };
    return { results: [] };
  }

  async function letra({ provider, id, title, artist }) {
    let falhas = 0;
    // Tenta primeiro a versão selecionada; depois procura a mesma música/artista.
    const fontes = provider === "lyricsovh" ? ["lyricsovh", "lrclib"] : ["lrclib", "lyricsovh"];
    for (const fonte of fontes) {
      try {
        if (fonte === "lrclib") {
          if (provider === "lrclib") {
            const faixa = await consultar(`https://lrclib.net/api/get/${encodeURIComponent(id)}`);
            if (faixa && normalizar(faixa.trackName) === normalizar(title) && normalizar(faixa.artistName) === normalizar(artist) && temLetra(faixa.plainLyrics)) {
              return { title, artist, text: faixa.plainLyrics.trim(), provider: fonte };
            }
          } else {
            const dados = await consultar(`https://lrclib.net/api/search?${new URLSearchParams({ track_name: title, artist_name: artist })}`);
            if (dados !== null && !Array.isArray(dados)) throw new Error("Resposta inválida");
            const faixa = (dados || []).find((item) => normalizar(item.trackName) === normalizar(title) && normalizar(item.artistName) === normalizar(artist) && temLetra(item.plainLyrics));
            if (faixa) return { title, artist, text: faixa.plainLyrics.trim(), provider: fonte };
          }
        } else {
          const dados = await consultar(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`);
          if (temLetra(dados?.lyrics)) return { title, artist, text: dados.lyrics.trim(), provider: fonte };
        }
      } catch (_) { falhas++; }
    }
    return { status: falhas ? 502 : 404, error: falhas
      ? "Não foi possível obter a letra nas fontes gratuitas. Tente novamente mais tarde."
      : "Letra não encontrada nas fontes gratuitas para esta música e artista. Você pode inserir a letra manualmente." };
  }

  return { buscar, letra };
}

module.exports = { criarServicoLetras };
