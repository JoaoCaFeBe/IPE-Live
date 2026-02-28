/**
 * Base.js — Lógica compartilhada entre as telas de exibição
 * (Projetor, Televisão, Legendas, LegendasAoVivo)
 *
 * Cada tela deve definir `window.telaCfg` antes de carregar este arquivo,
 * ou chamar `inicializarTela(config)` após o carregamento.
 *
 * Configuração (telaCfg):
 *   elementoConteudo : 'corpo' | 'rodape'   — elemento filho para louvor/passagem
 *   temAlerta        : true | false          — exibir alertas via bootbox
 *   delayEventos     : 0 | 1500             — delay no processamento de eventos
 *   limparNaMensagem : true | false          — limpar tela no obsSceneChanged='Mensagem'
 *   callbackFadeIn   : function | null       — callback após fadeIn de conteúdo
 *   aoIniciar        : function | null       — código extra executado em inicio()
 *   integracaoOBS    : true | false          — ativar integração direta com OBS
 */

var query = document.querySelector.bind(document),
    queryAll = document.querySelectorAll.bind(document),
    queryId = document.getElementById.bind(document),
    queryName = document.getElementsByName.bind(document),
    socket = io(servidor, { transports: ["polling", "websocket"] }),
    atual;

// Detecta atributo telaPrincipal no script que chamou (Projetor/Televisao)
let telaPrincipal = false;
document.querySelectorAll('script[telaPrincipal]').forEach(s => {
    if (s.getAttribute('telaPrincipal') === 'telaPrincipal') telaPrincipal = true;
});

// Configuração padrão
var telaCfg = window.telaCfg || {
    elementoConteudo: 'corpo',
    temAlerta: false,
    delayEventos: 0,
    limparNaMensagem: true,
    callbackFadeIn: null,
    aoIniciar: null,
    integracaoOBS: false
};

function inicializarTela(config) {
    telaCfg = Object.assign(telaCfg, config);
}

// -----------------------------------------------------------------------------------------
// Handlers de eventos Socket.IO
// -----------------------------------------------------------------------------------------

function _fecharJanela() {
    $('body>*:visible').fadeOut(200, function () {
        $('body>*:visible>*').html('');
    });
}

function _fecharBiblia() {
    if (atual === 'Mensagem') {
        if ($('mensagem>rodape').is(':visible')) $('mensagem>rodape').fadeOut(200);
    } else {
        _fecharJanela();
    }
}

function _alerta(args) {
    if (telaPrincipal && telaCfg.temAlerta) {
        if (!$('body').hasClass('modal-open')) {
            var dialog = bootbox.dialog({
                message: args,
                centerVertical: true,
                closeButton: false,
                className: 'bg-danger text-dark text-center',
                onShow: function () {
                    $('body').addClass('modal-open');
                    setTimeout(function () {
                        dialog.modal('hide');
                    }, 5000);
                },
                onHidden: function () {
                    $('body').removeClass('modal-open');
                }
            });
        }
    }
}

function _obsSceneChanged(args) {
    atual = args;
    if (telaCfg.limparNaMensagem || args !== 'Mensagem') {
        _fecharJanela();
    }
}

function _dadosMensagem(args) {
    $('mensagem>titulo').html(args.titulo);
    $('mensagem>corpo').html("");
    $('mensagem>corpo').append('<ol></ol>');
    args.topicos.forEach((topico, indice) => {
        $('mensagem>corpo>ol').append(`<li>${topico}</li>`);
        if (indice + 1 === args.topicos.length) $('mensagem>corpo>ol>li').fadeOut();
    });
}

function _processarEvento(eventName, args) {
    if (eventName === "fecharJanela") {
        _fecharJanela();
    } else if (eventName === "fecharBiblia") {
        _fecharBiblia();
    } else if (eventName === "Alerta") {
        _alerta(args);
    } else if (eventName === "obsSceneChanged") {
        _obsSceneChanged(args);
    } else if (eventName === "pegarDadosMensagem") {
        // ignorado nas telas
    } else if (eventName === "dadosMensagem") {
        _dadosMensagem(args);
    } else {
        processarConteudo(args);
    }
}

// -----------------------------------------------------------------------------------------
// Conexão e escuta de eventos
// -----------------------------------------------------------------------------------------

