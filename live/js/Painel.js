let painelOBS = (document.currentScript.getAttribute('painelOBS') === 'painelOBS');
var query = document.querySelector.bind(document),
    queryAll = document.querySelectorAll.bind(document),
    queryId = document.getElementById.bind(document),
    queryName = document.getElementsByName.bind(document),
    servidor = "10.0.0.253:3000",
    empresa = "IPE.Transmissão",
    socket = io(servidor, { transports: ["polling", "websocket"] }),
    tzoffset = (new Date()).getTimezoneOffset() * 60000,
    arquivo = (new Date(Date.now() - tzoffset)).toISOString().split('T')[0],
    culto;

socket.onAny((aplicativo, eventName, args) => {
    if (aplicativo === empresa) {
        if (eventName === "pegarDadosMensagem") {
            socket.emit(empresa, "dadosMensagem", culto);
        } else if ((painelOBS)&&(eventName === "obsSceneChanged")) {
            $('body>div:not(.form-check):not(.biblia)').hide();
            $('.accordion-button:not(.collapsed)').addClass('collapsed');
            $('.accordion-collapse.show').removeClass('show');
            if (args.toUpperCase().includes("HINO")) {
                $('body>#hinos').show();
            } else if (args.toUpperCase().includes("LOUVOR")) {
                $('body>#louvores').show();
            } else if (args.toUpperCase().includes("PASSAGEM")) {
                $('body>#passagens').show();
            } else if (args.toUpperCase().includes("MENSAGEM")) {
                $('body>#mensagens').show();
            }
        }
    }
});
// -----------------------------------------------------------------------------------------
const inicio = () => {
	
				mensagem.addEventListener('keyup', function(e){
				if (e.key === 'Enter' || e.keyCode === 13) {
					socket.emit(empresa, 'Alerta', mensagem.value);
				}
			});


    $.getJSON(`../cultos/${arquivo}.json`)
        .done(definicoes => {
            let hino = louvor = passagem = mensagem = extra = 0;
            definicoes.forEach(definicao => {
                switch (definicao.tipo) {
                    case 'hino':
                        hino++;
                        if (hino == 1) $("body").append(`<div id="hinos" class="accordion accordion-flush"></div>`);

                        $("#hinos").append(`<div class="accordion-item" tipo="hino">
                                                        <h2 class="accordion-header" id="hino${hino}">
                                                            <button class="accordion-button collapsed p-2" type="button" data-bs-toggle="collapse" data-bs-target="#colapseHino${hino}" aria-expanded="true" aria-controls="colapseHino${hino}">
                                                                <i class="fa-solid fa-music"></i>&nbsp;${definicao.titulo}
                                                            </button>
                                                        </h2>
                                                        <div id="colapseHino${hino}" class="accordion-collapse collapse" aria-labelledby="${hino}" data-bs-parent="#hinos">
                                                            <div class="accordion-body p-1">
                                                                <div class="btn-group-vertical w-100" role="group" aria-label="Vertical Basic radio toggle button group">
                                                                
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>`);

                        $(`#colapseHino${hino} .accordion-body .btn-group-vertical`)
                            .append(`
                                        <input type="radio" class="btn-check" name="btnHino${hino}" id="btnHino${hino}" titulo="${definicao.titulo}" autocomplete="off">
                                        <label class="btn btn-warning" for="btnHino${hino}">Título</label>
                                    `);
                        definicao.letra.forEach((valor, indice) => {
                            let cor = 'btn-secondary';
                            if (valor.includes('refrao:')) {
                                valor = valor.replace('refrao:', '');
                                cor = 'btn-info';
                            }
                            $(`#colapseHino${hino} .accordion-body .btn-group-vertical`)
                                .append(`
                                            <input type="radio" class="btn-check" name="btnHino${hino}" id="btnHino${hino}${indice}" titulo="${definicao.titulo}" autocomplete="off">
                                            <label class="btn ${cor}" for="btnHino${hino}${indice}">${valor}</label>
                                        `);
                        });
                        break;
                    case 'louvor':
                        louvor++;
                        if (louvor == 1) $("body").append(`<div id="louvores" class="accordion accordion-flush"></div>`);

                        $("#louvores").append(`<div class="accordion-item" tipo="louvor">
                                                            <h2 class="accordion-header" id="louvor${louvor}">
                                                                <button class="accordion-button collapsed p-2" type="button" data-bs-toggle="collapse" data-bs-target="#colapseLouvor${louvor}" aria-expanded="true" aria-controls="colapseLouvor${louvor}">
                                                                    <i class="fa-solid fa-guitar"></i>&nbsp;${definicao.titulo}
                                                                </button>
                                                            </h2>
                                                            <div id="colapseLouvor${louvor}" class="accordion-collapse collapse" aria-labelledby="${louvor}" data-bs-parent="#louvores">
                                                                <div class="accordion-body p-1">
                                                                    <div class="btn-group-vertical w-100" role="group" aria-label="Vertical button group">
                                                                    
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>`);
                        $(`#colapseLouvor${louvor} .accordion-body .btn-group-vertical`)
                            .append(`
                                        <input type="radio" class="btn-check" name="btnLouvor${louvor}" id="btnLouvor${louvor}" titulo="${definicao.titulo}" autocomplete="off">
                                        <label class="btn btn-warning" for="btnLouvor${louvor}">Título</label>
                                    `);
                        definicao.letra.forEach((valor, indice) => {
                            let cor = 'btn-secondary';
                            if (valor.includes('refrao:')) {
                                valor = valor.replace('refrao:', '');
                                cor = 'btn-info';
                            }
                            $(`#colapseLouvor${louvor} .accordion-body .btn-group-vertical`)
                                .append(`
                                            <input type="radio" class="btn-check" name="btnLouvor${louvor}" id="btnLouvor${louvor}${indice}" titulo="${definicao.titulo}" autocomplete="off">
                                            <label class="btn ${cor}" for="btnLouvor${louvor}${indice}">${valor}</label>
                                        `);
                        });
                        break;
                    case 'passagem':
                        passagem++;
                        if (passagem == 1) $("body").append(`<div id="passagens" class="accordion accordion-flush"></div>`);

                        $("#passagens").append(`<div class="accordion-item" tipo="passagem">
                                                            <h2 class="accordion-header" id="passagem${passagem}">
                                                                <button class="accordion-button collapsed p-2" type="button" data-bs-toggle="collapse" data-bs-target="#colapsePassagem${passagem}" aria-expanded="true" aria-controls="colapsePassagem${passagem}">
                                                                    <i class="fa-solid fa-book-bible"></i>&nbsp;${definicao.titulo}
                                                                </button>
                                                            </h2>
                                                            <div id="colapsePassagem${passagem}" class="accordion-collapse collapse" aria-labelledby="${passagem}" data-bs-parent="#passagens">
                                                                <div class="accordion-body p-1">
                                                                    <div class="btn-group-vertical w-100" role="group" aria-label="Vertical button group">
                                                                    
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>`);
                        definicao.texto.forEach((valor, indice) => $(`#colapsePassagem${passagem} .accordion-body .btn-group-vertical`)
                            .append(`
                                        <input type="radio" class="btn-check" name="btnPassagem${passagem}" id="btnPassagem${passagem}${indice}" titulo="${definicao.titulo}" autocomplete="off">
                                        <label class="btn btn-secondary" for="btnPassagem${passagem}${indice}">${valor}</label>
                                    `)
                        );
                        break;
                    case 'mensagem':
                        mensagem++;
                        culto = definicao;
                        socket.emit(empresa, "dadosMensagem", culto);
                        if (mensagem == 1) $("body").append(`<div id="mensagens" class="accordion accordion-flush"></div>`);
                        $("#mensagens").append(`<div class="accordion-item" tipo="mensagem">
                                                            <h2 class="accordion-header" id="mensagem${mensagem}">
                                                                <button class="accordion-button collapsed p-2" type="button" data-bs-toggle="collapse" data-bs-target="#colapseMensagem${mensagem}" aria-expanded="true" aria-controls="colapseMensagem${mensagem}">
                                                                    <i class="fa-solid fa-cross"></i>&nbsp;${definicao.titulo}
                                                                </button>
                                                            </h2>
                                                            <div id="colapseMensagem${mensagem}" class="accordion-collapse collapse" aria-labelledby="${mensagem}" data-bs-parent="#mensagens">
                                                                <div class="accordion-body p-1">
                                                                    
                                                                </div>
                                                            </div>
                                                        </div>`);

                        $(`#colapseMensagem${mensagem} .accordion-body`).append(`<div class="btn-group-vertical w-100" role="group" aria-label="Vertical button group" id="mensagemTopicos"></div>`);
                        definicao.topicos.forEach((valor, indice) => $(`#colapseMensagem${mensagem} .accordion-body #mensagemTopicos`)
                            .append(`
                                        <input type="checkbox" class="btn-check" name="btnMensagemTopico${mensagem}" id="btnMensagemTopico${mensagem}${indice}" titulo="${definicao.titulo}" autocomplete="off">
                                        <label class="btn btn-secondary" for="btnMensagemTopico${mensagem}${indice}">${valor}</label>
                                    `)
                        );

                        $(`#colapseMensagem${mensagem} .accordion-body`).append(`<div class="btn-group-vertical w-100" role="group" aria-label="Vertical button group" id="mensagemPassagens"></div>`);
                        $(`#colapseMensagem${mensagem} .accordion-body #mensagemPassagens`)
                            .append(`
                                        <input type="radio" class="btn-check" name="btnMensagemPassagem${mensagem}" id="btnMensagemPassagem${mensagem}" titulo="" autocomplete="off">
                                        <label class="btn btn-warning" for="btnMensagemPassagem${mensagem}">${definicao.passagem}</label>
                                    `);
                        definicao.texto.forEach((valor, indice) => $(`#colapseMensagem${mensagem} .accordion-body #mensagemPassagens`)
                            .append(`
                                        <input type="radio" class="btn-check" name="btnMensagemPassagem${mensagem}" id="btnMensagemPassagem${mensagem}${indice}" titulo="${definicao.titulo}" autocomplete="off">
                                        <label class="btn btn-secondary" for="btnMensagemPassagem${mensagem}${indice}">${valor}</label>
                                    `)
                        );
                        break;
                    case 'extra':
                        break;
                    default:
                        console.log(`Codigo errado em ${definicao.tipo}`);
                }
            });
        }).always(() => {
            queryAll(".accordion-item").forEach(item => {
                item.addEventListener('hide.bs.collapse', function () {
                    socket.emit(empresa, "fecharJanela");
                });
            });

            queryAll('.accordion:not(#mensagens) .btn-group-vertical>input[type="radio"]').forEach(button => {
                button.addEventListener('change', function () {
					this.nextElementSibling.style.color = 'yellow';
                    if (this.nextElementSibling.innerHTML === 'Título') {
                        socket.emit(empresa, $(this).parents('.accordion-item').attr('tipo'), { tipo: $(this).parents('.accordion-item').attr('tipo'), titulo: this.getAttribute('titulo'), corpo: '' });
                    } else {
                        socket.emit(empresa, $(this).parents('.accordion-item').attr('tipo'), { tipo: $(this).parents('.accordion-item').attr('tipo'), titulo: this.getAttribute('titulo'), corpo: encodeURI(this.nextElementSibling.innerHTML) });
                    }
                })
                button.addEventListener('dblclick', function () {
                    if (this.nextElementSibling.innerHTML === 'Título') {
                        socket.emit(empresa, $(this).parents('.accordion-item').attr('tipo'), { tipo: $(this).parents('.accordion-item').attr('tipo'), titulo: this.getAttribute('titulo'), corpo: '' });
                    } else {
                        socket.emit(empresa, $(this).parents('.accordion-item').attr('tipo'), { tipo: $(this).parents('.accordion-item').attr('tipo'), titulo: this.getAttribute('titulo'), corpo: encodeURI(this.nextElementSibling.innerHTML) });
                    }
                })
            });

            queryAll('#mensagens .btn-group-vertical>input[type="radio"]').forEach(button => {
                button.addEventListener('change', function () {
                    if (this.nextElementSibling.classList.contains('btn-warning')) {
                        socket.emit(empresa, $(this).parents('.accordion-item').attr('tipo'), { tipo: $(this).parents('.accordion-item').attr('tipo'), titulo: 'limpaPassagem' });
                    } else {
                        socket.emit(empresa, $(this).parents('.accordion-item').attr('tipo'), { tipo: $(this).parents('.accordion-item').attr('tipo'), titulo: 'passagem', corpo: encodeURI(this.nextElementSibling.innerHTML) });
                    }
                })
                button.addEventListener('dblclick', function () {
                    if (this.nextElementSibling.classList.contains('btn-warning')) {
                        socket.emit(empresa, $(this).parents('.accordion-item').attr('tipo'), { tipo: $(this).parents('.accordion-item').attr('tipo'), titulo: 'limpaPassagem' });
                    } else {
                        socket.emit(empresa, $(this).parents('.accordion-item').attr('tipo'), { tipo: $(this).parents('.accordion-item').attr('tipo'), titulo: 'passagem', corpo: encodeURI(this.nextElementSibling.innerHTML) });
                    }
                })
            });

            queryAll('.btn-group-vertical>input[type="checkbox"]').forEach((button, index) => {
                button.addEventListener('change', function () {
                    socket.emit(empresa, $(this).parents('.accordion-item').attr('tipo'), { tipo: $(this).parents('.accordion-item').attr('tipo'), titulo: 'topico', corpo: this.getAttribute('titulo'), indice: index, status: this.checked });
                })
                button.addEventListener('dblclick', function () {
                    socket.emit(empresa, $(this).parents('.accordion-item').attr('tipo'), { tipo: $(this).parents('.accordion-item').attr('tipo'), titulo: 'topico', corpo: this.getAttribute('titulo'), indice: index, status: this.checked });
                })
            });
			
        });
}

const capitulos = cap => {
    capitulo.setAttribute('max', livro.querySelector(`option[value='${cap}']`).getAttribute('capitulos'));
}

const listaVersiculos = (livro_id, capitulo, versao) => {
    let nomeLivro = livro.options[livro.selectedIndex].text,
        left = (screen.width - 350) / 2,
        top = (screen.height - 800) / 4;
    window.open(`Biblia.php?nomeLivro=${nomeLivro}&livro=${livro_id}&capitulo=${capitulo}&biblia=${versao}`, `${nomeLivro}${capitulo}`, `toolbar=no,
                                    location=no,
                                    status=no,
                                    menubar=no,
                                    scrollbars=no,
                                    resizable=no,
                                    width=350,
									height=800,
                                    top=${top},
                                    left=${left}`);
}