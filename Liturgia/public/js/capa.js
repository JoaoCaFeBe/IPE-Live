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

/* ── INICIALIZAÇÃO ──────────────────────────────────────────────────────── */

function inicio() {
    // Atalhos de teclado
    $(document).on('keydown', e => {
        const emInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            if (!$('#cardCorpo').hasClass('d-none')) salvar();
        } else if (e.key === 'Delete' && !emInput) {
            if (!$('#excluir').hasClass('d-none')) excluir();
        }
    });
    // Duplo clique na lista de liturgias para renomear
    $('#listaLiturgias').on('dblclick', 'li', function () { renomearLiturgia(this); });

    $.getJSON('/Cultos')
        .done(arquivos => {
            const $ul = $('#listaLiturgias');
            $ul.empty();
            arquivos.forEach(value => {
                // value = "2026-01-04.json"
                const dataStr = value.replace('.json', ''); // "2026-01-04"
                const data = new Date(dataStr + 'T00:00:00.000').toLocaleDateString('pt-BR');
                $ul.append(
                    `<li arquivo="${value}"
              onclick="marcaLI(this); abreLiturgia('${value}');">
            <i class='fas fa-folder'></i>&nbsp;${data}
          </li>`
                );
            });
        })
        .fail(() => {
            $('#listaLiturgias').html('<li class="text-danger p-2"><i class="fas fa-exclamation-triangle"></i>&nbsp;Erro ao carregar liturgias.</li>');
        });
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

/* ── NOVA LITURGIA ──────────────────────────────────────────────────────── */

