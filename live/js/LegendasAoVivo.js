/**
 * LegendasAoVivo.js — Tela de legendas ao vivo para OBS (sem delay)
 * Usa Base.js para lógica compartilhada
 */
inicializarTela({
    elementoConteudo: 'rodape',
    temAlerta: false,
    delayEventos: 0,
    limparNaMensagem: false,
    callbackFadeIn: null,
    integracaoOBS: true,
    juntarLinhasEmPares: true
});