/* ────────────────────────────────────────────────────────────────────────
   HINO — escolha pelo catálogo do banco (tabela hinos)
   Busca por número, nome ou trecho da letra; mesmo layout da escolha de passagem.
   A letra é sempre a do hinário; a ★ marca os hinos que a igreja já cantou.
   ──────────────────────────────────────────────────────────────────────── */

let hm = null; // estado do modal aberto

const hmData = d => d ? d.split('-').reverse().join('/') : '';

function hmBuscar() {
    const q = $('#hmBusca').val();
    const hinario = $('#hmHinario').val() || 'NC';
    const pedido = ++hm.pedido;
    return $.get('/hinos', { hinario, q }).done(lista => {
        if (pedido !== hm.pedido) return; // resposta atrasada de uma busca anterior
        hm.lista = lista;
        const $ul = $('#hmLista').empty();
        if (!lista.length) {
            $ul.append('<li class="hm-vazio">Nenhum hino encontrado</li>');
            return;
        }
        lista.forEach(h => {
            const $li = $('<li class="hm-item">').attr('data-id', h.id)
                .append($('<span class="num">').text(`${String(h.numero).padStart(3, '0')}${h.variante}`))
                .append($('<span class="nome">').text(h.nome));
            if (h.usado_em) $li.append($('<i class="fas fa-star usado">').attr('title', `Já cantado — última vez em ${hmData(h.usado_em)}`));
            if (h.encontrado === 'letra') $li.append($('<small class="onde">').text('na letra'));
            $ul.append($li);
        });
        const atual = hm.sel && $ul.find(`[data-id="${hm.sel.id}"]`);
        if (atual && atual.length) atual.addClass('ativo');
    });
}

function hmMostrar(id) {
    return $.getJSON('/hinos/' + id).done(h => {
        hm.sel = h;
        $('#hmLista .hm-item').removeClass('ativo').filter(`[data-id="${id}"]`).addClass('ativo')
            .each(function () { this.scrollIntoView({ block: 'nearest' }); });
        $('#hmCabecalho').text(h.titulo);
        const $t = $('#hmLetra').empty();
        h.letra.forEach(estrofe => {
            const refrao = estrofe.startsWith('refrao:');
            const $p = $('<p class="hm-estrofe">').toggleClass('refrao', refrao);
            estrofe.replace(/^refrao:/, '').split(/<br\s*\/?>/i).forEach((linha, i) => {
                if (i) $p.append('<br>');
                $p.append(document.createTextNode(linha));
            });
            $t.append($p);
        });
        $t.scrollTop(0);
        $('#hmOrigem').html('<i class="fas fa-book me-1"></i>Texto do hinário' + (h.usado_em
            ? ` · <i class="fas fa-star text-warning"></i> cantado pela última vez em ${hmData(h.usado_em)}` : ''));
        $('#hmResumo').html('<i class="fas fa-music me-1"></i><strong></strong>');
        $('#hmResumo strong').text(h.titulo);
        $('.hm-ok').removeClass('disabled');
    });
}

/** Setas ↑↓ andam pela lista; Enter confirma */
function hmTeclado(e) {
    if (!['ArrowDown', 'ArrowUp', 'Enter'].includes(e.key) || !hm.lista?.length) return;
    e.preventDefault();
    if (e.key === 'Enter') { if (hm.sel) $('.hm-ok').trigger('click'); return; }
    const i = hm.lista.findIndex(h => h.id === hm.sel?.id);
    const prox = e.key === 'ArrowDown' ? Math.min(i + 1, hm.lista.length - 1) : Math.max(i - 1, 0);
    hmMostrar(hm.lista[prox < 0 ? 0 : prox].id);
}

