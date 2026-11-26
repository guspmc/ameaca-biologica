'use strict';

// Módulo de conteúdo do Mestre. Não lê nem altera Fichas de Personagem.
const CONTEUDO_MESTRE_VAZIO = () => ({ anotacoes: '', encontros: [], documentos: [], itens: [] });
const CRIATURAS_AB = [
  { nome: 'Infectado', ameaca: 'Comum', pontos: 1 },
  { nome: 'Infectado Ácido', ameaca: 'Comum', pontos: 1 },
  { nome: 'Cerberus', ameaca: 'Comum', pontos: 1 },
  { nome: 'Fiador de Teia', ameaca: 'Comum', pontos: 1 },
  { nome: 'Corvo', ameaca: 'Comum', pontos: 1 },
  { nome: 'G Infante', ameaca: 'Comum', pontos: 1 },
  { nome: 'Cabeça Carmesim (Crimson Head)', ameaca: 'Perigosa', pontos: 2 },
  { nome: 'Cabeça Pustulenta', ameaca: 'Perigosa', pontos: 2 },
  { nome: 'Carnífice', ameaca: 'Perigosa', pontos: 2 },
  { nome: 'Deimos', ameaca: 'Perigosa', pontos: 2 },
  { nome: 'Infectado NE-α', ameaca: 'Perigosa', pontos: 2 },
  { nome: 'Ivy', ameaca: 'Perigosa', pontos: 2 },
  { nome: 'Pálido', ameaca: 'Perigosa', pontos: 2 },
  { nome: 'G Adulto', ameaca: 'Elite', pontos: 4 },
  { nome: 'Caçador Beta', ameaca: 'Elite', pontos: 4 },
  { nome: 'Caçador Gama', ameaca: 'Elite', pontos: 4 },
  { nome: 'Caçador Alfa', ameaca: 'Elite', pontos: 4 },
  { nome: 'Tirano (T-103 Forma II)', ameaca: 'Chefe', pontos: 8 },
  { nome: 'Jacaré', ameaca: 'Chefe', pontos: 8 },
  { nome: 'Planta 42', ameaca: 'Chefe', pontos: 8 },
  { nome: 'Nemesis T-Type — Forma II', ameaca: 'Chefe', pontos: 8 },
  { nome: 'Nemesis T-Type — Forma Final', ameaca: 'Chefe', pontos: 8 }
];
const ORCAMENTO_AB = {
  '1-2': [4, 6, 8], '3-4': [6, 9, 12], '5-6': [8, 12, 16],
  '7-8': [10, 15, 20], '9-10': [12, 18, 24]
};
let conteudoMestre = CONTEUDO_MESTRE_VAZIO();
let carregandoConteudoMestre = false;
let salvandoConteudoMestre = false;

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
  if (salvandoConteudoMestre) return;
  salvandoConteudoMestre = true;
  try {
    const r = await apiConteudoMestre('PUT', conteudoMestre);
    conteudoMestre = r.conteudo;
    desenharConteudoMestre();
    mensagem($('conteudo-msg'), 'Alterações salvas.', 'info');
  } catch (e) { mensagem($('conteudo-msg'), e.message, 'erro'); }
  finally { salvandoConteudoMestre = false; }
}

