var query = document.querySelector.bind(document),
    queryAll = document.querySelectorAll.bind(document),
    queryId = document.getElementById.bind(document),
    queryName = document.getElementsByName.bind(document),
    servidor = "10.0.0.253:3000",
    empresa = "IPE.Transmissão",
    socket = io(servidor, { transports: ["polling", "websocket"] });
// -----------------------------------------------------------------------------------------
const inicio = () => {
    botoes = queryAll('input[type="radio"]');
    botoes.forEach((button) => {
        button.addEventListener('change', function () {
            socket.emit(empresa, 'passagem', { tipo: 'passagem', titulo: this.getAttribute('titulo'), corpo: encodeURI(this.nextElementSibling.innerHTML) });
        })
    })
}