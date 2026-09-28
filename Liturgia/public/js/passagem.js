/* ────────────────────────────────────────────────────────────────────────
   PASSAGEM — escolha da passagem bíblica
   Livro → capítulo → clique nos versículos, ou digite a referência
   ("Jo 3:16-18", "Sl 23", "1Co 13:1-13", "Ef 3:20,21", "Mt 5:1-7:29").
   O item gravado mantém o formato da liturgia: texto[] = "Livro.cap.v. texto".
   ──────────────────────────────────────────────────────────────────────── */

// Abreviações na ordem canônica: todas as Bíblias do projeto usam book.id 1..66
const PM_ABREVIACOES = ['Gn', 'Êx', 'Lv', 'Nm', 'Dt', 'Js', 'Jz', 'Rt', '1Sm', '2Sm', '1Rs', '2Rs',
    '1Cr', '2Cr', 'Ed', 'Ne', 'Et', 'Jó', 'Sl', 'Pv', 'Ec', 'Ct', 'Is', 'Jr', 'Lm', 'Ez', 'Dn',
    'Os', 'Jl', 'Am', 'Ob', 'Jn', 'Mq', 'Na', 'Hc', 'Sf', 'Ag', 'Zc', 'Ml',
    'Mt', 'Mc', 'Lc', 'Jo', 'At', 'Rm', '1Co', '2Co', 'Gl', 'Ef', 'Fp', 'Cl', '1Ts', '2Ts',
    '1Tm', '2Tm', 'Tt', 'Fm', 'Hb', 'Tg', '1Pe', '2Pe', '1Jo', '2Jo', '3Jo', 'Jd', 'Ap'];
const PM_APELIDOS = { salmo: 19, cantares: 22, canticodoscanticos: 22, atos: 44 };

let pm = null; // estado do modal aberto

const pmNormalizar = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[\s.]/g, '');

/** Livro a partir do que foi digitado: abreviação, nome, apelido ou início único do nome */
function pmAcharLivro(digitado) {
    const t = pmNormalizar(digitado);
    if (!t) return null;
    // Com acento decide sozinho ("Jó"); sem acento, o último vence ("Jo" = João, não Jó)
    const comAcento = s => String(s || '').toLowerCase().replace(/[\s.]/g, '');
    let porAbrev = PM_ABREVIACOES.findIndex(a => comAcento(a) === comAcento(digitado));
    if (porAbrev < 0) porAbrev = PM_ABREVIACOES.map(pmNormalizar).lastIndexOf(t);
    if (porAbrev >= 0) return pm.livros.find(l => l.id === porAbrev + 1) || null;
    const exato = pm.livros.find(l => pmNormalizar(l.name) === t);
    if (exato) return exato;
    if (PM_APELIDOS[t]) return pm.livros.find(l => l.id === PM_APELIDOS[t]) || null;
    const candidatos = pm.livros.filter(l => pmNormalizar(l.name).startsWith(t));
    return candidatos.length === 1 ? candidatos[0] : null;
}

/**
 * Interpreta a referência digitada.
 * Devolve { livro, capInicio, capFim, versos } — versos: null (capítulo inteiro),
 * [{de, ate}] no mesmo capítulo, ou { vInicio, vFim } entre capítulos.
 */
function pmInterpretar(ref) {
    const m = String(ref || '').trim().match(/^([1-3]?\s*[^\d\s][^\d]*?)\s*(\d+)(?:\s*[:.]\s*(.+))?$/);
    if (!m) return null;
    const livro = pmAcharLivro(m[1]);
    if (!livro) return { erro: `Livro não reconhecido: "${m[1].trim()}"` };
    const cap = Number(m[2]);
    const resto = (m[3] || '').replace(/\s+/g, '');
    if (!resto) return { livro, capInicio: cap, capFim: cap, versos: null };

    const entreCapitulos = resto.match(/^(\d+)-(\d+)[:.](\d+)$/);
    if (entreCapitulos) {
        return {
            livro, capInicio: cap, capFim: Number(entreCapitulos[2]),
            versos: { vInicio: Number(entreCapitulos[1]), vFim: Number(entreCapitulos[3]) },
        };
    }
    const trechos = resto.split(',').map(p => p.match(/^(\d+)(?:-(\d+))?$/));
    if (trechos.some(t => !t)) return { erro: `Versículos não entendidos: "${m[3]}"` };
    return {
        livro, capInicio: cap, capFim: cap,
        versos: trechos.map(t => ({ de: Number(t[1]), ate: Number(t[2] || t[1]) })),
    };
}

