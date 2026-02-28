/**
 * capa.js — módulo de liturgia adaptado para Express (Node.js)
 *
 * Adaptações em relação ao original PHP:
 *  - inicio() carrega a lista de cultos via GET /cultos
 *  - Todas as chamadas a Dados/*.php → /dados/*
 *  - Todas as chamadas a formularios/*.php → /formularios/*
 *  - Sem iframe: baixarArquivo() acessa Liturgia diretamente
 *  - documento agora guarda apenas o nome do arquivo (ex.: "2026-01-04.json")
 */

window.onload = inicio;
var Liturgia = [], documento;

/* ── INICIALIZAÇÃO ──────────────────────────────────────────────────────── */

function inicio() {
    $.getJSON('/cultos')
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
            console.error('Não foi possível carregar a lista de cultos.');
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
                })
                .always(() => {
                    $('#listaLiturgias>li:first').click();
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

    $.getJSON('/cultos/' + arquivo + '?' + formatDate())
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
        });
}

/* ── NOVA SELEÇÃO ───────────────────────────────────────────────────────── */

function novaSelecao(tipo) {
    queryAll('#bodyLiturgia>ul>li.bg-warning')
        .forEach(el => el.classList.remove('bg-warning'));
    eval('mostra' + tipo + '();');
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
    const salvar = JSON.parse($('#final').val());
    const codigo = $('#bodyLiturgia>ul>li.bg-warning').index();
    if (codigo >= 0) {
        Liturgia[codigo] = salvar;
        const el = query('#bodyLiturgia>ul>li.bg-warning');
        if (el) el.innerHTML = salvar.titulo;
    } else {
        Liturgia.push(salvar);
        const idx = Object.keys(Liturgia).length - 1;
        $('#bodyLiturgia>ul').append(
            `<li class="${salvar.tipo}"
          onclick="marcaLI(this); mostra${capitalize(salvar.tipo)}(${idx});"
          id="M${idx}">${salvar.titulo}</li>`
        );
        $('#bodyLiturgia>ul>li:eq(' + idx + ')').click();
    }
    $.post('/dados/salvar-liturgia', { arquivo: documento, data: JSON.stringify(Liturgia) });
}

function excluir() {
    const codigo = $('#bodyLiturgia>ul>li.bg-warning').index();
    Liturgia.splice(codigo, 1);
    $('#bodyLiturgia>ul>li.bg-warning').remove();
    $.post('/dados/salvar-liturgia', { arquivo: documento, data: JSON.stringify(Liturgia) });
    $('#cardCorpo').addClass('d-none');
}

/* ────────────────────────────────────────────────────────────────────────
   PASSAGEM
   ──────────────────────────────────────────────────────────────────────── */

function mostraPassagem(codigo) {
    codigo = codigo ?? $('#bodyLiturgia>ul>li.bg-warning').index();
    movimentacao();
    let passagem = (codigo >= 0)
        ? $.passarObjeto(Liturgia[codigo])
        : { tipo: 'passagem', titulo: '', texto: [] };

    $.post('/formularios/passagem', { passagem: JSON.stringify(passagem) })
        .done(formulario => {
            $('#bodyCorpo>*:not(#botoesLiturgia)').remove();
            query('#bodyCorpo').insertAdjacentHTML('afterbegin', formulario);
        })
        .always(() => {
            query('#headerCorpo>titulo').innerHTML = "<i class='fas fa-bible'></i>" + passagem.titulo;
            query('#cardCorpo').classList.remove('d-none');
            $('#titulo').val(passagem.titulo);
            $('#final').text(JSON.stringify(passagem, undefined, 4));
            $('#original').val('');
            passagem.texto.forEach(linha => {
                $('#original').val($('#original').val() + '[' + linha.replace('.', ']').replace(/<br[/]>/gi, '\n') + '\n');
            });
            $('#excluir').toggleClass('d-none', codigo < 0);
        });
}

function arrumarPassagem() {
    let texto = $('#original').val().trim().replace(/]/g, '.').replace(/\n/g, ' ').split('[');
    let partes = [];
    texto.forEach(p => { if (p.trim()) partes.push('"' + p.trim() + '"'); });
    let trecho = {
        tipo: 'passagem',
        titulo: $('#titulo').val(),
        texto: JSON.parse('[' + partes.join(',') + ']')
    };
    $('#final').val(JSON.stringify(trecho, undefined, 4));
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
    movimentacao();
    let hino = (codigo >= 0)
        ? $.passarObjeto(Liturgia[codigo])
        : { tipo: 'hino', titulo: '', letra: [] };

    $.post('/formularios/hino', { hino: JSON.stringify(hino) })
        .done(formulario => {
            $('#bodyCorpo>*:not(#botoesLiturgia)').remove();
            query('#bodyCorpo').insertAdjacentHTML('afterbegin', formulario);
        })
        .always(() => {
            query('#headerCorpo>titulo').innerHTML = "<i class='fas fa-music'></i>" + hino.titulo;
            query('#cardCorpo').classList.remove('d-none');
            $('#titulo').val(hino.titulo);
            $('#final').text(JSON.stringify(hino, undefined, 4));
            $('#original').val('');
            hino.letra.forEach(l => {
                $('#original').val($('#original').val() + l.replace(/<br[/]>/gi, '\n') + '\n\n');
            });
            $('#excluir').toggleClass('d-none', codigo < 0);
        });
}