function novaLiturgia() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = ('0' + (today.getMonth() + 1)).slice(-2);
    const dd = ('0' + today.getDate()).slice(-2);

    bootbox.prompt({
        title: 'Selecione a data',
        inputType: 'date',
        value: `${yyyy}-${mm}-${dd}`,
        callback: result => {
            if (!result) return;
            const arquivo = result + '.json'; // "2026-03-01.json"
            $.post('/dados/nova-liturgia', { arquivo })
                .done(() => {
                    const data = new Date(result + 'T00:00:00.000').toLocaleDateString('pt-BR');
                    $('#listaLiturgias').prepend(
                        `<li arquivo="${arquivo}"
                onclick="marcaLI(this); abreLiturgia('${arquivo}');">
              <i class='fas fa-folder'></i>&nbsp;${data}
            </li>`
                    );
                    $('#listaLiturgias>li:first').click();
                })
                .fail(() => bootbox.alert('Erro ao criar a liturgia. Tente novamente.'));
        }
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
    const dataAtual = arquivoAtual.replace('.json', '');
    bootbox.prompt({
        title: 'Alterar data da liturgia',
        inputType: 'date',
        value: dataAtual,
        centerVertical: true,
        callback: result => {
            if (!result || result === dataAtual) return;
            const arquivoNovo = result + '.json';
            $.post('/dados/renomear-liturgia', { antigo: arquivoAtual, novo: arquivoNovo })
                .done(() => {
                    const data = new Date(result + 'T00:00:00.000').toLocaleDateString('pt-BR');
                    $(el).attr('arquivo', arquivoNovo)
                        .attr('onclick', `marcaLI(this); abreLiturgia('${arquivoNovo}');`)
                        .html(`<i class='fas fa-folder'></i>&nbsp;${data}`);
                    if (documento === arquivoAtual) documento = arquivoNovo;
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

function abreLiturgia(arquivo) {
    documento = arquivo; // apenas o nome, ex.: "2026-01-04.json"
    query('#cardCorpo').classList.add('d-none');

    // Exibe o botão de download na navbar
    document.getElementById('itemBaixar').classList.remove('d-none');

    $.getJSON('/Cultos/' + arquivo + '?' + formatDate())
        .done(retorno => {
            Liturgia = retorno;
            $('#bodyLiturgia>ul').html('');
            query('#cardLiturgia').classList.remove('d-none');
            Object.entries(Liturgia).forEach(([id, modulo]) => {
                $('#bodyLiturgia>ul').append(
                    `<li class="${modulo.tipo}"
              onclick="marcaLI(this); mostra${capitalize(modulo.tipo)}($(this).index());"
              id="M${id}">${modulo.titulo}</li>`
                );
            });
        })
        .fail(() => bootbox.alert('Erro ao carregar a liturgia.'));
}

/* ── NOVA SELEÇÃO ───────────────────────────────────────────────────────── */

function novaSelecao(tipo) {
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

/* ── MOVIMENTAÇÃO ───────────────────────────────────────────────────────── */

function movimentacao() {
    const codigo = $('#bodyLiturgia>ul>li.bg-warning').index();
    $('#up').attr('disabled', true);
    $('#down').attr('disabled', true);
    if (codigo >= 0) {
        if (codigo > 0) $('#up').attr('disabled', false);
        if (codigo < Liturgia.length - 1) $('#down').attr('disabled', false);
    }
}

function up() {
    const codigo = $('#bodyLiturgia>ul>li.bg-warning').index();
    const items = queryAll('#bodyLiturgia>ul>li');
    items[codigo].parentNode.insertBefore(items[codigo], items[codigo - 1]);
    [Liturgia[codigo - 1], Liturgia[codigo]] = [Liturgia[codigo], Liturgia[codigo - 1]];
    $.post('/dados/salvar-liturgia', { arquivo: documento, data: JSON.stringify(Liturgia) })
        .always(() => { $('#bodyLiturgia>ul>li:eq(' + (codigo - 1) + ')').click(); });
}

function down() {
    const codigo = $('#bodyLiturgia>ul>li.bg-warning').index();
    const items = queryAll('#bodyLiturgia>ul>li');
    items[codigo].parentNode.insertBefore(items[codigo + 1], items[codigo]);
    [Liturgia[codigo], Liturgia[codigo + 1]] = [Liturgia[codigo + 1], Liturgia[codigo]];
    $.post('/dados/salvar-liturgia', { arquivo: documento, data: JSON.stringify(Liturgia) })
        .always(() => { $('#bodyLiturgia>ul>li:eq(' + (codigo + 1) + ')').click(); });
}

/* ── SALVAR / EXCLUIR ───────────────────────────────────────────────────── */

function salvar() {
    let item;
    try {
        item = JSON.parse($('#final').val());
    } catch (e) {
        bootbox.alert('JSON inválido. Corrija o conteúdo antes de salvar.');
        return;
    }
    const codigo = $('#bodyLiturgia>ul>li.bg-warning').index();
    if (codigo >= 0) {
        Liturgia[codigo] = item;
        const el = query('#bodyLiturgia>ul>li.bg-warning');
        if (el) el.textContent = item.titulo;
    } else {
        Liturgia.push(item);
        const idx = Liturgia.length - 1;
        $('#bodyLiturgia>ul').append(
            `<li class="${item.tipo}"
          onclick="marcaLI(this); mostra${capitalize(item.tipo)}($(this).index());"
          id="M${idx}">${item.titulo}</li>`
        );
        $('#bodyLiturgia>ul>li:eq(' + idx + ')').click();
    }
    $.post('/dados/salvar-liturgia', { arquivo: documento, data: JSON.stringify(Liturgia) })
        .done(() => mostrarToast('<i class="fas fa-check-circle"></i>&nbsp;Salvo!'));
}

function excluir() {
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
    movimentacao();
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
   MENSAGEM
   ──────────────────────────────────────────────────────────────────────── */

function mostraMensagem(codigo) {
    codigo = codigo ?? $('#bodyLiturgia>ul>li.bg-warning').index();
    movimentacao();
    let mensagem = (codigo >= 0)
        ? $.passarObjeto(Liturgia[codigo])
        : { tipo: 'mensagem', titulo: '', passagem: '', topicos: [], texto: [] };

    $.post('/formularios/mensagem', { mensagem: JSON.stringify(mensagem) })
        .done(formulario => {
            $('#bodyCorpo>*:not(#botoesLiturgia)').remove();
            query('#bodyCorpo').insertAdjacentHTML('afterbegin', formulario);
        })
        .always(() => {
            query('#headerCorpo>titulo').innerHTML = "<i class='fas fa-cross'></i>" + mensagem.titulo;
            query('#cardCorpo').classList.remove('d-none');
            $('#titulo').val(mensagem.titulo);
            $('#passagem').val(mensagem.passagem);
            $('#final').text(JSON.stringify(mensagem, undefined, 4));
            $('#originalMsg').val('');
            mensagem.topicos.forEach(l => {
                $('#originalMsg').val($('#originalMsg').val() + l.replace(/<br[/]>/gi, '\n') + '\n');
            });
            $('#originalPas').val('');
            mensagem.texto.forEach(l => {
                $('#originalPas').val($('#originalPas').val() + '[' + l.replace('.', ']').replace(/<br[/]>/gi, '\n') + '\n');
            });
            $('#excluir').toggleClass('d-none', codigo < 0);
        });
}

function arrumarMensagem() {
    let mensagem = {
        tipo: 'mensagem',
        titulo: $('#titulo').val(),
        passagem: $('#passagem').val(),
        topicos: [],
        texto: []
    };
    $('#originalMsg').val().replace(/\n/g, '|').split('|')
        .forEach(l => { if (l.trim()) mensagem.topicos.push(l); });
    $('#originalPas').val().trim().replace(/]/g, '.').replace(/\n/g, '').split('[')
        .forEach(p => { if (p.trim()) mensagem.texto.push(p.trim()); });
    $('#final').val(JSON.stringify(mensagem, undefined, 4));
}

/* ────────────────────────────────────────────────────────────────────────
   HINO
   ──────────────────────────────────────────────────────────────────────── */

function mostraHino(codigo) {
    codigo = codigo ?? $('#bodyLiturgia>ul>li.bg-warning').index();
    if (codigo < 0) { hinoLocal(); return; }
    movimentacao();
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

function arrumarHino() {
    // Mantido para compatibilidade; não mais chamado pela UI de hino
    let hino = { tipo: 'hino', titulo: $('#tituloHino').text(), letra: [] };
    const div = document.getElementById('letraHino');
    if (div) {
        div.querySelectorAll('p').forEach(p => {
            const refrao = p.classList.contains('fst-italic');
            const l = p.innerHTML.replace(/<br>/gi, '\n').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
            hino.letra.push((refrao ? 'refrao:' : '') + l);
        });
    }
    $('#final').val(JSON.stringify(hino, undefined, 4));
}

/* ────────────────────────────────────────────────────────────────────────
   HINÁRIO — navegação e preenchimento automático de hinos
   ──────────────────────────────────────────────────────────────────────── */

/** Carrega a lista de hinários e inicializa com HNC como padrão. */
function hinarioCarregarLista() {
    if (!$('#selHinario').length) return;
    $.get('/hinario/lista')
        .done(lista => {
            const sel = $('#selHinario').empty();
            lista.forEach(h => {
                $('<option>').val(h.codigo).text(h.nome)
                    .prop('selected', h.codigo === 'HNC')
                    .appendTo(sel);
            });
            hinarioBuscar();
        })
        .fail(() => mostrarToast('Erro ao carregar hinários', 'danger'));
}

/** Busca hinos pelo texto ou número digitado no campo de busca. */
function hinarioBuscar() {
    const hinario = $('#selHinario').val();
    const q = $('#buscarHino').val().trim();
    if (!hinario) return;
    $.get('/hinario/buscar', { hinario, q })
        .done(resultados => {
            const ul = $('#resultadosHino').empty();
            if (!resultados.length) {
                $('<li class="list-group-item list-group-item-secondary py-1">').text('Nenhum resultado').appendTo(ul);
                return;
            }
            resultados.forEach(h => {
                $('<li class="list-group-item list-group-item-action py-1">')
                    .text(h.tituloForm)
                    .on('click', () => hinarioSelecionarHino(h.id))
                    .appendTo(ul);
            });
        })
        .fail(() => mostrarToast('Erro ao buscar hinos', 'danger'));
}

/** Carrega a letra completa do hino e preenche #titulo e #original. */
function hinarioSelecionarHino(id) {
    const hinario = $('#selHinario').val();
    $.get('/hinario/hino', { hinario, id })
        .done(hino => {
            $('#titulo').val(hino.tituloForm);
            $('#original').val('');
            hino.letra.forEach(l => {
                $('#original').val($('#original').val() + l.replace(/\{it\}|\{\/it\}/g, '').replace(/<br[/]>/gi, '\n') + '\n\n');
            });
            arrumarHino();
            $('#resultadosHino').empty();
        })
        .fail(() => mostrarToast('Erro ao carregar letra do hino', 'danger'));
}

/* ────────────────────────────────────────────────────────────────────────
   LOUVOR
   ──────────────────────────────────────────────────────────────────────── */

function mostraLouvor(codigo) {
    codigo = codigo ?? $('#bodyLiturgia>ul>li.bg-warning').index();
    movimentacao();
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
            $('#titulo').val(louvor.titulo);
            $('#final').text(JSON.stringify(louvor, undefined, 4));
            $('#original').val('');
            louvor.letra.forEach(l => {
                $('#original').val($('#original').val() + l.replace(/\{it\}|\{\/it\}/g, '').replace(/<br[/]>/gi, '\n') + '\n\n');
            });
            $('#excluir').toggleClass('d-none', codigo < 0);
        });
}

function arrumarLouvor() {
    let louvor = { tipo: 'louvor', titulo: $('#titulo').val(), letra: [] };
    $('#original').val().replace(/\n\n/g, '|').replace(/\n/g, '<br/>').split('|')
        .forEach(l => { if (l.trim()) louvor.letra.push(l); });
    $('#final').val(JSON.stringify(louvor, undefined, 4));
}

function pesquisarLouvor(titulo) {
    $.post('/formularios/pesquisar-louvor', { titulo })
        .done(formulario => {
            bootbox.dialog({
                title: 'Pesquisar louvor',
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
                                $('#original').val($('#letra').val());
                                arrumarLouvor();
                            }
                        }
                    }
                }
            })
                .bind('shown.bs.modal', function () { $('body').addClass('modal-open'); $(this).find('[autofocus]').focus(); })
                .bind('hidden.bs.modal', function () { $('body').removeClass('modal-open'); });
        });
}

function pesquisaMusica(titulo) {
    $.getJSON('https://api.vagalume.com.br/search.mus?q=' + encodeURIComponent(titulo) + '&apikey=c1563d6845dc6623fe573ef39989d329')
        .done(musicas => {
            $('#listaMusicas').html('');
            const docs = musicas?.response?.docs;
            if (!docs || !docs.length) {
                $('#listaMusicas').html('<li class="text-muted p-1">Nenhum resultado encontrado.</li>');
            } else {
                Object.values(docs).forEach(musica => {
                    $('#listaMusicas').append(
                        `<li id="${musica.id}" title="${musica.title}, ${musica.band}">${musica.title}, ${musica.band}</li>`
                    );
                });
                $('#listaMusicas>li').off('click').on('click', function () {
                    $.getJSON('https://api.vagalume.com.br/search.php?musid=' + $(this).attr('id') + '&apikey=c1563d6845dc6623fe573ef39989d329')
                        .done(musica => {
                            $('#pesquisaTitulo').val(musica.mus[0].name);
                            $('#letra').val(musica.mus[0].text);
                        })
                        .fail(() => bootbox.alert('Erro ao carregar a letra.'));
                });
            }
            $('#mostrarMusicas').removeClass('d-none').css('display', 'grid');
        })
        .fail(() => {
            $('#listaMusicas').html('<li class="text-danger p-1"><i class="fas fa-exclamation-triangle"></i>&nbsp;Erro na busca. Verifique a conexão.</li>');
            $('#mostrarMusicas').removeClass('d-none').css('display', 'grid');
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
                        Liturgia.push(salvar);
                        const codigo = Liturgia.length - 1;
                        $('#bodyLiturgia>ul').append(
                            `<li class="${salvar.tipo}"
                  onclick="marcaLI(this); mostra${capitalize(salvar.tipo)}($(this).index());"
                  id="M${codigo}">${salvar.titulo}</li>`
                        );
                        $('#bodyLiturgia>ul>li:eq(' + codigo + ')').click();
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
                    louvor.letra.forEach(linha => { el.innerHTML += linha + '<br><br>'; });
                    query('.botaoOK').classList.remove('disabled');
                });
                $(this).find('[autofocus]').focus().select();
            })
            .bind('hidden.bs.modal', function () { $('body').removeClass('modal-open'); });
    });
}

