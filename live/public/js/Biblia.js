var query = document.querySelector.bind(document),
    queryAll = document.querySelectorAll.bind(document),
    queryId = document.getElementById.bind(document),
    queryName = document.getElementsByName.bind(document),
    socket = io(servidor, { transports: ["polling", "websocket"], auth: { token: window.SOCKET_TOKEN || "" } });
// -----------------------------------------------------------------------------------------
const inicio = () => {
    const botoes = queryAll('input[type="radio"]');
    botoes.forEach((button) => {
        button.addEventListener('change', function () {
            socket.emit(empresa, 'passagem', { tipo: 'passagem', titulo: this.getAttribute('titulo'), corpo: encodeURI(this.nextElementSibling.innerHTML) });
        });
    });

    // Auto-seleção ao chegar de outro capítulo via teclado
    const sel = new URLSearchParams(window.location.search).get('sel');
    if (sel && botoes.length > 0) {
        const alvo = sel === 'ultimo' ? botoes[botoes.length - 1] : botoes[0];
        alvo.checked = true;
        alvo.dispatchEvent(new Event('change'));
        if (sel === 'ultimo') {
            alvo.nextElementSibling.scrollIntoView({ block: 'nearest' });
        } else {
            document.getElementById('bibliaVersos').scrollTop = 0;
        }
    }

    // Navegação por teclado
    document.addEventListener('keydown', (e) => {
        if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) return;
        e.preventDefault();

        const total = botoes.length;
        if (total === 0) return;

        const checked = query('input[type="radio"]:checked');
        const idx = checked ? parseInt(checked.id.replace('btnPassagem', '')) : -1;

        const avancar = e.key === 'ArrowRight' || e.key === 'ArrowDown';

        if (avancar) {
            if (idx < total - 1) {
                // Seleciona próximo versículo
                const prox = queryId('btnPassagem' + (idx + 1));
                prox.checked = true;
                prox.dispatchEvent(new Event('change'));
                prox.nextElementSibling.scrollIntoView({ block: 'nearest' });
            } else {
                // Último versículo → próximo capítulo/livro
                const d = document.body.dataset;
                const cap = parseInt(d.capitulo);
                const maxCap = parseInt(d.maxCapitulo);
                if (cap < maxCap) {
                    navegar(parseInt(d.livro), cap + 1, d.nomeLivro, 'primeiro');
                } else if (d.livroProximoId) {
                    navegar(parseInt(d.livroProximoId), 1, d.livroProximoNome, 'primeiro');
                }
            }
        } else {
            if (idx > 0) {
                // Seleciona versículo anterior
                const ant = queryId('btnPassagem' + (idx - 1));
                ant.checked = true;
                ant.dispatchEvent(new Event('change'));
                ant.nextElementSibling.scrollIntoView({ block: 'nearest' });
            } else {
                // Primeiro versículo → capítulo/livro anterior
                const d = document.body.dataset;
                const cap = parseInt(d.capitulo);
                if (cap > 1) {
                    navegar(parseInt(d.livro), cap - 1, d.nomeLivro, 'ultimo');
                } else if (d.livroAnteriorId) {
                    navegar(parseInt(d.livroAnteriorId), parseInt(d.maxCapituloAnterior), d.livroAnteriorNome, 'ultimo');
                }
            }
        }
    });
}