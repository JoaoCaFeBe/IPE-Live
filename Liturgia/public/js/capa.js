/**
 * capa.js — módulo de liturgia adaptado para Express (Node.js)
 *
 * Adaptações em relação ao original PHP:
 *  - inicio() carrega a lista de cultos via GET /Cultos
 *  - Todas as chamadas a Dados/*.php → /dados/*
 *  - Todas as chamadas a formularios/*.php → /formularios/*
 *  - Sem iframe: baixarArquivo() acessa Liturgia diretamente
 *  - documento agora guarda apenas o nome do arquivo (ex.: "2026-01-04.json")
 */

window.onload = inicio;
var Liturgia = [], documento;
// Mouse (passa por cima) × toque: o seletor de eventos abre no hover só com mouse
const COM_HOVER = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/* ── INICIALIZAÇÃO ──────────────────────────────────────────────────────── */

function inicio() {
    // Atalhos de teclado
    $(document).on('keydown', e => {
        const emInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
        if (e.key === 'F10') {
            e.preventDefault();
            e.stopPropagation();
            baixarInstaladorLive();
        } else if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            if ($('.editor-trechos:visible').length) $('.editor-trechos:visible .et-salvar').trigger('click');
            else if (!$('#cardCorpo').hasClass('d-none') && !somenteConsulta) salvar();
        } else if (e.key === 'Delete' && !emInput && !somenteConsulta) {
            if (!$('#excluir').hasClass('d-none')) excluir();
        }
    });
    // Data de hoje no fuso da igreja: dia passado abre só para consulta
    $.getJSON('/dados/hoje').done(r => { HOJE = r.hoje; });

    // Uma linha por data. Clique na data: o culto congregacional. Seletor ao lado: os eventos da data.
    // Duplo clique renomeia (troca a data) da liturgia aberta na linha.
    $('#listaLiturgias')
        .on('click', 'li[data-data]', function (e) {
            if ($(e.target).closest('.seletor-evento, .dropdown-menu').length) return;
            const culto = arquivoDe($(this).attr('data-data'), '');
            if ($(this).attr('data-culto') === '1') return abrirNaLista(culto);
            // Data sem culto congregacional: um evento só abre direto; mais de um, a lista para escolher
            // (no próximo ciclo, senão o próprio clique fecha o menu ao chegar no documento)
            const $opcoes = $(this).find('.dropdown-menu [data-arquivo]');
            if ($opcoes.length === 1) return abrirNaLista($opcoes.attr('data-arquivo'));
            const seletor = $(this).find('.seletor-evento')[0];
            setTimeout(() => bootstrap.Dropdown.getOrCreateInstance(seletor).show(), 0);
        })
        .on('click', '.seletor-evento', function (e) {
            // Com mouse o menu já abriu ao passar por cima: o clique só garante aberto (sem fechar).
            // No toque segue o comportamento normal do Bootstrap (abre e fecha no clique).
            if (!COM_HOVER) return;
            e.stopPropagation();
            bootstrap.Dropdown.getOrCreateInstance(this).show();
        })
        .on('mouseenter', '.linha-data .dropdown', function () {
            if (!COM_HOVER) return;
            clearTimeout(this._fechar);
            $('#listaLiturgias .seletor-evento.show').not($(this).find('.seletor-evento'))
                .each((_, b) => bootstrap.Dropdown.getOrCreateInstance(b).hide());
            bootstrap.Dropdown.getOrCreateInstance($(this).find('.seletor-evento')[0]).show();
        })
        .on('mouseleave', '.linha-data .dropdown', function () {
            if (!COM_HOVER) return;
            // Folga para o mouse atravessar o espaço entre o botão e o menu
            const botao = $(this).find('.seletor-evento')[0];
            this._fechar = setTimeout(() => bootstrap.Dropdown.getOrCreateInstance(botao).hide(), 250);
        })
        .on('click', '.dropdown-menu [data-arquivo]', function (e) {
            e.preventDefault();
            abrirNaLista($(this).attr('data-arquivo'));
        })
        .on('dblclick', 'li[data-data]', function (e) {
            if ($(e.target).closest('.seletor-evento, .dropdown-menu').length) return;
            if ($(this).attr('arquivo')) renomearLiturgia(this);
        });

    // Nomes dos eventos antes da lista, para o selo já sair com o nome digitado
    carregarEventos().always(() => recarregarLista());
}

/* ── LISTA DE LITURGIAS: UMA LINHA POR DATA ─────────────────────────────────
 * Pedido do João (21/11/2026): com vários eventos, datas repetidas dificultam a leitura.
 * Cada data é uma linha; o clique nela abre o culto congregacional (o padrão). Se a data tem
 * eventos, o seletor magenta ao lado (com a quantidade) lista o culto e os eventos dela.
 * A linha guarda em `arquivo` a liturgia aberta nela, e o selo embaixo mostra o evento. */

/** Busca /Cultos e monta a lista; `abrir` (opcional) já abre aquela liturgia */
function recarregarLista(abrir) {
    return $.getJSON('/Cultos')
        .done(arquivos => {
            const porData = new Map();
            arquivos.filter(a => RE_ARQUIVO.test(a)).forEach(a => {
                const data = dataDoArquivo(a);
                if (!porData.has(data)) porData.set(data, { culto: false, eventos: [] });
                const g = porData.get(data), ev = eventoDoArquivo(a);
                if (ev) g.eventos.push(ev); else g.culto = true;
            });
            const $ul = $('#listaLiturgias').empty();
            [...porData.keys()].sort().reverse().forEach(data => $ul.append(linhaDaData(data, porData.get(data))));
            if (abrir) abrirNaLista(abrir);
        })
        .fail(() => {
            $('#listaLiturgias').html('<li class="text-danger p-2"><i class="fas fa-exclamation-triangle"></i>&nbsp;Erro ao carregar liturgias.</li>');
        });
}

