/**
 * Legendas.js — Tela de legendas para OBS (sem atraso desde 19/10/2026, a pedido do João)
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