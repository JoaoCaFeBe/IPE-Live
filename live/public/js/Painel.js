let painelOBS =
  document.currentScript.getAttribute("painelOBS") === "painelOBS";
var query = document.querySelector.bind(document),
  queryAll = document.querySelectorAll.bind(document),
  queryId = document.getElementById.bind(document),
  queryName = document.getElementsByName.bind(document),
  socket = io(servidor, { transports: ["polling", "websocket"] }),
  tzoffset = new Date().getTimezoneOffset() * 60000,
  arquivo = new Date(Date.now() - tzoffset).toISOString().split("T")[0];

socket.onAny((aplicativo, eventName, args) => {
  if (aplicativo === empresa) {
    if (painelOBS && eventName === "obsSceneChanged") {
      $("body>div:not(.form-check):not(.biblia)").hide();
      $(".accordion-button:not(.collapsed)").addClass("collapsed");
      $(".accordion-collapse.show").removeClass("show");
      if (args.toUpperCase().includes("HINO")) {
        $("body>#hinos").show();
      } else if (args.toUpperCase().includes("LOUVOR")) {
        $("body>#louvores").show();
      } else if (args.toUpperCase().includes("PASSAGEM")) {
        $("body>#passagens").show();
      }
    }
  }
});

// Agrupa as linhas de letra em slides de no máximo `max` linhas cada.
// Cada item do array corresponde a uma estrofe. Se a estrofe for dividida em mais de um slide,
// ganha uma tag visual (idTag) para identificá-la.
const agruparEmSlides = (letra, max = 4) => {
  const slides = [];
  let contadorEstrofesDivididas = 0;

  (letra || []).forEach((item) => {
    const str = (item || "").trim();
    if (!str) return;
    const isRefrao = str.startsWith("refrao:");
    const conteudo = isRefrao ? str.slice("refrao:".length).trim() : str;

    const linhasItem = conteudo
      .split(/<br\s*\/?>/i)
      .map((l) => l.trim())
      .filter(Boolean);

    // Verifica se esta estrofe em particular precisa ser dividida
    const precisaDividir = linhasItem.length > max;
    // Se ela for dividida, ganha um identificador único de estrofe dividida na música
    let idTag = null;
    if (precisaDividir) {
      contadorEstrofesDivididas++;
      idTag = contadorEstrofesDivididas;
    }

    let bloco = { linhas: [], refrao: isRefrao, idTag: idTag };

    linhasItem.forEach((linha) => {
      if (bloco.linhas.length >= max) {
        slides.push(bloco);
        bloco = { linhas: [], refrao: isRefrao, idTag: idTag };
      }
      bloco.linhas.push(linha);
    });

    if (bloco.linhas.length > 0) {
      slides.push(bloco);
    }
  });

  return slides;
};