/** Linha de uma data: a data e, se houver evento, o seletor com o culto e os eventos dela */
function linhaDaData(data, { culto, eventos }) {
    const $li = $(`<li data-data="${data}" data-culto="${culto ? 1 : 0}" class="linha-data">
        <span class="rotulo-data"><i class='fas fa-folder'></i>&nbsp;${dataBR(data)}</span></li>`);
    if (!eventos.length) return $li;
    eventos.sort((a, b) => nomeEvento(a).localeCompare(nomeEvento(b), 'pt-BR'));
    const opcoes = (culto ? [['', 'Culto congregacional', 'fa-church']] : [])
        .concat(eventos.map(ev => [ev, nomeEvento(ev), 'fa-people-roof']));
    $li.append(`<span class="dropdown d-inline-block">
        <button type="button" class="seletor-evento" data-bs-toggle="dropdown" aria-expanded="false"
            data-bs-popper-config='{"strategy":"fixed"}'
            title="${eventos.length === 1 ? '1 evento' : eventos.length + ' eventos'} nesta data — escolher qual abrir"
            aria-label="Eventos de ${dataBR(data)}"><i class="fas fa-people-roof"></i>&nbsp;${eventos.length}</button>
        <ul class="dropdown-menu">
            ${opcoes.map(([ev, nome, icone]) => `<li><a class="dropdown-item" href="#" data-arquivo="${arquivoDe(data, ev)}">
                <i class="fas ${icone}"></i>&nbsp;${escHtml(nome)}</a></li>`).join('')}
        </ul></span>`);
    return $li;
}

/** Marca a linha da data, mostra o selo do evento (se for evento) e abre a liturgia */
function abrirNaLista(arquivo) {
    const $li = $(`#listaLiturgias li[data-data="${dataDoArquivo(arquivo)}"]`);
    if (!$li.length) return;
    const evento = eventoDoArquivo(arquivo);
    $('#listaLiturgias li[data-data]').removeAttr('arquivo');
    $li.attr('arquivo', arquivo);
    // O evento aberto aparece no título, ao lado de "IPE-Liturgia" (pedido do João, 21/11/2026)
    $('#seloEventoTitulo').text(evento ? nomeEvento(evento) : '').toggleClass('d-none', !evento);
    marcaLI($li[0]);
    $li[0].scrollIntoView({ block: 'nearest' });
    abreLiturgia(arquivo);
}

/* ── BAIXAR ─────────────────────────────────────────────────────────────── */

function baixarArquivo() {
    const $marcado = $('#listaLiturgias li.bg-warning');
    if (!$marcado.length) {
        bootbox.alert('Selecione um culto primeiro.');
        return;
    }
    $.downloadObj(Liturgia, $marcado.attr('arquivo'), 'text/plain');
}

function baixarInstaladorLive() {
    mostrarToast('<i class="fas fa-download"></i>&nbsp;Preparando o instalador atualizado…', 'info');
    const link = document.createElement('a');
    link.href = `/downloads/IPE-Live-Windows.zip?${Date.now()}`;
    link.download = 'IPE-Live-Windows.zip';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
}

/* ── DUPLICAR ───────────────────────────────────────────────────────────── */

const dataBR = d => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');

/* ── EVENTOS ────────────────────────────────────────────────────────────────
 * Evento (retiro, conferência…) tem liturgia e projeção separadas do culto congregacional,
 * que continua o padrão. A chave é a data com o evento: "2026-11-22@retiro-de-casais".
 * No Live, o Painel e as telas do evento abrem com ?evento=retiro-de-casais. */