function arrumarHino() {
    let hino = { tipo: 'hino', titulo: $('#titulo').val(), letra: [] };
    $('#original').val().replace(/\n\n/g, '|').replace(/\n/g, '<br/>').split('|')
        .forEach(l => { if (l.trim()) hino.letra.push(l); });
    $('#final').val(JSON.stringify(hino, undefined, 4));
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
                $('#original').val($('#original').val() + l.replace(/<br[/]>/gi, '\n') + '\n\n');
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
            Object.values(musicas.response.docs).forEach(musica => {
                $('#listaMusicas').append(
                    `<li id="${musica.id}" title="${musica.title}, ${musica.band}">${musica.title}, ${musica.band}</li>`
                );
            });
        })
        .always(() => {
            $('#listaMusicas>li').off('click').on('click', function () {
                $.getJSON('https://api.vagalume.com.br/search.php?musid=' + $(this).attr('id') + '&apikey=c1563d6845dc6623fe573ef39989d329')
                    .done(musica => {
                        $('#pesquisaTitulo').val(musica.mus[0].name);
                        $('#letra').val(musica.mus[0].text);
                    });
            });
            $('#mostrarMusicas').removeClass('d-none').css('display', 'grid');
        });
}

/* ────────────────────────────────────────────────────────────────────────
   EXTRA
   ──────────────────────────────────────────────────────────────────────── */

function mostraExtra(codigo) {
    codigo = codigo ?? $('#bodyLiturgia>ul>li.bg-warning').index();
    movimentacao();
    let extra = (codigo >= 0)
        ? $.passarObjeto(Liturgia[codigo])
        : { tipo: 'extra', titulo: 'Extra', imagens: [], videos: [] };

    $.post('/formularios/extra', { extra: JSON.stringify(extra) })
        .done(formulario => {
            $('#bodyCorpo>*:not(#botoesLiturgia)').remove();
            query('#bodyCorpo').insertAdjacentHTML('afterbegin', formulario);
        })
        .always(() => {
            query('#cardCorpo').classList.remove('d-none');
            $('#final').text(JSON.stringify(extra, undefined, 4));
            $('#originalImagem').val('');
            extra.imagens.forEach(l => {
                $('#originalImagem').val($('#originalImagem').val() + JSON.stringify(l).replace(/<br[/]>/gi, '\n') + '\n');
            });
            $('#originalVideo').val('');
            extra.videos.forEach(l => {
                $('#originalVideo').val($('#originalVideo').val() + JSON.stringify(l).replace(/<br[/]>/gi, '\n') + '\n');
            });
            $('#excluir').toggleClass('d-none', codigo < 0);
        });
}

function arrumarExtra() {
    let extra = { tipo: 'extra', titulo: 'Extra', imagens: [], videos: [] };
    $('#originalImagem').val().replace(/\n/g, '|').split('|')
        .forEach(l => { if (l.trim()) { try { extra.imagens.push(JSON.parse(l)); } catch (_) { } } });
    $('#originalVideo').val().replace(/\n/g, '|').split('|')
        .forEach(l => { if (l.trim()) { try { extra.videos.push(JSON.parse(l)); } catch (_) { } } });
    $('#final').val(JSON.stringify(extra, undefined, 4));
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
                        const salvar = retorno.louvores[idx];
                        Liturgia.push(salvar);
                        const codigo = Object.keys(Liturgia).length - 1;
                        $('#bodyLiturgia>ul').append(
                            `<li class="${salvar.tipo}"
                  onclick="marcaLI(this); mostra${capitalize(salvar.tipo)}(${codigo});"
                  id="${codigo}">${salvar.titulo}</li>`
                        );
                        $('#bodyLiturgia>ul>li:eq(' + codigo + ')').click();
                        $.post('/dados/salvar-liturgia', { arquivo: documento, data: JSON.stringify(Liturgia) });
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

function hinoLocal() {
    $.get('/formularios/pesquisar-hino-local').then(retorno => {
        bootbox.dialog({
            title: 'Selecione o hino',
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
                    callback: () => { novaSelecao('Hino'); }
                },
                ok: {
                    label: 'Ok',
                    className: 'btn-info disabled botaoOK',
                    callback: () => {
                        const idx = $('#hinos>li.bg-warning').attr('codigo');
                        const salvar = retorno.hinos[idx];
                        Liturgia.push(salvar);
                        const codigo = Object.keys(Liturgia).length - 1;
                        $('#bodyLiturgia>ul').append(
                            `<li class="${salvar.tipo}"
                  onclick="marcaLI(this); mostra${capitalize(salvar.tipo)}(${codigo});"
                  id="${codigo}">${salvar.titulo}</li>`
                        );
                        $('#bodyLiturgia>ul>li:eq(' + codigo + ')').click();
                        $.post('/dados/salvar-liturgia', { arquivo: documento, data: JSON.stringify(Liturgia) });
                    }
                }
            }
        })
            .bind('shown.bs.modal', function () {
                $('body').addClass('modal-open');
                $('#hinos>li').off('click').on('click', function () {
                    marcaLI(this);
                    const hino = retorno.hinos[$(this).attr('codigo')];
                    const el = query('mostrar');
                    el.innerHTML = `<h2>${hino.titulo}</h2><hr class="p-0 m-0 mt-1 mb-1">`;
                    hino.letra.forEach(linha => { el.innerHTML += linha + '<br><br>'; });
                    query('.botaoOK').classList.remove('disabled');
                });
                $(this).find('[autofocus]').focus().select();
            })
            .bind('hidden.bs.modal', function () { $('body').removeClass('modal-open'); });
    });
}
