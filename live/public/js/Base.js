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

    // Fallback conservador: desconta margens/paddings e aplica fator de segurança de 80%
    // para evitar aceitar pares de linhas que na prática causam quebra de linha
    return Math.max(0, (larguraViewport - margemX - paddingX) * 0.80);
}

function _linhaCabeNoContainer(linhaHtml, elementoAlvo, larguraMaxima) {
    if (!elementoAlvo || !larguraMaxima) return false;

    // Cria medidor DENTRO do elementoAlvo para herdar todos os estilos (fonte, tamanho, etc.)
    // naturalmente via CSS, sem precisar copiar propriedades manualmente.
    const medidor = document.createElement('span');
    medidor.style.position = 'absolute';
    medidor.style.left = '-99999px';
    medidor.style.visibility = 'hidden';
    medidor.style.whiteSpace = 'nowrap';
    medidor.style.pointerEvents = 'none';
    medidor.innerHTML = linhaHtml;
    elementoAlvo.appendChild(medidor);

    const larguraLinha = medidor.getBoundingClientRect().width;
    elementoAlvo.removeChild(medidor);

    return larguraLinha <= larguraMaxima;
}

function agruparLinhasEmPares(html, elementoAlvo) {
    if (!html || typeof html !== 'string') return html;

    // Expor temporariamente o elemento e seus ancestrais ocultos para medição precisa.
    // Usa visibility:hidden para que nada apareça na tela durante a medição.
    const ocultos = [];
    if (elementoAlvo) {
        let el = elementoAlvo;
        while (el && el !== document.body) {
            if (window.getComputedStyle(el).display === 'none') {
                ocultos.push({ el, display: el.style.display, visibility: el.style.visibility });
                el.style.display = 'block';
                el.style.visibility = 'hidden';
            }
            el = el.parentElement;
        }
    }

    const larguraMaxima = _obterLarguraUtilElemento(elementoAlvo);

    if (!larguraMaxima) {
        ocultos.forEach(({ el, display, visibility }) => { el.style.display = display; el.style.visibility = visibility; });
        return html;
    }

    const linhas = html
        .split(/<br\s*\/?\s*>/gi)
        .map(linha => linha.trim())
        .filter(linha => linha.length > 0);

    if (linhas.length < 2) {
        ocultos.forEach(({ el, display, visibility }) => { el.style.display = display; el.style.visibility = visibility; });
        return html;
    }

    const resultado = [];
    let buffer = [];

    const descarregarBuffer = () => {
        // Algoritmo sequencial: tenta juntar a linha atual com a próxima.
        // Se couber → junta e avança 2. Se não couber → linha atual fica só e
        // a próxima concorre com a subsequente na iteração seguinte.
        let i = 0;
        while (i < buffer.length) {
            if (i + 1 < buffer.length) {
                const separador = '<span class="sep-par"> · </span>';
                const linhaCombinada = `${buffer[i]}${separador}${buffer[i + 1]}`;
                if (_linhaCabeNoContainer(linhaCombinada, elementoAlvo, larguraMaxima)) {
                    resultado.push(linhaCombinada);
                    i += 2;
                } else {
                    resultado.push(buffer[i]);
                    i += 1;
                }
            } else {
                resultado.push(buffer[i]);
                i += 1;
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

    // Restaurar estado original de todos os elementos temporariamente expostos
    ocultos.forEach(({ el, display, visibility }) => { el.style.display = display; el.style.visibility = visibility; });

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
    _fecharJanela();
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
    _fecharJanela();
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
    } else {
        processarConteudo(args);
    }
}

// -----------------------------------------------------------------------------------------
// Conexão e escuta de eventos
// -----------------------------------------------------------------------------------------

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
// Processamento de conteúdo (louvor, passagem)
// -----------------------------------------------------------------------------------------

function processarConteudo(conteudo) {
    let tipo;
    if (conteudo.tipo.includes("hino") || conteudo.tipo.includes("louvor") || conteudo.tipo.includes("coral")) tipo = "louvor";
    else tipo = conteudo.tipo;

    let elem = telaCfg.elementoConteudo; // 'corpo' ou 'rodape'
    let cb = telaCfg.callbackFadeIn;     // callback opcional

    if ((tipo === 'louvor') || (tipo === 'passagem')) {
        conteudo.corpo = decodeURI(conteudo.corpo).replace(/\{st\}([^}]*)\{\/st\}/g, '<span style="color: #ffc107 !important; font-weight: bold;">$1</span>').replace(/\{it\}|\{\/it\}/g, '').trim();
        if (tipo === 'passagem') conteudo.corpo = conteudo.corpo.replace(/^[^.]+\.(\d+)\.(\d+)\.\s*/, '$1.$2. ');

        new Promise((resolve) => {
            if ($(`body>${tipo}>titulo`).html() !== conteudo.titulo) {
                $(`body>${tipo}`).fadeOut(200, () => resolve(true));
            } else resolve(false);
        }).then(() => {
            return new Promise((resolve) => {
                $(`body>${tipo}>${elem}`).fadeOut(200, () => resolve(true));
            });
        }).then(() => {
            $(`body>*:not(${tipo})`).fadeOut(200, function () {
                $(`body>${tipo}>titulo`).html(conteudo.titulo);
                // Inserir conteúdo primeiro para que a medição use o texto real
                const elementoAlvo = document.querySelector(`body>${tipo}>${elem}`);
                elementoAlvo.innerHTML = conteudo.corpo;
                if (conteudo.corpo && telaCfg.juntarLinhasEmPares) {
                    elementoAlvo.innerHTML = agruparLinhasEmPares(conteudo.corpo, elementoAlvo);
                }
                // Só exibe o elem se houver conteúdo
                if (elementoAlvo.innerHTML.trim()) {
                    $(`body>${tipo}>${elem}`).fadeIn(200);
                }
                $(`body>${tipo}`).fadeIn(200, cb);
            });
        });
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
        });
    }

    // Scroll em dispositivos móveis
    if (/android|ipad|iphone|ipod/i.test(navigator.userAgent.toLowerCase())) {
        $('body>*').addClass('scrollJC');
    }

    // Código extra específico da tela
    if (typeof telaCfg.aoIniciar === 'function') {
        telaCfg.aoIniciar();
    }
};
