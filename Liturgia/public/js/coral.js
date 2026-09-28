/* ────────────────────────────────────────────────────────────────────────
   CORAL — escolha por cantata (decisão do João, 28/09/2026)
   Cantata = nome + músicas em ordem. Na liturgia: "Inserir cantata" traz todas as
   músicas dela; marcando músicas (de uma ou várias cantatas, ou avulsas) e
   "Inserir selecionadas" traz só essas, na ordem em que foram marcadas.
   Também cadastra cantatas e músicas do coral fora de uma liturgia.
   ──────────────────────────────────────────────────────────────────────── */

let cm = null; // estado do modal aberto

const cmMusica = id => cm.catalogo.musicas.find(m => m.id === id);
const cmInicio = m => String((m.letra || [])[0] || '').replace(/^refrao:/, '').split(/<br\s*\/?>/i)[0].trim();

function cmCarregar() {
    return $.getJSON('/coral/catalogo').done(catalogo => { cm.catalogo = catalogo; cmDesenhar(); });
}

/** Lista: cada cantata (abre/fecha) com suas músicas, e o grupo "Sem cantata" */
function cmDesenhar() {
    const filtro = normalizarBusca($('#cmBusca').val());
    const naCantata = new Set(cm.catalogo.cantatas.flatMap(c => c.musicas));
    const combina = m => !filtro || normalizarBusca(m.titulo + ' ' + cmInicio(m)).includes(filtro);
    const linha = m => $('<li class="cm-musica">').attr('data-id', m.id)
        .toggleClass('marcada', cm.sel.includes(m.id))
        .append($('<input type="checkbox" class="form-check-input">').prop('checked', cm.sel.includes(m.id)),
            $('<span class="titulo">').text(m.titulo),
            $('<small class="inicio">').text(cmInicio(m)),
            $('<span class="cm-ordem">').text(cm.sel.includes(m.id) ? cm.sel.indexOf(m.id) + 1 : ''));

    const $lista = $('#cmLista').empty();
    const grupo = (cantata) => {
        const musicas = (cantata ? cantata.musicas.map(cmMusica) : cm.catalogo.musicas.filter(m => !naCantata.has(m.id)))
            .filter(Boolean);
        const nomeCombina = cantata && filtro && normalizarBusca(cantata.nome).includes(filtro);
        const visiveis = nomeCombina ? musicas : musicas.filter(combina);
        if ((filtro || !cantata) && !visiveis.length) return; // "Sem cantata" vazio não aparece
        const chave = cantata ? cantata.id : 'avulsas';
        const aberto = !!filtro || cm.abertos.has(chave);
        const $g = $('<div class="cm-grupo">').attr('data-chave', chave).toggleClass('aberto', aberto);
        const $cab = $('<div class="cm-cab">').append(
            $('<button type="button" class="cm-abrir">').append(
                $('<i class="fas fa-chevron-right">'),
                $('<strong>').text(cantata ? cantata.nome : 'Sem cantata'),
                $('<small class="text-muted">').text(` ${musicas.length} ${musicas.length === 1 ? 'música' : 'músicas'}`)));
        if (cantata) {
            $cab.append(
                $('<button type="button" class="btn btn-sm btn-success cm-inserir-cantata">')
                    .attr('title', 'Inserir todas as músicas desta cantata, na ordem')
                    .html('<i class="fas fa-plus"></i>&nbsp;Inserir cantata'),
                $('<button type="button" class="btn btn-sm btn-outline-secondary cm-editar">')
                    .attr('title', 'Editar cantata').html('<i class="fas fa-pen"></i>'));
        }
        $g.append($cab, $('<ul class="cm-musicas">').append(visiveis.map(linha)));
        $lista.append($g);
    };
    cm.catalogo.cantatas.forEach(grupo);
    grupo(null);
    if (!$lista.children().length) $lista.append('<div class="pm-vazio">Nada encontrado.</div>');
    cmResumo();
}

