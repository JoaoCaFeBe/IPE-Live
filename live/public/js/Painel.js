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
    : new Date(Date.now() - tzoffset).toISOString().split("T")[0],
  // Evento (?evento=slug, validado no servidor em EVENTO): liturgia "AAAA-MM-DD@slug" e canal próprio.
  // Sem evento, a liturgia é a da data: o culto congregacional.
  chaveLiturgia = (data) => (EVENTO ? `${data}@${EVENTO}` : data),
  nomeDoEvento = EVENTO ? (EVENTO.charAt(0).toUpperCase() + EVENTO.slice(1)).replace(/-/g, " ") : "";

/**
 * Ao lado da data: o que este Painel apresenta ("Culto congregacional" ou o nome do evento) e, se o
 * dia tem evento, o seletor para trocar. Trocar recarrega o Painel no canal do escolhido (cada evento
 * tem canal próprio no Socket), mantendo a data. Trocar só a data mantém o evento: nunca muda de canal
 * sozinho no meio de uma apresentação.
 */
const montarSeletorEvento = () => {
  const nomeDe = (slug, nomes) => (nomes && nomes[slug]) || (slug.charAt(0).toUpperCase() + slug.slice(1)).replace(/-/g, " ");
  const descrever = (nomes) => {
    const $d = $("#descricaoCulto");
    $d.toggleClass("evento", !!EVENTO);
    // O Font Awesome troca <i> por <svg>: o ícone se refaz inteiro
    $d.find(".ico").html(`<i class="fa-solid ${EVENTO ? "fa-people-roof" : "fa-church"}"></i>`);
    $d.find(".txt").text(EVENTO ? nomeDe(EVENTO, nomes) : "Culto congregacional");
    if (EVENTO) {
      nomeDoEvento = nomeDe(EVENTO, nomes);
      document.title = `Painel — ${nomeDoEvento}`;
    }
    $("#descricaoCulto").attr("title", EVENTO
      ? `Evento: telas separadas do culto congregacional (Projetor e TV com ?evento=${EVENTO})`
      : "Culto congregacional");
  };
  descrever({});
  $.when(
    $.getJSON("/api/eventos").then((r) => r, () => $.Deferred().resolve({})),
    $.getJSON("/api/cultos").then((r) => r, () => $.Deferred().resolve(null)),
  ).done((ev, lista) => {
    const nomes = (ev && ev.nomes) || {};
    descrever(nomes);
    // Eventos do dia: os que têm liturgia nesta data e os cujo período cadastrado a inclui
    const slugs = new Set();
    (Array.isArray(lista) ? lista : []).forEach((f) => {
      const m = /^(\d{4}-\d{2}-\d{2})@([a-z0-9-]+)\.json$/.exec(String(f));
      if (m && m[1] === arquivo) slugs.add(m[2]);
    });
    ((ev && ev.eventos) || []).forEach((e) => { if (e.inicio <= arquivo && arquivo <= e.fim) slugs.add(e.slug); });
    if (EVENTO) slugs.add(EVENTO); // o evento aberto aparece sempre, para voltar a ele
    // O culto congregacional existe no dia quando há a liturgia "AAAA-MM-DD.json". Se a lista de cultos
    // não veio, não se decide pela falta dela: o culto continua como opção e nada abre sozinho.
    const listaOk = Array.isArray(lista);
    const temCulto = !listaOk || lista.some((f) => String(f) === `${arquivo}.json`);
    const eventosDoDia = [...slugs].sort((a, b) => nomeDe(a, nomes).localeCompare(nomeDe(b, nomes), "pt-BR"));
    const irPara = (slug) => {
      const params = new URLSearchParams(location.search);
      if (slug) params.set("evento", slug); else params.delete("evento");
      params.set("data", arquivo);
      location.replace(`${location.pathname}?${params}`);
    };
    // Sem culto congregacional no dia e um só evento: abre direto nele (com culto, o culto é o padrão)
    if (listaOk && !EVENTO && !temCulto && eventosDoDia.length === 1) return irPara(eventosDoDia[0]);
    const opcoes = (temCulto || !EVENTO && !eventosDoDia.length ? [["", "Culto congregacional", "fa-church"]] : [])
      .concat(eventosDoDia.map((s) => [s, nomeDe(s, nomes), "fa-people-roof"]));
    // Sem culto e com vários eventos, nada está escolhido ainda: o nome vira "Escolha o evento"
    if (!EVENTO && !temCulto && eventosDoDia.length > 1) {
      $("#descricaoCulto").addClass("evento").find(".txt").text("Escolha o evento");
      $("#descricaoCulto .ico").html('<i class="fa-solid fa-people-roof"></i>');
    }
    if (opcoes.length < 2 && !(!EVENTO && !temCulto && eventosDoDia.length)) return;
    const $sel = $("#seletorEventoPainel");
    $("#descricaoCulto").prop("disabled", false).attr("title", "Trocar entre o culto e os eventos desta data");
    $sel.find(".seta").removeClass("d-none");
    $sel.find(".dropdown-menu").html(opcoes.map(([slug, nome, icone]) =>
      `<li><a class="dropdown-item${slug === EVENTO ? " active" : ""}" href="#" data-evento="${slug}">
        <i class="fa-solid ${icone}"></i>&nbsp;${escAttr(nome)}</a></li>`).join(""));
    $sel.on("click", "[data-evento]", function (e) {
      e.preventDefault();
      const slug = this.getAttribute("data-evento");
      if (slug === EVENTO) return;
      const params = new URLSearchParams(location.search);
      if (slug) params.set("evento", slug); else params.delete("evento");
      params.set("data", arquivo);
      location.search = params.toString();
    });
    // Menu próprio (o Live carrega o Bootstrap sem o Popper): clicar ou tocar no nome abre e fecha.
    const $botao = $("#descricaoCulto"), $menu = $sel.find(".dropdown-menu");
    const abrir = (sim) => { $menu.toggleClass("show", sim); $botao.attr("aria-expanded", sim ? "true" : "false"); };
    $botao.on("click", (e) => { e.stopPropagation(); abrir(!$menu.hasClass("show")); $botao.blur(); });
    $(document).on("click", (e) => { if (!$sel[0].contains(e.target)) abrir(false); });
    $(document).on("keydown", (e) => { if (e.key === "Escape") abrir(false); });
  });
};

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
  if (typeof atualizarBarra === "function") atualizarBarra();
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
      $("body>div:not(.form-check):not(.biblia):not(#itens)").hide();
      $("#itens>div").hide();
      $(".accordion-button:not(.collapsed)").addClass("collapsed");
      $(".accordion-collapse.show").removeClass("show");
      if (args.toUpperCase().includes("HINO")) {
        $("#itens>#hinos").show();
      } else if (args.toUpperCase().includes("LOUVOR")) {
        $("#itens>#louvores").show();
      } else if (args.toUpperCase().includes("PASSAGEM")) {
        $("#itens>#passagens").show();
      }
    }
  }
});

