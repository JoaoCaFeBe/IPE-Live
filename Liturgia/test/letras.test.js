const { test } = require("node:test");
const assert = require("node:assert/strict");
const { criarServicoLetras } = require("../lib/letras");
const faixa = { id: 123, trackName: "Louvor", artistName: "Coral", plainLyrics: "Texto de teste" };
function servico(respostas) {
  const chamadas = [];
  return { chamadas, ...criarServicoLetras({ fetchImpl: async (url, options) => {
    chamadas.push(url);
    assert.ok(options.signal);
    assert.match(options.headers["User-Agent"], /IPE-Liturgia/);
    const resposta = respostas.shift();
    if (resposta instanceof Error) throw resposta;
    assert.ok(resposta, "Chamada inesperada");
    return { ok: resposta.status === 200, status: resposta.status, json: async () => {
      if (resposta.invalid) throw new SyntaxError();
      return resposta.body;
    } };
  } }) };
}
const ok = (body) => ({ status: 200, body });
const sugestao = { data: [{ id: 7, title: "Louvor", artist: { name: "Coral" } }] };

test("busca prioriza LRCLIB e não consulta alternativa se há letra", async () => {
  const s = servico([ok([faixa])]);
  assert.equal((await s.buscar("Louvor")).results[0].provider, "lrclib");
  assert.equal(s.chamadas.length, 1);
});
test("consulta tira observação local e prioriza indícios gospel sem ocultar homônimos", async () => {
  const s = servico([ok([faixa, { ...faixa, id: 456, artistName: "Coral gospel", plainLyrics: "Jesus Cristo Salvador" }])]);
  const r = await s.buscar("Louvor (coral)");
  assert.equal(r.results[0].artist, "Coral gospel");
  assert.equal(r.results.length, 2);
  assert.equal(new URL(s.chamadas[0]).searchParams.get("q"), "Louvor");
});
test("respeita o artista indicado no cadastro em vez de oferecer homônimo", async () => {
  const s = servico([ok([faixa, { ...faixa, id: 456, artistName: "Paulo Cesar Baruk" }])]);
  const r = await s.buscar("Louvor (Paulo César Baruk)");
  assert.equal(r.results.length, 1);
  assert.equal(r.results[0].artist, "Paulo Cesar Baruk");
  assert.equal(new URL(s.chamadas[0]).searchParams.get("artist_name"), "Paulo César Baruk");
});
test("título exato vem antes de resultado aproximado mesmo com indícios gospel", async () => {
  const s = servico([ok([{ ...faixa, id: 789, trackName: "Outro louvor", plainLyrics: "Jesus Cristo Deus Senhor" }, faixa])]);
  assert.equal((await s.buscar("Louvor")).results[0].id, "123");
});
for (const [nome, resposta] of [
  ["lista vazia", ok([])], ["sem letra", ok([{ ...faixa, plainLyrics: "" }])],
  ["HTTP503", { status: 503 }], ["timeout", new Error("Timeout")],
  ["JSON inválido", { status: 200, invalid: true }], ["estrutura inválida", ok({})],
]) {
  test(`busca usa alternativa após ${nome}`, async () => {
    const s = servico([resposta, ok(sugestao), ok({ lyrics: "Letra carregada" })]);
    assert.equal((await s.buscar("Louvor")).results[0].provider, "lyricsovh");
    assert.equal(s.chamadas.length, 3);
  });
}
test("sugestões sem letra são omitidas e texto é normalizado preservando estrofes", async () => {
  const s = servico([ok([]), ok({ data: [
    { id: 1, title: "Sem letra", artist: { name: "Coral" } },
    { id: 2, title: "Com letra", artist: { name: "Coral" } },
    { id: 3, title: "Vazia", artist: { name: "Coral" } },
  ] }), { status: 404 }, ok({ lyrics: "Estrofe um\r\n\r\nEstrofe dois" }), ok({ lyrics: " " })]);
  const r = await s.buscar("Louvor");
  assert.equal(r.results.length, 1);
  assert.equal(r.results[0].title, "Com letra");
  assert.equal(r.results[0].text, "Estrofe um\n\nEstrofe dois");
});
test("diferencia ausência de indisponibilidade", async () => {
  assert.deepEqual(await servico([ok([]), ok({ data: [] })]).buscar("Coral"), { results: [] });
  assert.equal((await servico([{ status: 503 }, ok({ data: [] })]).buscar("Coral")).status, 502);
});
const selecao = { provider: "lrclib", id: "123", title: "Louvor", artist: "Coral" };
test("letra mantém versão selecionada pelo ID", async () => {
  const s = servico([ok(faixa)]);
  assert.equal((await s.letra(selecao)).provider, "lrclib");
  assert.equal(s.chamadas.length, 1);
});
test("letra usa alternativa quando selecionada está vazia", async () => {
  const s = servico([ok({ ...faixa, plainLyrics: "" }), ok({ lyrics: "Texto alternativo" })]);
  assert.equal((await s.letra(selecao)).text, "Texto alternativo");
});
test("letra usa alternativa após erro", async () => {
  const s = servico([new Error("Rede"), ok({ lyrics: "Texto alternativo" })]);
  assert.equal((await s.letra(selecao)).provider, "lyricsovh");
});
test("letra ausente nas duas fontes devolve404 e falha nas duas devolve502", async () => {
  assert.equal((await servico([{ status: 404 }, { status: 404 }]).letra(selecao)).status, 404);
  assert.equal((await servico([{ status: 503 }, { status: 503 }]).letra(selecao)).status, 502);
});
test("fallback reverso não troca artista por homônimo", async () => {
  const s = servico([{ status: 404 }, ok([{ ...faixa, artistName: "Outro coral" }])]);
  assert.equal((await s.letra({ ...selecao, provider: "lyricsovh" })).status, 404);
});
test("fallback reverso reconhece grafia sem acento do mesmo artista", async () => {
  const s = servico([{ status: 404 }, ok([{ ...faixa, artistName: "Córál" }])]);
  assert.equal((await s.letra({ ...selecao, provider: "lyricsovh" })).provider, "lrclib");
});
test("codifica título e artista sem criar rota arbitrária", async () => {
  const s = servico([ok({ lyrics: "Texto" })]);
  await s.letra({ ...selecao, provider: "lyricsovh", artist: "Artista / coral", title: "Canção? #1" });
  assert.ok(s.chamadas[0].endsWith("Artista%20%2F%20coral/Can%C3%A7%C3%A3o%3F%20%231"));
});