function cmResumo() {
    const n = cm.sel.length;
    $('#cmResumo').html(n
        ? `<i class="fas fa-users me-1"></i><strong>${n} ${n === 1 ? 'música selecionada' : 'músicas selecionadas'}</strong>
           <span class="ms-2 text-muted"></span>`
        : '<span class="text-muted">Marque as músicas ou use "Inserir cantata"</span>');
    $('#cmResumo .text-muted').text(cm.sel.map(id => cmMusica(id)?.titulo).join(' · '));
    $('.cm-ok').toggleClass('disabled', !n);
}

function cmMostrar(id) {
    const m = cmMusica(id);
    if (!m) return;
    $('#cmCabecalho').text(m.titulo);
    const $t = $('#cmLetra').empty();
    m.letra.forEach(estrofe => {
        const $p = $('<p class="hm-estrofe">').toggleClass('refrao', estrofe.startsWith('refrao:'));
        estrofe.replace(/^refrao:/, '').split(/<br\s*\/?>/i).forEach((l, i) => {
            if (i) $p.append('<br>');
            $p.append(document.createTextNode(l));
        });
        $t.append($p);
    });
    $t.scrollTop(0);
}

function cmMarcar(id) {
    const i = cm.sel.indexOf(id);
    if (i >= 0) cm.sel.splice(i, 1); else cm.sel.push(id);
    // A mesma música pode aparecer em mais de uma cantata: marca todas as ocorrências
    $('#cmLista .cm-musica').each(function () {
        const mid = Number(this.dataset.id);
        $(this).toggleClass('marcada', cm.sel.includes(mid))
            .find('input').prop('checked', cm.sel.includes(mid)).end()
            .find('.cm-ordem').text(cm.sel.includes(mid) ? cm.sel.indexOf(mid) + 1 : '');
    });
    cmResumo();
}

/** Acrescenta as músicas no fim do grupo do coral, salva e fecha */
function cmInserir(ids) {
    const itens = ids.map(cmMusica).filter(Boolean)
        .map(m => ({ tipo: 'coral', titulo: m.titulo, letra: m.letra, coral_id: m.id }));
    if (!itens.length) return;
    itens.forEach(item => {
        let idx = Liturgia.length;
        Liturgia.forEach((i, n) => { if (i && i.tipo === 'coral') idx = n + 1; });
        Liturgia.splice(idx, 0, item);
    });
    renderizarLiturgia();
    const ultimo = Liturgia.map(i => i?.tipo).lastIndexOf('coral');
    $('#bodyLiturgia>ul>li:eq(' + ultimo + ')').click();
    $.post('/dados/salvar-liturgia', { arquivo: documento, data: JSON.stringify(Liturgia) })
        .done(() => mostrarToast(`<i class="fas fa-check-circle"></i>&nbsp;${itens.length === 1 ? 'Coral adicionado!' : itens.length + ' músicas do coral adicionadas!'}`))
        .fail(xhr => bootbox.alert(xhr.responseJSON?.error || 'Erro ao salvar a liturgia.'));
    bootbox.hideAll();
}

/* ── cadastro ──────────────────────────────────────────────────────────── */

function cmNovaCantata() {
    bootbox.prompt({
        title: 'Nova cantata',
        placeholder: 'Nome da cantata (ex.: Experiência com Deus)',
        centerVertical: true,
        callback: nome => {
            if (!nome || !nome.trim()) return;
            $.post('/cantatas', { nome })
                .done(r => { cm.abertos.add(r.id); cmCarregar().done(() => cmEditarCantata(r.id)); })
                .fail(xhr => bootbox.alert(xhr.responseJSON?.error || 'Erro ao criar a cantata.'));
        }
    });
}