const RE_ARQUIVO = /^\d{4}-\d{2}-\d{2}(?:@[a-z0-9]+(?:-[a-z0-9]+)*)?\.json$/;
const chaveDoArquivo = arquivo => String(arquivo).replace('.json', '');
const eventoDoArquivo = arquivo => chaveDoArquivo(arquivo).split('@')[1] || '';
/** "Retiro de Casais" → "retiro-de-casais" (sem acento, só letras, números e hífen) */
const slugEvento = nome => String(nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');
/** Nomes dos eventos como foram digitados ({ slug: "ECC 2027" }) e o endereço do Live (GET /eventos) */
let NOMES_EVENTOS = {}, LIVE_URL = '', EVENTOS = [];
const carregarEventos = () => $.getJSON('/eventos').done(r => {
    NOMES_EVENTOS = r.nomes || {};
    LIVE_URL = r.liveUrl || '';
    EVENTOS = r.eventos || []; // [{ slug, nome, inicio, fim }]
});
/** Eventos cujo período inclui a data ("AAAA-MM-DD") */
const eventosNaData = data => EVENTOS.filter(ev => ev.inicio <= data && data <= ev.fim);
const escHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** Nome do evento como foi digitado; sem registro, o slug legível ("ecc-2027" → "Ecc 2027"). Texto puro. */
const nomeEvento = slug => !slug ? '' : NOMES_EVENTOS[slug] || (slug.charAt(0).toUpperCase() + slug.slice(1)).replace(/-/g, ' ');
const arquivoDe = (data, evento) => `${data}${evento ? '@' + evento : ''}.json`;

/**
 * Pede a data e, se houver evento cadastrado naquela data, para qual liturgia: o culto congregacional
 * ou o evento. Eventos se criam no botão "Criar evento" da barra de cima; aqui só se escolhe.
 * cb({ data, evento, nome }): evento em slug ('' = culto congregacional).
 */
function pedirDataEvento({ titulo, data, evento = '', mensagem = '' }, cb) {
    const min = HOJE || hojeLocal();
    const $form = $(`<form class="form-data-evento" autocomplete="off">
        ${mensagem ? `<p class="mb-3">${mensagem}</p>` : ''}
        <label class="form-label" for="campoData">Data</label>
        <input type="date" class="form-control" id="campoData" name="data" required min="${min}" value="${data || min}">
        <div class="grupo-evento d-none">
            <label class="form-label mt-3" for="campoEvento">Para</label>
            <select class="form-select" id="campoEvento" name="evento"></select>
            <div class="form-text">O evento tem liturgia e projeção separadas do culto.</div>
        </div>
        <div class="form-text sem-evento mt-2"><i class="fas fa-church"></i>&nbsp;Liturgia do culto congregacional.
            Para um retiro ou conferência, use <b>Criar evento</b> na barra de cima.</div>
    </form>`);
    // A lista acompanha a data: só os eventos cujo período inclui o dia escolhido
    const montarEventos = () => {
        const d = $form.find('[name=data]').val();
        const $sel = $form.find('[name=evento]');
        const atual = $sel.val() ?? evento;
        const lista = d ? eventosNaData(d) : [];
        $sel.html(`<option value="">Culto congregacional</option>` +
            lista.map(ev => `<option value="${ev.slug}">${escHtml(nomeEvento(ev.slug))}</option>`).join(''));
        $sel.val(lista.some(ev => ev.slug === atual) ? atual : '');
        $form.find('.grupo-evento').toggleClass('d-none', !lista.length);
        $form.find('.sem-evento').toggleClass('d-none', !!lista.length);
    };
    $form.on('input change', '[name=data]', montarEventos);
    montarEventos();
    const confirmar = () => {
        const d = $form.find('[name=data]').val();
        if (!d || d < min) { $form.find('[name=data]')[0].reportValidity(); return false; }
        const slug = eventosNaData(d).some(ev => ev.slug === $form.find('[name=evento]').val())
            ? $form.find('[name=evento]').val() : '';
        cb({ data: d, evento: slug, nome: '' }); // o evento já está cadastrado: nada a gravar de nome
    };
    const dialogo = bootbox.dialog({
        title: titulo,
        message: $form,
        centerVertical: true,
        buttons: {
            cancel: { label: 'Cancelar', className: 'btn-secondary' },
            ok: { label: 'OK', className: 'btn-primary', callback: confirmar },
        },
    });
    $form.on('submit', e => { e.preventDefault(); if (confirmar() !== false) dialogo.modal('hide'); });
}

function duplicarLiturgia() {
    if (!documento) return;
    const origem = chaveDoArquivo(documento);
    const eventoOrigem = eventoDoArquivo(documento);
    pedirDataEvento({
        titulo: `Duplicar a liturgia de ${dataBR(dataDoArquivo(documento))}${eventoOrigem ? ` (${escHtml(nomeEvento(eventoOrigem))})` : ''} para:`,
        evento: eventoOrigem,
        mensagem: 'Se a data já tiver liturgia, os itens são acrescentados — o que já estiver lá não é repetido.',
    }, ({ data, evento, nome }) => {
        const destino = chaveDoArquivo(arquivoDe(data, evento));
        $.post('/dados/duplicar-liturgia', { origem, destino, nomeEvento: nome })
            .done(r => {
                const partes = [`${r.acrescentados} ${r.acrescentados === 1 ? 'item copiado' : 'itens copiados'}`];
                if (r.repetidos) partes.push(`${r.repetidos} já ${r.repetidos === 1 ? 'estava' : 'estavam'} lá`);
                mostrarToast(`<i class="fas fa-copy"></i>&nbsp;${dataBR(data)}${evento ? ` (${escHtml(nomeEvento(evento))})` : ''}: ${partes.join(', ')}`, 'success');
                recarregarLista(r.arquivo); // a linha da data já abre na liturgia copiada
            })
            .fail(xhr => bootbox.alert(xhr.responseJSON?.error || 'Erro ao duplicar a liturgia.'));
    });
}

/* ── NOVA LITURGIA ──────────────────────────────────────────────────────── */

function novaLiturgia() {
    pedirDataEvento({ titulo: 'Nova liturgia' }, ({ data, evento, nome }) => {
        const arquivo = arquivoDe(data, evento); // "2026-03-01.json" ou "2026-03-01@retiro.json"
        $.post('/dados/nova-liturgia', { arquivo, nomeEvento: nome })
            .done(() => recarregarLista(arquivo)) // abre já no evento (ou culto) criado
            .fail(xhr => bootbox.alert(xhr.responseJSON?.error || 'Erro ao criar a liturgia. Tente novamente.'));
    });
}

/* ── CRIAR EVENTO ───────────────────────────────────────────────────────── */

/**
 * Botão "Criar evento" (barra de cima): nome e período. O servidor grava o evento e cria a
 * liturgia vazia de cada dia; a lista abre no primeiro dia. Mesmo nome de novo amplia o período.
 */
function criarEvento() {
    const min = HOJE || hojeLocal();
    const $form = $(`<form class="form-criar-evento" autocomplete="off">
        <label class="form-label" for="campoNomeEvento">Nome do evento</label>
        <input type="text" class="form-control" id="campoNomeEvento" name="nome" maxlength="60" required
            placeholder="Ex.: Retiro de Casais 2027">
        <div class="form-text slug-evento d-none">No link do Live: <code></code></div>
        <div class="row g-2 mt-2">
            <div class="col"><label class="form-label" for="campoInicio">Início</label>
                <input type="date" class="form-control" id="campoInicio" name="inicio" required min="${min}" value="${min}"></div>
            <div class="col"><label class="form-label" for="campoFim">Fim</label>
                <input type="date" class="form-control" id="campoFim" name="fim" required min="${min}" value="${min}"></div>
        </div>
        <div class="form-text dias-evento"></div>
    </form>`);
    const $ini = $form.find('[name=inicio]'), $fim = $form.find('[name=fim]');
    const dias = () => Math.round((Date.parse($fim.val()) - Date.parse($ini.val())) / 864e5) + 1;
    const atualizar = () => {
        const slug = slugEvento($form.find('[name=nome]').val());
        $form.find('.slug-evento').toggleClass('d-none', !slug).find('code').text(`?evento=${slug}`);
        $fim.attr('min', $ini.val() || min);
        if ($ini.val() && $fim.val() < $ini.val()) $fim.val($ini.val());
        const n = dias();
        $form.find('.dias-evento').text(n > 0 ? `${n} ${n === 1 ? 'dia' : 'dias'}: uma liturgia do evento em cada dia.` : '');
    };
    $form.on('input change', 'input', atualizar);
    atualizar();
    const confirmar = () => {
        const nome = $form.find('[name=nome]').val().replace(/\s+/g, ' ').trim();
        if (!slugEvento(nome)) { $form.find('[name=nome]').val('')[0].reportValidity(); return false; }
        if (!$ini.val() || $ini.val() < min) { $ini[0].reportValidity(); return false; }
        if (!$fim.val() || $fim.val() < $ini.val()) { $fim[0].reportValidity(); return false; }
        $.post('/eventos', { nome, inicio: $ini.val(), fim: $fim.val() })
            .done(r => {
                const quantas = r.criadas === r.dias ? `${r.dias} ${r.dias === 1 ? 'data criada' : 'datas criadas'}`
                    : `${r.criadas} de ${r.dias} datas criadas (as outras já existiam)`;
                mostrarToast(`<i class="fas fa-people-roof"></i>&nbsp;${escHtml(r.nome)}: ${quantas}`, 'success');
                carregarEventos().always(() => recarregarLista(r.arquivo));
            })
            .fail(xhr => bootbox.alert(xhr.responseJSON?.error || 'Erro ao criar o evento.'));
    };
    const dialogo = bootbox.dialog({
        title: '<i class="fas fa-people-roof"></i>&nbsp;Criar evento',
        message: $form,
        centerVertical: true,
        buttons: {
            cancel: { label: 'Cancelar', className: 'btn-secondary' },
            ok: { label: 'Criar', className: 'btn-primary', callback: confirmar },
        },
    });
    dialogo.on('shown.bs.modal', () => $form.find('[name=nome]').trigger('focus'));
    $form.on('submit', e => { e.preventDefault(); if (confirmar() !== false) dialogo.modal('hide'); });
}

/* ── LINKS DO EVENTO ────────────────────────────────────────────────────── */

/** Links do Live para quem vai apresentar o evento aberto, com botão de copiar */
function mostrarLinksEvento() {
    const slug = eventoDoArquivo(documento);
    if (!slug) return;
    const base = LIVE_URL || 'https://live.ipe.desklaser.cloud';
    // O Painel escolhe o evento no seletor ao lado da data (pedido do João, 21/11/2026):
    // aqui ficam só as telas, que precisam abrir já no canal do evento
    const telas = [
        ['Projetor', 'fa-display', `${base}/Projetor?evento=${slug}`],
        ['TV', 'fa-tv', `${base}/Televisao?evento=${slug}`],
    ];
    const $corpo = $(`<div class="links-evento">
        <p class="mb-3">Links das telas do evento. No Painel, escolha o evento no botão ao lado da data. Cada tela só mostra o que o Painel do evento projetar; o culto congregacional não é afetado.</p>
        ${telas.map(([nome, icone, url]) => `
        <label class="form-label mb-1"><i class="fas ${icone}"></i>&nbsp;${nome}</label>
        <div class="input-group mb-3">
            <input type="text" class="form-control" readonly value="${escHtml(url)}">
            <button type="button" class="btn btn-outline-primary copiar" title="Copiar o link"><i class="fas fa-copy"></i>&nbsp;Copiar</button>
        </div>`).join('')}
        <div class="form-text">Evento no link: <code>?evento=${slug}</code></div>
    </div>`);
    $corpo.on('click', '.copiar', function () {
        const campo = $(this).siblings('input')[0];
        const pronto = () => mostrarToast('<i class="fas fa-check"></i>&nbsp;Link copiado', 'success');
        if (navigator.clipboard) navigator.clipboard.writeText(campo.value).then(pronto, () => { campo.select(); document.execCommand('copy'); pronto(); });
        else { campo.select(); document.execCommand('copy'); pronto(); }
    });
    bootbox.dialog({
        title: `Links do evento — ${escHtml(nomeEvento(slug))}`,
        message: $corpo,
        centerVertical: true,
        size: 'large',
        onEscape: true,
        backdrop: true,
        buttons: { ok: { label: 'Fechar', className: 'btn-secondary' } },
    });
}

/* ── TOAST DE FEEDBACK ─────────────────────────────────────────────────── */

function mostrarToast(mensagem, tipo = 'success') {
    $('#toastFeedback').removeClass('bg-success bg-danger bg-info bg-warning bg-secondary')
        .addClass('bg-' + tipo);
    $('#toastMensagem').html(mensagem);
    bootstrap.Toast.getOrCreateInstance(document.getElementById('toastFeedback'), { delay: 2500 }).show();
}

/* ── RENOMEAR LITURGIA ──────────────────────────────────────────────────── */

function renomearLiturgia(el) {
    const arquivoAtual = $(el).attr('arquivo');
    if (ehDiaPassado(arquivoAtual)) {
        mostrarToast('<i class="fas fa-lock"></i>&nbsp;Dia passado: só consulta. Use Duplicar.', 'secondary');
        return;
    }
    const dataAtual = dataDoArquivo(arquivoAtual);
    const evento = eventoDoArquivo(arquivoAtual); // trocar a data mantém o evento
    bootbox.prompt({
        title: 'Alterar data da liturgia',
        inputType: 'date',
        min: HOJE || hojeLocal(),
        value: dataAtual,
        centerVertical: true,
        callback: result => {
            if (!result || result === dataAtual) return;
            const arquivoNovo = arquivoDe(result, evento);
            $.post('/dados/renomear-liturgia', { antigo: arquivoAtual, novo: arquivoNovo })
                .done(() => {
                    // A liturgia muda de linha (outra data): a lista se refaz e abre nela
                    recarregarLista(arquivoNovo);
                    mostrarToast('<i class="fas fa-calendar-check"></i>&nbsp;Data alterada!', 'info');
                })
                .fail(xhr => {
                    const msg = xhr.responseJSON?.error || 'Erro ao renomear.';
                    bootbox.alert(msg);
                });
        }
    });
}

/* ── ABRIR LITURGIA ─────────────────────────────────────────────────────── */

/* ── DIA PASSADO: SÓ CONSULTA ─────────────────────────────────────────── */

let HOJE = null;             // "AAAA-MM-DD" vindo do servidor (fuso da igreja)
let somenteConsulta = false; // liturgia aberta é de dia passado

function hojeLocal() {
    const tz = new Date().getTimezoneOffset() * 60000;
    return new Date(Date.now() - tz).toISOString().split('T')[0];
}

/** "2026-11-22@retiro.json" → "2026-11-22" */
const dataDoArquivo = arquivo => String(arquivo).replace('.json', '').slice(0, 10);
const ehDiaPassado = arquivo => dataDoArquivo(arquivo) < (HOJE || hojeLocal());

// Passado o dia, a liturgia não se edita: some o incluir, o arrastar e os botões
// de edição.
function aplicarModoConsulta() {
    document.body.classList.toggle('somente-consulta', somenteConsulta);
    $('#menuIncluir').toggleClass('d-none', somenteConsulta);
    $('#seloConsulta').toggleClass('d-none', !somenteConsulta);
    if (ordenador) ordenador.option('disabled', somenteConsulta);
}

function abreLiturgia(arquivo) {
    documento = arquivo; // apenas o nome, ex.: "2026-01-04.json"
    somenteConsulta = ehDiaPassado(arquivo);
    query('#cardCorpo').classList.add('d-none');

    // Exibe o botão de download na navbar
    document.getElementById('itemBaixar').classList.remove('d-none');
    // Liturgia de evento: botão com os links do Painel, Projetor e TV do evento
    $('#btnLinksEvento').toggleClass('d-none', !eventoDoArquivo(arquivo));

    $.getJSON('/Cultos/' + arquivo + '?vozes=1&t=' + formatDate())
        .done(retorno => {
            Liturgia = agruparComoPainel(retorno);
            renderizarLiturgia();
            aplicarModoConsulta();
            query('#cardLiturgia').classList.remove('d-none');
        })
        .fail(() => bootbox.alert('Erro ao carregar a liturgia.'));
}

/* ── ORDEM IGUAL À DO PAINEL ────────────────────────────────────────────── */

// O Painel do Live agrupa os itens por tipo, na ordem em que cada tipo aparece
// pela primeira vez; dentro do grupo vale a ordem digitada. O editor mostra igual.
function agruparComoPainel(itens) {
    const tipos = [];
    itens.forEach(i => { if (i && !tipos.includes(i.tipo)) tipos.push(i.tipo); });
    return tipos.flatMap(t => itens.filter(i => i && i.tipo === t));
}

function renderizarLiturgia() {
    const $ul = $('#bodyLiturgia>ul').empty();
    Liturgia.forEach((modulo, id) => {
        $('<li>')
            .addClass(modulo.tipo)
            .attr({ id: 'M' + id, 'data-tipo': modulo.tipo, onclick: `marcaLI(this); mostra${capitalize(modulo.tipo)}($(this).index());` })
            .text(modulo.titulo || '')
            .appendTo($ul);
    });
    ativarArrastar();
}

// Item novo entra no fim do grupo do seu tipo (ou no fim da lista, se o tipo é novo)
function adicionarItem(item) {
    let idx = Liturgia.length;
    Liturgia.forEach((i, n) => { if (i && i.tipo === item.tipo) idx = n + 1; });
    Liturgia.splice(idx, 0, item);
    renderizarLiturgia();
    $('#bodyLiturgia>ul>li:eq(' + idx + ')').click();
    return idx;
}

/* ── NOVA SELEÇÃO ───────────────────────────────────────────────────────── */

function novaSelecao(tipo) {
    if (somenteConsulta) return;
    queryAll('#bodyLiturgia>ul>li.bg-warning')
        .forEach(el => el.classList.remove('bg-warning'));
    const fn = window['mostra' + tipo];
    if (typeof fn === 'function') fn();
}

/* ── MARCAÇÃO DE ITEM ───────────────────────────────────────────────────── */

function marcaLI(linha) {
    linha.parentElement
        .querySelectorAll('.bg-warning')
        .forEach(el => el.classList.remove('bg-warning'));
    linha.classList.add('bg-warning');
}

/* ── ARRASTAR PARA ORDENAR ─────────────────────────────────────────────── */

// Só dentro do grupo do mesmo tipo: trocar de grupo não muda a ordem no Painel
let ordenador = null;
function ativarArrastar() {
    if (ordenador || typeof Sortable === 'undefined') return;
    ordenador = Sortable.create(query('#bodyLiturgia>ul'), {
        animation: 150,
        delay: 150,
        delayOnTouchOnly: true, // no celular, toque longo arrasta e toque curto rola a lista
        ghostClass: 'arrastando',
        onMove: evt => evt.related.dataset.tipo === evt.dragged.dataset.tipo,
        onEnd: evt => {
            if (evt.oldIndex === evt.newIndex) return;
            const [item] = Liturgia.splice(evt.oldIndex, 1);
            Liturgia.splice(evt.newIndex, 0, item);
            $.post('/dados/salvar-liturgia', { arquivo: documento, data: JSON.stringify(Liturgia) })
                .done(() => mostrarToast('<i class="fas fa-sort"></i>&nbsp;Ordem salva!', 'info'))
                .fail(() => bootbox.alert('Erro ao salvar a nova ordem. Reabra a liturgia e tente de novo.'));
        }
    });
}

/* ── SALVAR / EXCLUIR ───────────────────────────────────────────────────── */

function salvar() {
    if (somenteConsulta) return;
    let item;
    try {
        item = JSON.parse($('#final').val());
    } catch (e) {
        bootbox.alert('JSON inválido. Corrija o conteúdo antes de salvar.');
        return;
    }
    const codigo = $('#bodyLiturgia>ul>li.bg-warning').index();
    if (codigo >= 0) {
        // Preserva IDs existentes caso o #final ainda não os carregue (ex: segundo Save sem reabrir editor)
        const anterior = Liturgia[codigo];
        if (!item.louvor_id && anterior?.louvor_id) item.louvor_id = anterior.louvor_id;
        if (!item.coral_id && anterior?.coral_id) item.coral_id = anterior.coral_id;
        Liturgia[codigo] = item;
        const el = query('#bodyLiturgia>ul>li.bg-warning');
        if (el) el.textContent = item.titulo;
    } else {
        adicionarItem(item);
    }
    return $.post('/dados/salvar-liturgia', { arquivo: documento, data: JSON.stringify(Liturgia) })
        .done(resp => {
            // Sincroniza IDs (louvor_id / coral_id) gerados pelo servidor de volta para a memória
            if (resp.idMap) {
                resp.idMap.forEach((ids, i) => {
                    if (!Liturgia[i]) return;
                    if (ids.louvor_id) Liturgia[i].louvor_id = ids.louvor_id;
                    if (ids.coral_id) Liturgia[i].coral_id = ids.coral_id;
                    // Título normalizado pelo servidor (ex.: "2-CRISTO BOM MESTRE" → "Cristo bom Mestre")
                    if (ids.titulo && ids.titulo !== Liturgia[i].titulo) {
                        Liturgia[i].titulo = ids.titulo;
                        $('#bodyLiturgia>ul>li').eq(i).text(ids.titulo);
                    }
                });
            }
            mostrarToast('<i class="fas fa-check-circle"></i>&nbsp;Salvo!');
        });
}

function excluir() {
    if (somenteConsulta) return;
    const titulo = Liturgia[$('#bodyLiturgia>ul>li.bg-warning').index()]?.titulo || 'este item';
    bootbox.confirm({
        message: `Excluir <strong>${titulo}</strong>?`,
        centerVertical: true,
        buttons: {
            confirm: { label: 'Excluir', className: 'btn-danger' },
            cancel: { label: 'Cancelar', className: 'btn-secondary' }
        },
        callback: ok => {
            if (!ok) return;
            const codigo = $('#bodyLiturgia>ul>li.bg-warning').index();
            Liturgia.splice(codigo, 1);
            $('#bodyLiturgia>ul>li.bg-warning').remove();
            $('#cardCorpo').addClass('d-none');
            $.post('/dados/salvar-liturgia', { arquivo: documento, data: JSON.stringify(Liturgia) })
                .done(() => mostrarToast('<i class="fas fa-trash"></i>&nbsp;Excluído', 'danger'));
        }
    });
}

/* ────────────────────────────────────────────────────────────────────────
   PASSAGEM
   ──────────────────────────────────────────────────────────────────────── */

function mostraPassagem(codigo) {
    codigo = codigo ?? $('#bodyLiturgia>ul>li.bg-warning').index();
    if (codigo < 0) { passagemEscolher(-1); return; }
    const passagem = $.passarObjeto(Liturgia[codigo]);

    $.post('/formularios/passagem')
        .done(formulario => {
            $('#bodyCorpo>*:not(#botoesLiturgia)').remove();
            query('#bodyCorpo').insertAdjacentHTML('afterbegin', formulario);
        })
        .always(() => {
            query('#headerCorpo>titulo').innerHTML = "<i class='fas fa-bible'></i>" + passagem.titulo;
            query('#cardCorpo').classList.remove('d-none');
            $('#tituloPass').text(passagem.titulo);
            const div = document.getElementById('textoPass');
            if (div) {
                div.innerHTML = '';
                passagem.texto.forEach(l => {
                    const m = l.match(/^(.+?)\.([0-9]+)\.([0-9]+)\.?\s*(.*)/);
                    if (m) {
                        div.innerHTML += `<sup class="text-muted fw-bold me-1">${m[3]}</sup>${m[4]}<br>`;
                    } else {
                        div.innerHTML += l + '<br>';
                    }
                });
            }
            $('#final').val(JSON.stringify(passagem, undefined, 4));
            $('#excluir').removeClass('d-none');
        });
}

function arrumarPassagem() {
    // Ainda usada por passagemEscolher para converter o formato [Livro.cap.v] texto → texto[]
    const original = typeof arguments[0] === 'string' ? arguments[0] : $('#pmOriginal').val();
    const titulo = typeof arguments[1] === 'string' ? arguments[1] : $('#pmTitulo').val();
    let texto = original.trim().replace(/]/g, '.').replace(/\n/g, ' ').split('[');
    let partes = [];
    texto.forEach(p => { if (p.trim()) partes.push('"' + p.trim() + '"'); });
    return {
        tipo: 'passagem',
        titulo,
        texto: JSON.parse('[' + partes.join(',') + ']')
    };
}

