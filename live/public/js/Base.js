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
 *   aoRenderizar     : function | null       — (tipo, conteudo, elementoAlvo) depois de montar o conteúdo, antes de aparecer
 *   renderizar       : function | null       — ({tipo, conteudo, corpo, referencia, vozes}) a tela desenha tudo sozinha
 *   aoLimpar         : function | null       — saída da tela que desenha sozinha (Limpar / fechar a Bíblia)
 *   fadeEntrada      : ms | undefined        — fade ao sair da tela parada (padrão: TRANSICAO)
 *   fadeSaida        : ms | undefined        — fade ao limpar a tela (padrão: 200)
 *   integracaoOBS    : true | false          — ativar integração direta com OBS
 *   referenciaExata  : true | false          — passagem mostra "Livro cap:vers" do versículo na tela, sem o número no texto
 */

// Sanitizacao de HTML recebido via Socket.IO ou consumido do Liturgia (SEC-001, SEC-013).
// Allowlist baseada nas tags realmente usadas: span (com style/class), br, strong.
var SANITIZE_CONFIG = {
    ALLOWED_TAGS: ['span', 'br', 'strong'],
    ALLOWED_ATTR: ['style', 'class']
};
function sanitizar(html) {
    if (typeof html !== 'string') return '';
    return (window.DOMPurify ? window.DOMPurify.sanitize(html, SANITIZE_CONFIG) : html);
}
// Helper de atribuicao DOM com sanitizacao obrigatoria (substitui uso direto de innerHTML).
function definirHtmlSeguro(elemento, html) {
    if (!elemento) return;
    elemento.innerHTML = sanitizar(html);
}

var query = document.querySelector.bind(document),
    queryAll = document.querySelectorAll.bind(document),
    queryId = document.getElementById.bind(document),
    queryName = document.getElementsByName.bind(document),
    socket = io(servidor, { transports: ["polling", "websocket"], auth: { token: window.SOCKET_TOKEN || "" } });

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

// Duração de cada etapa da troca no Projetor e na TV (eram 200 ms; o João pediu resposta mais rápida).
const TRANSICAO = 120;

// Limpar a tela invalida também os callbacks de uma troca ainda em animação.
let geracaoExibicao = 0;

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

// Mede um elemento que pode estar oculto (ele ou um ancestral), sem nada aparecer na tela.
function _comAncestraisVisiveis(elemento, medir) {
    const ocultos = [];
    for (let el = elemento; el && el !== document.body; el = el.parentElement) {
        if (window.getComputedStyle(el).display !== 'none') continue;
        ocultos.push({ el, display: el.style.display, visibility: el.style.visibility });
        el.style.display = '';
        if (window.getComputedStyle(el).display === 'none') el.style.display = 'block';
        el.style.visibility = 'hidden';
    }
    try { return medir(); }
    finally { ocultos.forEach(({ el, display, visibility }) => { el.style.display = display; el.style.visibility = visibility; }); }
}

// Diminui a letra até o bloco caber na fração da altura da tela, sem passar do mínimo.
function ajustarAltura(elemento, fracao, minimo = 0.5) {
    if (!elemento) return;
    elemento.style.fontSize = '';
    _comAncestraisVisiveis(elemento, () => {
        const limite = window.innerHeight * fracao;
        const base = parseFloat(window.getComputedStyle(elemento).fontSize);
        for (let escala = 0.95; elemento.getBoundingClientRect().height > limite && escala >= minimo; escala -= 0.05) {
            elemento.style.fontSize = `${base * escala}px`;
        }
    });
}

// "Louvor a Deus (NC 016)" → rótulo "Hino · Novo Cântico 16" e nome "Louvor a Deus";
// "A / B" (dois cânticos juntos) → dois nomes. Usado pela abertura do Projetor e pela Legenda.
const HINARIOS = { NC: 'Novo Cântico' };

function textoPuro(html) {
    // Documento inerte: o título vira texto sem executar nada.
    return new DOMParser().parseFromString(String(html || ''), 'text/html').body.textContent.trim();
}

