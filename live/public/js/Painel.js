let painelOBS =
  document.currentScript.getAttribute("painelOBS") === "painelOBS";

// Sanitizacao (SEC-013) — dados vem do Liturgia (VPS publica) via getJSON e sao
// interpolados em templates literais HTML. Sem isso, atacante na VPS injeta XSS no Painel.
const SANITIZE_TITULO = { ALLOWED_TAGS: [] }; // titulo aparece em texto puro
const SANITIZE_TEXTO = {
  ALLOWED_TAGS: ["span", "br", "strong", "i"],
  ALLOWED_ATTR: ["style", "class"],
};
function sanitizarTitulo(s) {
  if (typeof s !== "string") return "";
  return window.DOMPurify ? window.DOMPurify.sanitize(s, SANITIZE_TITULO) : s;
}
function sanitizarTexto(s) {
  if (typeof s !== "string") return "";
  return window.DOMPurify ? window.DOMPurify.sanitize(s, SANITIZE_TEXTO) : s;
}
// Escape de valor de atributo HTML (para titulo="...") — DOMPurify nao cobre.
function escAttr(s) {
  if (typeof s !== "string") return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

var query = document.querySelector.bind(document),
  queryAll = document.querySelectorAll.bind(document),
  queryId = document.getElementById.bind(document),
  queryName = document.getElementsByName.bind(document),
  socket = io(servidor, { transports: ["polling", "websocket"], auth: { token: window.SOCKET_TOKEN || "" } }),
  tzoffset = new Date().getTimezoneOffset() * 60000,
  // Culto do dia; `?data=AAAA-MM-DD` abre outra data (ensaio, conferência antes do culto)
  dataEscolhida = new URLSearchParams(location.search).get("data"),
  arquivo = /^\d{4}-\d{2}-\d{2}$/.test(dataEscolhida || "")
    ? dataEscolhida
    : new Date(Date.now() - tzoffset).toISOString().split("T")[0];

const trocarData = (data) => {
  const params = new URLSearchParams(location.search);
  if (data) params.set("data", data);
  else params.delete("data");
  location.search = params.toString();
};

// Envios deste Painel ainda sem eco do servidor (que devolve tudo a todos, inclusive a quem enviou).
// A estrofe marcada (fundo amarelo e selo "Na tela") só continua marcada enquanto é ela que está
// na tela: limpar, fechar, ou outra tela/painel projetar outra coisa tira a marca. O eco atrasado
// de um envio nosso nunca tira a marca do que foi enviado depois.
const pendentes = [];
const chaveEnvio = (evento, args) => `${evento}|${JSON.stringify(args === undefined ? false : args)}`;
const enviar = (evento, payload) => {
  pendentes.push(chaveEnvio(evento, payload));
  if (pendentes.length > 50) pendentes.shift();
  if (payload === undefined) socket.emit(empresa, evento);
  else socket.emit(empresa, evento, payload);
};
const projetar = (tipo, payload) => enviar(tipo, payload);
const tirarDoAr = () => {
  queryAll(".btn-group-vertical > .btn-check:checked").forEach((input) => {
    input.checked = false;
  });
};
// true quando o evento recebido é eco de um envio nosso (e o tira da fila).
const ehEcoProprio = (evento, args) => {
  const i = pendentes.indexOf(chaveEnvio(evento, args));
  if (i === -1) return false;
  pendentes.splice(0, i + 1);
  return true;
};
const mudaATela = (evento, args) =>
  evento === "fecharBiblia" || evento === "fecharJanela" ||
  Boolean(args && typeof args === "object" && "corpo" in args);

const limparTexto = () => {
  tirarDoAr();
  enviar("fecharBiblia");
};

socket.onAny((aplicativo, eventName, args) => {
  if (aplicativo === empresa) {
    if (!ehEcoProprio(eventName, args) && mudaATela(eventName, args)) tirarDoAr();
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

// Selos à direita da estrofe: "Na tela" (só aparece com a estrofe no ar, pelo CSS) e a letra.
const selosEstrofe = (letraHtml = "") =>
  `<span class="selos-estrofe position-absolute top-50 end-0 translate-middle-y me-2"><span class="badge selo-no-ar"><i class="fa-solid fa-tower-broadcast"></i> Na tela</span>${letraHtml}</span>`;

// Balanceia as linhas de letra em slides de no máximo `max` linhas cada,
// distribuindo as linhas excedentes nos primeiros slides.
// Cada item do array corresponde a uma estrofe.
// Ganha uma tag visual (idTag) para identificá-la.
const agruparEmSlides = (letra, max = 4) => {
  const slides = [];
  let contadorEstrofes = 0;

  (letra || []).forEach((item) => {
    if (Trechos.ehDueto(item)) {
      contadorEstrofes++;
      const pares = Trechos.divisoes(item);
      pares.forEach(({ legenda: vozes, projetor: vozesProjetor }, i) => slides.push({ linhas: [], vozes, vozesProjetor, refrao: Boolean(item.refrao), idTag: contadorEstrofes, parte: i + 1, total: pares.length }));
      return;
    }
    if (typeof item !== 'string') return;
    const str = item.trim();
    if (!str) return;
    const isRefrao = str.startsWith("refrao:");
    const conteudo = isRefrao ? str.slice("refrao:".length).trim() : str;

    const linhasItem = conteudo
      .split(/<br\s*\/?>/i)
      .map((l) => l.trim())
      .filter(Boolean);

    contadorEstrofes++;
    let idTag = contadorEstrofes;

    const quantidadeSlides = Math.ceil(linhasItem.length / max);
    const linhasPorSlide = Math.floor(linhasItem.length / quantidadeSlides);
    const sobra = linhasItem.length % quantidadeSlides;
    let inicioLinha = 0;

    for (let i = 0; i < quantidadeSlides; i++) {
      const tamanho = linhasPorSlide + (i < sobra ? 1 : 0);
      slides.push({
        linhas: linhasItem.slice(inicioLinha, inicioLinha + tamanho),
        refrao: isRefrao,
        idTag: idTag,
      });
      inicioLinha += tamanho;
    }
  });

  return slides;
};

const htmlSlideVozes = vozes => {
  const bloco = document.createElement('div');
  Trechos.renderizarDueto(bloco, vozes);
  bloco.querySelectorAll('.voz-linha').forEach(linha => linha.classList.add('linha-truncate'));
  return bloco.innerHTML;
};
const vozesDaSelecao = (button, atributo = 'data-vozes') => {
  try { const vozes = JSON.parse(button.getAttribute(atributo)); return Trechos.ehPar(vozes) ? vozes : undefined; } catch { return undefined; }
};

const formatarVersiculoParaExibicao = (texto) => {
  return texto.replace(/^[^.]+\.(\d+)\.(\d+)\.\s*/, "$1.$2. ");
};
// -----------------------------------------------------------------------------------------
const inicio = () => {
  queryId("dataCulto").value = arquivo;
  mensagem.addEventListener("keyup", function (e) {
    if (e.key === "Enter" || e.keyCode === 13) {
      socket.emit(empresa, "Alerta", mensagem.value);
    }
  });

  $.getJSON(`${cultosUrl}/${arquivo}.json?vozes=1`)
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
                                                                <i class="fa-solid fa-music"></i>&nbsp;${sanitizarTitulo(definicao.titulo)}
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
                                        <input type="radio" class="btn-check" name="btnHino${hino}" id="btnHino${hino}" titulo="${escAttr(definicao.titulo)}" autocomplete="off">
                                        <label class="btn btn-warning text-truncate" for="btnHino${hino}">Título</label>
                                    `);
            agruparEmSlides(definicao.letra).forEach((slide, idx) => {
              const cor = slide.refrao ? "btn-info" : "btn-secondary";
              let tagHtml = selosEstrofe();
              let letraTag = "";
              if (slide.idTag) {
                const corBadge = [
                  "bg-danger",
                  "bg-success",
                  "bg-primary",
                  "selo-roxo", // amarelo é só "na tela"
                  "bg-dark",
                  "bg-light text-dark",
                ][(slide.idTag - 1) % 6];
                letraTag = String.fromCharCode(64 + slide.idTag);
                tagHtml = selosEstrofe(`<span class="badge ${corBadge}" title="Estrofe ${letraTag}">${letraTag}${slide.total > 1 ? ` · ${slide.parte}/${slide.total}` : ""}</span>`);
              }
              const textoLimpo = slide.vozes ? htmlSlideVozes(slide.vozes) : slide.linhas
                .map((l) => `<span class="linha-truncate">${sanitizarTexto(l)}</span>`)
                .join("");
              const textoCorpo = slide.linhas.join("<br>");
              const texto = tagHtml + textoLimpo;
              const id = `btnHino${hino}_${idx}`;
              $(
                `#colapseHino${hino} .accordion-body .btn-group-vertical`,
              ).append(
                `<input type="radio" class="btn-check" name="btnHino${hino}" id="${id}" titulo="${escAttr(definicao.titulo)}" corpo="${encodeURIComponent(textoCorpo)}" ${slide.vozes ? `data-vozes="${escAttr(JSON.stringify(slide.vozes))}" data-vozes-projetor="${escAttr(JSON.stringify(slide.vozesProjetor))}"` : ""} autocomplete="off" data-letra="${letraTag}"><label class="btn ${cor} ${slide.vozes ? "painel-dueto" : ""} position-relative text-start" for="${id}" style="${slide.idTag ? "padding-right: 32px;" : ""}">${texto}</label>`,
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

            $("#corais").append(`<div class="accordion-item" tipo="louvor" categoria="coral">
                                                        <h2 class="accordion-header" id="coral${louvor}">
                                                            <button class="accordion-button collapsed p-2" type="button" data-bs-toggle="collapse" data-bs-target="#colapseCoral${louvor}" aria-expanded="true" aria-controls="colapseCoral${louvor}">
                                                                <i class="fa-solid fa-users"></i>&nbsp;${sanitizarTitulo(definicao.titulo)}
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
                                        <input type="radio" class="btn-check" name="btnCoral${louvor}" id="btnCoral${louvor}" titulo="${escAttr(definicao.titulo)}" autocomplete="off">
                                        <label class="btn btn-warning text-truncate" for="btnCoral${louvor}">Título</label>
                                    `);
            agruparEmSlides(definicao.letra).forEach((slide, idx) => {
              const cor = slide.refrao ? "btn-info" : "btn-secondary";
              let tagHtml = selosEstrofe();
              let letraTag = "";
              if (slide.idTag) {
                const corBadge = [
                  "bg-danger",
                  "bg-success",
                  "bg-primary",
                  "selo-roxo", // amarelo é só "na tela"
                  "bg-dark",
                  "bg-light text-dark",
                ][(slide.idTag - 1) % 6];
                letraTag = String.fromCharCode(64 + slide.idTag);
                tagHtml = selosEstrofe(`<span class="badge ${corBadge}" title="Estrofe ${letraTag}">${letraTag}${slide.total > 1 ? ` · ${slide.parte}/${slide.total}` : ""}</span>`);
              }
              const textoLimpo = slide.vozes ? htmlSlideVozes(slide.vozes) : slide.linhas
                .map((l) => `<span class="linha-truncate">${sanitizarTexto(l)}</span>`)
                .join("");
              const textoCorpo = slide.linhas.join("<br>");
              const texto = tagHtml + textoLimpo;
              const id = `btnCoral${louvor}_${idx}`;
              $(
                `#colapseCoral${louvor} .accordion-body .btn-group-vertical`,
              ).append(
                `<input type="radio" class="btn-check" name="btnCoral${louvor}" id="${id}" titulo="${escAttr(definicao.titulo)}" corpo="${encodeURIComponent(textoCorpo)}" ${slide.vozes ? `data-vozes="${escAttr(JSON.stringify(slide.vozes))}" data-vozes-projetor="${escAttr(JSON.stringify(slide.vozesProjetor))}"` : ""} autocomplete="off" data-letra="${letraTag}"><label class="btn ${cor} ${slide.vozes ? "painel-dueto" : ""} position-relative text-start" for="${id}" style="${slide.idTag ? "padding-right: 32px;" : ""}">${texto}</label>`,
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
                                                                    <i class="fa-solid fa-guitar"></i>&nbsp;${sanitizarTitulo(definicao.titulo)}
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
                                        <input type="radio" class="btn-check" name="btnLouvor${louvor}" id="btnLouvor${louvor}" titulo="${escAttr(definicao.titulo)}" autocomplete="off">
                                        <label class="btn btn-warning text-truncate" for="btnLouvor${louvor}">Título</label>
                                    `);
            agruparEmSlides(definicao.letra).forEach((slide, idx) => {
              const cor = slide.refrao ? "btn-info" : "btn-secondary";
              let tagHtml = selosEstrofe();
              let letraTag = "";
              if (slide.idTag) {
                const corBadge = [
                  "bg-danger",
                  "bg-success",
                  "bg-primary",
                  "selo-roxo", // amarelo é só "na tela"
                  "bg-dark",
                  "bg-light text-dark",
                ][(slide.idTag - 1) % 6];
                letraTag = String.fromCharCode(64 + slide.idTag);
                tagHtml = selosEstrofe(`<span class="badge ${corBadge}" title="Estrofe ${letraTag}">${letraTag}${slide.total > 1 ? ` · ${slide.parte}/${slide.total}` : ""}</span>`);
              }
              const textoLimpo = slide.vozes ? htmlSlideVozes(slide.vozes) : slide.linhas
                .map((l) => `<span class="linha-truncate">${sanitizarTexto(l)}</span>`)
                .join("");
              const textoCorpo = slide.linhas.join("<br>");
              const texto = tagHtml + textoLimpo;
              const id = `btnLouvor${louvor}_${idx}`;
              $(
                `#colapseLouvor${louvor} .accordion-body .btn-group-vertical`,
              ).append(
                `<input type="radio" class="btn-check" name="btnLouvor${louvor}" id="${id}" titulo="${escAttr(definicao.titulo)}" corpo="${encodeURIComponent(textoCorpo)}" ${slide.vozes ? `data-vozes="${escAttr(JSON.stringify(slide.vozes))}" data-vozes-projetor="${escAttr(JSON.stringify(slide.vozesProjetor))}"` : ""} autocomplete="off" data-letra="${letraTag}"><label class="btn ${cor} ${slide.vozes ? "painel-dueto" : ""} position-relative text-start" for="${id}" style="${slide.idTag ? "padding-right: 32px;" : ""}">${texto}</label>`,
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
                                                                    <i class="fa-solid fa-book-bible"></i>&nbsp;${sanitizarTitulo(definicao.titulo)}
                                                                </button>
                                                            </h2>
                                                            <div id="colapsePassagem${passagem}" class="accordion-collapse collapse" aria-labelledby="${passagem}" data-bs-parent="#passagens">
                                                                <div class="accordion-body p-1">
                                                                    <div class="btn-group-vertical w-100" role="group" aria-label="Vertical button group">
                                                                    
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>`);
            // Botão Título: abre a leitura no Projetor e a tarja na Legenda, como no louvor.
            $(`#colapsePassagem${passagem} .accordion-body .btn-group-vertical`).append(`
                                        <input type="radio" class="btn-check" name="btnPassagem${passagem}" id="btnPassagem${passagem}Titulo" titulo="${escAttr(definicao.titulo)}" autocomplete="off">
                                        <label class="btn btn-warning text-truncate" for="btnPassagem${passagem}Titulo">Título</label>
                                    `);
            definicao.texto.forEach((valor, indice) => {
              const versiculoExibicao = formatarVersiculoParaExibicao(valor);
              $(
                `#colapsePassagem${passagem} .accordion-body .btn-group-vertical`,
              ).append(`
                                        <input type="radio" class="btn-check" name="btnPassagem${passagem}" id="btnPassagem${passagem}${indice}" titulo="${escAttr(definicao.titulo)}" autocomplete="off">
                                        <label class="btn btn-secondary text-truncate" for="btnPassagem${passagem}${indice}">${versiculoExibicao}</label>
                                    `);
            });
            break;
          default:
            console.log(`Codigo errado em ${definicao.tipo}`);
        }
      });
    })
    .fail((jqXHR) => {
      const dataBR = (d) => d.split("-").reverse().join("/");
      if (jqXHR.status !== 404) {
        // Falha de verdade (Liturgia fora do ar, rede): aí sim, vermelho.
        $("body").append(`<div class="alert alert-danger m-3" role="alert">
                <i class="fa-solid fa-triangle-exclamation"></i> Não consegui carregar a liturgia de ${dataBR(arquivo)}. Confira a conexão com a Liturgia e recarregue o Painel.
            </div>`);
        return;
      }
      // Dia sem culto é o estado normal fora dos cultos: aviso neutro e o próximo culto cadastrado.
      const diaSemana = new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: "UTC" })
        .format(new Date(`${arquivo}T12:00:00Z`)).replace("-feira", "");
      const $vazio = $(`<div class="estado-vazio" role="status">
                <i class="fa-regular fa-calendar fa-2x estado-icone" aria-hidden="true"></i>
                <div class="estado-titulo">Não há liturgia para ${diaSemana}, ${dataBR(arquivo)}</div>
                <div class="estado-texto estado-proximo d-none"></div>
                <button type="button" class="btn btn-light estado-acao d-none"></button>
                <div class="estado-texto estado-dica">Ou escolha outra data no campo acima.</div>
            </div>`);
      $("body").append($vazio);
      $.getJSON(cultosUrl).done((lista) => {
        const proximo = (Array.isArray(lista) ? lista : [])
          .map((f) => String(f).replace(".json", ""))
          .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d > arquivo)
          .sort()[0];
        if (!proximo) return;
        const diaProximo = new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: "UTC" })
          .format(new Date(`${proximo}T12:00:00Z`)).replace("-feira", "");
        $vazio.find(".estado-proximo").text(`O próximo culto cadastrado é ${diaProximo}, ${dataBR(proximo)}.`).removeClass("d-none");
        $vazio.find(".estado-acao").text(`Abrir o culto de ${dataBR(proximo)}`).removeClass("d-none")
          .on("click", () => trocarData(proximo));
      });
    })
    .always(() => {
      queryAll(".accordion-item").forEach((item) => {
        item.addEventListener("hide.bs.collapse", function () {
          enviar("fecharJanela");
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

      // Teclado para trocar de estrofe (apenas no que estiver aberto)
      document.addEventListener("keyup", function (e) {
        if (e.target.tagName === "INPUT" && e.target.type === "text") return;

        const key = e.key.toUpperCase();
        if (key >= "A" && key <= "Z" && key.length === 1) {
          const activeAccordion = document.querySelector(
            ".accordion-collapse.show",
          );
          if (activeAccordion) {
            const inputs = Array.from(
              activeAccordion.querySelectorAll(`input[data-letra="${key}"]`),
            );
            if (inputs.length > 0) {
              let checkedIndex = inputs.findIndex((input) => input.checked);
              let nextIndex = 0;
              if (checkedIndex !== -1 && checkedIndex < inputs.length - 1) {
                nextIndex = checkedIndex + 1;
              }
              inputs[nextIndex].click();
            }
          }
        }
      });

      queryAll('.accordion .btn-group-vertical>input[type="radio"]').forEach(
        (button) => {
          button.addEventListener("change", function () {
            this.nextElementSibling.style.color = "yellow";
            if (this.nextElementSibling.innerHTML === "Título") {
              projetar(
                $(this).parents(".accordion-item").attr("tipo"),
                {
                  tipo: $(this).parents(".accordion-item").attr("tipo"),
                  // O coral viaja como "louvor"; a categoria deixa a abertura dizer "Coral".
                  categoria: $(this).parents(".accordion-item").attr("categoria"),
                  titulo: this.getAttribute("titulo"),
                  corpo: "",
                },
              );
            } else {
              const corpoCompleto = this.getAttribute("corpo")
                ? decodeURIComponent(this.getAttribute("corpo"))
                : this.nextElementSibling.innerHTML;
              projetar(
                $(this).parents(".accordion-item").attr("tipo"),
                {
                  tipo: $(this).parents(".accordion-item").attr("tipo"),
                  // O coral viaja como "louvor"; a categoria deixa a abertura dizer "Coral".
                  categoria: $(this).parents(".accordion-item").attr("categoria"),
                  titulo: this.getAttribute("titulo"),
                  corpo: encodeURI(corpoCompleto),
                  vozes: vozesDaSelecao(this),
                  vozesProjetor: vozesDaSelecao(this, "data-vozes-projetor"),
                },
              );
            }
          });
          button.addEventListener("dblclick", function () {
            if (this.nextElementSibling.innerHTML === "Título") {
              projetar(
                $(this).parents(".accordion-item").attr("tipo"),
                {
                  tipo: $(this).parents(".accordion-item").attr("tipo"),
                  // O coral viaja como "louvor"; a categoria deixa a abertura dizer "Coral".
                  categoria: $(this).parents(".accordion-item").attr("categoria"),
                  titulo: this.getAttribute("titulo"),
                  corpo: "",
                },
              );
            } else {
              const corpoCompleto = this.getAttribute("corpo")
                ? decodeURIComponent(this.getAttribute("corpo"))
                : this.nextElementSibling.innerHTML;
              projetar(
                $(this).parents(".accordion-item").attr("tipo"),
                {
                  tipo: $(this).parents(".accordion-item").attr("tipo"),
                  // O coral viaja como "louvor"; a categoria deixa a abertura dizer "Coral".
                  categoria: $(this).parents(".accordion-item").attr("categoria"),
                  titulo: this.getAttribute("titulo"),
                  corpo: encodeURI(corpoCompleto),
                  vozes: vozesDaSelecao(this),
                  vozesProjetor: vozesDaSelecao(this, "data-vozes-projetor"),
                },
              );
            }
          });
          // O cartão visível é o label; duplo clique deve reenviar mesmo já marcado.
          button.nextElementSibling.addEventListener("dblclick", () => button.dispatchEvent(new MouseEvent("dblclick")));
        },
      );
    });
};

const urlBiblia = (livro_id, capitulo, versao, nomeLivro, ir) => {
  const q = new URLSearchParams({ nomeLivro, livro: livro_id, capitulo, biblia: versao });
  if (ir) q.set("ir", ir);
  return `Biblia?${q}`;
};

const _bibliaWins = new Set();
let _bibliaWinTimer = null;

const monitorarJanelasBiblia = () => {
  if (_bibliaWinTimer) return;

  _bibliaWinTimer = setInterval(() => {
    _bibliaWins.forEach((janela) => {
      if (janela.closed) _bibliaWins.delete(janela);
    });

    if (_bibliaWins.size === 0) {
      clearInterval(_bibliaWinTimer);
      _bibliaWinTimer = null;
      // Fechar a última janela da Bíblia limpa as telas: nada fica marcado como no ar.
      tirarDoAr();
      enviar("fecharBiblia");
    }
  }, 500);
};

// Abre a janela da Bíblia no capítulo; `ir` posiciona num versículo sem projetá-lo
const listaVersiculos = (livro_id, capitulo, versao, nomeLivro, ir = null) => {
  _bibliaWins.forEach((janela) => {
    if (janela.closed) _bibliaWins.delete(janela);
  });

  const deslocamento = (_bibliaWins.size % 8) * 24;
  let left = (screen.width - 350) / 2 + deslocamento,
    top = (screen.height - 800) / 4 + deslocamento;

  // Fecha todos os accordions abertos (hino, louvor, passagem, coral)
  document.querySelectorAll(".accordion-collapse.show").forEach((el) => {
    bootstrap.Collapse.getOrCreateInstance(el).hide();
  });

  const bibliaWin = window.open(
    urlBiblia(livro_id, capitulo, versao, nomeLivro, ir),
    "_blank",
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

  if (!bibliaWin) return;

  _bibliaWins.add(bibliaWin);
  monitorarJanelasBiblia();
};
