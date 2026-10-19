/**
 * LegendaAnimada.js — legenda do OBS no azul-petróleo da igreja, com o símbolo à esquerda.
 * Aprovada pelo João em 19/10/2026 (pranchas 3 e 4; prévia https://claude.ai/artifact/FzfzRBVrEErW9KDbwsiwku).
 *
 * Entrada: o quadrado do símbolo aparece com zoom, o verde cresce a partir dele (largura e altura)
 * e o texto surge. Troca: o texto sai, o verde vai do tamanho antigo para o novo, o texto entra.
 * Saída: o texto some, o verde recolhe para dentro do símbolo e o símbolo sai com zoom.
 * Todo texto entra por textContent ou pelo sanitizador do Base.js.
 */
const LegendaAnimada = (() => {
    const DURACAO = { simbolo: 260, cresce: 340, texto: 200, textoSai: 140, recolhe: 300, simboloSai: 220, trocaSai: 110, troca: 250, trocaEntra: 160 };
    const SUAVE = 'cubic-bezier(.2,.7,.2,1)';
    const TAMANHO = 'cubic-bezier(.45,0,.25,1)';   // largura e altura: acelera e desacelera, sem salto no começo
    const LARGURA_MAX = 0.84;       // fração da tela que o bloco pode ocupar
    const ALTURA_VERSICULO = 0.2;   // versículo: no máximo um quinto da altura (proposta 6)

    let raiz, marca, faixa, conteudo;
    let noAr = false, ocupado = false, proximo = null;

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
        marca = raiz.querySelector('.legenda-marca');
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

    // Até 3 linhas empilhadas, como se canta; com 4 ou mais, os versos se juntam em pares
    // ("verso · verso"), desde que o par caiba (proposta 5, aprovada na prancha 3).
    function juntarEmPares(linhas) {
        if (linhas.length < 4) return linhas;
        const pares = [];
        for (let i = 0; i < linhas.length; i += 2) pares.push(linhas[i + 1] ? `${linhas[i]}<span class="legenda-sep"> · </span>${linhas[i + 1]}` : linhas[i]);
        return pares;
    }

    // Monta o conteúdo novo no lugar do antigo e devolve o tamanho natural dele.
    function montar(dados) {
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
            const linhas = linhasDoCorpo(corpo);
            partes.push(el('div', 'legenda-rotulo', nomes.join(' / ')), blocoLinhas(juntarEmPares(linhas)));
            partes.linhas = linhas;
        }
        conteudo.replaceChildren(...partes);
        conteudo.style.width = conteudo.style.height = '';
        conteudo.querySelectorAll('.legenda-texto').forEach(t => { t.style.fontSize = ''; });

        const limite = window.innerWidth * LARGURA_MAX - marca.getBoundingClientRect().width;
        const texto = conteudo.querySelector('.legenda-texto');
        // Linha comprida demais quebra dentro do limite em vez de sair da tela; em duas vozes,
        // as duas colunas dividem a largura que sobra.
        // Pares que não cabem voltam a ser uma linha por verso.
        if (partes.linhas && partes.linhas.length >= 4 && conteudo.getBoundingClientRect().width > limite) {
            const empilhado = blocoLinhas(partes.linhas);
            texto.replaceWith(empilhado);
        }
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

    const encolhido = () => ({ width: 0, height: marca.getBoundingClientRect().width });

    async function entrar(dados) {
        raiz.classList.add('visivel');
        fixa(conteudo, { opacity: '0' });
        const alvo = montar(dados);
        const ini = encolhido();
        fixa(faixa, { width: `${ini.width}px`, height: `${ini.height}px` });
        await anima(marca, [{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1.1)', opacity: 1, offset: .75 }, { transform: 'scale(1)', opacity: 1 }], DURACAO.simbolo);
        await anima(faixa, [{ width: `${ini.width}px`, height: `${ini.height}px` }, { width: `${alvo.width}px`, height: `${alvo.height}px` }], DURACAO.cresce, TAMANHO);
        fixa(faixa, { width: `${alvo.width}px`, height: `${alvo.height}px` });
        await anima(conteudo, [{ opacity: 0, transform: 'translateY(.3em)' }, { opacity: 1, transform: 'none' }], DURACAO.texto);
        fixa(conteudo, { opacity: '1' });
    }

    async function trocar(dados) {
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
        const fim = encolhido();
        await anima(conteudo, [{ opacity: 1 }, { opacity: 0 }], DURACAO.textoSai);
        fixa(conteudo, { opacity: '0' });
        await anima(faixa, [{ width: `${antes.width}px`, height: `${antes.height}px` }, { width: `${fim.width}px`, height: `${fim.height}px` }], DURACAO.recolhe, 'cubic-bezier(.5,0,.75,0)');
        fixa(faixa, { width: `${fim.width}px`, height: `${fim.height}px` });
        await anima(marca, [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.1)', opacity: 1, offset: .25 }, { transform: 'scale(0)', opacity: 0 }], DURACAO.simboloSai, 'ease-in');
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
                if (pedido.limpar) { if (noAr) { await sair(); noAr = false; } }
                else if (!noAr) { await entrar(pedido); noAr = true; }
                else await trocar(pedido);
            }
        } finally { ocupado = false; }
    }

    return {
        renderizar(dados) { if (!raiz) iniciar(); proximo = dados; processar(); },
        limpar() { if (!raiz) iniciar(); proximo = { limpar: true }; processar(); }
    };
})();
