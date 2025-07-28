var query = document.querySelector.bind(document),
    queryAll = document.querySelectorAll.bind(document),
    queryId = document.getElementById.bind(document),
    queryName = document.getElementsByName.bind(document),
	servidor = "10.0.0.253:3000",
    empresa = "IPE.Transmissão",
    socket = io(servidor, { transports: ["polling", "websocket"] }),
    atual;

socket.on("connect", () => {
    socket.emit(empresa, "pegarDadosMensagem");
});

socket.onAny((aplicativo, eventName, args) => {
    if (aplicativo === empresa) {
		setTimeout(function(){
			if (eventName === "fecharJanela") {
				$(`body>*:visible`).fadeOut(200, function () {
					// this.querySelectorAll("*").forEach(obj => obj.innerhtml = "");
					$(`body>*:visible>*`).html('');
				});
			} else if (eventName === "fecharBiblia") {
				if (atual === 'Mensagem') {
					if ($(`mensagem>rodape`).html(mensagem.corpo).css('display') !== 'none') $(`mensagem>rodape`).fadeOut(200);
				} else {
					$(`body>*:visible`).fadeOut(200, function () {
						// this.querySelectorAll("*").forEach(obj => obj.innerhtml = "");
						$(`body>*:visible>*`).html('');
					});
				}
			} else if (eventName === "obsSceneChanged") {
				atual = args;
				if (args !== 'Mensagem') {
					$(`body>*:visible`).fadeOut(200, function () {
						// this.querySelectorAll("*").forEach(obj => obj.innerhtml = "");
						$(`body>*:visible>*`).html('');
					});
				}
			} else if (eventName === "pegarDadosMensagem") {
			} else if (eventName === "dadosMensagem") {
				$('mensagem>titulo').html(args.titulo);
				$('mensagem>corpo').html("");
				$('mensagem>corpo').append(`<ol></ol>`);
				args.topicos.forEach((topico, indice) => {
					$('mensagem>corpo>ol').append(`<li>${topico}</li>`);
					if (indice + 1 === args.topicos.length) $('mensagem>corpo>ol>li').fadeOut();
				});
			} else {
				mensagem(args);
			}
		},1500);
    }
});
// ----------------------------------------------------------------------------------
const inicio = () => {
    if (typeof window.obsstudio != "undefined") {

        window.addEventListener('obsSceneChanged', function (event) {
            socket.emit(empresa, 'obsSceneChanged', event.detail.name);
            if (event.detail.name === 'Mensagem') {
                $(`body>*:not(mensagem)`).fadeOut(200, function () {
                    $(`mensagem`).fadeIn(200);
                });
            }
        })

    };
}
// ----------------------------------------------------------------------------------
function mensagem(mensagem) {
    if (mensagem.tipo.includes("hino") || mensagem.tipo.includes("louvor")) tipo = "louvor"
    else tipo = mensagem.tipo;

    if ((atual === 'Mensagem') && (tipo === 'passagem')) {
        tipo = 'mensagem';
        mensagem.corpo = mensagem.titulo + '.' + mensagem.corpo;
        mensagem.titulo = 'passagem';
    }

    if ((tipo === 'louvor') || (tipo === 'passagem')) {
        mensagem.corpo = decodeURI(mensagem.corpo);

        new Promise((resolve) => {
            if ($(`body>${tipo}>titulo`).html() !== mensagem.titulo) {
                $(`body>${tipo}`).fadeOut(200, () => resolve(true));
            } else resolve(false);
        }).then((fechou) => {
            return new Promise((resolve) => {
                if ($(`body>${tipo}>rodape`).html() !== mensagem.corpo) $(`body>${tipo}>rodape`).fadeOut(200, () => resolve(true))
                else resolve(false);
            })
        }).then((ok) => {
            $(`body>*:not(${tipo})`).fadeOut(200, function () {
                $(`body>${tipo}>titulo`).html(mensagem.titulo);
                $(`body>${tipo}>rodape`).html(mensagem.corpo);
                $(`body>${tipo}>rodape`).fadeIn(200);
                $(`body>${tipo}`).fadeIn(200);
            });
        });
    } else if (tipo === 'mensagem') {
        if ($(`mensagem`).css('display') === 'none') {
            $(`body>*:not(mensagem)`).fadeOut(200, function () {
                $(`mensagem`).fadeIn(200);
            });
        }
        if (mensagem.titulo === 'topico') {
            if (mensagem.status === true) {
                $(`mensagem>corpo>ol>li:eq(${mensagem.indice})`).fadeIn(200);
            } else {
                $(`mensagem>corpo>ol>li:eq(${mensagem.indice})`).fadeOut(200);
            }
        } else if (mensagem.titulo === 'passagem') {
            mensagem.corpo = decodeURI(mensagem.corpo);
            if ($(`mensagem>rodape`).html(mensagem.corpo).css('display') === 'none') $(`mensagem>rodape`).fadeIn(200);
        } else if (mensagem.titulo === 'limpaPassagem') {
            if ($(`mensagem>rodape`).html(mensagem.corpo).css('display') !== 'none') $(`mensagem>rodape`).fadeOut(200);
        }
    }
};