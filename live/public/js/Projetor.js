/**
 * Projetor.js — Tela de projeção principal
 * Usa Base.js para lógica compartilhada
 *
 * Na parede da igreja só aparece o que tem luz (o preto não acende). Por isso a letra do louvor
 * vem sem faixa de título, e o nome do louvor aparece sozinho no botão Título (abertura).
 */

function montarAbertura(tipo, conteudo, elementoAlvo) {
    if (tipo !== 'louvor' && tipo !== 'passagem') return;
    const bloco = elementoAlvo.parentElement;
    const abertura = bloco.querySelector('abertura');
    const ehAbertura = !elementoAlvo.innerHTML.trim();
    bloco.classList.toggle('abertura', ehAbertura);
    abertura.replaceChildren();
    if (!ehAbertura) {
        // Louvor e versículo cabem na tela; o versículo curto cresce e o longo diminui (proposta 4).
        ajustarAltura(elementoAlvo, tipo === 'louvor' ? 0.92 : 0.86, tipo === 'louvor' ? 0.5 : 0.35);
        return;
    }
    const { rotulo, nomes } = rotuloENomes(conteudo);
    const simbolo = document.createElement('div');
    simbolo.className = 'abertura-simbolo';
    simbolo.setAttribute('aria-hidden', 'true');
    abertura.append(simbolo);
    const rotuloEl = document.createElement('div');
    rotuloEl.className = 'abertura-rotulo';
    rotuloEl.textContent = rotulo;
    abertura.append(rotuloEl);
    nomes.forEach((nome, i) => {
        if (i > 0) {
            const separador = document.createElement('div');
            separador.className = 'abertura-separador';
            abertura.append(separador);
        }
        const nomeEl = document.createElement('div');
        nomeEl.className = 'abertura-nome';
        nomeEl.textContent = nome;
        abertura.append(nomeEl);
    });
    ajustarAltura(abertura, 0.85, 0.4);
}

// Letra ajustada em px (ajustarAltura) não acompanha a janela: ao redimensionar, reajusta o
// conteúdo que está no ar, para não ficar pequeno demais nem cortar.
let esperaResize = null;
window.addEventListener('resize', () => {
    clearTimeout(esperaResize);
    esperaResize = setTimeout(() => {
        ['louvor', 'passagem'].forEach(tipo => {
            const bloco = document.querySelector(`body>${tipo}`);
            if (!bloco || getComputedStyle(bloco).display === 'none') return;
            if (bloco.classList.contains('abertura')) ajustarAltura(bloco.querySelector('abertura'), 0.85, 0.4);
            else ajustarAltura(bloco.querySelector('corpo'), tipo === 'louvor' ? 0.92 : 0.86, tipo === 'louvor' ? 0.5 : 0.35);
        });
    }, 150);
});

inicializarTela({
    elementoConteudo: 'corpo',
    temAlerta: false,
    delayEventos: 0,
    limparNaMensagem: true,
    callbackFadeIn: null,
    aoRenderizar: montarAbertura,
    // Versículo com a referência exata ("Romanos 1:11") em cima, sem o número no texto (proposta 4).
    referenciaExata: true,
    // Tela parada fica preta; o conteúdo surge e some devagar (João, 19/10/2026).
    fadeEntrada: 450,
    fadeSaida: 450,
    integracaoOBS: false
});