// Faixa de rótulos do cartão: "Refrão" (contorno na cor do tipo) à esquerda e "Na tela" à direita.
const selosEstrofe = (refrao = false) =>
  `<span class="estrofe-tags">${refrao ? `<span class="tag-refrao">Refrão</span>` : ""}<span class="selo-no-ar"><i class="fa-solid fa-tower-broadcast" aria-hidden="true"></i> Na tela</span></span>`;

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
  return bloco.innerHTML;
};
const vozesDaSelecao = (button, atributo = 'data-vozes') => {
  try { const vozes = JSON.parse(button.getAttribute(atributo)); return Trechos.ehPar(vozes) ? vozes : undefined; } catch { return undefined; }
};
// Todas as estrofes da música (sem as de duas vozes): a legenda fixa o bloco no tamanho da maior.
const estrofesDaMusica = (button) =>
  Array.from(button.closest(".btn-group-vertical").querySelectorAll("input.btn-check[corpo]:not([data-vozes])"))
    .map((input) => encodeURI(decodeURIComponent(input.getAttribute("corpo"))));

const formatarVersiculoParaExibicao = (texto) => {
  return texto.replace(/^[^.]+\.(\d+)\.(\d+)\.\s*/, "$1.$2. ");
};
// Itens da liturgia: um acordeão por tipo (hinos, louvores, corais, passagens), um cartão por estrofe.
const ITENS = {
  hino: { nome: "Hino", rotulo: "Hino", icone: "fa-music", grupo: "hinos", tipoAttr: "hino", plural: "Hinos" },
  coral: { nome: "Coral", rotulo: "Coral", icone: "fa-users", grupo: "corais", tipoAttr: "louvor", categoria: "coral", plural: "Corais" },
  louvor: { nome: "Louvor", rotulo: "Louvor", icone: "fa-guitar", grupo: "louvores", tipoAttr: "louvor", plural: "Louvores" },
  passagem: { nome: "Passagem", rotulo: "Passagem", icone: "fa-book-bible", grupo: "passagens", tipoAttr: "passagem", plural: "Passagens" },
};