function hinoLocal(codigoReplace = -1) {
    const atual = codigoReplace >= 0 ? Liturgia[codigoReplace] : null;
    hm = { lista: [], sel: null, pedido: 0 };

    const html = /* html */`
<div class="pm hm">
  <div class="pm-topo">
    <div class="input-group">
      <span class="input-group-text"><i class="fas fa-search"></i></span>
      <input type="text" id="hmBusca" class="form-control" autocomplete="off"
        placeholder="Número, nome ou trecho da letra (ex.: 16, Avante, Deus dos antigos)">
      <select id="hmHinario" class="form-select" title="Hinário"></select>
    </div>
  </div>
  <div class="pm-corpo">
    <ul id="hmLista" class="hm-lista"></ul>
    <div class="pm-leitura">
      <div class="pm-cabecalho"><strong id="hmCabecalho">Escolha um hino na lista</strong></div>
      <div class="pm-texto" id="hmLetra">
        <div class="pm-vazio">
          <i class="fas fa-music fa-2x mb-2"></i>
          <div>Digite o número ou parte do nome e escolha na lista.<br>
          <i class="fas fa-star text-warning"></i> marca os hinos que a igreja já cantou.</div>
        </div>
      </div>
      <div class="pm-dica" id="hmOrigem">Use ↑ ↓ para percorrer a lista e Enter para inserir.</div>
    </div>
  </div>
  <div class="pm-rodape">
    <div id="hmResumo"><span class="text-muted">Nenhum hino selecionado</span></div>
  </div>
</div>`;

    bootbox.dialog({
        title: atual ? 'Alterar hino' : 'Novo hino',
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
                label: `<i class="fas fa-check me-1"></i>${atual ? 'Atualizar hino' : 'Inserir na liturgia'}`,
                className: 'btn-success disabled hm-ok',
                callback: () => {
                    if (!hm.sel) return false;
                    const item = { tipo: 'hino', titulo: hm.sel.titulo, letra: hm.sel.letra, hino_id: hm.sel.id };
                    if (codigoReplace >= 0) {
                        Liturgia[codigoReplace] = item;
                        $('#bodyLiturgia>ul>li:eq(' + codigoReplace + ')').text(item.titulo);
                        mostraHino(codigoReplace);
                        $.post('/dados/salvar-liturgia', { arquivo: documento, data: JSON.stringify(Liturgia) })
                            .done(() => mostrarToast('<i class="fas fa-check-circle"></i>&nbsp;Hino atualizado!'));
                    } else {
                        adicionarItem(item);
                        $.post('/dados/salvar-liturgia', { arquivo: documento, data: JSON.stringify(Liturgia) })
                            .done(() => mostrarToast('<i class="fas fa-check-circle"></i>&nbsp;Hino adicionado!'));
                    }
                }
            }
        }
    })
        .on('shown.bs.modal', function () {
            $('body').addClass('modal-open');
            let espera = null;
            $('#hmBusca').trigger('focus')
                .on('input', () => { clearTimeout(espera); espera = setTimeout(hmBuscar, 200); })
                .on('keydown', hmTeclado);
            $('#hmHinario').on('change', hmBuscar);
            $('#hmLista').on('click', '.hm-item', function () { hmMostrar(Number(this.dataset.id)); });

            $.get('/hinos/hinarios').done(hinarios => {
                const sel = $('#hmHinario').empty();
                hinarios.forEach(h => $('<option>').val(h.codigo).text(`${h.nome} (${h.codigo})`).appendTo(sel));
                if (atual?.hino_id) {
                    // Alterar: abre no hinário e no número do hino atual
                    $.getJSON('/hinos/' + atual.hino_id).done(h => {
                        sel.val(h.hinario);
                        $('#hmBusca').val(`${h.numero}${h.variante}`);
                        hmBuscar().done(() => hmMostrar(h.id));
                    }).fail(() => hmBuscar());
                } else {
                    if (atual?.titulo) $('#hmBusca').val(atual.titulo.replace(/\s*\(.*\)\s*$/, ''));
                    hmBuscar();
                }
            });
        })
        .on('hidden.bs.modal', function () { $('body').removeClass('modal-open'); hm = null; });
}

function hinoAlterar() {
    const codigo = $('#bodyLiturgia>ul>li.bg-warning').index();
    if (codigo >= 0) hinoLocal(codigo);
}