function calcularOrcamentoAB(nivel, jogadores, dificuldade) {
  const faixa = nivel <= 2 ? '1-2' : nivel <= 4 ? '3-4' : nivel <= 6 ? '5-6' : nivel <= 8 ? '7-8' : '9-10';
  const base = ORCAMENTO_AB[faixa][dificuldade];
  return Math.max(1, Math.round(base * (1 + (jogadores - 4) * 0.25)));
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
  return { pontos, limite, composicao: Object.entries(contagem).map(([nome, qtd]) => qtd + ' × ' + nome).join(', ') };
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

function desenharConteudoMestre() {
  const raiz = $('bloco-conteudo-mestre');
  if (!raiz) return;
  $('anotacoes-mestre').value = conteudoMestre.anotacoes || '';
  const encontros = $('encontros-mestre'); encontros.replaceChildren();
  for (const item of conteudoMestre.encontros) {
    const li = elemento('li', '', 'registro-mestre');
    li.append(elemento('strong', item.nome || 'Encontro sem título'), elemento('p', (item.pontos || 0) + ' pontos · ' + (item.dificuldade || '—') + ' · ' + (item.composicao || 'Sem composição')));
    const remover = elemento('button', 'Excluir', 'botao pequeno perigo');
    remover.type = 'button'; remover.addEventListener('click', () => { conteudoMestre.encontros = conteudoMestre.encontros.filter(x => x.id !== item.id); salvarConteudoMestre(); });
    li.append(remover); encontros.append(li);
  }
  const documentos = $('documentos-mestre'); documentos.replaceChildren();
  for (const item of conteudoMestre.documentos) {
    const li = elemento('li', '', 'registro-mestre');
    li.append(elemento('strong', item.titulo), elemento('p', item.tipo + (item.visivel ? ' · marcado para compartilhar' : ' · privado')));
    const remover = elemento('button', 'Excluir', 'botao pequeno perigo');
    remover.type = 'button'; remover.addEventListener('click', () => { conteudoMestre.documentos = conteudoMestre.documentos.filter(x => x.id !== item.id); salvarConteudoMestre(); });
    li.append(remover); documentos.append(li);
  }
  const itens = $('itens-mestre'); itens.replaceChildren();
  for (const item of conteudoMestre.itens) {
    const li = elemento('li', '', 'registro-mestre');
    li.append(elemento('strong', item.nome), elemento('p', (item.categoria || 'Item') + ' · ' + (item.efeito || item.descricao || 'Sem efeito descrito')));
    const remover = elemento('button', 'Excluir', 'botao pequeno perigo');
    remover.type = 'button'; remover.addEventListener('click', () => { conteudoMestre.itens = conteudoMestre.itens.filter(x => x.id !== item.id); salvarConteudoMestre(); });
    li.append(remover); itens.append(li);
  }
}

function montarConteudoMestre() {
  if (estado.mesaAtual?.papel !== 'mestre' || $('bloco-conteudo-mestre')) return;
  const raiz = $('conteudo-mesa');
  const card = elemento('section', '', 'cartao painel-conteudo'); card.id = 'bloco-conteudo-mestre';
  card.append(elemento('h2', 'Ferramentas da narrativa'));
  const msg = elemento('p', '', 'mensagem'); msg.id = 'conteudo-msg'; msg.hidden = true; card.append(msg);

  const encontro = elemento('section', '', 'subpainel-mestre');
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
    resultado.textContent = 'Orçamento: ' + r.limite + ' pontos · Sorteio: ' + r.pontos + ' pontos · ' + r.composicao + '. Perseguidores e Chefes não entram no sorteio automático.';
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
    conteudoMestre.encontros.unshift({ id: novoIdConteudo(), nome: 'Encontro · Nível ' + s.nivel, nivel: s.nivel, jogadores: s.jogadores, dificuldade: s.dificuldade, pontos: s.pontos, composicao: s.composicao, cenario: cenario.value, direcao: direcao.value });
    form.dataset.sorteio = ''; salvarConteudoMestre();
  });
  encontro.append(form); card.append(encontro);

  const anotacoes = elemento('section', '', 'subpainel-mestre'); anotacoes.append(elemento('h3', 'Anotações da Mesa'));
  const notas = elemento('textarea'); notas.id = 'anotacoes-mestre'; notas.rows = 5; notas.maxLength = 12000; notas.placeholder = 'Pistas, decisões, nomes, acontecimentos…';
  const salvarNotas = elemento('button', 'Salvar anotações', 'botao'); salvarNotas.type = 'button';
  salvarNotas.addEventListener('click', () => { conteudoMestre.anotacoes = notas.value; salvarConteudoMestre(); });
  anotacoes.append(notas, salvarNotas); card.append(anotacoes);

  const docs = elemento('section', '', 'subpainel-mestre'); docs.append(elemento('h3', 'Documentos narrativos'));
  const fd = elemento('form', '', 'form-encontro-mestre');
  const [ldt, tituloDoc] = campoConteudo('Título', 'doc-titulo');
  const [ldtipo, tipoDoc] = campoConteudo('Tipo', 'doc-tipo', 'select');
  for (const t of ['Relatório', 'E-mail', 'Bilhete', 'Arquivo', 'Pista', 'Outro']) { const o = elemento('option', t); o.value = t; tipoDoc.append(o); }
  const [ldc, conteudoDoc] = campoConteudo('Conteúdo', 'doc-conteudo', 'textarea');
  conteudoDoc.rows = 6; conteudoDoc.maxLength = 12000;
  const visivel = elemento('input'); visivel.type = 'checkbox'; visivel.id = 'doc-visivel';
  const lv = elemento('label', 'Preparar para compartilhar com os Jogadores'); lv.prepend(visivel);
  const guardarDoc = elemento('button', 'Salvar documento', 'botao'); guardarDoc.type = 'submit';
  fd.append(ldt, tituloDoc, ldtipo, tipoDoc, ldc, conteudoDoc, lv, guardarDoc);
  fd.addEventListener('submit', e => { e.preventDefault(); if (!tituloDoc.value.trim() || !conteudoDoc.value.trim()) return;
    conteudoMestre.documentos.unshift({ id: novoIdConteudo(), titulo: tituloDoc.value.trim(), tipo: tipoDoc.value, conteudo: conteudoDoc.value, visivel: visivel.checked }); salvarConteudoMestre(); fd.reset(); });
  docs.append(fd, elemento('ul', '', 'lista')); docs.lastChild.id = 'documentos-mestre'; card.append(docs);

  const itensSec = elemento('section', '', 'subpainel-mestre'); itensSec.append(elemento('h3', 'Itens personalizados'));
  const fi = elemento('form', '', 'form-encontro-mestre');
  const [li, nomeItem] = campoConteudo('Nome do item', 'item-nome');
  const [lic, catItem] = campoConteudo('Categoria', 'item-categoria', 'select');
  for (const t of ['Arma', 'Proteção', 'Consumível', 'Chave', 'Equipamento', 'Outro']) { const o = elemento('option', t); o.value = t; catItem.append(o); }
  const [lid, descItem] = campoConteudo('Descrição', 'item-descricao', 'textarea'); descItem.rows = 3;
  const [lie, efeitoItem] = campoConteudo('Efeito / regra', 'item-efeito', 'textarea'); efeitoItem.rows = 3;
  const guardarItem = elemento('button', 'Salvar item', 'botao'); guardarItem.type = 'submit';
  fi.append(li, nomeItem, lic, catItem, lid, descItem, lie, efeitoItem, guardarItem);
  fi.addEventListener('submit', e => { e.preventDefault(); if (!nomeItem.value.trim()) return;
    conteudoMestre.itens.unshift({ id: novoIdConteudo(), nome: nomeItem.value.trim(), categoria: catItem.value, descricao: descItem.value, efeito: efeitoItem.value }); salvarConteudoMestre(); fi.reset(); });
  itensSec.append(fi, elemento('ul', '', 'lista')); itensSec.lastChild.id = 'itens-mestre'; card.append(itensSec);

  const ulE = elemento('ul', '', 'lista'); ulE.id = 'encontros-mestre';
  const eSec = elemento('section', '', 'subpainel-mestre'); eSec.append(elemento('h3', 'Encontros preparados'), ulE); card.append(eSec);
  raiz.append(card);
  desenharConteudoMestre();
}

