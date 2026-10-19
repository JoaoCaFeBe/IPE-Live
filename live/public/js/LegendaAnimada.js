/**
 * LegendaAnimada.js — legenda do OBS no azul-petróleo da igreja.
 * Aprovada pelo João em 19/10/2026 (pranchas 3 e 4; prévia https://claude.ai/artifact/FzfzRBVrEErW9KDbwsiwku).
 * Sem a logomarca desde 19/10/2026 (enquete do grupo, unânime): a faixa tirava a atenção da letra.
 *
 * Entrada: o verde abre do centro para os lados, já na altura do conteúdo, e o texto surge.
 * Troca: o texto sai, o verde vai do tamanho antigo para o novo, o texto entra.
 * Saída: o texto some e o verde fecha para o centro.
 * Bloco parado (sugestão da Renata, 19/10/2026): na estrofe de louvor, o bloco fica do tamanho da
 * maior estrofe da música, o nome fica fixo no topo e só a letra troca, centralizada.
 * Todo texto entra por textContent ou pelo sanitizador do Base.js.
 */
const LegendaAnimada = (() => {
    const DURACAO = { cresce: 340, texto: 200, textoSai: 140, recolhe: 300, trocaSai: 110, troca: 250, trocaEntra: 160 };
    const SUAVE = 'cubic-bezier(.2,.7,.2,1)';
    const TAMANHO = 'cubic-bezier(.45,0,.25,1)';   // largura e altura: acelera e desacelera, sem salto no começo
    const LARGURA_MAX = 0.84;       // fração da tela que o bloco pode ocupar
    const ALTURA_VERSICULO = 0.2;   // versículo: no máximo um quinto da altura (proposta 6)

    let raiz, faixa, conteudo;
    let noAr = false, ocupado = false, proximo = null, ultimo = null;
    let medidaMusica = null;        // { chave, width, height } da maior estrofe da música no ar

    const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
    const reduzir = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Página oculta (aba em segundo plano, fonte fora da cena no OBS): o navegador pausa as
    // animações e a fila travaria; então pula direto para o estado final, que cada passo fixa.
    const anima = (alvo, quadros, ms, easing = SUAVE) => {
        if (document.hidden) { alvo.getAnimations().forEach(a => a.cancel()); return Promise.resolve(); }
        return alvo.animate(quadros, { duration: reduzir() ? 1 : ms, easing, fill: 'forwards' }).finished;
    };
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && raiz) raiz.querySelectorAll('*').forEach(e => e.getAnimations().forEach(a => a.finish()));
    });
    const fixa = (alvo, props) => { alvo.getAnimations().forEach(a => a.cancel()); Object.assign(alvo.style, props); };

    function iniciar() {
        raiz = document.querySelector('.legenda-ipe');
        faixa = raiz.querySelector('.legenda-faixa');
        conteudo = raiz.querySelector('.legenda-conteudo');
    }

    // Linhas do corpo (separadas por <br>), já com o {st} convertido pelo Base.js.
    const linhasDoCorpo = corpo => String(corpo || '').split(/<br\s*\/?\s*>/gi).map(l => l.trim()).filter(Boolean);

    function blocoLinhas(linhas, cls = 'legenda-texto') {
        const bloco = el('div', cls);
        linhas.forEach((linha, i) => {
            const span = el('span', 'legenda-linha');
            definirHtmlSeguro(span, linha);
            if (i) bloco.append(document.createElement('br'));
            bloco.append(span);
        });
        return bloco;
    }

    // Duas vozes numa grade só: cada verso divide a linha com o seu par, e um verso que quebra
    // empurra os dois lados juntos (o par não desalinha).
    function blocoVozes(vozes) {
        const grade = el('div', 'legenda-vozes');
        const versos = ['esquerda', 'direita'].map(lado => Trechos.linhasVoz(vozes[lado].texto));
        const total = Math.max(...versos.map(v => v.length));
        grade.append(el('div', 'legenda-rotulo', vozes.esquerda.nome), el('div', 'legenda-rotulo legenda-dir', vozes.direita.nome));
        for (let i = 0; i < total; i++) {
            grade.append(el('div', 'legenda-texto legenda-verso', versos[0][i] || '\u00a0'), el('div', 'legenda-texto legenda-verso legenda-dir', versos[1][i] || '\u00a0'));
        }
        return grade;
    }

    // Até 3 linhas empilhadas; com 4 ou mais, cada verso se junta ao seguinte quando o par cabe
    // (Trechos.parearVersos, a mesma regra da prévia do editor da Liturgia).
    function juntarEmPares(linhas, larguraUtil) {
        const medidor = el('div', 'legenda-texto');
        Object.assign(medidor.style, { position: 'absolute', visibility: 'hidden', left: '-99999px' });
        conteudo.append(medidor);
        try {
            const cabe = (a, b) => {
                definirHtmlSeguro(medidor, `${a}<span class="legenda-sep"> · </span>${b}`);
                return medidor.getBoundingClientRect().width <= larguraUtil;
            };
            return Trechos.parearVersos(linhas, cabe).map(g => g.join('<span class="legenda-sep"> · </span>'));
        } finally { medidor.remove(); }
    }

    // Monta o conteúdo novo no lugar do antigo e devolve o tamanho natural dele.
    function montarConteudo(dados) {
        const { tipo, conteudo: c, corpo, referencia, vozes } = dados;
        const { rotulo, nomes } = rotuloENomes(c);
        const partes = [];
        if (vozes) {
            partes.push(el('div', 'legenda-rotulo', nomes.join(' / ')), blocoVozes(vozes));
        } else if (!String(corpo || '').trim()) {
            // Botão Título: a tarja com o tipo e o nome.
            partes.push(el('div', 'legenda-rotulo', rotulo), blocoLinhas(nomes, 'legenda-texto legenda-titulo'));
        } else if (tipo === 'passagem') {
            partes.push(el('div', 'legenda-rotulo', referencia || textoPuro(c.titulo)), blocoLinhas([corpo], 'legenda-texto legenda-versiculo'));
        } else {
            partes.push(el('div', 'legenda-rotulo', nomes.join(' / ')));
            partes.linhas = linhasDoCorpo(corpo);
        }
        conteudo.replaceChildren(...partes);
        if (partes.linhas) {
            // Largura útil do texto: o limite da tela menos o padding.
            const estilo = getComputedStyle(conteudo);
            const util = window.innerWidth * LARGURA_MAX - parseFloat(estilo.paddingLeft) - parseFloat(estilo.paddingRight);
            conteudo.append(blocoLinhas(juntarEmPares(partes.linhas, util)));
        }
        conteudo.style.width = conteudo.style.height = '';
        conteudo.querySelectorAll('.legenda-texto').forEach(t => { t.style.fontSize = ''; });

        const limite = window.innerWidth * LARGURA_MAX;
        const texto = conteudo.querySelector('.legenda-texto');
        // Linha comprida demais quebra dentro do limite em vez de sair da tela; em duas vozes,
        // as duas colunas dividem a largura que sobra.
        const textoAtual = conteudo.querySelector('.legenda-texto');
        if (textoAtual && conteudo.getBoundingClientRect().width > limite) {
            const estilo = getComputedStyle(conteudo);
            let largura = limite - parseFloat(estilo.paddingLeft) - parseFloat(estilo.paddingRight);
            const colunas = conteudo.querySelector('.legenda-vozes');
            if (colunas) {
                const dir = colunas.querySelector('.legenda-dir');
                largura = Math.floor((largura - parseFloat(getComputedStyle(colunas).columnGap) - parseFloat(getComputedStyle(dir).paddingLeft) - 2) / 2);
                colunas.style.gridTemplateColumns = `${largura}px ${largura}px`;
                colunas.querySelectorAll('.legenda-texto').forEach(t => t.classList.add('quebra'));
            } else {
                conteudo.querySelectorAll('.legenda-texto').forEach(t => { t.classList.add('quebra'); t.style.width = `${Math.floor(largura)}px`; });
            }
        }
        // Versículo: a letra diminui até caber em um quinto da altura.
        if (texto && texto.classList.contains('legenda-versiculo')) {
            const base = parseFloat(getComputedStyle(texto).fontSize);
            for (let e = 0.95; conteudo.getBoundingClientRect().height > window.innerHeight * ALTURA_VERSICULO && e >= 0.6; e -= 0.05) texto.style.fontSize = `${base * e}px`;
        }
        const { width, height } = conteudo.getBoundingClientRect();
        conteudo.style.width = `${width}px`;
        conteudo.style.height = `${height}px`;
        return { width, height };
    }

    // Estrofe de louvor (não Título, não duas vozes) de música com mais de uma estrofe: bloco parado.
    const estrofesParadas = ({ tipo, corpo, vozes, estrofes }) =>
        tipo === 'louvor' && !vozes && String(corpo || '').trim() && Array.isArray(estrofes) && estrofes.length > 1 ? estrofes : null;
    const chaveParada = dados => {
        const estrofes = estrofesParadas(dados);
        return estrofes && JSON.stringify([textoPuro(dados.conteudo.titulo), estrofes, window.innerWidth, window.innerHeight]);
    };

    function montar(dados) {
        const estrofes = estrofesParadas(dados);
        conteudo.classList.toggle('legenda-parada', Boolean(estrofes));
        if (!estrofes) return montarConteudo(dados);
        const chave = chaveParada(dados);
        if (medidaMusica?.chave !== chave) {
            let width = 0, height = 0;
            estrofes.forEach(corpo => {
                const m = montarConteudo({ ...dados, corpo });
                width = Math.max(width, m.width); height = Math.max(height, m.height);
            });
            medidaMusica = { chave, width, height };
        }
        montarConteudo(dados);
        const { width, height } = medidaMusica;
        conteudo.style.width = `${width}px`;
        conteudo.style.height = `${height}px`;
        return { width, height };
    }

    async function entrar(dados) {
        raiz.classList.add('visivel');
        fixa(conteudo, { opacity: '0' });
        const alvo = montar(dados);
        // O bloco é centralizado na tela: crescer a largura a partir de zero abre do centro para os lados.
        fixa(faixa, { width: '0px', height: `${alvo.height}px` });
        await anima(faixa, [{ width: '0px', height: `${alvo.height}px` }, { width: `${alvo.width}px`, height: `${alvo.height}px` }], DURACAO.cresce, TAMANHO);
        fixa(faixa, { width: `${alvo.width}px`, height: `${alvo.height}px` });
        await anima(conteudo, [{ opacity: 0, transform: 'translateY(.3em)' }, { opacity: 1, transform: 'none' }], DURACAO.texto);
        fixa(conteudo, { opacity: '1' });
    }

    async function trocar(dados) {
        // Mesma música com o bloco parado: o nome fica, só a letra sai e entra.
        if (conteudo.classList.contains('legenda-parada') && chaveParada(dados) === medidaMusica?.chave) {
            await anima(conteudo.querySelector(':scope > .legenda-texto'), [{ opacity: 1 }, { opacity: 0 }], DURACAO.trocaSai);
            montar(dados);
            await anima(conteudo.querySelector(':scope > .legenda-texto'), [{ opacity: 0, transform: 'translateY(.3em)' }, { opacity: 1, transform: 'none' }], DURACAO.trocaEntra);
            return;
        }
        const antes = faixa.getBoundingClientRect();
        await anima(conteudo, [{ opacity: 1 }, { opacity: 0 }], DURACAO.trocaSai);
        fixa(conteudo, { opacity: '0' });
        const alvo = montar(dados);
        await anima(faixa, [{ width: `${antes.width}px`, height: `${antes.height}px` }, { width: `${alvo.width}px`, height: `${alvo.height}px` }], DURACAO.troca, TAMANHO);
        fixa(faixa, { width: `${alvo.width}px`, height: `${alvo.height}px` });
        await anima(conteudo, [{ opacity: 0, transform: 'translateY(.3em)' }, { opacity: 1, transform: 'none' }], DURACAO.trocaEntra);
        fixa(conteudo, { opacity: '1' });
    }

    async function sair() {
        const antes = faixa.getBoundingClientRect();
        await anima(conteudo, [{ opacity: 1 }, { opacity: 0 }], DURACAO.textoSai);
        fixa(conteudo, { opacity: '0' });
        await anima(faixa, [{ width: `${antes.width}px`, height: `${antes.height}px` }, { width: '0px', height: `${antes.height}px` }], DURACAO.recolhe, 'cubic-bezier(.5,0,.75,0)');
        fixa(faixa, { width: '0px', height: `${antes.height}px` });
        raiz.classList.remove('visivel');
        conteudo.replaceChildren();
    }

    // Cliques rápidos não empilham animações: termina a atual e vai direto ao último pedido.
    async function processar() {
        if (ocupado) return;
        ocupado = true;
        try {
            while (proximo) {
                const pedido = proximo; proximo = null;
                if (!pedido.limpar) ultimo = pedido;
                if (pedido.limpar) { if (noAr) { await sair(); noAr = false; ultimo = null; } }
                else if (!noAr) { await entrar(pedido); noAr = true; }
                else await trocar(pedido);
            }
        } finally { ocupado = false; }
    }

    // A fonte usa vw: se a janela (ou a fonte do OBS) mudar de tamanho com a legenda no ar,
    // remonta o mesmo conteúdo e ajusta a faixa ao tamanho novo, sem animação.
    let esperaResize = null;
    window.addEventListener('resize', () => {
        clearTimeout(esperaResize);
        esperaResize = setTimeout(() => {
            if (!noAr || !ultimo || ocupado) return;
            const alvo = montar(ultimo);
            fixa(faixa, { width: `${alvo.width}px`, height: `${alvo.height}px` });
            fixa(conteudo, { opacity: '1' });
        }, 150);
    });

    return {
        renderizar(dados) { if (!raiz) iniciar(); proximo = dados; processar(); },
        limpar() { if (!raiz) iniciar(); proximo = { limpar: true }; processar(); }
    };
})();