const formatarVersiculoParaExibicao = (texto) => {
  return texto.replace(/^[^.]+\.(\d+)\.(\d+)\.\s*/, "$1.$2. ");
};
// -----------------------------------------------------------------------------------------
const inicio = () => {
  mensagem.addEventListener("keyup", function (e) {
    if (e.key === "Enter" || e.keyCode === 13) {
      socket.emit(empresa, "Alerta", mensagem.value);
    }
  });

  $.getJSON(`${cultosUrl}/${arquivo}.json`)
    .done((definicoes) => {
      let hino = 0,
        louvor = 0,
        passagem = 0;
      definicoes.forEach((definicao) => {
        switch (definicao.tipo) {
          case "hino":
            hino++;
            if (hino == 1)
              $("body").append(
                `<div id="hinos" class="accordion accordion-flush"></div>`,
              );

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
                                        <label class="btn btn-warning text-truncate" for="btnHino${hino}">Título</label>
                                    `);
            agruparEmSlides(definicao.letra).forEach((slide, idx) => {
              const cor = slide.refrao ? "btn-info" : "btn-secondary";
              let tagHtml = "";
              if (slide.idTag) {
                const corBadge = [
                  "bg-danger",
                  "bg-success",
                  "bg-primary",
                  "bg-warning text-dark",
                  "bg-dark",
                  "bg-light text-dark",
                ][(slide.idTag - 1) % 6];
                const letraTag = String.fromCharCode(64 + slide.idTag);
                tagHtml = `<span class="badge ${corBadge} position-absolute top-50 end-0 translate-middle-y me-2" title="Parte da mesma estrofe">${letraTag}</span>`;
              }
              const textoLimpo = slide.linhas
                .map((l) => `<span class="linha-truncate">${l}</span>`)
                .join("");
              const textoCorpo = slide.linhas.join("<br>");
              const texto = tagHtml + textoLimpo;
              const id = `btnHino${hino}_${idx}`;
              $(
                `#colapseHino${hino} .accordion-body .btn-group-vertical`,
              ).append(
                `<input type="radio" class="btn-check" name="btnHino${hino}" id="${id}" titulo="${definicao.titulo}" corpo="${encodeURIComponent(textoCorpo)}" autocomplete="off"><label class="btn ${cor} position-relative text-start" for="${id}" style="${slide.idTag ? "padding-right: 32px;" : ""}">${texto}</label>`,
              );
            });
            break;
          case "coral":
            louvor++;
            if (louvor == 1)
              $("body").append(
                `<div id="louvores" class="accordion accordion-flush"></div>`,
              );
            // Se a seção coral ainda não foi criada, cria-a separada
            if (!$("#corais").length)
              $("body").append(
                `<div id="corais" class="accordion accordion-flush"></div>`,
              );

            $("#corais").append(`<div class="accordion-item" tipo="louvor">
                                                        <h2 class="accordion-header" id="coral${louvor}">
                                                            <button class="accordion-button collapsed p-2" type="button" data-bs-toggle="collapse" data-bs-target="#colapseCoral${louvor}" aria-expanded="true" aria-controls="colapseCoral${louvor}">
                                                                <i class="fa-solid fa-users"></i>&nbsp;${definicao.titulo}
                                                            </button>
                                                        </h2>
                                                        <div id="colapseCoral${louvor}" class="accordion-collapse collapse" aria-labelledby="coral${louvor}" data-bs-parent="#corais">
                                                            <div class="accordion-body p-1">
                                                                <div class="btn-group-vertical w-100" role="group">
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>`);

            $(`#colapseCoral${louvor} .accordion-body .btn-group-vertical`)
              .append(`
                                        <input type="radio" class="btn-check" name="btnCoral${louvor}" id="btnCoral${louvor}" titulo="${definicao.titulo}" autocomplete="off">
                                        <label class="btn btn-warning text-truncate" for="btnCoral${louvor}">Título</label>
                                    `);
            agruparEmSlides(definicao.letra).forEach((slide, idx) => {
              const cor = slide.refrao ? "btn-info" : "btn-secondary";
              let tagHtml = "";
              if (slide.idTag) {
                const corBadge = [
                  "bg-danger",
                  "bg-success",
                  "bg-primary",
                  "bg-warning text-dark",
                  "bg-dark",
                  "bg-light text-dark",
                ][(slide.idTag - 1) % 6];
                const letraTag = String.fromCharCode(64 + slide.idTag);
                tagHtml = `<span class="badge ${corBadge} position-absolute top-50 end-0 translate-middle-y me-2" title="Parte da mesma estrofe">${letraTag}</span>`;
              }
              const textoLimpo = slide.linhas
                .map((l) => `<span class="linha-truncate">${l}</span>`)
                .join("");
              const textoCorpo = slide.linhas.join("<br>");
              const texto = tagHtml + textoLimpo;
              const id = `btnCoral${louvor}_${idx}`;
              $(
                `#colapseCoral${louvor} .accordion-body .btn-group-vertical`,
              ).append(
                `<input type="radio" class="btn-check" name="btnCoral${louvor}" id="${id}" titulo="${definicao.titulo}" corpo="${encodeURIComponent(textoCorpo)}" autocomplete="off"><label class="btn ${cor} position-relative text-start" for="${id}" style="${slide.idTag ? "padding-right: 32px;" : ""}">${texto}</label>`,
              );
            });
            break;
          case "louvor":
            louvor++;
            if (louvor == 1)
              $("body").append(
                `<div id="louvores" class="accordion accordion-flush"></div>`,
              );

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
                                        <label class="btn btn-warning text-truncate" for="btnLouvor${louvor}">Título</label>
                                    `);
            agruparEmSlides(definicao.letra).forEach((slide, idx) => {
              const cor = slide.refrao ? "btn-info" : "btn-secondary";
              let tagHtml = "";
              if (slide.idTag) {
                const corBadge = [
                  "bg-danger",
                  "bg-success",
                  "bg-primary",
                  "bg-warning text-dark",
                  "bg-dark",
                  "bg-light text-dark",
                ][(slide.idTag - 1) % 6];
                const letraTag = String.fromCharCode(64 + slide.idTag);
                tagHtml = `<span class="badge ${corBadge} position-absolute top-50 end-0 translate-middle-y me-2" title="Parte da mesma estrofe">${letraTag}</span>`;
              }
              const textoLimpo = slide.linhas
                .map((l) => `<span class="linha-truncate">${l}</span>`)
                .join("");
              const textoCorpo = slide.linhas.join("<br>");
              const texto = tagHtml + textoLimpo;
              const id = `btnLouvor${louvor}_${idx}`;
              $(
                `#colapseLouvor${louvor} .accordion-body .btn-group-vertical`,
              ).append(
                `<input type="radio" class="btn-check" name="btnLouvor${louvor}" id="${id}" titulo="${definicao.titulo}" corpo="${encodeURIComponent(textoCorpo)}" autocomplete="off"><label class="btn ${cor} position-relative text-start" for="${id}" style="${slide.idTag ? "padding-right: 32px;" : ""}">${texto}</label>`,
              );
            });
            break;
          case "passagem":
            passagem++;
            if (passagem == 1)
              $("body").append(
                `<div id="passagens" class="accordion accordion-flush"></div>`,
              );

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
            definicao.texto.forEach((valor, indice) => {
              const versiculoExibicao = formatarVersiculoParaExibicao(valor);
              $(
                `#colapsePassagem${passagem} .accordion-body .btn-group-vertical`,
              ).append(`
                                        <input type="radio" class="btn-check" name="btnPassagem${passagem}" id="btnPassagem${passagem}${indice}" titulo="${definicao.titulo}" autocomplete="off">
                                        <label class="btn btn-secondary text-truncate" for="btnPassagem${passagem}${indice}">${versiculoExibicao}</label>
                                    `);
            });
            break;
          default:
            console.log(`Codigo errado em ${definicao.tipo}`);
        }
      });
    })
    .fail((jqXHR, textStatus, errorThrown) => {
      $("body").append(`<div class="alert alert-danger m-3" role="alert">
                <i class="fa-solid fa-triangle-exclamation"></i> Erro ao carregar o culto do dia (${arquivo}.json): ${textStatus}
            </div>`);
    })
    .always(() => {
      queryAll(".accordion-item").forEach((item) => {
        item.addEventListener("hide.bs.collapse", function () {
          socket.emit(empresa, "fecharJanela");
          // Limpa seleção e cor amarela dos itens do accordion que fechou
          this.querySelectorAll(
            'input[type="radio"], input[type="checkbox"]',
          ).forEach((input) => {
            input.checked = false;
          });
          this.querySelectorAll("label").forEach((label) => {
            label.style.color = "";
          });
        });
      });

      // Fecha acordeons de outros grupos ao abrir um novo
      document.addEventListener("show.bs.collapse", function (e) {
        const grupoAtual = e.target.closest(".accordion");
        document
          .querySelectorAll(".accordion-collapse.show")
          .forEach((aberto) => {
            if (aberto.closest(".accordion") !== grupoAtual) {
              bootstrap.Collapse.getOrCreateInstance(aberto).hide();
            }
          });
      });

      queryAll('.accordion .btn-group-vertical>input[type="radio"]').forEach(
        (button) => {
          button.addEventListener("change", function () {
            this.nextElementSibling.style.color = "yellow";
            if (this.nextElementSibling.innerHTML === "Título") {
              socket.emit(
                empresa,
                $(this).parents(".accordion-item").attr("tipo"),
                {
                  tipo: $(this).parents(".accordion-item").attr("tipo"),
                  titulo: this.getAttribute("titulo"),
                  corpo: "",
                },
              );
            } else {
              const corpoCompleto = this.getAttribute("corpo")
                ? decodeURIComponent(this.getAttribute("corpo"))
                : this.nextElementSibling.innerHTML;
              socket.emit(
                empresa,
                $(this).parents(".accordion-item").attr("tipo"),
                {
                  tipo: $(this).parents(".accordion-item").attr("tipo"),
                  titulo: this.getAttribute("titulo"),
                  corpo: encodeURI(corpoCompleto),
                },
              );
            }
          });
          button.addEventListener("dblclick", function () {
            if (this.nextElementSibling.innerHTML === "Título") {
              socket.emit(
                empresa,
                $(this).parents(".accordion-item").attr("tipo"),
                {
                  tipo: $(this).parents(".accordion-item").attr("tipo"),
                  titulo: this.getAttribute("titulo"),
                  corpo: "",
                },
              );
            } else {
              const corpoCompleto = this.getAttribute("corpo")
                ? decodeURIComponent(this.getAttribute("corpo"))
                : this.nextElementSibling.innerHTML;
              socket.emit(
                empresa,
                $(this).parents(".accordion-item").attr("tipo"),
                {
                  tipo: $(this).parents(".accordion-item").attr("tipo"),
                  titulo: this.getAttribute("titulo"),
                  corpo: encodeURI(corpoCompleto),
                },
              );
            }
          });
        },
      );
    });
};

