/**
 * Televisao.js — Tela da televisão com relógio
 * Usa Base.js para lógica compartilhada
 */

// -----------------------------------------------------------------------------------------
// Relógio sincronizado com o servidor
// -----------------------------------------------------------------------------------------

let clockInterval = null;
let serverTimeOffset = 0;

function updateClock() {
    const agora = new Date(Date.now() + serverTimeOffset);
    document.getElementById('clock').textContent = agora.toTimeString().slice(0, 8);
}

function sincronizarHora() {
    return fetch('Hora.php')
        .then(response => response.json())
        .then(data => {
            const [h, m, s] = data.hora.split(':').map(Number);
            const agora = new Date();
            const horaServidor = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), h, m, s);
            serverTimeOffset = horaServidor.getTime() - Date.now();
        })
        .catch(error => console.error('Erro ao sincronizar hora do servidor:', error));
}

const visibilidadeRelogio = () => {
    if ($('#clock').is(':visible')) {
        $('#clock').fadeOut(200);
    }
    else if (
        $('passagem').is(':hidden') &&
        $('louvor').is(':hidden')
    ) {
        $('#clock').fadeIn(200);
        updateClock();

        if (!clockInterval) {
            clockInterval = setInterval(updateClock, 1000);
            setInterval(sincronizarHora, 60000);
        }

    } else {
        $('#clock').fadeOut(200);
    }
};

// -----------------------------------------------------------------------------------------
// Configuração da tela
// -----------------------------------------------------------------------------------------

inicializarTela({
    elementoConteudo: 'corpo',
    temAlerta: true,
    delayEventos: 0,
    limparNaMensagem: true,
    callbackFadeIn: visibilidadeRelogio,
    integracaoOBS: false,
    aoIniciar: sincronizarHora
});