/* ────────────────────────────────────────────────────────────────────────
   Seletor bíblico do Painel — versão, livro e capítulo em botões (como a
   escolha de passagem da Liturgia), ou referência digitada ("Jo 3:16").
   O capítulo abre a janela /Biblia de sempre (listaVersiculos em Painel.js).
   Dados: window.BIBLIA = { livros: [{id, name, capitulos}], versoes: [arquivo], versaoAtual }
   ──────────────────────────────────────────────────────────────────────── */

// Abreviações na ordem canônica: todas as Bíblias do projeto usam book.id 1..66
const BS_ABREVIACOES = ['Gn', 'Êx', 'Lv', 'Nm', 'Dt', 'Js', 'Jz', 'Rt', '1Sm', '2Sm', '1Rs', '2Rs',
    '1Cr', '2Cr', 'Ed', 'Ne', 'Et', 'Jó', 'Sl', 'Pv', 'Ec', 'Ct', 'Is', 'Jr', 'Lm', 'Ez', 'Dn',
    'Os', 'Jl', 'Am', 'Ob', 'Jn', 'Mq', 'Na', 'Hc', 'Sf', 'Ag', 'Zc', 'Ml',
    'Mt', 'Mc', 'Lc', 'Jo', 'At', 'Rm', '1Co', '2Co', 'Gl', 'Ef', 'Fp', 'Cl', '1Ts', '2Ts',
    '1Tm', '2Tm', 'Tt', 'Fm', 'Hb', 'Tg', '1Pe', '2Pe', '1Jo', '2Jo', '3Jo', 'Jd', 'Ap'];
const BS_APELIDOS = { salmo: 19, cantares: 22, atos: 44 };

const bsNormalizar = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[\s.]/g, '');
const bsSigla = arquivo => (String(arquivo).match(/- ([^-]+)\.sqlite$/) || [])[1] || arquivo;

// Conveniências deste navegador: último livro, último capítulo por livro, leituras recentes por canal
// e a versão por culto (data@evento). Tudo em localStorage; se falhar, o seletor funciona sem lembrar.
function bsLembrar(chave, valor) {
    try {
        if (valor === undefined) return localStorage.getItem('bibliaSeletor.' + chave);
        localStorage.setItem('bibliaSeletor.' + chave, valor);
    } catch (_) { return null; }
}

/** Canal do Painel: o slug do evento (?evento=) ou "culto" (congregacional) */
function bsCanal() { return (typeof EVENTO !== 'undefined' && EVENTO) || 'culto'; }
const bsHoje = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
/** Data do culto aberto no Painel (AAAA-MM-DD) */
function bsData() {
    const v = $('#dataCulto').val() || new URLSearchParams(location.search).get('data') || '';
    return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : bsHoje();
}
const bsChaveVersao = () => `versao.${bsData()}@${bsCanal()}`;

/** Versão deste culto: a última escolhida nele, se ainda existir; senão a padrão */
function bsVersaoDoCulto() {
    const guardada = bsLembrar(bsChaveVersao());
    const versoes = (window.BIBLIA && window.BIBLIA.versoes) || [];
    // Padrão da igreja: ARA (decisão do João, 28/09/2026); a troca vale até o fim deste culto
    return versoes.includes(guardada) ? guardada : (versoes.find(a => / - ARA\.sqlite$/.test(a)) || window.BIBLIA.versaoAtual);
}

/** Descarta versões guardadas de datas anteriores a hoje (não acumula) */
function bsLimparVersoesAntigas() {
    try {
        const hoje = bsHoje();
        Object.keys(localStorage).forEach(k => {
            const m = k.match(/^bibliaSeletor\.versao\.(\d{4}-\d{2}-\d{2})@/);
            if (m && m[1] < hoje && m[1] !== bsData()) localStorage.removeItem(k);
            if (/^bibliaSeletor\.recentes\./.test(k)) localStorage.removeItem(k); // formato antigo (por versículo)
        });
    } catch (_) { /* sem armazenamento: nada a limpar */ }
}

