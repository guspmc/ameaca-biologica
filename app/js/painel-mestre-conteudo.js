'use strict';

// Módulo de conteúdo do Mestre. Não lê nem altera Fichas de Personagem.
const CONTEUDO_MESTRE_VAZIO = () => ({ anotacoes: '', encontros: [], documentos: [], itens: [] });
let BESTIARIO_AB = [];
let CRIATURAS_AB = [];
let carregandoBestiarioMestre = false;

async function carregarBestiarioMestre() {
  if (BESTIARIO_AB.length || carregandoBestiarioMestre) return;
  carregandoBestiarioMestre = true;
  try {
    const dados = await buscar(estado.base + '/dados/bestiario.json');
    BESTIARIO_AB = Array.isArray(dados) ? dados : [];
    CRIATURAS_AB = BESTIARIO_AB.map(c => ({ id: c.id, nome: c.nome, ameaca: c.categoria, pontos: c.pontos }));
    window.BESTIARIO_AB = BESTIARIO_AB;
    if (typeof preencherSeletorCriaturasCombate === 'function') preencherSeletorCriaturasCombate();
    desenharBestiarioMestre();
  } catch (e) {
    const lista = $('bestiario-lista');
    if (lista) lista.textContent = 'Não foi possível carregar o catálogo de B.O.Ws.';
  } finally { carregandoBestiarioMestre = false; }
}
const ORCAMENTO_AB = {
  '1-2': [4, 6, 8], '3-4': [6, 9, 12], '5-6': [8, 12, 16],
  '7-8': [10, 15, 20], '9-10': [12, 18, 24]
};
let conteudoMestre = CONTEUDO_MESTRE_VAZIO();
let carregandoConteudoMestre = false;
let salvandoConteudoMestre = false;
let salvarConteudoPendente = false;