function cmEditarCantata(id) {
    const cantata = cm.catalogo.cantatas.find(c => c.id === id);
    if (!cantata) return;
    let ordem = cantata.musicas.slice();

    const html = /* html */`
<div class="ce">
  <label class="form-label small text-muted mb-1">Nome</label>
  <input type="text" id="ceNome" class="form-control mb-3">
  <label class="form-label small text-muted mb-1">Músicas, na ordem da cantata — arraste para reordenar</label>
  <ul id="ceLista" class="ce-lista"></ul>
  <div class="input-group mt-2">
    <select id="ceAdicionar" class="form-select"></select>
    <button class="btn btn-outline-primary" type="button" id="ceBtnAdicionar"><i class="fas fa-plus"></i>&nbsp;Adicionar</button>
  </div>
  <div class="small text-muted mt-2">Música nova do coral: feche e use "Nova música", escolhendo esta cantata.</div>
</div>`;

    const desenhar = () => {
        $('#ceLista').empty().append(ordem.map((mid, i) => {
            const m = cmMusica(mid);
            return $('<li class="ce-item">').attr({ 'data-id': mid, 'data-i': i }).append(
                $('<i class="fas fa-grip-vertical text-muted">'),
                $('<span class="ce-n">').text(i + 1),
                $('<span class="flex-grow-1">').text(m ? m.titulo : '?'),
                $('<button type="button" class="btn btn-sm btn-link text-danger ce-remover" title="Tirar da cantata">').html('<i class="fas fa-times"></i>'));
        }));
        if (!ordem.length) $('#ceLista').append('<li class="text-muted small p-2">Nenhuma música ainda.</li>');
        // Todas as músicas do coral, inclusive as que já estão na cantata: a mesma música
        // pode se repetir (abrir e fechar a cantata, por exemplo)
        const $sel = $('#ceAdicionar').empty().append('<option value="">Escolha uma música do coral…</option>');
        cm.catalogo.musicas.forEach(m => $('<option>').val(m.id)
            .text(`${m.titulo} — ${cmInicio(m)}${ordem.includes(m.id) ? '  (já está na cantata)' : ''}`).appendTo($sel));
    };

    bootbox.dialog({
        title: '<i class="fas fa-users me-2"></i>Editar cantata',
        message: html,
        centerVertical: true,
        onEscape: true,
        buttons: {
            excluir: {
                label: '<i class="fas fa-trash"></i>&nbsp;Excluir cantata', className: 'btn-outline-danger me-auto',
                callback: () => {
                    bootbox.confirm({
                        message: `Excluir a cantata "${$('<i>').text(cantata.nome).html()}"? As músicas continuam no coral.`,
                        buttons: { confirm: { label: 'Excluir', className: 'btn-danger' }, cancel: { label: 'Cancelar' } },
                        callback: ok => {
                            if (!ok) return;
                            $.ajax({ url: '/cantatas/' + id, method: 'DELETE' })
                                .done(() => { mostrarToast('<i class="fas fa-trash"></i>&nbsp;Cantata excluída', 'secondary'); cmCarregar(); })
                                .fail(() => bootbox.alert('Erro ao excluir a cantata.'));
                        }
                    });
                }
            },
            cancelar: { label: 'Cancelar', className: 'btn-outline-secondary' },
            salvar: {
                label: '<i class="fas fa-check"></i>&nbsp;Salvar', className: 'btn-primary',
                callback: () => {
                    const nome = $('#ceNome').val().trim();
                    if (!nome) { $('#ceNome').addClass('is-invalid'); return false; }
                    $.ajax({ url: '/cantatas/' + id, method: 'PUT', contentType: 'application/json',
                        data: JSON.stringify({ nome, musicas: ordem }) })
                        .done(() => { mostrarToast('<i class="fas fa-check-circle"></i>&nbsp;Cantata salva!'); cm.abertos.add(id); cmCarregar(); })
                        .fail(xhr => bootbox.alert(xhr.responseJSON?.error || 'Erro ao salvar a cantata.'));
                }
            }
        }
    }).on('shown.bs.modal', function () {
        $('#ceNome').val(cantata.nome).on('input', function () { this.classList.remove('is-invalid'); });
        desenhar();
        if (typeof Sortable !== 'undefined') {
            Sortable.create(document.getElementById('ceLista'), {
                animation: 150, handle: '.fa-grip-vertical',
                onEnd: () => {
                    ordem = $('#ceLista .ce-item').map((_, li) => Number(li.dataset.id)).get();
                    desenhar();
                }
            });
        }
        $('#ceLista').on('click', '.ce-remover', function () {
            // Tira só esta posição: a mesma música pode estar em outra posição da cantata
            ordem.splice(Number($(this).closest('.ce-item').attr('data-i')), 1);
            desenhar();
        });
        $('#ceBtnAdicionar').on('click', () => {
            const mid = Number($('#ceAdicionar').val());
            if (mid) { ordem.push(mid); desenhar(); }
        });
    });
}