/* ── dados ─────────────────────────────────────────────────────────────── */

const pmChave = (cap, v) => `${cap}:${v}`;

/** Garante no cache os capítulos capInicio..capFim inteiros */
function pmCarregarCapitulos(capInicio, capFim = capInicio) {
    const faltam = [];
    for (let c = capInicio; c <= capFim; c++) if (!pm.cache[c]) faltam.push(c);
    if (!faltam.length) return $.Deferred().resolve().promise();
    return $.get('/biblia/versiculos', {
        versao: pm.versao, livro: pm.livro.id,
        capInicio: faltam[0], capFim: faltam[faltam.length - 1], inicio: 1, fim: 999,
    }).then(({ versiculos }) => {
        faltam.forEach(c => { pm.cache[c] = []; });
        versiculos.forEach(v => { if (pm.cache[v.chapter]) pm.cache[v.chapter].push(v); });
    });
}

function pmVersiculosEntre(inicio, fim) {
    const [a, b] = [inicio, fim].sort((x, y) => x.cap - y.cap || x.v - y.v);
    const lista = [];
    for (let c = a.cap; c <= b.cap; c++) {
        (pm.cache[c] || []).forEach(v => {
            if (c === a.cap && v.verse < a.v) return;
            if (c === b.cap && v.verse > b.v) return;
            lista.push(v);
        });
    }
    return lista;
}

/* ── seleção ───────────────────────────────────────────────────────────── */

function pmOrdenados() {
    return [...pm.sel.values()].sort((a, b) => a.chapter - b.chapter || a.verse - b.verse);
}

/** "João 3:16-18", "Efésios 3:20-21", "Mateus 5:1-7:29", "Salmos 23" */
function pmTitulo() {
    const vs = pmOrdenados();
    if (!vs.length) return '';
    const ultimo = c => (pm.cache[c] || []).reduce((m, v) => Math.max(m, v.verse), 0);
    const continuo = (a, b) => (b.chapter === a.chapter && b.verse === a.verse + 1) ||
        (b.chapter === a.chapter + 1 && b.verse === 1 && a.verse === ultimo(a.chapter));
    const blocos = [];
    vs.forEach(v => {
        const bloco = blocos[blocos.length - 1];
        if (bloco && continuo(bloco.fim, v)) bloco.fim = v; else blocos.push({ inicio: v, fim: v });
    });
    const nome = pm.livro.name;
    if (blocos.length === 1) {
        const { inicio: i, fim: f } = blocos[0];
        if (i.chapter !== f.chapter) {
            const inteiros = i.verse === 1 && f.verse === ultimo(f.chapter);
            return inteiros ? `${nome} ${i.chapter}-${f.chapter}` : `${nome} ${i.chapter}:${i.verse}-${f.chapter}:${f.verse}`;
        }
        if (i.verse === 1 && f.verse === ultimo(i.chapter)) return `${nome} ${i.chapter}`;
    }
    const porCapitulo = {};
    blocos.forEach(({ inicio: i, fim: f }) => {
        // Bloco que atravessa capítulos vira um trecho por capítulo
        for (let c = i.chapter; c <= f.chapter; c++) {
            const de = c === i.chapter ? i.verse : 1;
            const ate = c === f.chapter ? f.verse : ultimo(c);
            (porCapitulo[c] = porCapitulo[c] || []).push(de === ate ? `${de}` : `${de}-${ate}`);
        }
    });
    return `${nome} ` + Object.entries(porCapitulo).map(([c, t]) => `${c}:${t.join(',')}`).join('; ');
}

function pmAtualizarResumo() {
    const total = pm.sel.size;
    const titulo = pmTitulo();
    $('#pmResumo').html(total
        ? `<i class="fas fa-book-bible me-1"></i><strong></strong><span class="ms-2 text-muted">${total} versículo${total > 1 ? 's' : ''}</span>`
        : '<span class="text-muted">Nenhum versículo selecionado</span>');
    $('#pmResumo strong').text(titulo);
    $('#pmLimpar').toggleClass('d-none', !total);
    $('.pm-ok').toggleClass('disabled', !total);
    $('#pmTexto .pm-v').each(function () {
        this.classList.toggle('selecionado', pm.sel.has(pmChave(this.dataset.cap, this.dataset.v)));
    });
    $('#pmCapitulos button').each(function () {
        const c = Number(this.dataset.cap);
        this.classList.toggle('tem-selecao', [...pm.sel.values()].some(v => v.chapter === c));
    });
}

