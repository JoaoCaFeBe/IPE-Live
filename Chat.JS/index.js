const { Server } = require("socket.io");

const io = new Server({ cors: { origin: ["http://transmissao", "http://localhost", "http://localhost:8080", "http://192.168.1.43", "http://10.0.0.253", "https://ipe.live.test"] } });

io.on("connection", (socket) => {
    console.log("Nova conexão : " + socket.id);

    socket.onAny((empresa, funcao, args = false) => {
        io.emit(empresa, funcao, args);
    });
});

io.listen(3001);