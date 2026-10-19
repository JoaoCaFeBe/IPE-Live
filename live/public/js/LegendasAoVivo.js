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
    aoLimpar: LegendaAnimada.limpar
});