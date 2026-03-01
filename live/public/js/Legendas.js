/**
 * Legendas.js — Tela de legendas para OBS (com delay de 1.5s)
 * Usa Base.js para lógica compartilhada
 */
inicializarTela({
    elementoConteudo: 'rodape',
    temAlerta: false,
    delayEventos: 1500,
    callbackFadeIn: null,
    integracaoOBS: true,
    juntarLinhasEmPares: true
});