/** Marca o capítulo aberto (o que se abriu, não cada versículo); o que já está marcado não se repete. Máx. 10 */
function bsMarcar(livro, capitulo, versao) {
    try {
        const lista = bsRecentes();
        if (lista.some(r => r.livro === livro.id && r.cap === capitulo)) return;
        const agora = new Date();
        const hora = String(agora.getHours()).padStart(2, '0') + ':' + String(agora.getMinutes()).padStart(2, '0');
        bsLembrar('marcadores.' + bsCanal(), JSON.stringify([{ livro: livro.id, nome: livro.name, cap: capitulo, versao, hora, data: bsHoje() }, ...lista].slice(0, 10)));
    } catch (_) { /* sem armazenamento: abre sem marcar */ }
}

function bsRecentes() {
    try { const l = JSON.parse(bsLembrar('marcadores.' + bsCanal()) || '[]'); return Array.isArray(l) ? l : []; }
    catch (_) { return []; }
}

function bsLivros() { return (window.BIBLIA && window.BIBLIA.livros) || []; }

/** Livro pelo que foi digitado: com acento decide sozinho ("Jó"); sem acento, "Jo" = João */
function bsAcharLivro(digitado) {
    const t = bsNormalizar(digitado);
    if (!t) return null;
    const livros = bsLivros();
    const comAcento = s => String(s || '').toLowerCase().replace(/[\s.]/g, '');
    let i = BS_ABREVIACOES.findIndex(a => comAcento(a) === comAcento(digitado));
    if (i < 0) i = BS_ABREVIACOES.map(bsNormalizar).lastIndexOf(t);
    if (i >= 0) return livros.find(l => l.id === i + 1) || null;
    const exato = livros.find(l => bsNormalizar(l.name) === t);
    if (exato) return exato;
    if (BS_APELIDOS[t]) return livros.find(l => l.id === BS_APELIDOS[t]) || null;
    const candidatos = livros.filter(l => bsNormalizar(l.name).startsWith(t));
    return candidatos.length === 1 ? candidatos[0] : null;
}

/** "Jo 3:16-18" → { livro, capitulo: 3, versiculo: 16 }; "Sl 23" → versiculo null */
function bsInterpretar(ref) {
    const m = String(ref || '').trim().match(/^([1-3]?\s*[^\d\s][^\d]*?)\s*(\d+)(?:\s*[:.]\s*(\d+))?/);
    if (!m) return null;
    const livro = bsAcharLivro(m[1]);
    if (!livro) return { erro: `Livro não reconhecido: "${m[1].trim()}"` };
    const capitulo = Number(m[2]);
    if (capitulo < 1 || capitulo > livro.capitulos) return { erro: `${livro.name} tem ${livro.capitulos} capítulos.` };
    return { livro, capitulo, versiculo: m[3] ? Number(m[3]) : null };
}

/* ── tela ──────────────────────────────────────────────────────────────── */

function bsDesenharLivros(filtro = '') {
    const t = bsNormalizar((String(filtro).match(/^\s*([1-3]?\s*[^\d]*)/) || ['', ''])[1]);
    const ativo = Number(bsLembrar('livro')) || 0;
    const combina = l => !t || bsNormalizar(l.name).includes(t) || bsNormalizar(BS_ABREVIACOES[l.id - 1]).startsWith(t);
    const botao = l => $('<button type="button" class="bs-livro">')
        .toggleClass('ativo', l.id === ativo)
        .attr({ 'data-id': l.id, title: l.name })
        .append($('<span class="abrev">').text(BS_ABREVIACOES[l.id - 1] || ''),
            $('<span class="nome">').text(l.name));
    $('#bsAT').empty().append(bsLivros().filter(l => l.id <= 39 && combina(l)).map(botao));
    $('#bsNT').empty().append(bsLivros().filter(l => l.id >= 40 && combina(l)).map(botao));
    $('#bsRotuloAT').toggle(!!$('#bsAT').children().length);
    $('#bsRotuloNT').toggle(!!$('#bsNT').children().length);
}

/** Hora da leitura; de outro dia, a data antes (o marcador não se passa por leitura de hoje) */
function bsQuando(r) {
    if (!r.data || r.data === bsHoje()) return r.hora || "";
    const [, m, d] = r.data.split("-");
    return `${d}/${m} ${r.hora || ""}`.trim();
}