function apiConteudoMestre(metodo = 'GET', corpo) {
  return buscar(estado.base + '/api/painel-mestre/' + encodeURIComponent(estado.mesaId) + '/conteudo', {
    method: metodo,
    headers: { Authorization: 'Bearer ' + estado.token, ...(corpo ? { 'Content-Type': 'application/json' } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined
  });
}

async function carregarConteudoMestre(silencioso = true) {
  if (!estado.mesaId || estado.modo !== 'local' || estado.mesaAtual?.papel !== 'mestre' || carregandoConteudoMestre) return;
  carregandoConteudoMestre = true;
  try {
    const r = await apiConteudoMestre();
    conteudoMestre = r.conteudo || CONTEUDO_MESTRE_VAZIO();
    desenharConteudoMestre();
  } catch (e) {
    if (!silencioso) mensagem($('aviso-mesa'), e.message, 'erro');
  } finally { carregandoConteudoMestre = false; }
}

async function salvarConteudoMestre() {
  if (salvandoConteudoMestre) { salvarConteudoPendente = true; return; }
  salvandoConteudoMestre = true;
  let erro = null;
  try {
    do {
      salvarConteudoPendente = false;
      const copia = JSON.parse(JSON.stringify(conteudoMestre));
      const r = await apiConteudoMestre('PUT', copia);
      if (!salvarConteudoPendente) conteudoMestre = r.conteudo;
    } while (salvarConteudoPendente);
  } catch (e) { erro = e; }
  finally {
    salvandoConteudoMestre = false;
    desenharConteudoMestre();
    if (erro) mensagem($('conteudo-msg'), erro.message, 'erro');
    else mensagem($('conteudo-msg'), 'Alterações salvas.', 'info');
  }
}

function calcularOrcamentoAB(nivel, jogadores, dificuldade) {
  const faixa = nivel <= 2 ? '1-2' : nivel <= 4 ? '3-4' : nivel <= 6 ? '5-6' : nivel <= 8 ? '7-8' : '9-10';
  const base = ORCAMENTO_AB[faixa][dificuldade];
  return Math.max(1, Math.round(base * (1 + (jogadores - 4) * 0.25)));
}

function avaliarUsoOrcamentoAB(pontos, limite) {
  const percentual = limite > 0 ? Math.round((pontos / limite) * 100) : 0;
  let leitura;
  if (pontos === 0) leitura = 'Nenhuma criatura foi selecionada.';
  else if (percentual >= 90) leitura = 'Orçamento bem aproveitado.';
  else if (percentual >= 70) leitura = 'Encontro abaixo do orçamento; há margem para reforçar a composição.';
  else leitura = 'Encontro consideravelmente abaixo do orçamento; considere adicionar ameaças ou assumir um combate mais leve.';
  return { percentual, leitura };
}

function sortearEncontroAB(nivel, jogadores, dificuldade) {
  const limite = calcularOrcamentoAB(nivel, jogadores, dificuldade);
  const escolhidas = [];
  let pontos = 0;
  const elegiveis = CRIATURAS_AB.filter(c => c.pontos <= limite && c.pontos < 8);
  for (let i = 0; i < 12; i++) {
    const disponiveis = elegiveis.filter(c => pontos + c.pontos <= limite);
    if (!disponiveis.length) break;
    const c = disponiveis[Math.floor(Math.random() * disponiveis.length)];
    escolhidas.push(c.nome);
    pontos += c.pontos;
    if (pontos >= limite || Math.random() < 0.28) break;
  }
  const contagem = {};
  for (const nome of escolhidas) contagem[nome] = (contagem[nome] || 0) + 1;
  return { pontos, limite, ...avaliarUsoOrcamentoAB(pontos, limite), composicao: Object.entries(contagem).map(([nome, qtd]) => qtd + ' × ' + nome).join(', ') };
}

function elemento(tag, texto, classe) {
  const e = document.createElement(tag);
  if (texto !== undefined) e.textContent = texto;
  if (classe) e.className = classe;
  return e;
}
function campoConteudo(rotulo, id, tipo = 'input', valor = '') {
  const l = elemento('label', rotulo);
  const e = elemento(tipo);
  e.id = id;
  e.value = valor;
  if (tipo === 'input') e.maxLength = 100;
  return [l, e];
}
function novoIdConteudo() { return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2); }

let documentoEmEdicao = null;
let itemEmEdicao = null;

function cancelarEdicaoDocumento() {
  documentoEmEdicao = null;
  $('doc-titulo').value = '';
  $('doc-tipo').selectedIndex = 0;
  $('doc-conteudo').value = '';
  $('doc-arquivo').value = '';
  $('doc-visivel').checked = false;
  $('doc-guardar').textContent = 'Salvar documento';
  $('doc-cancelar').hidden = true;
}
function editarDocumentoMestre(id) {
  const doc = conteudoMestre.documentos.find(x => x.id === id);
  if (!doc) return;
  documentoEmEdicao = id;
  $('doc-titulo').value = doc.titulo;
  $('doc-tipo').value = doc.tipo;
  $('doc-conteudo').value = doc.conteudo;
  $('doc-arquivo').value = doc.arquivoUrl || '';
  $('doc-visivel').checked = Boolean(doc.visivel);
  $('doc-guardar').textContent = 'Salvar alterações';
  $('doc-cancelar').hidden = false;
  $('doc-titulo').focus();
}
function cancelarEdicaoItem() {
  itemEmEdicao = null;
  $('item-nome').value = '';
  $('item-categoria').selectedIndex = 0;
  $('item-descricao').value = '';
  $('item-efeito').value = '';
  $('item-imagem').value = '';
  $('item-imagem-preview').hidden = true;
  $('item-publicar').checked = false;
  $('item-guardar').textContent = 'Salvar item';
  $('item-cancelar').hidden = true;
}
function editarItemMestre(id) {
  const item = conteudoMestre.itens.find(x => x.id === id);
  if (!item) return;
  itemEmEdicao = id;
  $('item-nome').value = item.nome;
  $('item-categoria').value = item.categoria;
  $('item-descricao').value = item.descricao;
  $('item-efeito').value = item.efeito;
  $('item-imagem').value = item.imagemUrl || '';
  atualizarPreviewImagemItem();
  $('item-publicar').checked = Boolean(item.visivel);
  $('item-guardar').textContent = 'Salvar alterações';
  $('item-cancelar').hidden = false;
  $('item-nome').focus();
}

function atualizarPreviewImagemItem() {
  const preview = $('item-imagem-preview');
  const url = $('item-imagem')?.value.trim() || '';
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('URL inválida');
    preview.src = url; preview.hidden = false;
  } catch { preview.removeAttribute('src'); preview.hidden = true; }
}

