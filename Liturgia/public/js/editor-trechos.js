/* Editor único de trechos para louvor e coral; texto antigo continua compatível. */
const EditorTrechos = (() => {
    function abrir(opcoes) {
        let blocos = Trechos.paraEditor(opcoes.letra || []);
        const vazio = () => ({ modo: 'todos', refrao: false, texto: '', esquerda: { nome: 'Homens', texto: '' }, direita: { nome: 'Mulheres', texto: '' } });
        if (!blocos.length) blocos = [vazio()];
        let indice = 0, pagina = 0, gravando = false;
        const html = `<div class="et-editor">
          <label for="etTitulo">Título da música</label><input id="etTitulo" class="form-control mb-3" style="background:bisque;">
          <label class="et-cantata d-none" for="etCantata">Cantata</label><select id="etCantata" class="form-select mb-3 et-cantata d-none"><option value="">Sem cantata (avulsa)</option></select>
          <div class="et-layout"><aside><strong>Trechos da música</strong><div class="et-lista mt-2"></div>
          <button type="button" class="btn btn-outline-primary et-adicionar w-100 mt-2">+ Adicionar trecho</button>
          <button type="button" class="btn btn-outline-secondary et-colar w-100 mt-2">Colar letra completa</button></aside>
          <section><div class="d-flex align-items-center justify-content-between mb-2"><strong class="et-trecho"></strong><label class="et-check"><input class="et-refrao" type="checkbox"> Refrão</label></div>
          <fieldset class="mb-3"><legend>Como este trecho será apresentado?</legend>
          <label class="et-check"><input type="radio" name="etModo" value="todos"> Uma coluna · Todos</label>
          <label class="et-check"><input type="radio" name="etModo" value="duas"> Duas colunas</label></fieldset>
          <label class="et-normal" for="etTexto">Letra do trecho<textarea id="etTexto" class="form-control" rows="5"></textarea></label>
          <div class="et-duas"><section><label for="etNomeE">Nome da coluna esquerda</label><input id="etNomeE" class="form-control mb-2" maxlength="80">
          <label for="etTextoE">Letra da coluna esquerda</label><textarea id="etTextoE" class="form-control" rows="5"></textarea></section>
          <section><label for="etNomeD">Nome da coluna direita</label><input id="etNomeD" class="form-control mb-2" maxlength="80">
          <label for="etTextoD">Letra da coluna direita</label><textarea id="etTextoD" class="form-control" rows="5"></textarea></section></div>
          <p class="small text-muted mt-2">Uma linha por verso. Em duas colunas, deixe uma linha vazia para indicar uma pausa e alinhar as vozes. No coral, use os nomes dos grupos que vão cantar cada parte.</p>
          <div class="d-flex gap-2 flex-wrap mt-2"><button type="button" class="btn btn-sm btn-outline-secondary et-subir">Subir</button><button type="button" class="btn btn-sm btn-outline-secondary et-descer">Descer</button>
          <button type="button" class="btn btn-sm btn-outline-secondary et-juntar">Juntar com o próximo em duas vozes</button><button type="button" class="btn btn-sm btn-outline-danger et-remover">Remover trecho</button></div>
          <div class="d-flex justify-content-between align-items-center mt-3"><strong>Prévia</strong><div class="d-flex gap-2 align-items-center"><button type="button" class="btn btn-sm btn-outline-secondary et-anterior" aria-label="Parte anterior">‹</button><span class="et-par small"></span><button type="button" class="btn btn-sm btn-outline-secondary et-proximo" aria-label="Próxima parte">›</button></div></div>
          <div class="et-previas mt-2"><section><small>Projetor</small><div class="et-previa et-projetor"></div></section><section><small>Legenda do OBS</small><div class="et-previa et-obs"></div></section></div>
          <p class="small text-muted mt-1 mb-0">Legenda: referência Full HD (1920 × 1080). A quebra pode variar conforme a resolução da saída.</p>
          </section></div><p class="et-erro text-danger mt-3 mb-0" role="alert"></p></div>`;
        const botoes = {};
        if (opcoes.onPesquisar) botoes.pesquisar = { label: 'Pesquisar', className: 'btn-success float-start', callback() { if (gravando) return false; opcoes.onPesquisar($titulo.val()); } };
        botoes.cancelar = { label: 'Cancelar', className: 'btn-secondary', callback() { return !gravando; } };
        botoes.salvar = { label: 'Salvar', className: 'btn-primary et-salvar', callback() {
            if (gravando) return false;
            const titulo = $titulo.val().trim();
            const invalido = blocos.findIndex(b => b.modo === 'todos' ? !b.texto.trim() : !Trechos.ehDueto(Trechos.doEditor([b])[0]));
            if (!titulo || invalido >= 0) {
                if (invalido >= 0) { indice = invalido; pagina = 0; carregar(); }
                $erro.text(!titulo ? 'Informe o título.' : 'Complete a letra do trecho e os nomes das duas vozes.');
                if (!titulo) $titulo.trigger('focus');
                return false;
            }
            gravando = true; $dialog.find('button,input,textarea,select').prop('disabled', true);
            Promise.resolve().then(() => opcoes.onSalvar({ titulo, letra: Trechos.doEditor(blocos), cantata_id: $cantata.val() })).then(() => $dialog.modal('hide')).catch(e => {
                gravando = false; $dialog.find('button,input,textarea,select').prop('disabled', false); carregar();
                $erro.text(e?.responseJSON?.error || e?.message || 'Não foi possível salvar. Tente novamente.');
            });
            return false;
        } };
        const $dialog = bootbox.dialog({ title: opcoes.tipo === 'coral' ? 'Editar música do coral' : 'Editar Louvor', message: html, size: 'extra-large', className: 'editor-trechos', centerVertical: true, buttons: botoes, onEscape() { return !gravando; }, closeButton: false });
        const $root = $dialog.find('.et-editor'), $titulo = $root.find('#etTitulo'), $cantata = $root.find('#etCantata'), $erro = $root.find('.et-erro');
        $titulo.val(opcoes.titulo || '');
        if (opcoes.cantatas) { $root.find('.et-cantata').removeClass('d-none'); opcoes.cantatas.forEach(c => $cantata.append($('<option>').val(c.id).text(c.nome))); }
        const atual = () => blocos[indice];
        function lista() {
            const foco = $root.find('.et-lista button').index(document.activeElement);
            const $lista = $root.find('.et-lista').empty();
            blocos.forEach((b, i) => $('<button type="button" class="btn w-100 text-start mb-1">').toggleClass('btn-warning', i === indice).toggleClass('btn-outline-secondary', i !== indice)
                .attr('aria-pressed', String(i === indice)).text(`${i + 1}. ${b.refrao ? 'Refrão · ' : ''}${b.modo === 'duas' ? (b.esquerda.nome || 'Voz 1') + ' / ' + (b.direita.nome || 'Voz 2') : 'Todos'}`)
                .on('click', () => { indice = i; pagina = 0; carregar(); }).appendTo($lista));
            if (foco >= 0) $lista.find('button').eq(Math.min(foco, blocos.length - 1)).trigger('focus');
        }
        function previa() {
            const b = atual(), par = Trechos.doEditor([b])[0];
            // Todos segue o balanceamento do Painel (ex.: cinco versos viram 3 + 2).
            const versos = Trechos.linhas(b.texto), total = Math.ceil(versos.length / 4);
            let inicio = 0;
            const partes = b.modo === 'duas' ? Trechos.divisoes(par) : Array.from({ length: total }, (_, i) => {
                const tamanho = Math.floor(versos.length / total) + (i < versos.length % total ? 1 : 0);
                const parte = versos.slice(inicio, inicio + tamanho); inicio += tamanho; return parte;
            });
            pagina = Math.max(0, Math.min(pagina, partes.length - 1));
            $root.find('.et-par').text(`${b.modo === 'duas' ? 'Par' : 'Parte'} ${pagina + 1} de ${Math.max(1, partes.length)}`);
            $root.find('.et-anterior').prop('disabled', pagina === 0); $root.find('.et-proximo').prop('disabled', pagina >= partes.length - 1);
            $root.find('.et-previa').each(function () {
                if (b.modo === 'duas') Trechos.renderizarDueto(this, partes[pagina]?.[this.classList.contains('et-obs') ? 'legenda' : 'projetor']);
                else {
                    this.replaceChildren();
                    const linhas = partes[pagina] || [];
                    const exibidas = this.classList.contains('et-obs') ? linhasLegenda(linhas) : linhas.map(Trechos.plano);
                    exibidas.forEach(texto => { const p = document.createElement('div'); p.className = 'et-linha'; p.textContent = texto; this.append(p); });
                }
            });
        }
        function linhasLegenda(linhas) {
            // Referência Full HD da legenda: fonte 16px + 1vw + 1vh = 46px;
            // descontar margem e padding de 16px em cada lado (1856px úteis).
            // Medir texto simples, sem executar HTML recebido da letra.
            const medidor = document.createElement('span');
            Object.assign(medidor.style, { position: 'absolute', left: '-99999px', visibility: 'hidden', whiteSpace: 'nowrap', fontFamily: getComputedStyle($root[0]).fontFamily, fontSize: '46px', fontWeight: '400' });
            // O modal ainda pode estar oculto na primeira prévia; medir no body visível.
            document.body.append(medidor);
            const resultado = [];
            try {
                for (let i = 0; i < linhas.length; i++) {
                    const atual = Trechos.plano(linhas[i]);
                    const cantor = s => /<strong[^>]*>.*?<\/strong>/i.test(s);
                    if (i + 1 < linhas.length && !cantor(linhas[i]) && !cantor(linhas[i + 1])) {
                        medidor.textContent = atual + ' · ' + Trechos.plano(linhas[i + 1]);
                        // O separador do Live acrescenta 0.15em de padding de cada lado.
                        if (medidor.getBoundingClientRect().width + 0.3 * 46 <= 1856) {
                            resultado.push(medidor.textContent); i++; continue;
                        }
                    }
                    resultado.push(atual);
                }
            } finally { medidor.remove(); }
            return resultado;
        }
        function carregar() {
            const b = atual(); $root.find('.et-trecho').text(`Trecho ${indice + 1}`); $root.find('[name=etModo]').each(function () { this.checked = this.value === b.modo; });
            $root.find('.et-refrao').prop('checked', b.refrao); $root.find('.et-normal').toggle(b.modo === 'todos'); $root.find('.et-duas').toggle(b.modo === 'duas');
            $root.find('#etTexto').val(b.texto); $root.find('#etNomeE').val(b.esquerda.nome); $root.find('#etTextoE').val(b.esquerda.texto); $root.find('#etNomeD').val(b.direita.nome); $root.find('#etTextoD').val(b.direita.texto);
            $root.find('.et-subir').prop('disabled', indice === 0); $root.find('.et-descer').prop('disabled', indice === blocos.length - 1);
            $root.find('.et-juntar').prop('disabled', b.modo !== 'todos' || blocos[indice + 1]?.modo !== 'todos'); lista(); previa();
        }
        $root.find('[name=etModo]').on('change', function () { const b = atual(); b.modo = this.value;
            if (b.modo === 'duas' && !b.esquerda.texto) b.esquerda.texto = Trechos.plano(b.texto);
            if (b.modo === 'todos' && !b.texto) b.texto = [b.esquerda.texto, b.direita.texto].filter(Boolean).join('\n');
            pagina = 0; carregar(); });
        [['#etTexto','texto'],['#etNomeE','esquerda','nome'],['#etTextoE','esquerda','texto'],['#etNomeD','direita','nome'],['#etTextoD','direita','texto']].forEach(([sel, key, sub]) => $root.find(sel).on('input', function () { if (sub) atual()[key][sub] = this.value; else atual()[key] = this.value; pagina = 0; lista(); previa(); }));
        $root.find('.et-refrao').on('change', function () { atual().refrao = this.checked; lista(); });
        $root.find('.et-adicionar').on('click', () => { blocos.push(vazio()); indice = blocos.length - 1; pagina = 0; carregar(); $root.find('#etTexto').trigger('focus'); });
        $root.find('.et-remover').on('click', () => { blocos.splice(indice, 1); if (!blocos.length) blocos.push(vazio()); indice = Math.min(indice, blocos.length - 1); pagina = 0; carregar(); });
        for (const [sel, delta] of [['.et-subir', -1],['.et-descer', 1]]) $root.find(sel).on('click', () => { const novo = indice + delta; if (novo < 0 || novo >= blocos.length) return; [blocos[indice], blocos[novo]] = [blocos[novo], blocos[indice]]; indice = novo; pagina = 0; carregar(); });
        $root.find('.et-juntar').on('click', () => { const b = atual(), proximo = blocos[indice + 1]; if (b.modo !== 'todos' || proximo?.modo !== 'todos') return; b.modo = 'duas'; b.refrao = b.refrao || proximo.refrao; b.esquerda.texto = Trechos.plano(b.texto); b.direita.texto = Trechos.plano(proximo.texto); blocos.splice(indice + 1, 1); pagina = 0; carregar(); });
        $root.find('.et-anterior').on('click', () => { pagina--; previa(); }); $root.find('.et-proximo').on('click', () => { pagina++; previa(); });
        $root.find('.et-colar').on('click', () => bootbox.prompt({ title: 'Colar letra completa', inputType: 'textarea', message: 'Separe os trechos com uma linha em branco. Substitui os trechos deste editor; Cancelar mantém os atuais.', callback(texto) { if (texto === null) return; const letra = String(texto).replace(/\r/g, '').split(/\n\s*\n/).map(t => t.trim()).filter(Boolean).map(t => t.replace(/^refr[aã]o\s*:\s*/i, 'refrao:').replace(/\n/g, '<br/>')); if (!letra.length) return false; blocos = Trechos.paraEditor(letra); indice = 0; pagina = 0; carregar(); } }));
        carregar(); $dialog.on('shown.bs.modal', () => $titulo.trigger('focus'));
        return $dialog;
    }
    return { abrir };
})();
