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

// telaPrincipal será detectado em inicio() quando o DOM estiver completo
let telaPrincipal = false;

// Configuração padrão
var telaCfg = window.telaCfg || {
    elementoConteudo: 'corpo',
    temAlerta: false,
    delayEventos: 0,
    limparNaMensagem: true,
    callbackFadeIn: null,
    aoIniciar: null,
    integracaoOBS: false,
    juntarLinhasEmPares: false
};

function inicializarTela(config) {
    telaCfg = Object.assign(telaCfg, config);
}

function _obterLarguraUtilElemento(elementoAlvo) {
    if (!elementoAlvo) return 0;
    const estilo = window.getComputedStyle(elementoAlvo);
    const paddingX = (parseFloat(estilo.paddingLeft) || 0) + (parseFloat(estilo.paddingRight) || 0);
    const larguraUtil = elementoAlvo.clientWidth - paddingX;
    if (larguraUtil > 0) return Math.max(0, larguraUtil);

    const margemX = (parseFloat(estilo.marginLeft) || 0) + (parseFloat(estilo.marginRight) || 0);
    const larguraViewport = window.innerWidth || document.documentElement.clientWidth || 0;
    if (larguraViewport <= 0) return 0;

    return Math.max(0, (larguraViewport - margemX - paddingX) * 0.98);
}

function _linhaCabeNoContainer(linhaHtml, elementoAlvo, larguraMaxima) {
    if (!elementoAlvo || !larguraMaxima) return false;

    let medidor = document.getElementById('medidor-linha-legenda');
    if (!medidor) {
        medidor = document.createElement('span');
        medidor.id = 'medidor-linha-legenda';
        medidor.style.position = 'fixed';
        medidor.style.left = '-99999px';
        medidor.style.top = '-99999px';
        medidor.style.visibility = 'hidden';
        medidor.style.whiteSpace = 'nowrap';
        medidor.style.pointerEvents = 'none';
        document.body.appendChild(medidor);
    }

    const estilo = window.getComputedStyle(elementoAlvo);
    medidor.style.font = estilo.font;
    medidor.style.fontSize = estilo.fontSize;
    medidor.style.fontFamily = estilo.fontFamily;
    medidor.style.fontWeight = estilo.fontWeight;
    medidor.style.letterSpacing = estilo.letterSpacing;
    medidor.style.textTransform = estilo.textTransform;
    medidor.style.lineHeight = estilo.lineHeight;
    medidor.innerHTML = linhaHtml;

    const larguraLinha = medidor.getBoundingClientRect().width;
    return larguraLinha <= larguraMaxima;
}

function agruparLinhasEmPares(html, elementoAlvo) {
    if (!html || typeof html !== 'string') return html;

    const larguraMaxima = _obterLarguraUtilElemento(elementoAlvo);
    if (!larguraMaxima) return html;

    const linhas = html
        .split(/<br\s*\/?\s*>/gi)
        .map(linha => linha.trim())
        .filter(linha => linha.length > 0);

    if (linhas.length < 2) return html;

    const resultado = [];
    let buffer = [];

    const descarregarBuffer = () => {
        for (let i = 0; i < buffer.length; i += 2) {
            if (i + 1 < buffer.length) {
                const linhaCombinada = `${buffer[i]} ${buffer[i + 1]}`;
                if (_linhaCabeNoContainer(linhaCombinada, elementoAlvo, larguraMaxima)) {
                    resultado.push(linhaCombinada);
                } else {
                    resultado.push(buffer[i]);
                    resultado.push(buffer[i + 1]);
                }
            } else {
                resultado.push(buffer[i]);
            }
        }
        buffer = [];
    };

    linhas.forEach((linha) => {
        const ehLinhaCantor = /<strong[^>]*>.*?<\/strong>/i.test(linha);
        if (ehLinhaCantor) {
            descarregarBuffer();
            resultado.push(linha);
        } else {
            buffer.push(linha);
        }
    });

    descarregarBuffer();
    return resultado.join('<br/>');
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
    if (telaCfg.temAlerta) {
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
    if (args == null || typeof args !== 'object') return;
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
        conteudo.corpo = decodeURI(conteudo.corpo).replace(/\{st\}([^}]*)\{\/st\}/g, '<span style="color: #ffc107 !important; font-weight: bold;">$1</span>').trim();
        if (tipo === 'passagem') conteudo.corpo = conteudo.corpo.replace(/^[^.]+\.(\d+)\.(\d+)\.\s*/, '$1.$2. ');
        if (telaCfg.juntarLinhasEmPares) {
            const elementoAlvo = document.querySelector(`body>${tipo}>${elem}`);
            conteudo.corpo = agruparLinhasEmPares(conteudo.corpo, elementoAlvo);
        }

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
            conteudo.corpo = conteudo.corpo.replace(/^[^.]+\.(\d+)\.(\d+)\.\s*/, '$1.$2. ');
            if (telaCfg.juntarLinhasEmPares) {
                const elementoAlvo = document.querySelector('mensagem>rodape');
                conteudo.corpo = agruparLinhasEmPares(conteudo.corpo, elementoAlvo);
            }
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
    // Detecta atributo telaPrincipal agora que o DOM está completo
    document.querySelectorAll('script[telaPrincipal]').forEach(s => {
        if (s.getAttribute('telaPrincipal') === 'telaPrincipal') telaPrincipal = true;
    });

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
