const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const T = require('../public/js/trechos');
const N = require('../lib/normalizar');
const dueto = { tipo: 'duas-vozes', refrao: true, esquerda: { nome: 'Tenores', texto: 'Um\nDois\nTrês\nQuatro' }, direita: { nome: 'Baixos', texto: 'Resposta um\nResposta dois\nResposta três' } };
test('estrofes antigas e refrão preservados na ida e volta do editor', () => {
    const letra = ['Texto<br/>Outra linha', 'refrao:Todos<br/>Juntos'];
    assert.deepEqual(T.doEditor(T.paraEditor(letra)), letra);
});
test('duas vozes persistem junto com trechos antigos sem perder nomes ou ordem', () => {
    const letra = ['Abertura', dueto, 'Final'];
    assert(T.letraValida(letra));
    assert.deepEqual(T.doEditor(T.paraEditor(JSON.parse(JSON.stringify(letra)))), letra);
    assert(N.textoDaLetra(letra).includes('resposta tres'));
    assert(!N.textoDaLetra(letra).includes('object object'));
});
test('paginação mantém pares e coluna mais curta sem repetir versos', () => {
    const pares = T.pares(dueto);
    assert.equal(pares.length, 2);
    assert.equal(pares[1].esquerda.texto, 'Três\nQuatro');
    assert.equal(pares[1].direita.texto, 'Resposta três');
    const curto = { ...dueto, direita: { nome: 'Baixos', texto: 'Uma resposta' } };
    const final = T.pares(curto)[1];
    assert.equal(final.direita.texto, '');
    assert(T.ehPar(final));
    assert(!T.ehDueto(final));
});
test('segunda metade da legenda conserva quatro versos no Projetor', () => {
    const partes = T.divisoes(dueto);
    assert.equal(partes.length, 2);
    assert.deepEqual(partes[0].projetor, partes[1].projetor);
    assert.equal(partes[0].projetor.esquerda.texto, 'Um\nDois\nTrês\nQuatro');
    assert.equal(partes[1].legenda.esquerda.texto, 'Três\nQuatro');
    assert.equal(partes[1].legenda.direita.texto, 'Resposta três');
});
test('quadro seguinte inicia após quatro versos e não repete a voz curta', () => {
    const longo = { ...dueto, esquerda: { nome:'Tenores', texto:'1\n2\n3\n4\n5\n6\n7' }, direita:{nome:'Baixos',texto:'A'} };
    const partes = T.divisoes(longo);
    assert.equal(partes.length, 4);
    assert.equal(partes[2].projetor.esquerda.texto, '5\n6\n7');
    assert.deepEqual(partes[2].projetor, partes[3].projetor);
    assert.equal(partes[3].legenda.esquerda.texto, '7');
    assert.equal(partes[2].projetor.direita.texto, '');
    assert.equal(partes[3].legenda.direita.texto, '');
});
test('rejeita dueto sem nome/voz preenchida e objetos estranhos', () => {
    for (const t of [{}, { ...dueto, esquerda: { nome: '', texto: 'Sim' } }, { ...dueto, direita: { nome: 'B', texto: '' } }, { ...dueto, refrao: 'true' }]) assert(!T.letraValida([t]));
    assert(!T.letraValida([]));
});
test('contrato embarcado no Live é igual ao da Liturgia', () => {
    assert.equal(fs.readFileSync(path.join(__dirname, '../public/js/trechos.js'), 'utf8'), fs.readFileSync(path.join(__dirname, '../../live/public/js/Trechos.js'), 'utf8'));
});

test('conversão remove marcas antigas sem alterar os trechos originais', () => {
    const original = '{it}Eu canto{/it}<br/><strong>E louvo</strong>';
    const b = T.paraEditor([original])[0];
    assert.equal(T.plano(b.texto), 'Eu canto\nE louvo');
    assert.deepEqual(T.doEditor([b]), [original]);
});

test('saída para clientes antigos mantém strings e escapa texto de vozes', () => {
    const l = T.legado(['Antes', { ...dueto, esquerda: { nome: '<img>', texto: '<script>texto</script>' } }, 'Depois']);
    assert(l.every(t => typeof t === 'string'));
    assert.equal(l[0], 'Antes');
    assert.equal(l[2], 'Depois');
    assert(l[1].includes('&lt;img&gt;'));
    assert(!l[1].includes('<script>'));
});
test('linhas vazias das vozes sobrevivem ao cadastro, inclusive no início e fim', () => {
    const pausa = { ...dueto, esquerda:{nome:'Tenores',texto:'\nUm\n\nTrês\n'}, direita:{nome:'Baixos',texto:'Seu amor\n\nSua graça'} };
    assert.deepEqual(T.doEditor(T.paraEditor([pausa])), [pausa]);
    assert.deepEqual(T.linhasVoz(pausa.direita.texto), ['Seu amor','','Sua graça']);
    assert.deepEqual(T.linhas('Um\n\nDois'), ['Um','Dois']);
    assert(T.legado([pausa])[0].includes('Seu amor<br/><br/>Sua graça'));
});
test('resposta na terceira posição fica na segunda metade do OBS', () => {
    const pausa = { ...dueto, direita:{nome:'Baixos',texto:'Seu amor permanece\n\nSua graça nos alcança'} };
    const partes = T.divisoes(pausa);
    assert.equal(partes.length, 2);
    assert.equal(partes[0].legenda.direita.texto, 'Seu amor permanece\n');
    assert.equal(partes[1].legenda.direita.texto, 'Sua graça nos alcança');
    assert.deepEqual(partes[0].projetor, partes[1].projetor);
});
test('metade totalmente em silêncio conserva duas posições sem antecipar versos', () => {
    const pausa = { ...dueto, esquerda:{nome:'Tenores',texto:'\n\nEntrada T'}, direita:{nome:'Baixos',texto:'\n\nEntrada B'} };
    const partes = T.divisoes(pausa);
    assert(T.ehPar(partes[0].legenda));
    assert.equal(partes[0].legenda.posicoes, 2);
    assert.equal(partes[0].legenda.esquerda.texto, '\n');
    assert.equal(partes[1].legenda.esquerda.texto, 'Entrada T');
    assert(!T.ehPar({...partes[0].legenda,posicoes:999}));
    assert(!T.ehPar({...partes[0].legenda,posicoes:'2'}));
});
test('pausas atravessam o limite de quatro posições sem adiantar o quadro seguinte', () => {
    const pausa = { ...dueto, esquerda:{nome:'Tenores',texto:'1\n2\n3\n\n5'}, direita:{nome:'Baixos',texto:'A\n\nC\n\nE'} };
    const partes = T.divisoes(pausa);
    assert.equal(partes.length, 3);
    assert.equal(partes[1].legenda.esquerda.texto, '3\n');
    assert.equal(partes[1].projetor.esquerda.texto, '1\n2\n3\n');
    assert.equal(partes[2].legenda.esquerda.texto, '5');
    assert.equal(partes[2].projetor.direita.texto, 'E');
});