function bsDesenharRecentes() {
    const lista = bsRecentes().slice(0, 10);
    // O botão fica sempre ao lado da versão; sem leituras, o menu explica onde elas aparecem
    $('#bsRecentesQtd').text(lista.length);
    $('#bsRecentesBtn').attr('aria-label', `Leituras recentes: ${lista.length}`);
    $('#bsRecentesLista').empty().append($('<div class="bs-rotulo">').text('Leituras recentes'),
        lista.length ? null : $('<div class="bs-recentes-vazio">').text('Nenhum capítulo marcado ainda. Os capítulos abertos aparecem aqui.'),
        lista.map((r, i) => $('<button type="button" class="bs-recente" role="menuitem">')
        .attr({ 'data-i': i, 'aria-label': `${r.nome} ${r.cap}, ${bsSigla(r.versao)}, ${bsQuando(r)}` })
        .append($('<i class="fa-solid fa-bookmark" aria-hidden="true"></i>'),
            $('<span class="ref">').text(`${r.nome} ${r.cap}`),
            $('<span class="meta">').text(`${bsSigla(r.versao)} · ${bsQuando(r)}`))));
}

/** Passo 1 (versão, busca e livros) ou passo 2 (capítulos do livro escolhido) */
function bsPasso(n) {
    $('.bs').attr('data-passo', n);
    $('.bs-passo').scrollTop(0);
}

/** Escolher o livro leva ao passo 2: a grade de capítulos 1..N */
function bsEscolherLivro(livro) {
    bsLembrar('livro', livro.id);
    $('#bsLivros .bs-livro').removeClass('ativo').filter(`[data-id="${livro.id}"]`).addClass('ativo');
    $('#bsLivroTitulo').text(livro.name);
    const capAtivo = Number(bsLembrar('cap.' + livro.id)) || 0;
    $('#bsCapitulos').empty().append(Array.from({ length: livro.capitulos }, (_, i) =>
        $('<button type="button" class="bs-cap">').toggleClass('ativo', i + 1 === capAtivo).attr({ 'data-cap': i + 1, 'aria-label': `${livro.name}, capítulo ${i + 1}` }).text(i + 1)));
    $('#bsDica').text('Escolha o capítulo: a lista de versículos abre na janela da Bíblia.');
    bsPasso(2);
}

/** Abre a janela /Biblia no capítulo (e posiciona no versículo, sem projetar) */
function bsAbrir(livro, capitulo, versiculo = null) {
    const versao = $('#bsVersao').val() || window.BIBLIA.versaoAtual;
    bsLembrar('livro', livro.id);
    bsLembrar('cap.' + livro.id, capitulo);
    bsMarcar(livro, capitulo, versao);
    bootbox.hideAll();
    listaVersiculos(livro.id, capitulo, versao, livro.name, versiculo);
}

function bsAplicarReferencia(texto) {
    const ref = bsInterpretar(texto);
    if (!ref || ref.erro) {
        const unico = $('#bsLivros .bs-livro');
        if (!ref && unico.length === 1) {
            bsEscolherLivro(bsLivros().find(l => l.id === Number(unico.data('id'))));
            $('#bsErro').text('');
            return;
        }
        $('#bsErro').text(ref?.erro || 'Use: livro capítulo:versículo, por exemplo Jo 3:16');
        return;
    }
    bsAbrir(ref.livro, ref.capitulo, ref.versiculo);
}