function hinoAlterar() {
    const codigo = $('#bodyLiturgia>ul>li.bg-warning').index();
    if (codigo >= 0) hinoLocal(codigo);
}

function passagemAlterar() {
    const codigo = $('#bodyLiturgia>ul>li.bg-warning').index();
    if (codigo >= 0) passagemEscolher(codigo);
}

/* ────────────────────────────────────────────────────────────────────────
   PASSAGEM — modal de seleção bíblica
   ──────────────────────────────────────────────────────────────────────── */

function pmCarregarLivros() {
    const versao = $('#pmSelVersao').val();
    $.get('/biblia/livros', { versao }).done(livros => {
        const sel = $('#pmSelLivro').empty().append('<option value="">Livro…</option>');
        livros.forEach(l => $('<option>').val(l.id).text(l.name).appendTo(sel));
        $('#pmCapDe, #pmCapAte').val('').attr({ min: 1, max: '', placeholder: 'cap.' });
        $('#pmVDe,  #pmVAte').val('').attr({ min: 1, max: '', placeholder: 'vers.' });
    });
}

function pmCarregarCapitulos() {
    const versao = $('#pmSelVersao').val();
    const livro = $('#pmSelLivro').val();
    if (!livro) return;
    $.get('/biblia/capitulos', { versao, livro }).done(({ total }) => {
        const hint = `1–${total}`;
        $('#pmCapDe').attr({ min: 1, max: total, placeholder: hint }).val(1);
        $('#pmCapAte').attr({ min: 1, max: total, placeholder: hint }).val(total);
        $('#pmVDe, #pmVAte').val('').attr({ min: 1, max: '', placeholder: 'vers.' });
        pmCarregarVersos('inicio');
        pmCarregarVersos('fim');
    });
}