function pmSelecionar(lista, somar = false) {
    if (!somar) pm.sel.clear();
    lista.forEach(v => pm.sel.set(pmChave(v.chapter, v.verse), v));
    pmAtualizarResumo();
}

/** Clique: 1º marca o início, 2º fecha o trecho (pode ser em outro capítulo). Ctrl/⌘ marca avulso. */
function pmClicarVersiculo(el, evento) {
    const cap = Number(el.dataset.cap), v = Number(el.dataset.v);
    const verso = pm.cache[cap].find(x => x.verse === v);
    if (evento.ctrlKey || evento.metaKey) {
        const k = pmChave(cap, v);
        if (pm.sel.has(k)) pm.sel.delete(k); else pm.sel.set(k, verso);
        pm.ancora = null; // avulso não abre trecho: o próximo clique simples recomeça
        pmAtualizarResumo();
        return;
    }
    if (pm.ancora) {
        const inicio = pm.ancora;
        pm.ancora = null;
        pmCarregarCapitulos(Math.min(inicio.cap, cap), Math.max(inicio.cap, cap))
            .then(() => pmSelecionar(pmVersiculosEntre(inicio, { cap, v })));
        $('#pmDica').text('Trecho marcado. Clique em outro versículo para recomeçar.');
    } else {
        pm.ancora = { cap, v };
        pmSelecionar([verso]);
        $('#pmDica').text('Agora clique no último versículo do trecho.');
    }
}

/* ── tela ──────────────────────────────────────────────────────────────── */

function pmDesenharLivros(filtro = '') {
    // Só a parte do livro filtra ("1Co 13:4" → "1Co")
    const t = pmNormalizar((String(filtro).match(/^\s*([1-3]?\s*[^\d]*)/) || ['', ''])[1]);
    const botao = l => $('<button type="button" class="pm-livro">')
        .toggleClass('ativo', pm.livro?.id === l.id)
        .attr({ title: l.name, 'data-id': l.id })
        .html(`<span class="abrev"></span><span class="nome"></span>`)
        .find('.abrev').text(PM_ABREVIACOES[l.id - 1] || '').end()
        .find('.nome').text(l.name).end();
    const combina = l => !t || pmNormalizar(l.name).includes(t) || pmNormalizar(PM_ABREVIACOES[l.id - 1]).startsWith(t);
    $('#pmAT').empty().append(pm.livros.filter(l => l.id <= 39 && combina(l)).map(botao));
    $('#pmNT').empty().append(pm.livros.filter(l => l.id >= 40 && combina(l)).map(botao));
    $('#pmRotuloAT').toggle(!!$('#pmAT').children().length);
    $('#pmRotuloNT').toggle(!!$('#pmNT').children().length);
}

function pmEscolherLivro(livro, cap = 1) {
    if (pm.livro?.id !== livro.id) {
        pm.livro = livro;
        pm.cache = {};
        pm.sel.clear();
        pm.ancora = null;
    }
    $('#pmLivros .pm-livro').removeClass('ativo').filter(`[data-id="${livro.id}"]`).addClass('ativo');
    return $.get('/biblia/capitulos', { versao: pm.versao, livro: livro.id }).then(({ total }) => {
        pm.capitulos = total;
        $('#pmCapitulos').empty().append(
            Array.from({ length: total }, (_, i) => $('<button type="button">')
                .attr('data-cap', i + 1).text(i + 1)));
        return pmAbrirCapitulo(Math.min(Math.max(cap, 1), total));
    });
}

function pmAbrirCapitulo(cap) {
    pm.cap = cap;
    $('#pmCapTitulo').text(`${pm.livro.name} ${cap}`);
    $('#pmAnterior').prop('disabled', cap <= 1);
    $('#pmProximo').prop('disabled', cap >= pm.capitulos);
    $('#pmCapitulos button').removeClass('ativo').filter(`[data-cap="${cap}"]`).addClass('ativo');
    return pmCarregarCapitulos(cap).then(() => {
        const $t = $('#pmTexto').empty();
        pm.cache[cap].forEach(v => {
            $('<p class="pm-v">').attr({ 'data-cap': cap, 'data-v': v.verse })
                .append($('<sup>').text(v.verse), document.createTextNode(' ' + v.text))
                .appendTo($t);
        });
        $t.scrollTop(0);
        const primeiro = $t.find('.pm-v').filter(function () {
            return pm.sel.has(pmChave(this.dataset.cap, this.dataset.v));
        })[0];
        if (primeiro) primeiro.scrollIntoView({ block: 'center' });
        pmAtualizarResumo();
    });
}