/** Linhas → estrofes: linha em branco separa estrofes; "Refrão:" no começo marca o refrão */
function cmLetraDoTexto(texto) {
    return String(texto || '').replace(/\r/g, '').split(/\n\s*\n/).map(bloco => {
        let linhas = bloco.split('\n').map(l => l.trim()).filter(Boolean);
        if (!linhas.length) return null;
        let refrao = false;
        if (/^refr[aã]o\s*:?\s*/i.test(linhas[0])) {
            refrao = true;
            linhas[0] = linhas[0].replace(/^refr[aã]o\s*:?\s*/i, '');
            linhas = linhas.filter(Boolean);
        }
        return linhas.length ? (refrao ? 'refrao:' : '') + linhas.join('<br/>') : null;
    }).filter(Boolean);
}

function cmNovaMusica() {
    const opcoes = cm.catalogo.cantatas.map(c => `<option value="${c.id}"></option>`).join('');
    const html = /* html */`
<input type="text" id="nmTitulo" class="form-control mb-2" placeholder="Título da música" style="background:bisque;">
<select id="nmCantata" class="form-select mb-2">
  <option value="">Sem cantata (avulsa)</option>${opcoes}
</select>
<textarea id="nmLetra" class="form-control" rows="12" style="resize:none;"
  placeholder="Cole a letra aqui&#10;Estrofes separadas por linha em branco&#10;Comece a estrofe com &quot;Refrão:&quot; para marcar o refrão"></textarea>`;
    bootbox.dialog({
        title: '<i class="fas fa-users me-2"></i>Nova música do coral',
        message: html,
        size: 'large',
        centerVertical: true,
        onEscape: true,
        buttons: {
            cancelar: { label: 'Cancelar', className: 'btn-outline-secondary' },
            salvar: {
                label: '<i class="fas fa-check"></i>&nbsp;Cadastrar', className: 'btn-primary',
                callback: () => {
                    const titulo = $('#nmTitulo').val().trim();
                    const letra = cmLetraDoTexto($('#nmLetra').val());
                    if (!titulo || !letra.length) { bootbox.alert('Informe o título e a letra.'); return false; }
                    const cantata_id = $('#nmCantata').val();
                    $.ajax({ url: '/coral', method: 'POST', contentType: 'application/json',
                        data: JSON.stringify({ titulo, letra, cantata_id }) })
                        .done(() => {
                            mostrarToast('<i class="fas fa-check-circle"></i>&nbsp;Música cadastrada no coral!');
                            cm.abertos.add(cantata_id ? Number(cantata_id) : 'avulsas');
                            cmCarregar();
                        })
                        .fail(xhr => bootbox.alert(xhr.responseJSON?.error || 'Erro ao cadastrar a música.'));
                }
            }
        }
    }).on('shown.bs.modal', function () {
        // Nomes das cantatas entram como texto (não HTML)
        $('#nmCantata option[value!=""]').each(function () {
            this.textContent = cm.catalogo.cantatas.find(c => c.id === Number(this.value))?.nome || '';
        });
        $('#nmTitulo').trigger('focus');
    });
}