socket.on("connect", () => {
    socket.emit(empresa, "pegarDadosMensagem");
});

socket.onAny((aplicativo, eventName, args) => {
    if (aplicativo === empresa) {
        if (telaCfg.delayEventos > 0) {
            setTimeout(() => _processarEvento(eventName, args), telaCfg.delayEventos);
        } else {
            _processarEvento(eventName, args);
        }
    }
});

// -----------------------------------------------------------------------------------------
// Processamento de conteúdo (louvor, passagem, mensagem)
// -----------------------------------------------------------------------------------------

function processarConteudo(conteudo) {
    let tipo;
    if (conteudo.tipo.includes("hino") || conteudo.tipo.includes("louvor")) tipo = "louvor";
    else tipo = conteudo.tipo;

    if ((atual === 'Mensagem') && (tipo === 'passagem')) {
        tipo = 'mensagem';
        conteudo.corpo = conteudo.titulo + '.' + conteudo.corpo;
        conteudo.titulo = 'passagem';
    }

    let elem = telaCfg.elementoConteudo; // 'corpo' ou 'rodape'
    let cb = telaCfg.callbackFadeIn;     // callback opcional

    if ((tipo === 'louvor') || (tipo === 'passagem')) {
        conteudo.corpo = decodeURI(conteudo.corpo);

        new Promise((resolve) => {
            if ($(`body>${tipo}>titulo`).html() !== conteudo.titulo) {
                $(`body>${tipo}`).fadeOut(200, () => resolve(true));
            } else resolve(false);
        }).then(() => {
            return new Promise((resolve) => {
                if ($(`body>${tipo}>${elem}`).html() !== conteudo.corpo) {
                    $(`body>${tipo}>${elem}`).fadeOut(200, () => resolve(true));
                } else resolve(false);
            });
        }).then(() => {
            $(`body>*:not(${tipo})`).fadeOut(200, function () {
                $(`body>${tipo}>titulo`).html(conteudo.titulo);
                $(`body>${tipo}>${elem}`).html(conteudo.corpo);
                $(`body>${tipo}>${elem}`).fadeIn(200);
                $(`body>${tipo}`).fadeIn(200, cb);
            });
        });
    } else if (tipo === 'mensagem') {
        if ($('mensagem').css('display') === 'none') {
            $('body>*:not(mensagem)').fadeOut(200, function () {
                $('mensagem').fadeIn(200, cb);
            });
        }
        if (conteudo.titulo === 'topico') {
            if (conteudo.status === true) {
                $(`mensagem>corpo>ol>li:eq(${conteudo.indice})`).fadeIn(200);
            } else {
                $(`mensagem>corpo>ol>li:eq(${conteudo.indice})`).fadeOut(200);
            }
        } else if (conteudo.titulo === 'passagem') {
            conteudo.corpo = decodeURI(conteudo.corpo);
            if ($('mensagem>rodape').html(conteudo.corpo).css('display') === 'none') {
                $('mensagem>rodape').fadeIn(200, cb);
            }
        } else if (conteudo.titulo === 'limpaPassagem') {
            if ($('mensagem>rodape').html(conteudo.corpo).css('display') !== 'none') {
                $('mensagem>rodape').fadeOut(200, cb);
            }
        }
    }
}

// -----------------------------------------------------------------------------------------
// Inicialização
// -----------------------------------------------------------------------------------------

const inicio = () => {
    // Integração direta com OBS (Legendas)
    if (telaCfg.integracaoOBS && typeof window.obsstudio !== "undefined") {
        window.addEventListener('obsSceneChanged', function (event) {
            socket.emit(empresa, 'obsSceneChanged', event.detail.name);
            if (event.detail.name === 'Mensagem') {
                $('body>*:not(mensagem)').fadeOut(200, function () {
                    $('mensagem').fadeIn(200);
                });
            }
        });
    }

    // Scroll em dispositivos móveis
    if (/android|ipad|iphone|ipod/i.test(navigator.userAgent.toLowerCase())) {
        $('body>*:not(#mensagem)').addClass('scrollJC');
    }

    // Código extra específico da tela
    if (typeof telaCfg.aoIniciar === 'function') {
        telaCfg.aoIniciar();
    }
};