/** Aplica a referência digitada: abre o livro/capítulo e marca os versículos */
function pmAplicarReferencia(texto) {
    const ref = pmInterpretar(texto);
    if (!ref || ref.erro) {
        // Sem capítulo: se o filtro deixou um único livro, abre ele
        const unico = $('#pmLivros .pm-livro');
        if (!ref && unico.length === 1) {
            pmEscolherLivro(pm.livros.find(l => l.id === Number(unico.data('id'))));
            $('#pmErro').text('');
            return;
        }
        $('#pmErro').text(ref?.erro || 'Use o formato: livro capítulo:versículos — ex.: Jo 3:16-18');
        return;
    }
    $('#pmErro').text('');
    pmEscolherLivro(ref.livro, ref.capInicio).then(() => {
        if (ref.capInicio > pm.capitulos) { $('#pmErro').text(`${ref.livro.name} tem ${pm.capitulos} capítulos.`); return; }
        const capFim = Math.min(ref.capFim, pm.capitulos);
        return pmCarregarCapitulos(ref.capInicio, capFim).then(() => {
            let lista;
            if (!ref.versos) lista = pmVersiculosEntre({ cap: ref.capInicio, v: 1 }, { cap: capFim, v: 999 });
            else if (!Array.isArray(ref.versos)) lista = pmVersiculosEntre({ cap: ref.capInicio, v: ref.versos.vInicio }, { cap: capFim, v: ref.versos.vFim });
            else lista = pm.cache[ref.capInicio].filter(v => ref.versos.some(t => v.verse >= t.de && v.verse <= t.ate));
            if (!lista.length) { $('#pmErro').text('Nenhum versículo encontrado nesse intervalo.'); return; }
            pm.ancora = null;
            pmSelecionar(lista);
            const alvo = $('#pmTexto .pm-v.selecionado')[0];
            if (alvo) alvo.scrollIntoView({ block: 'center' });
        });
    });
}

/** Troca de versão: recarrega o capítulo aberto e o texto dos versículos já marcados */
function pmTrocarVersao(versao) {
    pm.versao = versao;
    if (!pm.livro) return;
    const marcados = pmOrdenados().map(v => ({ cap: v.chapter, v: v.verse }));
    pm.cache = {};
    const caps = [...new Set(marcados.map(m => m.cap).concat(pm.cap))];
    pmCarregarCapitulos(Math.min(...caps), Math.max(...caps)).then(() => {
        pm.sel.clear();
        marcados.forEach(m => {
            const v = (pm.cache[m.cap] || []).find(x => x.verse === m.v);
            if (v) pm.sel.set(pmChave(m.cap, m.v), v);
        });
        pmAbrirCapitulo(pm.cap);
    });
}