/* ── modal ─────────────────────────────────────────────────────────────── */

const normalizarBusca = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function coralLocal() {
    cm = { catalogo: { cantatas: [], musicas: [] }, sel: [], abertos: new Set() };

    const html = /* html */`
<div class="pm cm">
  <div class="pm-topo">
    <div class="input-group">
      <span class="input-group-text"><i class="fas fa-search"></i></span>
      <input type="text" id="cmBusca" class="form-control" autocomplete="off"
        placeholder="Buscar cantata ou música do coral">
      <button class="btn btn-outline-primary" type="button" id="cmNovaCantata"><i class="fas fa-layer-group"></i>&nbsp;Nova cantata</button>
      <button class="btn btn-outline-primary" type="button" id="cmNovaMusica"><i class="fas fa-plus"></i>&nbsp;Nova música</button>
    </div>
  </div>
  <div class="pm-corpo">
    <div id="cmLista" class="cm-lista"></div>
    <div class="pm-leitura">
      <div class="pm-cabecalho"><strong id="cmCabecalho">Clique numa música para ver a letra</strong></div>
      <div class="pm-texto" id="cmLetra">
        <div class="pm-vazio">
          <i class="fas fa-users fa-2x mb-2"></i>
          <div><strong>Inserir cantata</strong> traz todas as músicas dela, na ordem.<br>
          Ou marque músicas de uma ou mais cantatas e use <strong>Inserir selecionadas</strong>.</div>
        </div>
      </div>
      <div class="pm-dica">As músicas marcadas entram na ordem em que você marcou.</div>
    </div>
  </div>
  <div class="pm-rodape"><div id="cmResumo"></div></div>
</div>`;

    bootbox.dialog({
        title: '<i class="fas fa-users me-2"></i>Coral',
        message: html,
        size: 'extra-large',
        centerVertical: true,
        onEscape: true,
        closeButton: true,
        className: 'pm-modal',
        buttons: {
            cancelar: { label: 'Cancelar', className: 'btn-outline-secondary' },
            ok: {
                label: '<i class="fas fa-check me-1"></i>Inserir selecionadas',
                className: 'btn-success disabled cm-ok',
                callback: () => { if (!cm.sel.length) return false; cmInserir(cm.sel); }
            }
        }
    }).on('shown.bs.modal', function () {
        $('body').addClass('modal-open');
        cmCarregar();
        $('#cmBusca').trigger('focus').on('input', cmDesenhar);
        $('#cmNovaCantata').on('click', cmNovaCantata);
        $('#cmNovaMusica').on('click', cmNovaMusica);
        $('#cmLista')
            .on('click', '.cm-abrir', function () {
                const chave = $(this).closest('.cm-grupo').attr('data-chave');
                const k = chave === 'avulsas' ? chave : Number(chave);
                cm.abertos.has(k) ? cm.abertos.delete(k) : cm.abertos.add(k);
                $(this).closest('.cm-grupo').toggleClass('aberto');
            })
            .on('click', '.cm-inserir-cantata', function () {
                const c = cm.catalogo.cantatas.find(x => x.id === Number($(this).closest('.cm-grupo').attr('data-chave')));
                if (c && c.musicas.length) cmInserir(c.musicas);
                else bootbox.alert('Esta cantata ainda não tem músicas.');
            })
            .on('click', '.cm-editar', function () {
                cmEditarCantata(Number($(this).closest('.cm-grupo').attr('data-chave')));
            })
            // Caixinha marca/desmarca; clicar no nome só mostra a letra
            .on('click', '.cm-musica', function (e) {
                const id = Number(this.dataset.id);
                cmMostrar(id);
                if (e.target.tagName === 'INPUT') cmMarcar(id);
            });
    }).on('hidden.bs.modal', function () { $('body').removeClass('modal-open'); });
}