function pmCarregarVersos(qual) {
    const versao = $('#pmSelVersao').val();
    const livro = $('#pmSelLivro').val();
    const capitulo = qual === 'inicio' ? $('#pmCapDe').val() : $('#pmCapAte').val();
    const $inp = qual === 'inicio' ? $('#pmVDe') : $('#pmVAte');
    if (!livro || !capitulo) return;
    $.get('/biblia/versiculos-count', { versao, livro, capitulo }).done(({ total }) => {
        const hint = `1–${total}`;
        $inp.attr({ min: 1, max: total, placeholder: hint });
        $inp.val(qual === 'inicio' ? 1 : total);
    });
}

/** Valida e corrige campos numéricos de cap/v para garantir De ≤ Até e limites. */
function pmValidar(origem) {
    const maxCap = Number($('#pmCapDe').attr('max')) || 999;
    let capDe = Math.min(Math.max(Number($('#pmCapDe').val()) || 1, 1), maxCap);
    let capAte = Math.min(Math.max(Number($('#pmCapAte').val()) || 1, 1), maxCap);

    if (origem === 'capDe' && capAte < capDe) { capAte = capDe; $('#pmCapAte').val(capAte); }
    if (origem === 'capAte' && capAte < capDe) { capDe = capAte; $('#pmCapDe').val(capDe); }
    $('#pmCapDe').val(capDe);
    $('#pmCapAte').val(capAte);

    // Recarrega versos do lado que mudou o capítulo
    if (origem === 'capDe') pmCarregarVersos('inicio');
    if (origem === 'capAte') pmCarregarVersos('fim');

    // Valida versículos quando o capítulo é o mesmo
    const maxVDe = Number($('#pmVDe').attr('max')) || 999;
    const maxVAte = Number($('#pmVAte').attr('max')) || 999;
    let vDe = Math.min(Math.max(Number($('#pmVDe').val()) || 1, 1), maxVDe);
    let vAte = Math.min(Math.max(Number($('#pmVAte').val()) || 1, 1), maxVAte);

    if (capDe === capAte) {
        if (origem === 'vDe' && vAte < vDe) { vAte = vDe; $('#pmVAte').val(vAte); }
        if (origem === 'vAte' && vAte < vDe) { vDe = vAte; $('#pmVDe').val(vDe); }
    }
    $('#pmVDe').val(vDe);
    $('#pmVAte').val(vAte);
}