function desenharBestiarioMestre(filtro = '') {
  const lista = $('bestiario-lista');
  if (!lista) return;
  lista.replaceChildren();
  const termo = String(filtro).trim().toLocaleLowerCase('pt-BR');
  const criaturas = BESTIARIO_AB.filter(c => !termo || [c.nome,c.categoria,c.funcao,c.tamanho].join(' ').toLocaleLowerCase('pt-BR').includes(termo));
  if (!criaturas.length) { lista.append(elemento('p', BESTIARIO_AB.length ? 'Nenhuma criatura encontrada.' : 'Carregando catálogo…', 'dica')); return; }
  for (const c of criaturas) {
    const detalhe = elemento('details', '', 'bestiario-criatura');
    const resumo = elemento('summary', c.nome + ' · ' + c.categoria + ' (' + c.pontos + ' pts)');
    detalhe.append(resumo);
    detalhe.append(elemento('p', c.funcao + ' · ' + c.tamanho, 'dica'));
    detalhe.append(elemento('p', 'PV ' + c.pv + ' · Defesa ' + c.defesa + ' · Movimento ' + c.movimento));
    detalhe.append(elemento('p', 'FOR ' + c.atributos.for + ' · AGI ' + c.atributos.agi + ' · VIG ' + c.atributos.vig + ' · AST ' + c.atributos.ast + ' · Iniciativa +' + c.iniciativa));
    detalhe.append(elemento('p', 'Fortitude +' + c.resistencias.fortitude + ' · Reflexos +' + c.resistencias.reflexos + ' · Vontade +' + c.resistencias.vontade + ' · Percepção +' + c.resistencias.percepcao));
    const ataques = elemento('div'); ataques.append(elemento('strong','Ataques'));
    for (const ataque of c.ataques) ataques.append(elemento('p',ataque));
    detalhe.append(ataques);
    const tracos = elemento('div'); tracos.append(elemento('strong','Traços'));
    for (const traco of c.tracos) tracos.append(elemento('p',traco));
    detalhe.append(tracos);
    lista.append(detalhe);
  }
  const rodape = elemento('p', criaturas.length + ' de ' + BESTIARIO_AB.length + ' criaturas', 'dica');
  lista.append(rodape);
}