function passagemEscolher(codigoReplace) {
    const atual = codigoReplace >= 0 ? Liturgia[codigoReplace] : null;
    pm = { versao: 'ARA', livros: [], livro: null, capitulos: 0, cap: null, cache: {}, sel: new Map(), ancora: null };

    const html = /* html */`
<div class="pm">
  <div class="pm-topo">
    <div class="input-group">
      <span class="input-group-text"><i class="fas fa-search"></i></span>
      <input type="text" id="pmRef" class="form-control" autocomplete="off"
        placeholder="Digite a referência (Jo 3:16-18, Sl 23, 1Co 13) ou o nome do livro">
      <button class="btn btn-primary" type="button" id="pmIr">Ir</button>
      <select id="pmVersao" class="form-select" title="Versão da Bíblia"></select>
    </div>
    <div id="pmErro" class="small text-danger"></div>
  </div>
  <div class="pm-corpo">
    <div id="pmLivros" class="pm-livros-painel">
      <div class="pm-rotulo" id="pmRotuloAT">Antigo Testamento</div>
      <div class="pm-livros" id="pmAT"></div>
      <div class="pm-rotulo" id="pmRotuloNT">Novo Testamento</div>
      <div class="pm-livros" id="pmNT"></div>
    </div>
    <div class="pm-leitura">
      <div class="pm-cabecalho">
        <button class="btn btn-sm btn-outline-secondary" id="pmAnterior" title="Capítulo anterior" disabled><i class="fas fa-chevron-left"></i></button>
        <strong id="pmCapTitulo">Escolha um livro</strong>
        <button class="btn btn-sm btn-outline-secondary" id="pmProximo" title="Próximo capítulo" disabled><i class="fas fa-chevron-right"></i></button>
      </div>
      <div class="pm-capitulos" id="pmCapitulos"></div>
      <div class="pm-texto" id="pmTexto">
        <div class="pm-vazio">
          <i class="fas fa-book-open fa-2x mb-2"></i>
          <div>Escolha o livro à esquerda (ou digite a referência acima),<br>depois clique no <strong>primeiro</strong> e no <strong>último</strong> versículo.</div>
        </div>
      </div>
      <div class="pm-dica" id="pmDica">Clique no primeiro e no último versículo. Ctrl/⌘ + clique marca versículos avulsos.</div>
    </div>
  </div>
  <div class="pm-rodape">
    <div id="pmResumo"><span class="text-muted">Nenhum versículo selecionado</span></div>
    <button class="btn btn-sm btn-link text-danger d-none" id="pmLimpar">Limpar seleção</button>
  </div>
</div>`;

    bootbox.dialog({
        title: atual ? 'Alterar passagem' : 'Nova passagem',
        message: html,
        onEscape: true,
        closeButton: true,
        backdrop: true,
        size: 'extra-large',
        centerVertical: true,
        className: 'pm-modal',
        buttons: {
            cancelar: { label: 'Cancelar', className: 'btn-outline-secondary' },
            ok: {
                label: `<i class="fas fa-check me-1"></i>${atual ? 'Atualizar passagem' : 'Inserir na liturgia'}`,
                className: 'btn-success disabled pm-ok',
                callback: () => {
                    if (!pm.sel.size) return false;
                    const passagem = {
                        tipo: 'passagem',
                        titulo: pmTitulo(),
                        texto: pmOrdenados().map(v => `${pm.livro.name}.${v.chapter}.${v.verse}. ${v.text}`),
                    };
                    if (codigoReplace >= 0) {
                        Liturgia[codigoReplace] = passagem;
                        $('#bodyLiturgia>ul>li:eq(' + codigoReplace + ')').text(passagem.titulo);
                        mostraPassagem(codigoReplace);
                        $.post('/dados/salvar-liturgia', { arquivo: documento, data: JSON.stringify(Liturgia) })
                            .done(() => mostrarToast('<i class="fas fa-check-circle"></i>&nbsp;Passagem atualizada!'));
                    } else {
                        adicionarItem(passagem);
                        $.post('/dados/salvar-liturgia', { arquivo: documento, data: JSON.stringify(Liturgia) })
                            .done(() => mostrarToast('<i class="fas fa-check-circle"></i>&nbsp;Passagem adicionada!'));
                    }
                }
            }
        }
    })
        .on('shown.bs.modal', function () {
            $('body').addClass('modal-open');
            $('#pmRef').trigger('focus')
                .on('input', function () { pmDesenharLivros(this.value); $('#pmErro').text(''); })
                .on('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); pmAplicarReferencia(this.value); } });
            $('#pmIr').on('click', () => pmAplicarReferencia($('#pmRef').val()));
            $('#pmLivros').on('click', '.pm-livro', function () {
                pmEscolherLivro(pm.livros.find(l => l.id === Number(this.dataset.id)));
            });
            $('#pmCapitulos').on('click', 'button', function () { pmAbrirCapitulo(Number(this.dataset.cap)); });
            $('#pmAnterior').on('click', () => pmAbrirCapitulo(pm.cap - 1));
            $('#pmProximo').on('click', () => pmAbrirCapitulo(pm.cap + 1));
            $('#pmTexto').on('click', '.pm-v', function (e) { pmClicarVersiculo(this, e); });
            $('#pmLimpar').on('click', () => { pm.ancora = null; pmSelecionar([]); });
            $('#pmVersao').on('change', function () { pmTrocarVersao(this.value); });

            $.get('/biblia/versoes').done(versoes => {
                const sel = $('#pmVersao').empty();
                versoes.forEach(v => $('<option>').val(v.codigo).text(v.codigo).attr('title', v.nome)
                    .prop('selected', v.codigo === pm.versao).appendTo(sel));
            });
            $.get('/biblia/livros', { versao: pm.versao }).done(livros => {
                pm.livros = livros;
                pmDesenharLivros();
                // Alterar: abre já na passagem atual
                if (atual?.titulo) {
                    $('#pmRef').val(atual.titulo);
                    pmAplicarReferencia(atual.titulo);
                }
            });
        })
        .on('hidden.bs.modal', function () { $('body').removeClass('modal-open'); pm = null; });
}

function passagemAlterar() {
    const codigo = $('#bodyLiturgia>ul>li.bg-warning').index();
    if (codigo >= 0) passagemEscolher(codigo);
}