function pmBuscar() {
    const versao = $('#pmSelVersao').val();
    const livro = $('#pmSelLivro').val();
    const capInicio = $('#pmCapDe').val();
    const capFim = $('#pmCapAte').val() || capInicio;
    const inicio = $('#pmVDe').val();
    const fim = $('#pmVAte').val();
    if (!livro || !capInicio) { mostrarToast('Selecione livro e capítulo', 'warning'); return; }
    $.get('/biblia/versiculos', { versao, livro, capInicio, capFim, inicio, fim })
        .done(({ livro: nomeLivro, versiculos }) => {
            let tituloRef;
            if (capInicio === capFim || !capFim) {
                tituloRef = `${nomeLivro} ${capInicio}`;
                if (inicio && fim && inicio !== fim) tituloRef += `:${inicio}-${fim}`;
                else if (inicio) tituloRef += `:${inicio}`;
            } else {
                tituloRef = `${nomeLivro} ${capInicio}:${inicio || 1}-${capFim}:${fim || '?'}`;
            }
            $('#pmTitulo').val(tituloRef);
            let original = '';
            versiculos.forEach(v => { original += `[${nomeLivro}.${v.chapter}.${v.verse}] ${v.text}\n`; });
            $('#pmOriginal').val(original.trim());
        })
        .fail(() => mostrarToast('Erro ao buscar versículos', 'danger'));
}