function desenharConteudoMestre() {
  const raiz = $('bloco-conteudo-mestre');
  if (!raiz) return;
  $('anotacoes-mestre').value = conteudoMestre.anotacoes || '';
  const encontros = $('encontros-mestre'); encontros.replaceChildren();
  for (const item of conteudoMestre.encontros) {
    const li = elemento('li', '', 'registro-mestre');
    li.append(elemento('strong', item.nome || 'Encontro sem título'));
    li.append(elemento('p', 'Nível ' + (item.nivel || '—') + ' · ' + (item.jogadores || '—') + ' personagens · ' + (item.dificuldade || '—')));
    const avaliacao = avaliarUsoOrcamentoAB(item.pontos || 0, item.orcamento || 0);
    li.append(elemento('p', (item.pontos || 0) + ' / ' + (item.orcamento || '—') + ' pontos (' + avaliacao.percentual + '%) · ' + (item.composicao || 'Sem composição')));
    li.append(elemento('p', avaliacao.leitura, 'dica'));
    if (item.cenario) li.append(elemento('p', 'Cenário: ' + item.cenario));
    if (item.direcao) li.append(elemento('p', 'Direção: ' + item.direcao));
    const acoes = elemento('div', '', 'linha');
    const editar = elemento('button', 'Editar encontro', 'botao pequeno');
    editar.type = 'button';
    const duplicar = elemento('button', 'Duplicar', 'botao pequeno');
    duplicar.type = 'button';
    duplicar.addEventListener('click', () => {
      const copia = JSON.parse(JSON.stringify(item));
      copia.id = novoIdConteudo();
      copia.nome = (item.nome || 'Encontro sem título') + ' (cópia)';
      const indice = conteudoMestre.encontros.findIndex(x => x.id === item.id);
      conteudoMestre.encontros.splice(indice < 0 ? 0 : indice + 1, 0, copia);
      salvarConteudoMestre();
    });
    const remover = elemento('button', 'Excluir', 'botao pequeno perigo');
    remover.type = 'button'; remover.addEventListener('click', () => { if (!confirm('Excluir este encontro preparado?')) return; conteudoMestre.encontros = conteudoMestre.encontros.filter(x => x.id !== item.id); salvarConteudoMestre(); });
    const editor = elemento('form', '', 'editor-encontro-mestre'); editor.hidden = true;
    const campos = {};
    const adicionarCampo = (chave, rotulo, tipo = 'text') => {
      const label = elemento('label', rotulo);
      const input = elemento('input'); input.type = tipo; input.value = item[chave] ?? '';
      input.maxLength = chave === 'composicao' || chave === 'cenario' || chave === 'direcao' ? 12000 : 100;
      if (tipo === 'number') { input.min = '0'; input.max = '100'; input.step = '1'; }
      label.append(input); editor.append(label); campos[chave] = input;
    };
    adicionarCampo('nome','Nome do encontro');
    adicionarCampo('nivel','Nível','number');
    adicionarCampo('jogadores','Quantidade de personagens','number');
    const labelDificuldade = elemento('label','Intensidade');
    const selectDificuldade = elemento('select');
    for (const valor of ['Tenso','Difícil','Brutal']) { const op = elemento('option',valor); op.value = valor; selectDificuldade.append(op); }
    selectDificuldade.value = item.dificuldade || 'Tenso'; labelDificuldade.append(selectDificuldade); editor.append(labelDificuldade); campos.dificuldade = selectDificuldade;
    adicionarCampo('pontos','Pontos da composição','number');
    adicionarCampo('orcamento','Orçamento','number');
    adicionarCampo('composicao','Composição');
    adicionarCampo('cenario','Cenário');
    adicionarCampo('direcao','Direção / comportamento');
    const salvar = elemento('button','Salvar alterações','botao pequeno primario'); salvar.type = 'submit';
    const cancelar = elemento('button','Cancelar','botao pequeno'); cancelar.type = 'button'; cancelar.addEventListener('click',()=>{editor.hidden=true;});
    editor.append(salvar,cancelar);
    editar.addEventListener('click',()=>{editor.hidden=!editor.hidden;});
    editor.addEventListener('submit',e=>{
      e.preventDefault();
      for (const chave of ['nome','composicao','cenario','direcao']) item[chave] = campos[chave].value.trim();
      for (const chave of ['nivel','jogadores','pontos','orcamento']) {
        const valor = Number(campos[chave].value);
        if (!Number.isInteger(valor) || valor < 0 || valor > 100) { mensagem($('conteudo-msg'),'Informe valores inteiros entre 0 e 100 nos campos numéricos.','aviso'); campos[chave].focus(); return; }
        item[chave] = valor;
      }
      item.dificuldade = campos.dificuldade.value;
      if (!item.nome) { mensagem($('conteudo-msg'),'Informe um nome para o encontro.','aviso'); campos.nome.focus(); return; }
      salvarConteudoMestre();
    });
    acoes.append(editar,duplicar,remover);
    li.append(acoes,editor); encontros.append(li);
  }
  const documentos = $('documentos-mestre'); documentos.replaceChildren();
  for (const item of conteudoMestre.documentos) {
    const li = elemento('li', '', 'registro-mestre');
    li.append(elemento('strong', item.titulo), elemento('p', item.tipo + (item.visivel ? ' · marcado para compartilhar' : ' · privado')));
    const editarDoc = elemento('button', 'Editar', 'botao pequeno');
    editarDoc.type = 'button'; editarDoc.addEventListener('click', () => editarDocumentoMestre(item.id));
    const publicar = elemento('button', item.visivel ? 'Retirar publicação' : 'Publicar', 'botao pequeno');
    publicar.type = 'button'; publicar.addEventListener('click', () => { item.visivel = !item.visivel; salvarConteudoMestre(); });
    const remover = elemento('button', 'Excluir', 'botao pequeno perigo');
    remover.type = 'button'; remover.addEventListener('click', () => { if (!confirm('Excluir este documento?')) return; conteudoMestre.documentos = conteudoMestre.documentos.filter(x => x.id !== item.id); salvarConteudoMestre(); });
    if (item.arquivoUrl) { const link = elemento('a', 'Abrir arquivo anexo'); link.href = item.arquivoUrl; link.target = '_blank'; link.rel = 'noopener noreferrer'; li.append(link); }
    li.append(editarDoc, publicar, remover); documentos.append(li);
  }
  const itens = $('itens-mestre'); itens.replaceChildren();
  for (const item of conteudoMestre.itens) {
    const li = elemento('li', '', 'registro-mestre');
    li.append(elemento('strong', item.nome), elemento('p', (item.categoria || 'Item') + ' · ' + (item.efeito || item.descricao || 'Sem efeito descrito')));
    if (item.imagemUrl) { const img = elemento('img'); img.src = item.imagemUrl; img.alt = 'Imagem de ' + item.nome; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer'; img.className = 'item-imagem-mestre'; li.append(img); }
    const estadoPublicacao = elemento('span', item.visivel ? 'Publicado para Jogadores' : 'Privado', 'dica');
    const editar = elemento('button', 'Editar', 'botao pequeno');
    editar.type = 'button'; editar.addEventListener('click', () => editarItemMestre(item.id));
    const publicar = elemento('button', item.visivel ? 'Retirar publicação' : 'Publicar', 'botao pequeno');
    publicar.type = 'button'; publicar.addEventListener('click', () => { item.visivel = !item.visivel; salvarConteudoMestre(); });
    const remover = elemento('button', 'Excluir', 'botao pequeno perigo');
    remover.type = 'button'; remover.addEventListener('click', () => { if (!confirm('Excluir este item personalizado?')) return; conteudoMestre.itens = conteudoMestre.itens.filter(x => x.id !== item.id); salvarConteudoMestre(); });
    li.append(estadoPublicacao, editar, publicar, remover); itens.append(li);
  }
}

function montarConteudoMestre() {
  if (estado.mesaAtual?.papel !== 'mestre' || $('bloco-conteudo-mestre')) return;
  const raiz = $('conteudo-mesa');
  const card = elemento('section', '', 'cartao painel-conteudo'); card.id = 'bloco-conteudo-mestre';
  card.append(elemento('h2', 'Painel de conteúdo'));
  const menu = elemento('nav', '', 'menu-conteudo-mestre'); menu.setAttribute('aria-label', 'Seções do Painel do Mestre');
  const abas = [['itens','Itens personalizados'],['documentos','Documentações / Files'],['bestiario','Bestiário'],['encontros','Encontros e anotações']];
  const paineis = {};
  const trocarAba = (nome) => { for (const [chave] of abas) { if (paineis[chave]) paineis[chave].hidden = chave !== nome; const botao = menu.querySelector('[data-aba="' + chave + '"]'); if (botao) { botao.setAttribute('aria-selected', String(chave === nome)); botao.tabIndex = chave === nome ? 0 : -1; } } };
  for (const [chave, rotulo] of abas) { const botao = elemento('button', rotulo, 'botao pequeno'); botao.type = 'button'; botao.dataset.aba = chave; botao.setAttribute('role','tab'); botao.setAttribute('aria-selected',String(chave==='itens')); botao.addEventListener('click',()=>trocarAba(chave)); menu.append(botao); }
  card.append(menu);
  const msg = elemento('p', '', 'mensagem'); msg.id = 'conteudo-msg'; msg.hidden = true; card.append(msg);

  const encontro = elemento('section', '', 'subpainel-mestre'); encontro.dataset.secao = 'encontros'; paineis.encontros = encontro;
  encontro.append(elemento('h3', 'Criador de encontros'));
  const form = elemento('form', '', 'form-encontro-mestre');
  const [ln, nivel] = campoConteudo('Nível da Mesa', 'encontro-nivel', 'select');
  for (let i = 1; i <= 10; i++) { const o = elemento('option', 'Nível ' + i); o.value = i; nivel.append(o); }
  nivel.value = estado.mesaAtual.limiteNivel || 1;
  const [lj, jogadores] = campoConteudo('Quantidade de personagens', 'encontro-jogadores', 'select');
  for (let i = 1; i <= 9; i++) { const o = elemento('option', String(i)); o.value = i; jogadores.append(o); }
  jogadores.value = Math.max(1, (estado.mesaAtual.jogadores || []).filter(j => j.status === 'aprovado').length);
  const [ld, dificuldade] = campoConteudo('Intensidade', 'encontro-dificuldade', 'select');
  for (const [v, t] of [[0, 'Tenso'], [1, 'Difícil'], [2, 'Brutal']]) { const o = elemento('option', t); o.value = v; dificuldade.append(o); }
  const resultado = elemento('p', 'Defina nível, tamanho do grupo e intensidade para calcular o orçamento.', 'dica'); resultado.id = 'encontro-resultado';
  const gerar = elemento('button', 'Sortear composição', 'botao primario'); gerar.type = 'button';
  gerar.addEventListener('click', () => {
    const n = Number(nivel.value), j = Number(jogadores.value), d = Number(dificuldade.value);
    const r = sortearEncontroAB(n, j, d);
    resultado.textContent = 'Orçamento: ' + r.limite + ' pontos · Sorteio: ' + r.pontos + ' pontos (' + r.percentual + '%) · ' + r.composicao + '. ' + r.leitura + ' Perseguidores e Chefes não entram no sorteio automático. A leitura do aproveitamento é apenas uma referência prática, não uma regra adicional do livro.';
    form.dataset.sorteio = JSON.stringify({ nivel: n, jogadores: j, dificuldade: ['Tenso', 'Difícil', 'Brutal'][d], ...r });
  });
  const [lc, cenario] = campoConteudo('Cenário', 'encontro-cenario');
  const [ldir, direcao] = campoConteudo('Direção / comportamento', 'encontro-direcao', 'textarea');
  const salvarEncontro = elemento('button', 'Guardar encontro', 'botao'); salvarEncontro.type = 'submit';
  form.append(ln, nivel, lj, jogadores, ld, dificuldade, gerar, resultado, lc, cenario, ldir, direcao, salvarEncontro);
  form.addEventListener('submit', e => {
    e.preventDefault();
    let s; try { s = JSON.parse(form.dataset.sorteio || 'null'); } catch {}
    if (!s) { mensagem(msg, 'Faça um sorteio antes de guardar o encontro.', 'aviso'); return; }
    conteudoMestre.encontros.unshift({ id: novoIdConteudo(), nome: 'Encontro · Nível ' + s.nivel, nivel: s.nivel, jogadores: s.jogadores, dificuldade: s.dificuldade, pontos: s.pontos, orcamento: s.limite, composicao: s.composicao, cenario: cenario.value, direcao: direcao.value });
    form.dataset.sorteio = ''; salvarConteudoMestre();
  });
  encontro.append(form); card.append(encontro);

  const anotacoes = elemento('section', '', 'subpainel-mestre'); anotacoes.dataset.secao = 'encontros'; anotacoes.append(elemento('h3', 'Anotações da Mesa'));
  const notas = elemento('textarea'); notas.id = 'anotacoes-mestre'; notas.rows = 5; notas.maxLength = 12000; notas.placeholder = 'Pistas, decisões, nomes, acontecimentos…';
  const salvarNotas = elemento('button', 'Salvar anotações', 'botao'); salvarNotas.type = 'button';
  salvarNotas.addEventListener('click', () => { conteudoMestre.anotacoes = notas.value; salvarConteudoMestre(); });
  anotacoes.append(notas, salvarNotas); encontro.append(anotacoes);

  const bestiario = elemento('section', '', 'subpainel-mestre'); bestiario.dataset.secao = 'bestiario'; paineis.bestiario = bestiario;
  bestiario.append(elemento('h3', 'Bestiário de B.O.Ws.'));
  bestiario.append(elemento('p', 'Catálogo do Arquivo do Mestre v1.0. Os valores são referências da ficha impressa; ajustes de cena ficam a cargo do Mestre.', 'dica'));
  const buscaBestiario = elemento('input'); buscaBestiario.type = 'search'; buscaBestiario.id = 'bestiario-busca'; buscaBestiario.placeholder = 'Buscar criatura, categoria ou função…'; buscaBestiario.maxLength = 80;
  buscaBestiario.addEventListener('input', () => desenharBestiarioMestre(buscaBestiario.value));
  const listaBestiario = elemento('div', '', 'lista-bestiario'); listaBestiario.id = 'bestiario-lista';
  bestiario.append(buscaBestiario, listaBestiario); card.append(bestiario);

  const docs = elemento('section', '', 'subpainel-mestre'); docs.dataset.secao = 'documentos'; paineis.documentos = docs; docs.append(elemento('h3', 'Documentos narrativos'));
  const fd = elemento('form', '', 'form-encontro-mestre');
  const [ldt, tituloDoc] = campoConteudo('Título', 'doc-titulo');
  const [ldtipo, tipoDoc] = campoConteudo('Tipo', 'doc-tipo', 'select');
  for (const t of ['Relatório', 'E-mail', 'Bilhete', 'Arquivo', 'Pista', 'Outro']) { const o = elemento('option', t); o.value = t; tipoDoc.append(o); }
  const [ldc, conteudoDoc] = campoConteudo('Conteúdo', 'doc-conteudo', 'textarea');
  conteudoDoc.rows = 6; conteudoDoc.maxLength = 12000;
  const [larq, arquivoDoc] = campoConteudo('Link para arquivo anexo (opcional)', 'doc-arquivo');
  arquivoDoc.type = 'url'; arquivoDoc.placeholder = 'https://…';
  const visivel = elemento('input'); visivel.type = 'checkbox'; visivel.id = 'doc-visivel';
  const lv = elemento('label', 'Preparar para compartilhar com os Jogadores'); lv.prepend(visivel);
  const guardarDoc = elemento('button', 'Salvar documento', 'botao'); guardarDoc.type = 'submit'; guardarDoc.id = 'doc-guardar';
  const cancelarDoc = elemento('button', 'Cancelar edição', 'botao pequeno'); cancelarDoc.type = 'button'; cancelarDoc.id = 'doc-cancelar'; cancelarDoc.hidden = true; cancelarDoc.addEventListener('click', cancelarEdicaoDocumento);
  fd.append(ldt, tituloDoc, ldtipo, tipoDoc, ldc, conteudoDoc, larq, arquivoDoc, lv, guardarDoc, cancelarDoc);
  fd.addEventListener('submit', e => { e.preventDefault(); if (!tituloDoc.value.trim() || !conteudoDoc.value.trim()) return;
    const dados = { titulo: tituloDoc.value.trim(), tipo: tipoDoc.value, conteudo: conteudoDoc.value, arquivoUrl: arquivoDoc.value.trim(), visivel: visivel.checked };
    if (documentoEmEdicao) { const doc = conteudoMestre.documentos.find(x => x.id === documentoEmEdicao); if (doc) Object.assign(doc, dados); }
    else conteudoMestre.documentos.unshift({ id: novoIdConteudo(), ...dados });
    cancelarEdicaoDocumento(); salvarConteudoMestre(); });
  docs.append(fd, elemento('ul', '', 'lista')); docs.lastChild.id = 'documentos-mestre'; card.append(docs);

  const itensSec = elemento('section', '', 'subpainel-mestre'); itensSec.dataset.secao = 'itens'; paineis.itens = itensSec; itensSec.append(elemento('h3', 'Itens personalizados'));
  const fi = elemento('form', '', 'form-encontro-mestre');
  const [li, nomeItem] = campoConteudo('Nome do item', 'item-nome');
  const [lic, catItem] = campoConteudo('Categoria', 'item-categoria', 'select');
  for (const t of ['Arma', 'Proteção', 'Consumível', 'Chave', 'Equipamento', 'Outro']) { const o = elemento('option', t); o.value = t; catItem.append(o); }
  const [lid, descItem] = campoConteudo('Descrição', 'item-descricao', 'textarea'); descItem.rows = 3;
  const [lie, efeitoItem] = campoConteudo('Efeito / regra', 'item-efeito', 'textarea'); efeitoItem.rows = 3;
  const [lim, imagemItem] = campoConteudo('Imagem do item (URL)', 'item-imagem');
  imagemItem.type = 'url'; imagemItem.placeholder = 'https://…';
  const previewItem = elemento('img'); previewItem.id = 'item-imagem-preview'; previewItem.alt = 'Prévia da imagem do item'; previewItem.hidden = true; previewItem.loading = 'lazy'; previewItem.referrerPolicy = 'no-referrer';
  imagemItem.addEventListener('input', atualizarPreviewImagemItem);
  const publicarItem = elemento('input'); publicarItem.type = 'checkbox'; publicarItem.id = 'item-publicar';
  const labelPublicarItem = elemento('label', 'Compartilhar item com os Jogadores'); labelPublicarItem.prepend(publicarItem);
  const guardarItem = elemento('button', 'Salvar item', 'botao'); guardarItem.type = 'submit'; guardarItem.id = 'item-guardar';
  const cancelarItem = elemento('button', 'Cancelar edição', 'botao pequeno'); cancelarItem.type = 'button'; cancelarItem.id = 'item-cancelar'; cancelarItem.hidden = true; cancelarItem.addEventListener('click', cancelarEdicaoItem);
  fi.append(li, nomeItem, lic, catItem, lid, descItem, lie, efeitoItem, lim, imagemItem, previewItem, labelPublicarItem, guardarItem, cancelarItem);
  fi.addEventListener('submit', e => { e.preventDefault(); if (!nomeItem.value.trim()) return;
    const dados = { nome: nomeItem.value.trim(), categoria: catItem.value, descricao: descItem.value, efeito: efeitoItem.value, imagemUrl: imagemItem.value.trim(), visivel: publicarItem.checked };
    if (itemEmEdicao) { const item = conteudoMestre.itens.find(x => x.id === itemEmEdicao); if (item) Object.assign(item, dados); }
    else conteudoMestre.itens.unshift({ id: novoIdConteudo(), ...dados });
    cancelarEdicaoItem(); salvarConteudoMestre(); });
  itensSec.append(fi, elemento('ul', '', 'lista')); itensSec.lastChild.id = 'itens-mestre'; card.append(itensSec);

  const ulE = elemento('ul', '', 'lista'); ulE.id = 'encontros-mestre';
  const eSec = elemento('section', '', 'subpainel-mestre'); eSec.dataset.secao = 'encontros'; eSec.append(elemento('h3', 'Encontros preparados'), ulE); encontro.append(eSec);
  raiz.append(card);
  trocarAba('itens');
  desenharConteudoMestre();
}

let documentosPublicosMesa = [];
let itensPublicosMesa = [];
let carregandoDocumentosPublicos = false;
async function carregarDocumentosPublicos() {
  if (!estado.mesaId || estado.modo !== 'local' || estado.mesaAtual?.papel !== 'jogador' || carregandoDocumentosPublicos) return;
  carregandoDocumentosPublicos = true;
  try {
    const r = await buscar(estado.base + '/api/mesas/' + encodeURIComponent(estado.mesaId) + '/publicacoes', {
      headers: { Authorization: 'Bearer ' + estado.token }
    });
    documentosPublicosMesa = r.documentos || [];
    itensPublicosMesa = r.itens || [];
  } catch { documentosPublicosMesa = []; itensPublicosMesa = []; }
  finally { carregandoDocumentosPublicos = false; }
}
function montarDocumentosPublicos() {
  if (estado.mesaAtual?.papel !== 'jogador' || $('documentos-publicos-mesa')) return;
  const card = elemento('section', '', 'cartao'); card.id = 'documentos-publicos-mesa';
  card.append(elemento('h2', 'Documentos compartilhados pelo Mestre'));
  if (!documentosPublicosMesa.length && !itensPublicosMesa.length) card.append(elemento('p', 'Nenhum documento ou item foi compartilhado nesta Mesa.', 'dica'));
  for (const doc of documentosPublicosMesa) {
    const sec = elemento('article', '', 'subpainel-mestre');
    sec.append(elemento('h3', doc.titulo), elemento('p', doc.tipo, 'dica'));
    const corpo = elemento('p', doc.conteudo); corpo.style.whiteSpace = 'pre-wrap'; sec.append(corpo);
    if (doc.arquivoUrl) { const link = elemento('a', 'Abrir arquivo anexo'); link.href = doc.arquivoUrl; link.target = '_blank'; link.rel = 'noopener noreferrer'; sec.append(link); }
    card.append(sec);
  }
  if (itensPublicosMesa.length) {
    card.append(elemento('h2', 'Itens disponibilizados pelo Mestre'));
    for (const item of itensPublicosMesa) {
      const sec = elemento('article', '', 'subpainel-mestre');
      sec.append(elemento('h3', item.nome), elemento('p', item.categoria || 'Item', 'dica'));
      if (item.imagemUrl) { const img = elemento('img'); img.src = item.imagemUrl; img.alt = 'Imagem de ' + item.nome; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer'; img.className = 'item-imagem-mestre'; sec.append(img); }
      if (item.descricao) sec.append(elemento('p', item.descricao));
      if (item.efeito) sec.append(elemento('p', item.efeito));
      card.append(sec);
    }
  }
  $('conteudo-mesa').append(card);
}
const renderizarMesaConteudoOriginal = window.renderizarMesa;
const carregarMesaConteudoOriginal = window.carregarMesaAtual;
window.renderizarMesa = function () {
  renderizarMesaConteudoOriginal();
  if (estado.tela !== 'mesa') return;
  if (estado.mesaAtual?.papel === 'mestre') montarConteudoMestre();
  else montarDocumentosPublicos();
};
let mesaConteudoCarregada = null;
window.carregarMesaAtual = async function () {
  if (estado.mesaId !== mesaConteudoCarregada) { conteudoMestre = CONTEUDO_MESTRE_VAZIO(); documentosPublicosMesa = []; itensPublicosMesa = []; mesaConteudoCarregada = estado.mesaId; }
  await carregarMesaConteudoOriginal();
  if (estado.tela !== 'mesa') return;
  await carregarBestiarioMestre();
  if (estado.mesaAtual?.papel === 'mestre') await carregarConteudoMestre(true);
  else {
    documentosPublicosMesa = []; itensPublicosMesa = [];
    await carregarDocumentosPublicos();
    window.renderizarMesa();
  }
};