function rotuloENomes(conteudo) {
    const tipo = String(conteudo.categoria || conteudo.tipo || '');
    let titulo = textoPuro(conteudo.titulo);
    let rotulo = tipo.includes('hino') ? 'Hino' : tipo.includes('coral') ? 'Coral' : tipo.includes('passagem') ? 'Leitura bíblica' : 'Louvor';
    const numero = titulo.match(/\s*\(([A-Z]{2,4})\s*0*(\d+)\)\s*$/);
    if (numero) {
        rotulo += ` · ${HINARIOS[numero[1]] || numero[1]} ${numero[2]}`;
        titulo = titulo.slice(0, numero.index).trim();
    }
    const nomes = titulo.split(/\s+\/\s+/).map(n => n.trim()).filter(Boolean);
    return { rotulo, nomes: nomes.length ? nomes : [titulo] };
}

// "Ester 4:1-17" + "11. Todos..." → "Ester 4:11"; "Juízes 1:3-7" + "1.3. Disse..." → "Juízes 1:3".
// Sem número reconhecível, fica o título como veio e o texto intacto.
function referenciaExata(titulo, corpo) {
    const t = String(titulo || '').trim();
    const versiculo = String(corpo).match(/^(?:(\d+)\.)?(\d+)\.\s*/);
    const livro = t.match(/^(.+?)\s+(\d+)(?:\s*[:\-–].*)?$/);
    if (!versiculo || !livro) return { referencia: t, corpo };
    return { referencia: `${livro[1]} ${versiculo[1] || livro[2]}:${versiculo[2]}`, corpo: corpo.slice(versiculo[0].length) };
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
    geracaoExibicao++;
    // Tela que desenha o próprio conteúdo (Legenda animada) cuida também da saída.
    if (typeof telaCfg.aoLimpar === 'function') return telaCfg.aoLimpar();
    $('body>*').stop(true, true);
    $('body>*>*').stop(true, true);
    $('body>*:not(.recado):visible').fadeOut(telaCfg.fadeSaida || 200, function () {
        $('body>*:not(.recado):visible>*').html('');
    });
}

function _fecharBiblia() {
    _fecharJanela();
}

// Recado do Painel para o púlpito: tela cheia por 5 segundos, com a barra do tempo que falta.
// Um recado novo substitui o anterior e recomeça a contagem. O texto entra como texto, nunca como HTML.
const DURACAO_RECADO = 5000;
let _recadoTimer = null;

function _alerta(args) {
    if (!telaCfg.temAlerta) return;
    const texto = String(args ?? '').trim();
    if (!texto) return;
    let recado = document.querySelector('body>.recado');
    if (!recado) {
        recado = document.createElement('div');
        recado.className = 'recado';
        recado.setAttribute('role', 'alert');
        recado.innerHTML = '<div class="recado-rotulo">Mensagem para o púlpito</div><div class="recado-texto"></div><div class="recado-barra"></div>';
        recado.querySelector('.recado-barra').style.animationDuration = `${DURACAO_RECADO}ms`;
        document.body.append(recado);
    }
    const textoEl = recado.querySelector('.recado-texto');
    const barra = recado.querySelector('.recado-barra');
    textoEl.textContent = texto;
    barra.style.animationName = 'none';
    void barra.offsetWidth;
    barra.style.animationName = '';
    recado.classList.add('visivel');
    ajustarAltura(textoEl, 0.6, 0.3);
    clearTimeout(_recadoTimer);
    _recadoTimer = setTimeout(() => recado.classList.remove('visivel'), DURACAO_RECADO);
}