// Rótulo visível de cada slide: 1, 2, 4A, 4B… (refrão = R); a tecla A–Z continua a da estrofe (data-letra).
const rotulosDeSlides = (slides) => {
  const posicoes = new Map();
  slides.forEach((s, i) => { if (!posicoes.has(s.idTag)) posicoes.set(s.idTag, []); posicoes.get(s.idTag).push(i); });
  const numeros = new Map();
  let proximo = 0;
  return slides.map((s, i) => {
    let base = "R";
    if (!s.refrao) {
      if (!numeros.has(s.idTag)) numeros.set(s.idTag, ++proximo);
      base = String(numeros.get(s.idTag));
    }
    const lista = posicoes.get(s.idTag);
    return lista.length > 1 ? base + String.fromCharCode(65 + lista.indexOf(i)) : base;
  });
};

const adicionarItem = (definicao, chave, n) => {
  const cfg = ITENS[chave];
  const alvo = `colapse${cfg.nome}${n}`;
  const base = `btn${cfg.nome}${n}`;
  if (!$(`#${cfg.grupo}`).length) $("#itens").append(`<div id="${cfg.grupo}" class="accordion accordion-flush"></div>`);
  $(`#${cfg.grupo}`).append(`<div class="accordion-item" tipo="${cfg.tipoAttr}"${cfg.categoria ? ` categoria="${cfg.categoria}"` : ""}>
      <h2 class="accordion-header" id="${chave}${n}">
        <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#${alvo}" aria-expanded="false" aria-controls="${alvo}">
          <i class="fa-solid ${cfg.icone}" aria-hidden="true"></i><span class="item-nome">${sanitizarTitulo(definicao.titulo)}</span>
        </button>
        <button class="item-fechar" type="button" data-bs-toggle="collapse" data-bs-target="#${alvo}" aria-controls="${alvo}" aria-label="Fechar ${cfg.rotulo.toLowerCase()} e tirar da tela"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
      </h2>
      <div id="${alvo}" class="accordion-collapse collapse" aria-labelledby="${chave}${n}" data-bs-parent="#${cfg.grupo}">
        <div class="detalhe-cab">
          <i class="fa-solid ${cfg.icone}" aria-hidden="true"></i><span class="item-nome">${sanitizarTitulo(definicao.titulo)}</span>
          <button class="detalhe-fechar" type="button" data-bs-toggle="collapse" data-bs-target="#${alvo}" aria-controls="${alvo}" aria-label="Fechar ${cfg.rotulo.toLowerCase()} e tirar da tela"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
        </div>
        <div class="accordion-body">
          <div class="btn-group-vertical w-100" role="group" aria-label="Estrofes"></div>
        </div>
      </div>
    </div>`);
  const $grupo = $(`#${alvo} .accordion-body .btn-group-vertical`);
  const tituloId = chave === "passagem" ? `${base}Titulo` : base;
  const tituloAttr = escAttr(definicao.titulo);
  // Botão Título: abre o item no Projetor/Legenda sem letra (neutro; amarelo só quando está no ar)
  $grupo.append(`<input type="radio" class="btn-check" name="${base}" id="${tituloId}" titulo="${tituloAttr}" data-rotulo-estado="título" autocomplete="off"><label class="btn titulo-btn" for="${tituloId}">Título</label>`);

  if (chave === "passagem") {
    definicao.texto.forEach((valor, indice) => {
      const versiculoExibicao = formatarVersiculoParaExibicao(valor);
      const ref = /^(\d+\.\d+)\./.exec(versiculoExibicao);
      $grupo.append(`<input type="radio" class="btn-check" name="${base}" id="${base}${indice}" titulo="${tituloAttr}" data-rotulo-estado="versículo ${ref ? ref[1] : indice + 1}" autocomplete="off"><label class="btn estrofe estrofe-verso" for="${base}${indice}">${versiculoExibicao}</label>`);
    });
    return;
  }

  const slides = agruparEmSlides(definicao.letra);
  const rotulos = rotulosDeSlides(slides);
  slides.forEach((slide, idx) => {
    const letraTag = slide.idTag ? String.fromCharCode(64 + slide.idTag) : "";
    const rotulo = rotulos[idx];
    const estado = slide.refrao ? `refrão${rotulo.length > 1 ? " " + rotulo.slice(1) : ""}` : `estrofe ${rotulo}`;
    const textoLimpo = slide.vozes ? htmlSlideVozes(slide.vozes) : slide.linhas
      .map((l) => `<span class="linha">${sanitizarTexto(l)}</span>`)
      .join("");
    const textoCorpo = slide.linhas.join("<br>");
    const id = `${base}_${idx}`;
    const dica = letraTag ? ` title="Estrofe ${rotulo}, tecla ${letraTag}"` : "";
    $grupo.append(
      `<input type="radio" class="btn-check" name="${base}" id="${id}" titulo="${tituloAttr}" corpo="${encodeURIComponent(textoCorpo)}" ${slide.vozes ? `data-vozes="${escAttr(JSON.stringify(slide.vozes))}" data-vozes-projetor="${escAttr(JSON.stringify(slide.vozesProjetor))}"` : ""} autocomplete="off" data-letra="${letraTag}" data-rotulo-estado="${escAttr(estado)}"><label class="btn estrofe${slide.refrao ? " refrao" : ""}${slide.vozes ? " painel-dueto" : ""}" for="${id}"${dica}><span class="selo-num">${rotulo}</span><span class="estrofe-corpo">${selosEstrofe(slide.refrao)}<span class="estrofe-texto">${textoLimpo}</span></span></label>`,
    );
  });
};

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const dataLegivel = (iso) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${DIAS[d.getUTCDay()]}, ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
};

