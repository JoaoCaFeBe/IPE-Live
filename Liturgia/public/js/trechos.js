/* Contrato de letras compartilhado pelos módulos independentes Liturgia e Live.
 * Manter esta cópia e live/public/js/Trechos.js iguais (ver teste de contrato). */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.Trechos = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const vozValida = v => v && typeof v.nome === 'string' && v.nome.trim().length > 0 && v.nome.length <= 80 && typeof v.texto === 'string' && v.texto.trim().length > 0;
    const ehDueto = t => Boolean(t && typeof t === 'object' && t.tipo === 'duas-vozes' && vozValida(t.esquerda) && vozValida(t.direita) && (t.refrao === undefined || typeof t.refrao === 'boolean'));
    const letraValida = l => Array.isArray(l) && l.length > 0 && l.every(t => typeof t === 'string' ? Boolean(t.trim()) : ehDueto(t));
    const linhas = texto => String(texto || '').replace(/\r\n?/g, '\n').split(/<br\s*\/?\s*>|\n/gi).map(l => l.trim()).filter(Boolean);
    // Só as vozes conservam pausas; Todos mantém a limpeza histórica de vazios.
    const linhasVoz = texto => texto === '' || texto == null ? [] : String(texto).replace(/\r\n?/g, '\n').split(/<br\s*\/?\s*>|\n/gi).map(l => l.trim());
    const texto = t => ehDueto(t) ? `${t.esquerda.texto}\n${t.direita.texto}` : typeof t === 'string' ? t : '';
    const plano = s => String(s || '').replace(/^refrao:/, '').replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]*>/g, '').replace(/\{\/?(?:it|st)\}/g, '').replace(/&(?:amp|lt|gt|quot|#39);/g, e => ({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'"})[e]);
    function paraEditor(letra) {
        return (letra || []).map(t => ehDueto(t)
            ? { modo: 'duas', refrao: Boolean(t.refrao), texto: '', esquerda: { ...t.esquerda }, direita: { ...t.direita } }
            : { modo: 'todos', refrao: typeof t === 'string' && t.startsWith('refrao:'), texto: String(t || '').replace(/^refrao:/, '').replace(/<br\s*\/?\s*>/gi, '\n'), esquerda: { nome: 'Homens', texto: '' }, direita: { nome: 'Mulheres', texto: '' } });
    }
    function doEditor(blocos) {
        return blocos.map(b => b.modo === 'duas'
            ? { tipo: 'duas-vozes', refrao: Boolean(b.refrao), esquerda: { nome: b.esquerda.nome.trim(), texto: linhasVoz(b.esquerda.texto).join('\n') }, direita: { nome: b.direita.nome.trim(), texto: linhasVoz(b.direita.texto).join('\n') } }
            : (b.refrao ? 'refrao:' : '') + b.texto.trim().replace(/\r/g, '').replace(/\n/g, '<br/>'));
    }
    function pares(t, max = 2) {
        if (!ehDueto(t)) return [];
        const esquerda = linhasVoz(t.esquerda.texto), direita = linhasVoz(t.direita.texto);
        const total = Math.ceil(Math.max(esquerda.length, direita.length) / max);
        return Array.from({ length: total }, (_, i) => ({ tipo: 'duas-vozes', refrao: Boolean(t.refrao), posicoes: Math.min(max, Math.max(esquerda.length, direita.length) - i * max), esquerda: { nome: t.esquerda.nome, texto: esquerda.slice(i * max, (i + 1) * max).join('\n') }, direita: { nome: t.direita.nome, texto: direita.slice(i * max, (i + 1) * max).join('\n') } }));
    }
    // Cada quadro de quatro versos permanece no Projetor por duas partes do OBS.
    function divisoes(t) {
        const projetores = pares(t, 4);
        return pares(t, 2).map((legenda, i) => ({ projetor: projetores[Math.floor(i / 2)], legenda }));
    }
    // Pares finais podem ter uma coluna vazia: preserva o alinhamento, sem repetir versos.
    function ehPar(t) {
        return Boolean(t && t.tipo === 'duas-vozes' && ['esquerda', 'direita'].every(k => t[k] && typeof t[k].nome === 'string' && t[k].nome.trim() && t[k].nome.length <= 80 && typeof t[k].texto === 'string') && (t.posicoes === undefined || (Number.isInteger(t.posicoes) && t.posicoes >= 1 && t.posicoes <= 4)) && (t.esquerda.texto.trim() || t.direita.texto.trim() || t.posicoes));
    }
    // Clientes antigos continuam recebendo strings; os atualizados pedem ?vozes=1.
    function legado(letra) {
        const escapar = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return (letra || []).map(t => ehDueto(t) ? (t.refrao ? 'refrao:' : '') + ['esquerda', 'direita'].map(k => [escapar(t[k].nome) + ':', ...linhasVoz(t[k].texto).map(escapar)].join('<br/>')).join('<br/>') : t);
    }
    function renderizarDueto(container, t) {
        container.replaceChildren();
        if (!ehPar(t)) return;
        const grid = document.createElement('div'); grid.className = 'conteudo-vozes vozes-alinhadas';
        const versos = ['esquerda', 'direita'].map(k => linhasVoz(t[k].texto));
        const total = Math.max(t.posicoes || 0, ...versos.map(v => v.length));
        for (const [col, key] of ['esquerda', 'direita'].entries()) {
            const coluna = document.createElement('div'); coluna.className = 'coluna-voz';
            const nome = document.createElement('div'); nome.className = 'voz-nome'; nome.textContent = t[key].nome; coluna.append(nome);
            nome.style.gridColumn = String(col + 1); nome.style.gridRow = '1';
            for (let i = 0; i < total; i++) {
                const linha = document.createElement('div'); linha.className = 'voz-linha'; linha.textContent = versos[col][i] || '';
                linha.style.gridColumn = String(col + 1); linha.style.gridRow = String(i + 2); coluna.append(linha);
            }
            grid.append(coluna);
        }
        container.append(grid);
    }
    function renderizar(container, letra) {
        container.replaceChildren();
        (letra || []).forEach(t => {
            const p = document.createElement('div'); p.className = 'trecho-leitura mb-3';
            if (ehDueto(t)) renderizarDueto(p, t);
            else { p.style.whiteSpace = 'pre-wrap'; p.textContent = plano(t); }
            if (ehDueto(t) ? t.refrao : typeof t === 'string' && t.startsWith('refrao:')) p.classList.add('refrao', 'text-primary');
            container.append(p);
        });
    }
    // Legenda do OBS: até 3 versos ficam empilhados; com 4 ou mais, cada verso se junta ao seguinte
    // quando o par cabe (cabe(a, b) mede na tela de quem chama). Devolve grupos de 1 ou 2 versos.
    // Usada pela legenda (LegendaAnimada.js) e pela prévia do editor da Liturgia.
    function parearVersos(linhas, cabe) {
        if (linhas.length < 4) return linhas.map(l => [l]);
        const grupos = [];
        for (let i = 0; i < linhas.length; i++) {
            if (i + 1 < linhas.length && cabe(linhas[i], linhas[i + 1])) { grupos.push([linhas[i], linhas[i + 1]]); i++; }
            else grupos.push([linhas[i]]);
        }
        return grupos;
    }
    return { legado, ehDueto, ehPar, letraValida, linhas, linhasVoz, texto, plano, paraEditor, doEditor, pares, divisoes, renderizarDueto, renderizar, parearVersos };
});