/* ────────────────────────────────────────────────────────────────────────
   BÍBLIA — navegação e preenchimento automático de passagens
   ──────────────────────────────────────────────────────────────────────── */

/** Carrega a lista de versões e inicializa o seletor com ARA como padrão. */
function bibliaIniciar() {
    if (!$('#selVersao').length) return;
    $.get('/biblia/versoes')
        .done(versoes => {
            const sel = $('#selVersao').empty();
            versoes.forEach(v => {
                $('<option>').val(v.codigo).text(v.nome)
                    .prop('selected', v.codigo === 'ARA')
                    .appendTo(sel);
            });
            bibliaCarregarLivros();
        })
        .fail(() => mostrarToast('Erro ao carregar versões da Bíblia', 'danger'));
}

/** Popula o seletor de livros conforme a versão escolhida. */
function bibliaCarregarLivros() {
    const versao = $('#selVersao').val();
    $.get('/biblia/livros', { versao })
        .done(livros => {
            const sel = $('#selLivro').empty().append('<option value="">Livro…</option>');
            livros.forEach(l => $('<option>').val(l.id).text(l.name).appendTo(sel));
            $('#selCapInicio, #selCapFim').empty().append('<option value="">Cap…</option>');
            $('#selInicio, #selFim').empty().append('<option value="">v…</option>');
        })
        .fail(() => mostrarToast('Erro ao carregar livros', 'danger'));
}

