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

// Último livro usado (conveniência deste navegador); a versão sempre começa na ARA
function bsLembrar(chave, valor) {
    try {
        if (valor === undefined) return localStorage.getItem('bibliaSeletor.' + chave);
        localStorage.setItem('bibliaSeletor.' + chave, valor);
    } catch (_) { return null; }
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

function bsEscolherLivro(livro) {
    bsLembrar('livro', livro.id);
    $('#bsLivros .bs-livro').removeClass('ativo').filter(`[data-id="${livro.id}"]`).addClass('ativo');
    $('#bsLivroTitulo').text(livro.name);
    $('#bsCapitulos').empty().append(Array.from({ length: livro.capitulos }, (_, i) =>
        $('<button type="button" class="bs-cap">').attr('data-cap', i + 1).text(i + 1)));
    $('#bsDica').text('Escolha o capítulo — a lista de versículos abre na janela da Bíblia.');
}

/** Abre a janela /Biblia no capítulo (e posiciona no versículo, sem projetar) */
function bsAbrir(livro, capitulo, versiculo = null) {
    const versao = $('#bsVersao').val() || window.BIBLIA.versaoAtual;
    bsLembrar('livro', livro.id);
    $('#bibliaAtual').text(`${livro.name} ${capitulo}${versiculo ? ':' + versiculo : ''} · ${bsSigla(versao)}`);
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
        $('#bsErro').text(ref?.erro || 'Use: livro capítulo:versículo — ex.: Jo 3:16');
        return;
    }
    bsAbrir(ref.livro, ref.capitulo, ref.versiculo);
}

function abrirSeletorBiblico() {
    const versoes = (window.BIBLIA && window.BIBLIA.versoes) || [];
    // Padrão da igreja: sempre abre na ARA (decisão do João, 28/09/2026); trocar vale só para esta abertura
    const versaoInicial = versoes.find(a => / - ARA\.sqlite$/.test(a)) || window.BIBLIA.versaoAtual;

    const html = /* html */`
<div class="bs">
  <div class="input-group">
    <span class="input-group-text"><i class="fa-solid fa-magnifying-glass"></i></span>
    <input type="text" id="bsRef" class="form-control" autocomplete="off"
      placeholder="Referência (Jo 3:16, Sl 23) ou nome do livro">
    <button class="btn btn-primary" type="button" id="bsIr">Ir</button>
    <select id="bsVersao" class="form-select" title="Versão da Bíblia"></select>
  </div>
  <div id="bsErro" class="small text-danger"></div>
  <div class="bs-corpo">
    <div id="bsLivros" class="bs-livros-painel">
      <div class="bs-rotulo" id="bsRotuloAT">Antigo Testamento</div>
      <div class="bs-livros" id="bsAT"></div>
      <div class="bs-rotulo" id="bsRotuloNT">Novo Testamento</div>
      <div class="bs-livros" id="bsNT"></div>
    </div>
    <div class="bs-capitulos-painel">
      <strong id="bsLivroTitulo">Escolha um livro</strong>
      <div class="bs-capitulos" id="bsCapitulos"></div>
      <div class="bs-dica" id="bsDica">Escolha o livro à esquerda ou digite a referência acima.</div>
    </div>
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
        const ultimo = bsLivros().find(l => l.id === Number(bsLembrar('livro')));
        if (ultimo) bsEscolherLivro(ultimo);

        $('#bsRef').trigger('focus')
            .on('input', function () { bsDesenharLivros(this.value); $('#bsErro').text(''); })
            .on('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); bsAplicarReferencia(this.value); } });
        $('#bsIr').on('click', () => bsAplicarReferencia($('#bsRef').val()));
        $('#bsLivros').on('click', '.bs-livro', function () {
            bsEscolherLivro(bsLivros().find(l => l.id === Number(this.dataset.id)));
        });
        $('#bsCapitulos').on('click', '.bs-cap', function () {
            const livro = bsLivros().find(l => l.id === Number(bsLembrar('livro')));
            if (livro) bsAbrir(livro, Number(this.dataset.cap));
        });
    });
}