// Barra de operação: o que está na tela e Anterior/Próxima do item aberto.
const itemAberto = () => document.querySelector(".accordion-collapse.show");
const entradasDoAberto = () => {
  const aberto = itemAberto();
  return aberto ? Array.from(aberto.querySelectorAll(".btn-group-vertical > input")) : [];
};
const atualizarBarra = () => {
  const marcado = document.querySelector(".btn-group-vertical > input:checked");
  const $estado = $("#estadoTela");
  if (marcado) {
    const item = marcado.closest(".accordion-item");
    const cfg = ITENS[item.getAttribute("categoria") === "coral" ? "coral" : item.getAttribute("tipo")];
    $estado.removeClass("nada").find(".estado-txt")
      .text(`Na tela: ${cfg ? cfg.rotulo : ""} · ${marcado.getAttribute("titulo")} · ${marcado.getAttribute("data-rotulo-estado") || ""}`);
  } else {
    $estado.addClass("nada").find(".estado-txt").text("Nada na tela");
  }
  const entradas = entradasDoAberto();
  const i = entradas.findIndex((x) => x.checked);
  // Anterior | Próxima só aparecem quando há para onde ir (mesma regra de quando ficavam ativos)
  const temAnterior = i > 0, temProxima = entradas.length > 0 && i < entradas.length - 1;
  $("#btnAnterior").prop("disabled", !temAnterior).toggleClass("d-none", !temAnterior);
  $("#btnProxima").prop("disabled", !temProxima).toggleClass("d-none", !temProxima);
  $("#barraPassos").toggleClass("d-none", !(temAnterior || temProxima));
};
const passoEstrofe = (delta) => {
  const entradas = entradasDoAberto();
  const alvo = entradas[entradas.findIndex((x) => x.checked) + delta];
  if (!alvo) return;
  alvo.click();
  alvo.nextElementSibling.scrollIntoView({ block: "nearest" });
};