function passagemEscolher(codigoReplace) {
    const html = /* html */`
<div style="height:60vh;display:grid;grid-template-rows:auto auto auto 1fr;gap:.3rem;">
  <div class="input-group input-group-sm">
    <select id="pmSelVersao" class="form-select" style="max-width:11rem;">
      <option value="ARA">Carregando versões…</option>
    </select>
    <select id="pmSelLivro" class="form-select">
      <option value="">Livro…</option>
    </select>
  </div>
  <div class="input-group input-group-sm">
    <span class="input-group-text">De</span>
    <input type="number" id="pmCapDe" class="form-control" placeholder="cap."
      min="1" title="Capítulo inicial" style="max-width:5.5rem;">
    <input type="number" id="pmVDe" class="form-control" placeholder="vers."
      min="1" title="Versículo inicial" style="max-width:5.5rem;">
    <span class="input-group-text">Até</span>
    <input type="number" id="pmCapAte" class="form-control" placeholder="cap."
      min="1" title="Capítulo final" style="max-width:5.5rem;">
    <input type="number" id="pmVAte" class="form-control" placeholder="vers."
      min="1" title="Versículo final" style="max-width:5.5rem;">
    <button class="btn btn-primary" id="pmBtnBuscar" title="Buscar versículos">
      <i class="fas fa-search me-1"></i>Buscar
    </button>
  </div>
  <input type="text" id="pmTitulo" class="form-control form-control-sm"
    placeholder="Referência" style="background:bisque;" readonly>
  <textarea id="pmOriginal" class="form-control" style="resize:none;"
    placeholder="Selecione o livro, capítulo e versículos acima…" readonly></textarea>
</div>`;

    bootbox.dialog({
        title: 'Selecione a passagem',
        message: html,
        onEscape: true,
        closeButton: true,
        backdrop: true,
        className: 'p-0',
        size: 'extra-large',
        centerVertical: true,
        buttons: {
            ok: {
                label: 'Ok',
                className: 'btn-info disabled botaoOK',
                callback: () => {
                    const passagem = arrumarPassagem($('#pmOriginal').val(), $('#pmTitulo').val());
                    if (!passagem.titulo || !passagem.texto.length) return false;
                    if (codigoReplace >= 0) {
                        Liturgia[codigoReplace] = passagem;
                        $('#bodyLiturgia>ul>li:eq(' + codigoReplace + ')').text(passagem.titulo);
                        mostraPassagem(codigoReplace);
                        $.post('/dados/salvar-liturgia', { arquivo: documento, data: JSON.stringify(Liturgia) })
                            .done(() => mostrarToast('<i class="fas fa-check-circle"></i>&nbsp;Passagem atualizada!'));
                    } else {
                        Liturgia.push(passagem);
                        const idx = Liturgia.length - 1;
                        $('#bodyLiturgia>ul').append(
                            `<li class="passagem"
                  onclick="marcaLI(this); mostraPassagem($(this).index());"
                  id="M${idx}">${passagem.titulo}</li>`
                        );
                        $('#bodyLiturgia>ul>li:eq(' + idx + ')').click();
                        $.post('/dados/salvar-liturgia', { arquivo: documento, data: JSON.stringify(Liturgia) })
                            .done(() => mostrarToast('<i class="fas fa-check-circle"></i>&nbsp;Passagem adicionada!'));
                    }
                }
            }
        }
    })
        .bind('shown.bs.modal', function () {
            $('body').addClass('modal-open');
            $('#pmSelVersao').on('change', pmCarregarLivros);
            $('#pmSelLivro').on('change', pmCarregarCapitulos);
            $('#pmCapDe').on('change', () => pmValidar('capDe'));
            $('#pmCapAte').on('change', () => pmValidar('capAte'));
            $('#pmVDe').on('change', () => pmValidar('vDe'));
            $('#pmVAte').on('change', () => pmValidar('vAte'));
            $('#pmCapDe, #pmCapAte, #pmVDe, #pmVAte').on('focus', function () { this.select(); });
            $('#pmBtnBuscar').on('click', pmBuscar);
            $.get('/biblia/versoes').done(versoes => {
                const sel = $('#pmSelVersao').empty();
                versoes.forEach(v => $('<option>').val(v.codigo).text(v.nome)
                    .prop('selected', v.codigo === 'ARA').appendTo(sel));
                pmCarregarLivros();
            });
            // habilita OK assim que houver texto buscado
            $('#pmBtnBuscar').on('click.ok', () => setTimeout(() => {
                if ($('#pmOriginal').val().trim()) query('.botaoOK').classList.remove('disabled');
            }, 400));
        })
        .bind('hidden.bs.modal', function () { $('body').removeClass('modal-open'); });
}

