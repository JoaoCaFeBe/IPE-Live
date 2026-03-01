var query = document.querySelector.bind(document),
    queryAll = document.querySelectorAll.bind(document),
    queryId = document.getElementById.bind(document),
    queryName = document.getElementsByName.bind(document),
    socket = io(servidor, { transports: ["polling", "websocket"] });
// -----------------------------------------------------------------------------------------
const inicio = () => {
    let botoes = queryAll('input[type="radio"]');
    botoes.forEach((button) => {
        button.addEventListener('change', function () {
            socket.emit(empresa, 'passagem', { tipo: 'passagem', titulo: this.getAttribute('titulo'), corpo: encodeURI(this.nextElementSibling.innerHTML) });
        })
    })
}