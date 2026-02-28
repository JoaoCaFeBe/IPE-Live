const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Diretório raiz do projeto PHP IPE (onde ficam lib/, .img/ e .liturgia/)
const IPE_DIR = path.resolve(
  '/Users/joaocfb/Library/Mobile Documents/com~apple~CloudDocs/Desenvol/php/IPEncruzilhada/IPE'
);

// Diretório onde ficam os arquivos JSON de cultos
const CULTOS_DIR = path.join(IPE_DIR, '.liturgia', 'cultos');

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Arquivos estáticos do próprio projeto (public/)
app.use(express.static(path.join(__dirname, 'public')));

// Bibliotecas JS/CSS compartilhadas (Bootstrap, jQuery, Font Awesome, Bootbox…)
app.use('/lib', express.static(path.join(IPE_DIR, 'lib')));

// Imagens da aplicação (logomarca, fundo etc.)
app.use('/img', express.static(path.join(IPE_DIR, '.img')));

// Garantir que o diretório de cultos existe
if (!fs.existsSync(CULTOS_DIR)) {
  fs.mkdirSync(CULTOS_DIR, { recursive: true });
}

// ===========================================================================
// CULTOS
// ===========================================================================

/** Lista todos os arquivos de culto (ordem decrescente) */
app.get('/cultos', (_req, res) => {
  try {
    const files = fs.readdirSync(CULTOS_DIR)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse();
    res.json(files);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Serve o JSON de um culto específico */
app.get('/cultos/:arquivo', (req, res) => {
  const filePath = path.join(CULTOS_DIR, path.basename(req.params.arquivo));
  if (!fs.existsSync(filePath)) return res.status(404).json([]);
  res.sendFile(filePath);
});

// ===========================================================================
// DADOS
// ===========================================================================

/** Cria novo arquivo de liturgia vazio */
app.post('/dados/nova-liturgia', (req, res) => {
  const arquivo = path.basename((req.body.arquivo || '').replace(/^cultos\//, ''));
  if (!arquivo) return res.status(400).send('Arquivo inválido');
  fs.writeFileSync(path.join(CULTOS_DIR, arquivo), '[]');
  res.json({ ok: true, arquivo });
});

/** Salva o conteúdo JSON de uma liturgia */
app.post('/dados/salvar-liturgia', (req, res) => {
  const arquivo = path.basename((req.body.arquivo || '').replace(/^cultos\//, ''));
  const dados = req.body.data;
  if (!arquivo || !dados) return res.status(400).json({ error: 'Dados inválidos' });
  try {
    JSON.parse(dados); // valida antes de salvar
    fs.writeFileSync(path.join(CULTOS_DIR, arquivo), dados);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: 'JSON inválido: ' + e.message });
  }
});

// ===========================================================================
// FORMULÁRIOS — retornam fragmentos HTML inseridos no DOM via AJAX
// ===========================================================================

app.post('/formularios/passagem', (_req, res) => {
  res.send(/* html */`
<input type="text" class="form-control" id="titulo" placeholder="Digite o título"
  style="background-color:bisque;" onchange="arrumarPassagem();">
<texto style="display:grid;grid-template-rows:1fr 40%;grid-row-gap:.25rem;">
  <textarea class="form-control" id="original"
    placeholder="Cole o texto a formatar aqui&#10;Formato: [Livro.cap.v] texto"
    onchange="arrumarPassagem();" style="resize:none;"></textarea>
  <textarea class="form-control text-nowrap" id="final" style="resize:none;"></textarea>
</texto>`);
});

app.post('/formularios/hino', (_req, res) => {
  res.send(/* html */`
<input type="text" class="form-control" id="titulo" placeholder="Digite o título"
  style="background-color:bisque;" onchange="arrumarHino();">
<texto style="display:grid;grid-template-rows:1fr 40%;grid-row-gap:.25rem;">
  <textarea class="form-control" id="original"
    placeholder="Cole a letra aqui&#10;Estrofes separadas por linha em branco"
    onchange="arrumarHino();" style="resize:none;"></textarea>
  <textarea class="form-control text-nowrap" id="final" style="resize:none;"></textarea>
</texto>`);
});

app.post('/formularios/louvor', (_req, res) => {
  res.send(/* html */`
<div class="input-group">
  <input type="text" class="form-control" id="titulo" placeholder="Digite o título"
    style="background-color:bisque;" onchange="arrumarLouvor();">
  <button class="btn btn-success" type="button"
    onclick="pesquisarLouvor($('#titulo').val());">
    <i class="fas fa-search limpo"></i>
  </button>
</div>
<texto style="display:grid;grid-template-rows:1fr 40%;grid-row-gap:.25rem;">
  <textarea class="form-control" id="original"
    placeholder="Cole a letra aqui&#10;Estrofes separadas por linha em branco"
    onchange="arrumarLouvor();" style="resize:none;"></textarea>
  <textarea class="form-control text-nowrap" id="final" style="resize:none;"></textarea>
</texto>`);
});

app.post('/formularios/mensagem', (_req, res) => {
  res.send(/* html */`
<div>
  <input type="text" class="form-control" id="titulo" placeholder="Digite o título"
    style="background-color:bisque;margin-bottom:.225rem;" onchange="arrumarMensagem();">
  <input type="text" class="form-control" id="passagem" placeholder="Digite a passagem"
    style="background-color:bisque;" onchange="arrumarMensagem();">
</div>
<texto style="display:grid;grid-template-rows:1fr 40%;grid-row-gap:.25rem;">
  <div style="display:grid;grid-template-columns:1fr 1fr;grid-column-gap:.25rem;">
    <textarea class="form-control" id="originalMsg"
      placeholder="Tópicos — um por linha" onchange="arrumarMensagem();" style="resize:none;"></textarea>
    <textarea class="form-control" id="originalPas"
      placeholder="Cole o texto bíblico aqui" onchange="arrumarMensagem();" style="resize:none;"></textarea>
  </div>
  <textarea class="form-control text-nowrap" id="final" style="resize:none;"></textarea>
</texto>`);
});

app.post('/formularios/extra', (_req, res) => {
  res.send(/* html */`
<div>Extra</div>
<texto style="display:grid;grid-template-rows:1fr 40%;grid-row-gap:.25rem;height:100%;">
  <div style="display:grid;grid-template-columns:1fr 1fr;grid-column-gap:.25rem;">
    <textarea class="form-control" id="originalImagem"
      placeholder='Imagens — uma por linha:&#10;{"arquivo":"","titulo":""}'
      onchange="arrumarExtra();" style="resize:none;"></textarea>
    <textarea class="form-control" id="originalVideo"
      placeholder='Vídeos — um por linha:&#10;{"arquivo":"","titulo":""}'
      onchange="arrumarExtra();" style="resize:none;"></textarea>
  </div>
  <textarea class="form-control text-nowrap" id="final" style="resize:none;"></textarea>
</texto>`);
});

app.post('/formularios/pesquisar-louvor', (req, res) => {
  const titulo = escHtml(req.body.titulo || '');
  res.send(/* html */`
<div style="display:grid;grid-template-rows:auto auto;grid-row-gap:.25rem;">
  <div class="input-group">
    <input id="pesquisaTitulo" type="text" class="form-control"
      placeholder="Nome da música / artista" value="${titulo}" autofocus>
    <button class="btn btn-success" type="button"
      onclick="pesquisaMusica($('#pesquisaTitulo').val());">
      <i class="fas fa-search"></i>
    </button>
  </div>
  <div id="mostrarMusicas" class="d-none"
    style="display:grid;grid-template-columns:35% 1fr;grid-column-gap:.25rem;">
    <ul id="listaMusicas" class="ulMenu selecionavel"
      style="border:1px solid silver;border-radius:.25rem;margin:0;"></ul>
    <textarea class="form-control text-nowrap" id="letra" style="resize:none;"></textarea>
  </div>
</div>`);
});

/** Retorna { formulario: HTML, louvores: [] } */
app.get('/formularios/pesquisar-louvor-local', (_req, res) => {
  const louvores = carregarItens('louvor');
  const listaHtml = louvores
    .map((l, i) => `<li codigo="${i}">${escHtml(l.titulo)}</li>`)
    .join('\n');
  res.json({
    formulario: /* html */`
<louvores style="display:grid;grid-template-columns:30% 1fr;grid-column-gap:.25rem;height:70vh;">
  <pesquisa class="border-end" style="display:grid;grid-template-rows:1fr auto;overflow-y:auto;">
    <ul id="louvores" class="ulMenu selecionavel w-100 p-1"
      style="overflow-y:auto;margin-bottom:0;padding-bottom:0;">${listaHtml}</ul>
    <div class="input-group input-group-sm border-top p-1">
      <input type="text" class="form-control" placeholder="Pesquisar louvor"
        oninput="$('#louvores').filtra(this.value);" autofocus>
      <span class="input-group-text"><i class="fa fa-search"></i></span>
    </div>
  </pesquisa>
  <mostrar style="overflow:auto;"></mostrar>
</louvores>`,
    louvores
  });
});

/** Retorna { formulario: HTML, hinos: [] } */
app.get('/formularios/pesquisar-hino-local', (_req, res) => {
  const hinos = carregarItens('hino');
  const listaHtml = hinos
    .map((h, i) => `<li codigo="${i}">${escHtml(h.titulo)}</li>`)
    .join('\n');
  res.json({
    formulario: /* html */`
<hinos style="display:grid;grid-template-columns:30% 1fr;grid-column-gap:.25rem;height:70vh;">
  <pesquisa class="border-end" style="display:grid;grid-template-rows:1fr auto;overflow-y:auto;">
    <ul id="hinos" class="ulMenu selecionavel w-100 p-1"
      style="overflow-y:auto;margin-bottom:0;padding-bottom:0;">${listaHtml}</ul>
    <div class="input-group input-group-sm border-top p-1">
      <input type="text" class="form-control" placeholder="Pesquisar hino"
        oninput="$('#hinos').filtra(this.value);" autofocus>
      <span class="input-group-text"><i class="fa fa-search"></i></span>
    </div>
  </pesquisa>
  <mostrar style="overflow:auto;"></mostrar>
</hinos>`,
    hinos
  });
});

// ===========================================================================
// HELPERS
// ===========================================================================

/** Coleta todos os itens de um tipo em todos os arquivos de culto, sem duplicatas */
function carregarItens(tipo) {
  let itens = [];
  try {
    fs.readdirSync(CULTOS_DIR)
      .filter(f => f.endsWith('.json'))
      .forEach(file => {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(CULTOS_DIR, file), 'utf8'));
          if (Array.isArray(data)) {
            data.forEach(item => { if (item && item.tipo === tipo) itens.push(item); });
          }
        } catch (_) { /* arquivo inválido */ }
      });
  } catch (_) { /* diretório vazio */ }

  itens.sort((a, b) =>
    (a.titulo || '').localeCompare(b.titulo || '', 'pt-BR', { sensitivity: 'base' })
  );

  const visto = new Set();
  return itens.filter(item => {
    const k = (item.titulo || '').toLowerCase();
    if (!k || visto.has(k)) return false;
    visto.add(k);
    return true;
  });
}

function escHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ===========================================================================
// INICIAR
// ===========================================================================
app.listen(PORT, () => {
  console.log(`✓ IPE-Liturgia: http://localhost:${PORT}`);
  console.log(`  Cultos em: ${CULTOS_DIR}`);
});