function _processarEvento(eventName, args) {
    // Trocar a cena do OBS não altera mais o conteúdo das telas de exibição.
    if (eventName === "obsSceneChanged") return;

    if (eventName === "fecharJanela") {
        _fecharJanela();
    } else if (eventName === "fecharBiblia") {
        _fecharBiblia();
    } else if (eventName === "Alerta") {
        _alerta(args);
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

    const vozes = !telaCfg.juntarLinhasEmPares && Trechos.ehPar(conteudo.vozesProjetor) ? conteudo.vozesProjetor : conteudo.vozes;
    const dueto = Trechos.ehPar(vozes);
    let elem = telaCfg.elementoConteudo; // 'corpo' ou 'rodape'
    let cb = telaCfg.callbackFadeIn;     // callback opcional

    if ((tipo === 'louvor') || (tipo === 'passagem')) {
        const geracao = geracaoExibicao;
        conteudo.corpo = decodeURI(conteudo.corpo).replace(/\{st\}([^}]*)\{\/st\}/g, '<span style="color: #ffc107 !important; font-weight: bold;">$1</span>').replace(/\{it\}|\{\/it\}/g, '').trim();
        if (tipo === 'passagem') conteudo.corpo = conteudo.corpo.replace(/^[^.]+\.(\d+)\.(\d+)\.\s*/, '$1.$2. ');
        let referencia = null;
        if (tipo === 'passagem' && telaCfg.referenciaExata) ({ referencia, corpo: conteudo.corpo } = referenciaExata(conteudo.titulo, conteudo.corpo));
        if (typeof telaCfg.renderizar === 'function') {
            geracaoExibicao++;
            return telaCfg.renderizar({ tipo, conteudo, corpo: conteudo.corpo, referencia, vozes: dueto ? vozes : null });
        }

        const alvoAtual = document.querySelector(`body>${tipo}>${elem}`);
        if (dueto && !telaCfg.juntarLinhasEmPares && alvoAtual?.dataset.quadroVozes === JSON.stringify(vozes) && alvoAtual.classList.contains('com-vozes') && alvoAtual.querySelector('.conteudo-vozes') &&
            $(`body>${tipo}>titulo`).html() === sanitizar(conteudo.titulo) && $(`body>${tipo}`).is(':visible')) {
            // Invalida uma troca pendente, preservando as quatro linhas sem piscar.
            geracaoExibicao++;
            $('body>*').stop(true, true);
            $(`body>*:not(${tipo}):not(.recado)`).hide();
            $(`body>${tipo}`).show(); $(alvoAtual).stop(true, true).show();
            return;
        }

        new Promise((resolve) => {
            if ($(`body>${tipo}>titulo`).html() !== conteudo.titulo) {
                $(`body>${tipo}`).fadeOut(TRANSICAO, () => resolve(true));
            } else resolve(false);
        }).then(() => {
            if (geracao !== geracaoExibicao) return;
            return new Promise((resolve) => {
                $(`body>${tipo}>${elem}`).fadeOut(TRANSICAO, () => resolve(true));
            });
        }).then(() => {
            if (geracao !== geracaoExibicao) return;
            $(`body>*:not(${tipo}):not(.recado)`).fadeOut(TRANSICAO, function () {
                if (geracao !== geracaoExibicao) return;
                // Sanitizacao (SEC-001): titulo e corpo vem via Socket.IO de cliente nao confiavel
                $(`body>${tipo}>titulo`).html(sanitizar(conteudo.titulo));
                // Inserir conteúdo primeiro para que a medição use o texto real
                const elementoAlvo = document.querySelector(`body>${tipo}>${elem}`);
                elementoAlvo.classList.toggle('com-vozes', dueto);
                if (dueto) {
                    const quadro = JSON.stringify(vozes);
                    // A segunda metade do OBS conserva o DOM do quadro completo.
                    if (elementoAlvo.dataset.quadroVozes !== quadro || !elementoAlvo.querySelector('.conteudo-vozes')) Trechos.renderizarDueto(elementoAlvo, vozes);
                    elementoAlvo.dataset.quadroVozes = quadro;
                }
                else { delete elementoAlvo.dataset.quadroVozes; definirHtmlSeguro(elementoAlvo, conteudo.corpo); }
                if (!dueto && conteudo.corpo && telaCfg.juntarLinhasEmPares) {
                    definirHtmlSeguro(elementoAlvo, agruparLinhasEmPares(conteudo.corpo, elementoAlvo));
                }
                if (referencia) elementoAlvo.dataset.ref = referencia;
                else delete elementoAlvo.dataset.ref;
                if (typeof telaCfg.aoRenderizar === 'function') telaCfg.aoRenderizar(tipo, conteudo, elementoAlvo);
                // Só exibe o elem se houver conteúdo
                if (elementoAlvo.innerHTML.trim()) {
                    $(`body>${tipo}>${elem}`).fadeIn(TRANSICAO);
                }
                // Vindo da tela parada (bloco oculto), entra com o fade de entrada da tela.
                $(`body>${tipo}`).fadeIn($(`body>${tipo}`).is(':visible') ? TRANSICAO : (telaCfg.fadeEntrada || TRANSICAO), cb);
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