let documentosPublicosMesa = [];
let carregandoDocumentosPublicos = false;
async function carregarDocumentosPublicos() {
  if (!estado.mesaId || estado.modo !== 'local' || estado.mesaAtual?.papel !== 'jogador' || carregandoDocumentosPublicos) return;
  carregandoDocumentosPublicos = true;
  try {
    const r = await buscar(estado.base + '/api/mesas/' + encodeURIComponent(estado.mesaId) + '/documentos', {
      headers: { Authorization: 'Bearer ' + estado.token }
    });
    documentosPublicosMesa = r.documentos || [];
  } catch { documentosPublicosMesa = []; }
  finally { carregandoDocumentosPublicos = false; }
}
function montarDocumentosPublicos() {
  if (estado.mesaAtual?.papel !== 'jogador' || $('documentos-publicos-mesa')) return;
  const card = elemento('section', '', 'cartao'); card.id = 'documentos-publicos-mesa';
  card.append(elemento('h2', 'Documentos compartilhados pelo Mestre'));
  if (!documentosPublicosMesa.length) card.append(elemento('p', 'Nenhum documento foi compartilhado nesta Mesa.', 'dica'));
  for (const doc of documentosPublicosMesa) {
    const sec = elemento('article', '', 'subpainel-mestre');
    sec.append(elemento('h3', doc.titulo), elemento('p', doc.tipo, 'dica'));
    const corpo = elemento('p', doc.conteudo); corpo.style.whiteSpace = 'pre-wrap'; sec.append(corpo);
    card.append(sec);
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
  if (estado.mesaId !== mesaConteudoCarregada) { conteudoMestre = CONTEUDO_MESTRE_VAZIO(); documentosPublicosMesa = []; mesaConteudoCarregada = estado.mesaId; }
  await carregarMesaConteudoOriginal();
  if (estado.tela !== 'mesa') return;
  if (estado.mesaAtual?.papel === 'mestre') await carregarConteudoMestre(true);
  else {
    documentosPublicosMesa = [];
    await carregarDocumentosPublicos();
    window.renderizarMesa();
  }
};