const capitulos = (cap) => {
  capitulo.setAttribute(
    "max",
    livro.querySelector(`option[value='${cap}']`).getAttribute("capitulos"),
  );
};

let _bibliaWin = null,
  _bibliaWinTimer = null;

const listaVersiculos = (livro_id, capitulo, versao) => {
  let nomeLivro = livro.options[livro.selectedIndex].text,
    left = (screen.width - 350) / 2,
    top = (screen.height - 800) / 4;

  // Fecha todos os accordions abertos (hino, louvor, passagem, coral)
  document.querySelectorAll(".accordion-collapse.show").forEach((el) => {
    bootstrap.Collapse.getOrCreateInstance(el).hide();
  });

  // Se já há uma janela aberta, foca ela em vez de abrir outra
  if (_bibliaWin && !_bibliaWin.closed) {
    _bibliaWin.location.href = `Biblia?nomeLivro=${encodeURIComponent(nomeLivro)}&livro=${livro_id}&capitulo=${capitulo}&biblia=${versao}`;
    _bibliaWin.focus();
    return;
  }

  _bibliaWin = window.open(
    `Biblia?nomeLivro=${nomeLivro}&livro=${livro_id}&capitulo=${capitulo}&biblia=${versao}`,
    `${nomeLivro}${capitulo}`,
    `toolbar=no,
                                    location=no,
                                    status=no,
                                    menubar=no,
                                    scrollbars=no,
                                    resizable=no,
                                    width=350,
									height=800,
                                    top=${top},
                                    left=${left}`,
  );

  // Monitora o fechamento da janela e emite fecharBiblia automaticamente
  if (_bibliaWinTimer) clearInterval(_bibliaWinTimer);
  _bibliaWinTimer = setInterval(() => {
    if (_bibliaWin && _bibliaWin.closed) {
      clearInterval(_bibliaWinTimer);
      _bibliaWinTimer = null;
      _bibliaWin = null;
      socket.emit(empresa, "fecharBiblia");
    }
  }, 500);
};
