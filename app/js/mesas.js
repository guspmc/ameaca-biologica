'use strict';
/*
 * Mesas no app: lista, criar, entrar por código ou QR, Painel do Mestre e visão do Jogador.
 * Este arquivo é carregado ANTES do app.js e usa `estado`, `$`, `buscar`, `mensagem`, `mostrarTela`
 * e `renderizarEnderecos` de lá. Nada roda ao carregar: só quando o app.js chama.
 */

const NIVEL_MAX = 10; // o livro tem Níveis de 1 a 10
const JOGADORES_MIN = 2; // 1 Mestre + 2 Jogadores = 3 pessoas
const JOGADORES_MAX = 9; // 1 Mestre + 9 Jogadores = 10 pessoas

// Cria elementos sem innerHTML: nomes vindos de outros aparelhos nunca viram HTML.
function h(tag, props = {}, ...filhos) {
  const el = document.createElement(tag);
  for (const [chave, valor] of Object.entries(props)) {
    if (valor === false || valor == null) continue;
    if (chave === 'class') el.className = valor;
    else if (chave.startsWith('on')) el.addEventListener(chave.slice(2), valor);
    else if (valor === true) el[chave] = true;
    else el.setAttribute(chave, valor);
  }
  for (const filho of filhos.flat()) {
    if (filho != null && filho !== false) el.append(filho);
  }
  return el;
}