/** Popula os seletores de capítulo (início e fim) conforme o livro escolhido. */
function bibliaCarregarCapitulos() {
    const versao = $('#selVersao').val();
    const livro = $('#selLivro').val();
    if (!livro) return;
    $.get('/biblia/capitulos', { versao, livro })
        .done(({ total }) => {
            const opcoesHtml = '<option value="">Cap…</option>' +
                Array.from({ length: total }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');
            $('#selCapInicio').html(opcoesHtml);
            $('#selCapFim').html(opcoesHtml);
            $('#selInicio, #selFim').empty().append('<option value="">v…</option>');
        })
        .fail(() => mostrarToast('Erro ao carregar capítulos', 'danger'));
}

/**
 * Popula o seletor de versículos de inicio ou fim ao trocar o capítulo correspondente.
 * @param {'inicio'|'fim'} qual
 */
function bibliaCarregarVersos(qual) {
    const versao = $('#selVersao').val();
    const livro = $('#selLivro').val();
    const capitulo = qual === 'inicio' ? $('#selCapInicio').val() : $('#selCapFim').val();
    const selVerse = qual === 'inicio' ? '#selInicio' : '#selFim';
    if (!livro || !capitulo) return;
    // Sincroniza selCapFim com pelo menos o valor de selCapInicio
    if (qual === 'inicio') {
        const capInicioVal = Number($('#selCapInicio').val());
        const capFimVal = Number($('#selCapFim').val());
        if (!capFimVal || capFimVal < capInicioVal) $('#selCapFim').val(capInicioVal);
    }
    $.get('/biblia/versiculos-count', { versao, livro, capitulo })
        .done(({ total }) => {
            const opts = '<option value="">v…</option>' +
                Array.from({ length: total }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');
            $(selVerse).html(opts);
            if (qual === 'inicio') $(selVerse).val(1);
            else $(selVerse).val(total);
        })
        .fail(() => mostrarToast('Erro ao carregar versículos', 'danger'));
}

/** Busca os versículos selecionados (suporta múltiplos capítulos) e preenche #titulo e #original. */
function bibliaBuscar() {
    const versao = $('#selVersao').val();
    const livro = $('#selLivro').val();
    const capInicio = $('#selCapInicio').val();
    const capFim = $('#selCapFim').val() || capInicio;
    const inicio = $('#selInicio').val();
    const fim = $('#selFim').val();
    if (!livro || !capInicio) { mostrarToast('Selecione livro e capítulo', 'warning'); return; }
    $.get('/biblia/versiculos', { versao, livro, capInicio, capFim, inicio, fim })
        .done(({ livro: nomeLivro, versiculos }) => {
            // Monta o título
            let tituloRef;
            if (capInicio === capFim || !capFim) {
                tituloRef = `${nomeLivro} ${capInicio}`;
                if (inicio && fim && inicio !== fim) tituloRef += `:${inicio}-${fim}`;
                else if (inicio) tituloRef += `:${inicio}`;
            } else {
                tituloRef = `${nomeLivro} ${capInicio}:${inicio || 1}-${capFim}:${fim || '?'}`;
            }
            $('#titulo').val(tituloRef);
            // Monta o texto no formato [Livro.cap.v] texto
            let original = '';
            versiculos.forEach(v => {
                original += `[${nomeLivro}.${v.chapter}.${v.verse}] ${v.text}\n`;
            });
            $('#original').val(original.trim());
            arrumarPassagem();
        })
        .fail(() => mostrarToast('Erro ao buscar versículos', 'danger'));
}

/* ────────────────────────────────────────────────────────────────────────
   HINO
   ──────────────────────────────────────────────────────────────────────── */

function mostraHino(codigo) {
    codigo = codigo ?? $('#bodyLiturgia>ul>li.bg-warning').index();
    if (codigo < 0) { hinoLocal(); return; }
    const hino = $.passarObjeto(Liturgia[codigo]);

    $.post('/formularios/hino')
        .done(formulario => {
            $('#bodyCorpo>*:not(#botoesLiturgia)').remove();
            query('#bodyCorpo').insertAdjacentHTML('afterbegin', formulario);
        })
        .always(() => {
            query('#headerCorpo>titulo').innerHTML = "<i class='fas fa-music'></i>" + hino.titulo;
            query('#cardCorpo').classList.remove('d-none');
            $('#tituloHino').text(hino.titulo);
            const div = document.getElementById('letraHino');
            if (div) {
                div.innerHTML = '';
                hino.letra.forEach(l => {
                    const isRefrao = l.startsWith('refrao:');
                    const texto = l.replace(/^refrao:/, '').replace(/\{it\}|\{\/it\}/g, '').replace(/<br\/?>/gi, '\n');
                    div.innerHTML += `<p class="mb-2${isRefrao ? ' fst-italic text-primary' : ''}">${texto.replace(/\n/g, '<br>')}</p>`;
                });
            }
            $('#final').val(JSON.stringify(hino, undefined, 4));
            $('#excluir').removeClass('d-none');
        });
}

/* ────────────────────────────────────────────────────────────────────────
   LOUVOR
   ──────────────────────────────────────────────────────────────────────── */

function mostraLouvor(codigo) {
    codigo = codigo ?? $('#bodyLiturgia>ul>li.bg-warning').index();
    let louvor = (codigo >= 0)
        ? $.passarObjeto(Liturgia[codigo])
        : { tipo: 'louvor', titulo: '', letra: [] };

    $.post('/formularios/louvor', { louvor: JSON.stringify(louvor) })
        .done(formulario => {
            $('#bodyCorpo>*:not(#botoesLiturgia)').remove();
            query('#bodyCorpo').insertAdjacentHTML('afterbegin', formulario);
        })
        .always(() => {
            query('#headerCorpo>titulo').innerHTML = "<i class='fas fa-guitar'></i>" + louvor.titulo;
            query('#cardCorpo').classList.remove('d-none');
            $('#tituloLouvor').text(louvor.titulo);
            $('#titulo').val(louvor.titulo);
            const divLouvor = document.getElementById('letraLouvor');
            if (divLouvor) Trechos.renderizar(divLouvor, louvor.letra);
            $('#final').val(JSON.stringify(louvor, undefined, 4));
            $('#original').val('');
            $('#original').val(louvor.letra.map(Trechos.texto).join('\n\n'));
            $('#excluir').toggleClass('d-none', codigo < 0);
            if (codigo < 0) louvorAbrirEditor('louvor');
        });
}

function louvorAbrirEditor(tipo) {
    let item;
    try { item = JSON.parse($('#final').val()); } catch { item = { tipo, titulo: $('#titulo').val(), letra: [] }; }
    EditorTrechos.abrir({ tipo, titulo: item.titulo, letra: item.letra,
        onPesquisar: tipo === 'louvor' ? titulo => { $('#titulo').val(titulo); pesquisarLouvor(titulo); } : undefined,
        onSalvar: atualizado => {
            const novo = { ...item, tipo, titulo: atualizado.titulo, letra: atualizado.letra };
            $('#titulo').val(novo.titulo); $('#tituloLouvor').text(novo.titulo);
            $('#original').val(novo.letra.map(Trechos.texto).join('\n\n'));
            $('#final').val(JSON.stringify(novo)); Trechos.renderizar(document.getElementById('letraLouvor'), novo.letra);
            return salvar();
        }
    });
}

function separarEstrofes(texto) {
    return String(texto || '').replace(/\r\n?/g, '\n').trim()
        .split(/\n[ \t]*\n(?:[ \t]*\n)*/).map(bloco => bloco.trim()).filter(Boolean);
}

function atualizarEstrofesPesquisa() {
    const quantidade = separarEstrofes($('#letra').val()).length;
    $('#estrofesLetra').text(`${quantidade} ${quantidade === 1 ? 'estrofe' : 'estrofes'} · Separe os blocos com uma linha em branco.`);
}

function arrumarLouvor() {
    const codigo = $('#bodyLiturgia>ul>li.bg-warning').index();
    let louvor = { tipo: 'louvor', titulo: $('#titulo').val(), letra: [] };
    if (codigo >= 0 && Liturgia[codigo]?.louvor_id) {
        louvor.louvor_id = Liturgia[codigo].louvor_id;
    }
    louvor.letra = separarEstrofes($('#original').val()).map(bloco => bloco.replace(/\n/g, '<br/>'));
    $('#final').val(JSON.stringify(louvor, undefined, 4));
    // sincroniza exibição visual
    $('#tituloLouvor').text(louvor.titulo);
    const div = document.getElementById('letraLouvor');
    if (div) {
        div.innerHTML = '';
        louvor.letra.forEach(l => {
            const isRefrao = l.startsWith('refrao:');
            const texto = l.replace(/^refrao:/, '').replace(/<br\/?>/gi, '\n');
            div.innerHTML += `<p class="mb-2${isRefrao ? ' fst-italic text-primary' : ''}">${texto.replace(/\n/g, '<br>')}</p>`;
        });
    }
}

function pesquisarLouvor(titulo) {
    $.post('/formularios/pesquisar-louvor', { titulo })
        .done(formulario => {
            bootbox.dialog({
                title: 'Pesquisar louvor',
                className: 'pesquisa-louvor',
                message: formulario,
                size: 'extra-large',
                centerVertical: true,
                onEscape: true,
                closeButton: false,
                backdrop: true,
                buttons: {
                    ok: {
                        label: 'Ok',
                        className: 'btn-info',
                        callback: () => {
                            if ($('#letra').val().trim()) {
                                $('#titulo').val($('#pesquisaTitulo').val());
                                // A letra externa é texto; o catálogo guarda estrofes com HTML de quebra de linha.
                                $('#original').val($('#letra').val().replace(/</g, '&lt;').replace(/>/g, '&gt;'));
                                arrumarLouvor();
                            }
                        }
                    }
                }
            })
                .bind('shown.bs.modal', function () {
                    $('body').addClass('modal-open');
                    $(this).find('[autofocus]').focus();
                    $('#letra').on('input', atualizarEstrofesPesquisa);
                    atualizarEstrofesPesquisa();
                })
                .bind('hidden.bs.modal', function () {
                    ++pesquisaLetraAtual;
                    $('body').removeClass('modal-open');
                });
        });
}

let pesquisaLetraAtual = 0;
function pesquisaMusica(titulo) {
    const pesquisa = ++pesquisaLetraAtual;
    $('#letra').val('');
    atualizarEstrofesPesquisa();
    $('#fonteLetra').text('Confira artista, versão e letra antes de usar.');
    $('#listaMusicas').empty().append($('<li>', { class: 'text-muted p-1' }).text('Pesquisando músicas e verificando letras…'));
    $('#mostrarMusicas').removeClass('d-none').css('display', 'grid');
    $.getJSON('/api/letras/buscar', { q: titulo })
        .done(musicas => {
            if (pesquisa !== pesquisaLetraAtual) return;
            $('#listaMusicas').empty();
            const resultados = (musicas.results || []).filter(musica => typeof musica.text === 'string' && musica.text.trim());
            if (!resultados.length) {
                $('#listaMusicas').append($('<li>', { class: 'text-muted p-1' }).text('Nenhum resultado encontrado nas fontes gratuitas.'));
                return;
            }
            resultados.forEach(musica => {
                const nome = `${musica.title} — ${musica.artist}${musica.album ? ' (' + musica.album + ')' : ''}`;
                $('<li>').text(nome).attr('title', nome).appendTo('#listaMusicas').on('click', function () {
                    $('#listaMusicas>li').removeClass('bg-warning');
                    $(this).addClass('bg-warning');
                    $('#pesquisaTitulo').val(musica.title);
                    $('#letra').val(musica.text);
                    atualizarEstrofesPesquisa();
                    const fonte = musica.provider === 'lrclib' ? 'LRCLIB' : 'Lyrics.ovh';
                    $('#fonteLetra').text(`${musica.artist} · ${fonte}. Confira a versão e a letra antes de usar.`);
                });
            });
        })
        .fail(xhr => {
            if (pesquisa !== pesquisaLetraAtual) return;
            const mensagem = xhr.responseJSON?.error || (xhr.status === 0
                ? 'O servidor da Liturgia não respondeu. Tente pesquisar novamente.'
                : 'Não foi possível concluir a pesquisa. Tente novamente.');
            $('#listaMusicas').empty().append($('<li>', { class: 'text-danger p-1' }).text(mensagem));
        });
}

/* ────────────────────────────────────────────────────────────────────────
   PESQUISAR LOUVOR / HINO LOCAL
   ──────────────────────────────────────────────────────────────────────── */

function louvorLocal() {
    $.get('/formularios/pesquisar-louvor-local').then(retorno => {
        bootbox.dialog({
            title: 'Selecione o louvor',
            message: retorno.formulario,
            onEscape: true,
            closeButton: true,
            backdrop: true,
            className: 'p-0',
            size: 'extra-large',
            centerVertical: true,
            buttons: {
                novo: {
                    label: 'Novo',
                    className: 'btn-success',
                    callback: () => { novaSelecao('Louvor'); }
                },
                ok: {
                    label: 'Ok',
                    className: 'btn-info disabled botaoOK',
                    callback: () => {
                        const idx = $('#louvores>li.bg-warning').attr('codigo');
                        const salvar = $.passarObjeto(retorno.louvores[idx]);
                        adicionarItem(salvar);
                        $.post('/dados/salvar-liturgia', { arquivo: documento, data: JSON.stringify(Liturgia) })
                            .done(() => mostrarToast('<i class="fas fa-check-circle"></i>&nbsp;Louvor adicionado!'));
                    }
                }
            }
        })
            .bind('shown.bs.modal', function () {
                $('body').addClass('modal-open');
                $('#louvores>li').off('click').on('click', function () {
                    marcaLI(this);
                    const louvor = retorno.louvores[$(this).attr('codigo')];
                    const el = query('mostrar');
                    el.innerHTML = `<h2>${louvor.titulo}</h2><hr class="p-0 m-0 mt-1 mb-1">`;
                    const letra = document.createElement('div'); Trechos.renderizar(letra, louvor.letra); el.append(letra);
                    query('.botaoOK').classList.remove('disabled');
                });
                $(this).find('[autofocus]').focus().select();
            })
            .bind('hidden.bs.modal', function () { $('body').removeClass('modal-open'); });
    });
}

/* ───────────────────────────────────────────────────────────────────────────
   CORAL
   ─────────────────────────────────────────────────────────────────────────── */

function mostraCoral(codigo) {
    codigo = codigo ?? $('#bodyLiturgia>ul>li.bg-warning').index();
    let coral = (codigo >= 0)
        ? $.passarObjeto(Liturgia[codigo])
        : { tipo: 'coral', titulo: '', letra: [] };

    $.post('/formularios/coral', { coral: JSON.stringify(coral) })
        .done(formulario => {
            $('#bodyCorpo>*:not(#botoesLiturgia)').remove();
            query('#bodyCorpo').insertAdjacentHTML('afterbegin', formulario);
        })
        .always(() => {
            query('#headerCorpo>titulo').innerHTML = "<i class='fas fa-users'></i>" + coral.titulo;
            query('#cardCorpo').classList.remove('d-none');
            $('#tituloLouvor').text(coral.titulo);
            $('#titulo').val(coral.titulo);
            const divCoral = document.getElementById('letraLouvor');
            if (divCoral) Trechos.renderizar(divCoral, coral.letra);
            $('#final').val(JSON.stringify(coral, undefined, 4));
            $('#original').val('');
            $('#original').val(coral.letra.map(Trechos.texto).join('\n\n'));
            $('#excluir').toggleClass('d-none', codigo < 0);
            if (codigo < 0) louvorAbrirEditor('coral');
        });
}

function arrumarCoral() {
    const codigo = $('#bodyLiturgia>ul>li.bg-warning').index();
    let coral = { tipo: 'coral', titulo: $('#titulo').val(), letra: [] };
    if (codigo >= 0 && Liturgia[codigo]?.coral_id) {
        coral.coral_id = Liturgia[codigo].coral_id;
    }
    $('#original').val().replace(/\n\n/g, '|').replace(/\n/g, '<br/>').split('|')
        .forEach(l => { if (l.trim()) coral.letra.push(l); });
    $('#final').val(JSON.stringify(coral, undefined, 4));
    // sincroniza exibição visual
    $('#tituloLouvor').text(coral.titulo);
    const div = document.getElementById('letraLouvor');
    if (div) {
        div.innerHTML = '';
        coral.letra.forEach(l => {
            const isRefrao = l.startsWith('refrao:');
            const texto = l.replace(/^refrao:/, '').replace(/<br\/?>/gi, '\n');
            div.innerHTML += `<p class="mb-2${isRefrao ? ' fst-italic text-primary' : ''}">${texto.replace(/\n/g, '<br>')}</p>`;
        });
    }
}

// coralLocal (escolha do coral por cantata) está em js/coral.js