function hinoLocal(codigoReplace) {
    let hinoSel = null;

    const html = /* html */`
<hinos style="display:grid;grid-template-columns:42% 1fr;column-gap:.25rem;height:70vh;">
  <pesquisa class="border-end" style="display:grid;grid-template-rows:auto 1fr auto;overflow:hidden;">
    <select id="selModalHinario" class="form-select form-select-sm border-0 border-bottom rounded-0 p-2">
      <option value="HNC">Carregando hinários…</option>
    </select>
    <ul id="listaHinos" class="ulMenu selecionavel w-100 p-1"
      style="overflow-y:auto;margin:0;list-style:none;padding-bottom:0;"></ul>
    <div class="input-group input-group-sm border-top p-1">
      <input type="text" id="buscaHino" class="form-control" placeholder="Pesquisar por número ou título" autofocus>
      <span class="input-group-text"><i class="fa fa-search"></i></span>
    </div>
  </pesquisa>
  <mostrar style="overflow:auto;padding:.5rem;"></mostrar>
</hinos>`;

    bootbox.dialog({
        title: 'Selecione o hino',
        message: html,
        onEscape: true,
        closeButton: true,
        backdrop: true,
        className: 'p-0',
        size: 'extra-large',
        centerVertical: true,
        buttons: {
            ok: {
                label: 'Ok',
                className: 'btn-info disabled botaoOK',
                callback: () => {
                    if (!hinoSel) return false;
                    const item = { tipo: 'hino', titulo: hinoSel.tituloForm, letra: hinoSel.letra };
                    if (codigoReplace >= 0) {
                        Liturgia[codigoReplace] = item;
                        $('#bodyLiturgia>ul>li:eq(' + codigoReplace + ')').text(item.titulo);
                        mostraHino(codigoReplace);
                        $.post('/dados/salvar-liturgia', { arquivo: documento, data: JSON.stringify(Liturgia) })
                            .done(() => mostrarToast('<i class="fas fa-check-circle"></i>&nbsp;Hino atualizado!'));
                    } else {
                        Liturgia.push(item);
                        const idx = Liturgia.length - 1;
                        $('#bodyLiturgia>ul').append(
                            `<li class="hino"
              onclick="marcaLI(this); mostraHino($(this).index());"
              id="M${idx}">${item.titulo}</li>`
                        );
                        $('#bodyLiturgia>ul>li:eq(' + idx + ')').click();
                        $.post('/dados/salvar-liturgia', { arquivo: documento, data: JSON.stringify(Liturgia) })
                            .done(() => mostrarToast('<i class="fas fa-check-circle"></i>&nbsp;Hino adicionado!'));
                    }
                }
            }
        }
    })
        .bind('shown.bs.modal', function () {
            $('body').addClass('modal-open');

            function carregarLista(hinario, q) {
                $.get('/hinario/buscar', { hinario, q: q || '' }).then(hinos => {
                    const ul = $('#listaHinos').empty();
                    hinos.forEach(h => {
                        $('<li>').attr('codigo', h.id).text(h.tituloForm).appendTo(ul);
                    });
                    ul.find('li').on('click', function () {
                        marcaLI(this);
                        const id = $(this).attr('codigo');
                        const hinario = $('#selModalHinario').val();
                        $.get('/hinario/hino', { hinario, id }).then(hino => {
                            hinoSel = hino;
                            const el = query('mostrar');
                            el.innerHTML = `<h2>${hino.tituloForm}</h2><hr class="p-0 m-0 mt-1 mb-1">`;
                            hino.letra.forEach(linha => { el.innerHTML += linha + '<br><br>'; });
                            query('.botaoOK').classList.remove('disabled');
                        });
                    });
                });
            }

            $.get('/hinario/lista').then(lista => {
                const sel = $('#selModalHinario').empty();
                lista.forEach(h => sel.append(`<option value="${h.codigo}">${h.nome}</option>`));
                sel.val('HNC');
                carregarLista('HNC', '');
            });

            $('#selModalHinario').on('change', function () {
                hinoSel = null;
                query('mostrar').innerHTML = '';
                query('.botaoOK').classList.add('disabled');
                carregarLista($(this).val(), $('#buscaHino').val());
            });

            $('#buscaHino').on('input', function () {
                carregarLista($('#selModalHinario').val(), $(this).val());
            }).focus().select();
        })
        .bind('hidden.bs.modal', function () { $('body').removeClass('modal-open'); });
}