// -----------------------------------------------------------------------------------------
const inicio = () => {
  queryId("dataCulto").value = arquivo;
  $("#dataTxt").text(dataLegivel(arquivo));
  // Tocar na data abre o seletor nativo (o input fica transparente sobre ela)
  $("#dataCulto").on("click", function () { try { this.showPicker(); } catch (_) { /* o toque nativo cobre */ } });
  // Alturas do topo e da barra viram variáveis CSS: cabeçalho do item e rolagem se ajustam a elas
  const raiz = document.documentElement.style;
  const medir = () => {
    raiz.setProperty("--topo-h", `${$(".topo-painel").outerHeight() || 0}px`);
    raiz.setProperty("--barra-h", `${$("#barraOperacao").outerHeight() || 0}px`);
  };
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(medir);
    ro.observe(document.querySelector(".topo-painel"));
    ro.observe(queryId("barraOperacao"));
  }
  medir();
  // Abrir um louvor, hino, coral ou leitura deixa o Título dele pronto, sem projetar: abrir só para
  // ver a letra não pode mostrar nada na tela (Victor Hugo, 19/10/2026). O clique no Título projeta.
  $(document).on("show.bs.collapse", ".accordion-collapse", function (e) {
    if (e.target !== this) return;
    const opcoes = Array.from(this.querySelectorAll(".btn-group-vertical > input"));
    if (opcoes.some((input) => input.checked)) return;
    const titulo = opcoes.find((input) => input.nextElementSibling?.textContent.trim() === "Título");
    if (!titulo) return;
    titulo.nextElementSibling.classList.add("proximo");
    opcoes.forEach((input) => input.addEventListener("change", () => titulo.nextElementSibling.classList.remove("proximo"), { once: true }));
  });
  $(document).on("hide.bs.collapse", ".accordion-collapse", function (e) {
    if (e.target === this) this.querySelectorAll("label.proximo").forEach((label) => label.classList.remove("proximo"));
  });
  $(document).on("shown.bs.collapse hidden.bs.collapse", ".accordion-collapse", atualizarBarra);

  // Barra de operação. Depois do clique o foco sai do botão: as teclas A–Z seguem valendo.
  $("#barraOperacao button").on("click", function () { this.blur(); });
  $("#btnAnterior").on("click", () => passoEstrofe(-1));
  $("#btnProxima").on("click", () => passoEstrofe(1));
  const fecharMensagem = () => {
    $("#painelMensagem").addClass("d-none");
    $("#btnMensagem").attr("aria-pressed", "false");
    mensagem.blur();
  };
  $("#btnMensagem").on("click", function () {
    const abrir = $("#painelMensagem").hasClass("d-none");
    $("#painelMensagem").toggleClass("d-none", !abrir);
    $(this).attr("aria-pressed", abrir ? "true" : "false");
    if (abrir) mensagem.focus();
  });
  mensagem.addEventListener("keyup", function (e) {
    if (e.key === "Enter" || e.keyCode === 13) {
      socket.emit(empresa, "Alerta", mensagem.value);
      fecharMensagem();
    }
  });
  atualizarBarra();

  // O que este Painel controla aparece na descrição ao lado da data (magenta no evento);
  // a faixa do topo saiu a pedido do João (21/11/2026)
  montarSeletorEvento();

  $.getJSON(`${cultosUrl}/${encodeURIComponent(chaveLiturgia(arquivo))}.json?vozes=1`)
    .done((definicoes) => {
      let hino = 0,
        louvor = 0, // o coral conta junto com o louvor
        passagem = 0;
      definicoes.forEach((definicao) => {
        switch (definicao.tipo) {
          case "hino": adicionarItem(definicao, "hino", ++hino); break;
          case "coral": adicionarItem(definicao, "coral", ++louvor); break;
          case "louvor": adicionarItem(definicao, "louvor", ++louvor); break;
          case "passagem": adicionarItem(definicao, "passagem", ++passagem); break;
          default:
            console.log(`Codigo errado em ${definicao.tipo}`);
        }
      });
      // Rótulo de cada grupo ("Hinos · 3")
      Object.values(ITENS).forEach((cfg) => {
        const n = $(`#${cfg.grupo} > .accordion-item`).length;
        if (n) $(`#${cfg.grupo}`).prepend(`<div class="grupo-rotulo">${cfg.plural} · ${n}</div>`);
      });
    })
    .fail((jqXHR) => {
      const dataBR = (d) => d.split("-").reverse().join("/");
      if (jqXHR.status !== 404) {
        // Falha de verdade (Liturgia fora do ar, rede): aí sim, vermelho.
        $("#itens").append(`<div class="alert alert-danger m-3" role="alert">
                <i class="fa-solid fa-triangle-exclamation"></i> Não consegui carregar a liturgia de ${dataBR(arquivo)}. Confira a conexão com a Liturgia e recarregue o Painel.
            </div>`);
        return;
      }
      // Dia sem culto é o estado normal fora dos cultos: aviso neutro e o próximo culto cadastrado.
      const diaSemana = new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: "UTC" })
        .format(new Date(`${arquivo}T12:00:00Z`)).replace("-feira", "");
      const $vazio = $(`<div class="estado-vazio" role="status">
                <i class="fa-regular fa-calendar fa-2x estado-icone" aria-hidden="true"></i>
                <div class="estado-titulo">Não há liturgia ${EVENTO ? `do evento ${escAttr(nomeDoEvento)} ` : ""}para ${diaSemana}, ${dataBR(arquivo)}</div>
                <div class="estado-texto estado-proximo d-none"></div>
                <button type="button" class="btn btn-light estado-acao d-none"></button>
                <div class="estado-texto estado-dica">Ou escolha outra data no campo acima.</div>
            </div>`);
      $("#itens").append($vazio);
      $.getJSON(cultosUrl).done((lista) => {
        const proximo = (Array.isArray(lista) ? lista : [])
          .map((f) => String(f).replace(".json", ""))
          // Só liturgias do mesmo contexto: o culto congregacional não oferece evento, e vice-versa
          .filter((k) => /^\d{4}-\d{2}-\d{2}(@|$)/.test(k) && k === chaveLiturgia(k.slice(0, 10)))
          .map((k) => k.slice(0, 10))
          .filter((d) => d > arquivo)
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
      // Abrir um item fecha o anterior na mesma hora (acordeão e outros grupos). Esse fechamento
      // não mexe na tela: o item pode ter sido aberto só para ver a letra. Só fechar, sem abrir
      // outro, o item que está na tela limpa a tela; fechar um item só consultado não limpa.
      let abrindoOutroItem = false;
      document.addEventListener("show.bs.collapse", () => {
        abrindoOutroItem = true;
        setTimeout(() => { abrindoOutroItem = false; }, 0);
      }, true);
      queryAll(".accordion-item").forEach((item) => {
        item.addEventListener("hide.bs.collapse", function () {
          const temNaTela = Boolean(this.querySelector(".btn-group-vertical > input:checked"));
          if (!abrindoOutroItem && temNaTela) enviar("fecharJanela");
          // Limpa seleção e a marca de já projetada dos itens do accordion que fechou
          this.querySelectorAll(
            'input[type="radio"], input[type="checkbox"]',
          ).forEach((input) => {
            input.checked = false;
          });
          this.querySelectorAll("label.ja-projetada").forEach((label) => label.classList.remove("ja-projetada"));
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
            // Já projetada: marca até fechar o item (o amarelo fica só para o que está na tela)
            this.nextElementSibling.classList.add("ja-projetada");
            atualizarBarra();
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
                  estrofes: estrofesDaMusica(this),
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
                  estrofes: estrofesDaMusica(this),
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
  if (EVENTO) q.set("evento", EVENTO); // a janela da Bíblia projeta no canal do evento
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