async function apiMesas(rota, metodo = 'GET', corpo) {
  if (!estado.base || !estado.token || estado.modo !== 'local') throw new Error('Conecte-se a um servidor local primeiro.');
  return buscar(estado.base + rota, {
    method: metodo,
    headers: { Authorization: 'Bearer ' + estado.token, ...(corpo ? { 'Content-Type': 'application/json' } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
}

/* ---------- Dados ---------- */

function limparMesas() {
  estado.mesas = [];
  estado.mesaId = null;
  estado.mesaAtual = null;
  estado.codigoPendente = null;
}

// Chamado pelo app.js sempre que a conexão com o servidor (re)abre.
async function aoConectar() {
  await carregarMesas();
  await processarConvitePendente();
  if (estado.tela === 'mesa' && estado.mesaId) await carregarMesaAtual();
}

// Chamado pelo app.js quando o servidor avisa que uma Mesa mudou.
function aoEventoDeMesa(dados) {
  carregarMesas();
  if (estado.tela === 'mesa' && estado.mesaId === dados.id) carregarMesaAtual();
}

async function carregarMesas() {
  try {
    estado.mesas = (await apiMesas('/api/mesas')).mesas;
  } catch (erro) {
    if (estado.modo === 'local') mensagem($('msg-mesas'), erro.message, 'erro');
  }
  renderizarListaMesas();
}

async function carregarMesaAtual() {
  const id = estado.mesaId;
  if (!id) return;
  try {
    const r = await apiMesas('/api/mesas/' + encodeURIComponent(id));
    if (estado.mesaId !== id) return;
    estado.mesaAtual = r.mesa;
    renderizarMesa();
  } catch (erro) {
    if (estado.mesaId !== id) return;
    if (erro.status === 404) voltarAoLaboratorio('Esta Mesa foi encerrada ou você não faz mais parte dela.');
    else mensagem($('aviso-mesa'), erro.message, 'erro');
  }
}

/* ---------- Navegação ---------- */

function abrirMesa(id) {
  estado.mesaId = id;
  estado.mesaAtual = null;
  mensagem($('aviso-mesa'), '');
  mostrarTela('mesa');
  renderizarMesa();
  carregarMesaAtual();
}

function voltarAoLaboratorio(aviso) {
  estado.mesaId = null;
  estado.mesaAtual = null;
  mostrarTela('lab');
  mensagem($('msg-mesas'), aviso || '', 'aviso');
  carregarMesas();
}

function abrirCriarMesa() {
  mensagem($('msg-criar'), '');
  mostrarTela('criar');
  $('campo-nome-mesa').focus();
}

/* ---------- Ações do Laboratório ---------- */

async function criarMesa(evento) {
  evento.preventDefault();
  const botao = $('btn-confirmar-criar');
  botao.disabled = true;
  try {
    const r = await apiMesas('/api/mesas', 'POST', {
      nome: $('campo-nome-mesa').value,
      limiteJogadores: Number($('campo-limite-jogadores').value),
      limiteNivel: Number($('campo-limite-nivel').value),
    });
    $('campo-nome-mesa').value = '';
    await carregarMesas();
    abrirMesa(r.id);
  } catch (erro) {
    mensagem($('msg-criar'), erro.message, 'erro');
  } finally {
    botao.disabled = false;
  }
}

async function entrarNaMesa(codigo) {
  try {
    const r = await apiMesas('/api/mesas/entrar', 'POST', { codigo });
    mensagem($('msg-mesas'), '');
    await carregarMesas();
    abrirMesa(r.id);
    // O servidor identifica a pessoa só pelo nome de usuário: o mesmo usuário em outro aparelho continua sendo o Mestre.
    if (r.papel === 'mestre') {
      mensagem($('aviso-mesa'), `Você entrou como "${estado.usuario}", que é o Mestre desta Mesa (o mesmo usuário vale em qualquer aparelho). Para entrar como Jogador, toque em Sair no Laboratório e entre com outro usuário.`, 'aviso');
    }
  } catch (erro) {
    mensagem($('msg-mesas'), erro.message, 'erro');
  }
}

// Convite por QR Code: o endereço traz ?mesa=CODIGO; o pedido de entrada sai assim que a conexão abre.
async function processarConvitePendente() {
  const codigo = estado.codigoPendente;
  if (!codigo) return;
  estado.codigoPendente = null;
  await entrarNaMesa(codigo);
}

/* ---------- Ações dentro da Mesa ---------- */

async function acaoMesa(rota, corpo, sucesso) {
  try {
    await apiMesas(rota, 'POST', corpo);
    mensagem($('aviso-mesa'), sucesso || '', 'info');
  } catch (erro) {
    mensagem($('aviso-mesa'), erro.message, 'erro');
  }
  await carregarMesaAtual();
  carregarMesas();
}

const rotaDaMesa = (sufixo = '') => `/api/mesas/${encodeURIComponent(estado.mesaId)}${sufixo}`;

function decidirJogador(usuario, acao) {
  if (acao === 'remover' && !confirm(`Remover ${usuario} da Mesa?`)) return;
  return acaoMesa(rotaDaMesa(`/jogadores/${encodeURIComponent(usuario)}/${acao}`));
}

function gerarNovoCodigo() {
  if (!confirm('Gerar um novo código? O código antigo deixa de funcionar, mas quem já está na Mesa continua nela.')) return;
  return acaoMesa(rotaDaMesa('/novo-codigo'), undefined, 'Novo código gerado.');
}

function salvarConfiguracao(evento) {
  evento.preventDefault();
  return acaoMesa(rotaDaMesa('/configurar'), {
    nome: $('cfg-nome').value,
    limiteJogadores: Number($('cfg-jogadores').value),
    limiteNivel: Number($('cfg-nivel').value),
  }, 'Configurações salvas.');
}

async function encerrarMesa() {
  if (!confirm('Encerrar a Mesa? Ela some para todos os jogadores e não dá para desfazer.')) return;
  try {
    await apiMesas(rotaDaMesa('/encerrar'), 'POST');
    voltarAoLaboratorio('Mesa encerrada.');
  } catch (erro) {
    mensagem($('aviso-mesa'), erro.message, 'erro');
  }
}

async function sairDaMesa() {
  if (!confirm('Sair desta Mesa? Para voltar, você precisará pedir entrada de novo e o Mestre precisará aprovar.')) return;
  try {
    await apiMesas(rotaDaMesa('/sair'), 'POST');
    voltarAoLaboratorio('Você saiu da Mesa.');
  } catch (erro) {
    mensagem($('aviso-mesa'), erro.message, 'erro');
  }
}

/* ---------- Desenho: lista no Laboratório ---------- */

function descreverMesa(m) {
  if (m.papel === 'mestre') {
    const pedidos = m.pendentes === 1 ? '1 pedido de entrada' : `${m.pendentes} pedidos de entrada`;
    return `Mestre · ${m.aprovados}/${m.limiteJogadores} jogadores` + (m.pendentes ? ` · ${pedidos}` : '');
  }
  return m.status === 'pendente' ? 'Aguardando aprovação do Mestre' : `Jogador · Mestre: ${m.mestre}`;
}

function renderizarListaMesas() {
  const conectado = estado.modo === 'local';
  $('aviso-mesas-offline').hidden = conectado;
  $('bloco-mesas').hidden = !conectado;
  if (!conectado) return;

  const lista = $('lista-mesas');
  lista.replaceChildren();
  for (const m of estado.mesas) {
    lista.append(h('li', {},
      h('button', { type: 'button', class: 'botao mesa-item', onclick: () => abrirMesa(m.id) },
        h('span', { class: 'mesa-nome' }, m.nome),
        h('span', { class: 'mesa-info' }, descreverMesa(m)))));
  }
  $('vazio-mesas').hidden = estado.mesas.length > 0;
}

/* ---------- Desenho: dentro da Mesa ---------- */

const cartao = (titulo, ...filhos) => h('div', { class: 'cartao' }, h('h2', {}, titulo), ...filhos);
const botao = (texto, classe, aoClicar) => h('button', { type: 'button', class: 'botao pequeno ' + classe, onclick: aoClicar }, texto);

function pontoOnline(usuario) {
  const ligado = estado.conectados.some((n) => n.toLowerCase() === usuario.toLowerCase());
  const rotulo = ligado ? 'Conectado' : 'Desconectado';
  return h('span', { class: 'ponto ' + (ligado ? 'on' : 'off'), role: 'img', 'aria-label': rotulo, title: rotulo });
}

function opcoes(de, ate, selecionado) {
  const lista = [];
  for (let n = de; n <= ate; n++) lista.push(h('option', { value: n, selected: n === selecionado }, String(n)));
  return lista;
}

function cartaoConvite(m) {
  if (!estado.enderecos.length) {
    return cartao('Convidar jogadores',
      h('p', { class: 'codigo-mesa' }, m.codigoFormatado),
      h('p', { class: 'mensagem aviso' }, 'Nenhuma rede encontrada neste computador: só este aparelho consegue acessar o servidor.'));
  }
  const lista = h('ul', { class: 'lista' });
  const imagem = h('img', { class: 'qr', alt: 'QR Code para entrar na Mesa', width: '220', height: '220' });
  const dica = h('p', { class: 'dica', hidden: true }, 'Este computador tem mais de um endereço de rede. Se o celular não abrir, toque em outro:');
  renderizarEnderecos(lista, imagem, dica, '/?mesa=' + m.codigo, renderizarMesa);
  return cartao('Convidar jogadores',
    h('p', { class: 'dica' }, 'Código da Mesa:'),
    h('p', { class: 'codigo-mesa' }, m.codigoFormatado),
    h('div', { class: 'linha' }, botao('Gerar novo código', '', gerarNovoCodigo)),
    h('p', { class: 'dica' }, 'Ou peça para escanearem o QR Code com a câmera do celular. Ele abre o servidor e já pede entrada nesta Mesa:'),
    imagem, dica, lista);
}

function painelDoMestre(m) {
  const pendentes = m.jogadores.filter((j) => j.status === 'pendente');
  const aprovados = m.jogadores.filter((j) => j.status === 'aprovado');
  const partes = [cartaoConvite(m)];

  if (pendentes.length) {
    partes.push(cartao('Pedidos de entrada',
      h('ul', { class: 'lista' }, pendentes.map((j) => h('li', { class: 'linha-jogador' },
        h('span', { class: 'nome' }, j.usuario),
        h('span', { class: 'acoes' },
          botao('Aprovar', 'primario', () => decidirJogador(j.usuario, 'aprovar')),
          botao('Recusar', '', () => decidirJogador(j.usuario, 'recusar'))))))));
  }

  partes.push(cartao(`Jogadores (${aprovados.length}/${m.limiteJogadores})`,
    aprovados.length
      ? h('ul', { class: 'lista' }, aprovados.map((j) => h('li', { class: 'linha-jogador' },
        h('span', { class: 'nome' }, pontoOnline(j.usuario), j.usuario),
        h('span', { class: 'acoes' }, botao('Remover', 'perigo', () => decidirJogador(j.usuario, 'remover'))))))
      : h('p', { class: 'dica' }, 'Ninguém entrou ainda. Compartilhe o código ou o QR Code acima.'),
    h('p', { class: 'dica' }, 'As Fichas de Personagem são dos Jogadores: o Mestre aprova quem entra, mas não abre as Fichas.')));

  partes.push(cartao('Configurações da Mesa',
    h('form', { onsubmit: salvarConfiguracao },
      h('label', { for: 'cfg-nome' }, 'Nome da Mesa'),
      h('input', { id: 'cfg-nome', type: 'text', maxlength: '40', required: true, value: m.nome }),
      h('label', { for: 'cfg-jogadores' }, 'Máximo de jogadores'),
      h('select', { id: 'cfg-jogadores' }, opcoes(JOGADORES_MIN, JOGADORES_MAX, m.limiteJogadores)),
      h('label', { for: 'cfg-nivel' }, 'Nível máximo de personagem'),
      h('select', { id: 'cfg-nivel' }, opcoes(1, NIVEL_MAX, m.limiteNivel)),
      h('div', { class: 'linha' }, h('button', { type: 'submit', class: 'botao primario' }, 'Salvar')))));

  partes.push(h('div', { class: 'cartao desativado' },
    h('h2', {}, 'Em breve'),
    h('p', { class: 'dica' }, 'Resumo das Fichas, turnos e iniciativa, documentos, anotações e itens personalizados.')));

  partes.push(h('button', { type: 'button', class: 'botao perigo largo', onclick: encerrarMesa }, 'Encerrar Mesa'));
  return partes;
}

function visaoDoJogador(m) {
  const partes = [];
  if (m.status === 'pendente') {
    partes.push(cartao('Aguardando aprovação',
      h('p', {}, 'Seu pedido foi enviado. Assim que o Mestre aprovar, você poderá criar suas Fichas de Personagem.')));
  } else {
    const gente = [m.mestre, ...m.jogadores.map((j) => j.usuario)];
    partes.push(cartao('Mesa',
      h('p', {}, `Nível máximo de personagem: ${m.limiteNivel}`),
      h('ul', { class: 'lista' }, gente.map((nome, i) => h('li', {},
        pontoOnline(nome), nome,
        i === 0 ? h('span', { class: 'etiqueta' }, 'Mestre') : null,
        nome.toLowerCase() === estado.usuario.toLowerCase() ? h('span', { class: 'voce' }, '(você)') : null)))));
    partes.push(h('div', { class: 'cartao desativado' },
      h('h2', {}, 'Fichas de Personagem'),
      h('p', { class: 'dica' }, `Em breve: você vai criar até 5 rascunhos e usar até 3 Fichas ativas. Esta Mesa aceita personagens até o Nível ${m.limiteNivel}.`)));
  }
  partes.push(h('button', { type: 'button', class: 'botao perigo largo', onclick: sairDaMesa }, 'Sair da Mesa'));
  return partes;
}

function renderizarMesa() {
  if (estado.tela !== 'mesa') return;
  const raiz = $('conteudo-mesa');

  // Não apaga um campo que a pessoa está editando; redesenha quando ela terminar.
  const ativo = document.activeElement;
  if (ativo && raiz.contains(ativo) && /^(SELECT|INPUT)$/.test(ativo.tagName)) {
    estado.redesenharMesa = true;
    return;
  }
  estado.redesenharMesa = false;

  const m = estado.mesaAtual;
  const aviso = estado.modo === 'local'
    ? null
    : h('p', { class: 'mensagem aviso', role: 'status' }, 'Sem conexão com o servidor. Tentando reconectar…');
  if (!m) {
    $('titulo-mesa').textContent = 'Mesa';
    $('subtitulo-mesa').textContent = '';
    raiz.replaceChildren(...[aviso, h('p', { class: 'dica' }, 'Carregando a Mesa…')].filter(Boolean));
    return;
  }
  $('titulo-mesa').textContent = m.nome;
  $('subtitulo-mesa').textContent = (m.papel === 'mestre' ? 'Painel do Mestre' : `Mesa · Mestre: ${m.mestre}`) + ` · você: ${estado.usuario}`;
  raiz.replaceChildren(...[aviso, ...(m.papel === 'mestre' ? painelDoMestre(m) : visaoDoJogador(m))].filter(Boolean));
}

/* ---------- Início ---------- */

function iniciarMesas() {
  $('campo-limite-jogadores').replaceChildren(...opcoes(JOGADORES_MIN, JOGADORES_MAX, 5));
  $('campo-limite-nivel').replaceChildren(...opcoes(1, NIVEL_MAX, 1));

  $('btn-criar-mesa').addEventListener('click', abrirCriarMesa);
  $('form-criar-mesa').addEventListener('submit', criarMesa);
  $('btn-voltar-criar').addEventListener('click', () => voltarAoLaboratorio());
  $('btn-voltar-mesa').addEventListener('click', () => voltarAoLaboratorio());
  $('form-entrar-mesa').addEventListener('submit', (e) => {
    e.preventDefault();
    const codigo = $('campo-codigo').value;
    $('campo-codigo').value = '';
    entrarNaMesa(codigo);
  });
  $('conteudo-mesa').addEventListener('focusout', () => {
    if (estado.redesenharMesa) setTimeout(renderizarMesa, 0);
  });
}