function abrirSeletorBiblico() {
    const versoes = (window.BIBLIA && window.BIBLIA.versoes) || [];
    // A versão acompanha o culto (data@evento): a última escolhida nele; sem escolha, a padrão
    bsLimparVersoesAntigas();
    const versaoInicial = bsVersaoDoCulto();

    const html = /* html */`
<div class="bs" data-passo="1">
  <div class="bs-topo">
    <div class="bs-versao-linha">
      <select id="bsVersao" class="form-select" aria-label="Versão da Bíblia" title="Versão da Bíblia"></select>
      <div class="bs-marcadores" id="bsRecentes">
        <button type="button" class="btn bs-marcadores-btn" id="bsRecentesBtn" aria-haspopup="true" aria-expanded="false"
          title="Leituras recentes (as 10 últimas)"><i class="fa-solid fa-bookmark" aria-hidden="true"></i><span class="qtd" id="bsRecentesQtd"></span></button>
        <div class="bs-marcadores-menu" id="bsRecentesLista" role="menu" aria-label="Leituras recentes"></div>
      </div>
    </div>
    <div class="input-group bs-busca">
      <input type="text" id="bsRef" class="form-control" autocomplete="off" aria-label="Referência ou nome do livro"
        placeholder="Referência (Jo 3:16, Sl 23) ou livro">
      <button class="btn btn-primary" type="button" id="bsIr">Ir</button>
    </div>
  </div>
  <div id="bsErro" role="alert"></div>
  <div class="bs-passo bs-passo-livros" id="bsLivros">
    <div class="bs-rotulo" id="bsRotuloAT">Antigo Testamento</div>
    <div class="bs-livros" id="bsAT"></div>
    <div class="bs-rotulo" id="bsRotuloNT">Novo Testamento</div>
    <div class="bs-livros" id="bsNT"></div>
  </div>
  <div class="bs-passo bs-passo-capitulos">
    <div class="bs-cap-topo">
      <button type="button" class="bs-voltar" id="bsVoltar" aria-label="Voltar para a lista de livros">&lsaquo; Livros</button>
      <strong id="bsLivroTitulo">Escolha um livro</strong>
    </div>
    <div class="bs-capitulos" id="bsCapitulos"></div>
    <div class="bs-dica" id="bsDica"></div>
  </div>
</div>`;

    bootbox.dialog({
        title: '<i class="fa-solid fa-book-bible me-2"></i>Bíblia',
        message: html,
        onEscape: true,
        closeButton: true,
        backdrop: true,
        size: 'extra-large',
        className: 'bs-modal',
    }).on('shown.bs.modal', function () {
        const $v = $('#bsVersao');
        versoes.forEach(a => $('<option>').val(a).text(bsSigla(a)).attr('title', a.replace('.sqlite', ''))
            .prop('selected', a === versaoInicial).appendTo($v));
        bsDesenharLivros();
        bsDesenharRecentes();
        $v.on('change', () => bsLembrar(bsChaveVersao(), $v.val()));

        // Teclado só abre sozinho com mouse/teclado físico; no toque o operador escolhe nos botões
        const $ref = $('#bsRef');
        if (window.matchMedia('(pointer: fine)').matches) $ref.trigger('focus');
        $ref.on('input', function () { bsDesenharLivros(this.value); $('#bsErro').text(''); })
            .on('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); bsAplicarReferencia(this.value); } });
        $('#bsIr').on('click', () => bsAplicarReferencia($('#bsRef').val()));
        $('#bsLivros').on('click', '.bs-livro', function () {
            bsEscolherLivro(bsLivros().find(l => l.id === Number(this.dataset.id)));
        });
        // Menu dos marcadores ao lado da versão: tocar no botão abre e fecha; fora dele, fecha
        const $menuRec = $('#bsRecentesLista'), $btnRec = $('#bsRecentesBtn');
        const abrirRec = (sim) => { $menuRec.toggleClass('show', sim); $btnRec.attr('aria-expanded', sim ? 'true' : 'false'); };
        $btnRec.on('click', (e) => { e.stopPropagation(); abrirRec(!$menuRec.hasClass('show')); });
        $('.bs-modal').on('click', (e) => { if (!$('#bsRecentes')[0].contains(e.target)) abrirRec(false); });
        $('#bsRecentesLista').on('click', '.bs-recente', function () {
            const r = bsRecentes()[Number(this.dataset.i)];
            if (!r) return;
            bootbox.hideAll();
            listaVersiculos(r.livro, r.cap, r.versao, r.nome);
        });
        $('#bsVoltar').on('click', () => bsPasso(1));
        $('#bsCapitulos').on('click', '.bs-cap', function () {
            const livro = bsLivros().find(l => l.id === Number(bsLembrar('livro')));
            if (livro) bsAbrir(livro, Number(this.dataset.cap));
        });
    });
}
