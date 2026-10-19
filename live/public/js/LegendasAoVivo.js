/**
 * LegendasAoVivo.js — Tela de legendas ao vivo para OBS (sem delay)
 * Usa Base.js para lógica compartilhada
 */
inicializarTela({
    elementoConteudo: 'rodape',
    temAlerta: false,
    delayEventos: 0,
    callbackFadeIn: null,
    integracaoOBS: true,
    juntarLinhasEmPares: true,
    referenciaExata: true,
    // A legenda animada desenha tudo sozinha (LegendaAnimada.js).
    renderizar: LegendaAnimada.renderizar,
    aoLimpar: LegendaAnimada.limpar,
    // O OBS define window.obsstudio; fora dele, mostra a cruz de fundo para conferir a legenda.
    aoIniciar: () => document.body.classList.toggle('fora-do-obs', typeof window.obsstudio === 'undefined')
});