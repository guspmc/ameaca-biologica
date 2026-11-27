'use strict';
/*
 * Laboratório · Ameaça Biológica
 * Etapa 1: login no aparelho, status (Offline/Local) e conexão ao servidor local.
 * Sem bibliotecas: JavaScript simples.
 */

const $ = (id) => document.getElementById(id);
const CHAVES = { contas: 'ab_contas', sessao: 'ab_sessao', servidor: 'ab_servidor' };
const REGEX_NOME = /^[\p{L}\p{N} _.-]{2,20}$/u;
const NOME_DO_JOGO = 'Ameaça Biológica';

const estado = {
  usuario: null,
  senha: null,
  modo: 'offline', // 'offline' | 'local'
  base: null,      // endereço do servidor, ex.: http://192.168.0.10:3000
  token: null,
  fonte: null,     // conexão em tempo real (EventSource)
  quer: false,     // a pessoa quer ficar conectada (liga a reconexão automática)
  enderecos: [],
  enderecoEscolhido: null, // endereço mostrado no QR Code
  conectados: [],
  tentativa: 0,
  timer: null,
  tela: 'login',
  mesas: [],             // Mesas do usuário (ver mesas.js)
  mesaId: null,          // Mesa aberta
  mesaAtual: null,
  codigoPendente: null,  // código vindo do QR Code (?mesa=), usado ao conectar
  redesenharMesa: false,
};

/* ---------- Armazenamento no aparelho ---------- */

function lerLS(chave, padrao) {
  try {
    const valor = localStorage.getItem(chave);
    return valor === null ? padrao : JSON.parse(valor);
  } catch {
    return padrao;
  }
}

function gravarLS(chave, valor) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    /* navegador sem armazenamento: o app segue funcionando nesta sessão */
  }
}

/* ---------- Login (identifica a pessoa neste aparelho) ---------- */

// Devolve um texto de erro, ou null se deu certo.
function entrarLocal(nome, senha) {
  nome = nome.trim();
  if (!REGEX_NOME.test(nome)) return 'Nome de usuário inválido (use de 2 a 20 letras, números ou espaços).';
  if (senha.length < 4 || senha.length > 40) return 'A senha deve ter de 4 a 40 caracteres.';

  const contas = lerLS(CHAVES.contas, {});
  const chave = nome.toLowerCase();
  const conta = contas[chave];
  if (!conta) {
    contas[chave] = { nome, senha };
    gravarLS(CHAVES.contas, contas);
  } else if (conta.senha !== senha) {
    return 'Senha incorreta para este usuário neste aparelho.';
  }

  estado.usuario = conta ? conta.nome : nome;
  estado.senha = senha;
  gravarLS(CHAVES.sessao, { usuario: estado.usuario });
  return null;
}

function restaurarSessao() {
  const sessao = lerLS(CHAVES.sessao, null);
  if (!sessao || !sessao.usuario) return false;
  const conta = lerLS(CHAVES.contas, {})[sessao.usuario.toLowerCase()];
  if (!conta) return false;
  estado.usuario = conta.nome;
  estado.senha = conta.senha;
  return true;
}

function sair() {
  desconectar(true);
  limparMesas();
  estado.usuario = null;
  estado.senha = null;
  gravarLS(CHAVES.sessao, null);
  $('campo-senha').value = '';
  mostrarTela('login');
}

/* ---------- Rede ---------- */

// Entende o que a pessoa digitou. `semPorta` é verdadeiro quando ela não informou a porta.
function interpretarEndereco(texto) {
  let t = texto.trim();
  if (!t) throw new Error('vazio');
  if (!/^https?:\/\//i.test(t)) t = 'http://' + t;
  const url = new URL(t);
  const semPorta = !/^https?:\/\/[^/]*:\d+/i.test(t);
  return { url, semPorta };
}

// O servidor usa a 3000 ou, se ela estiver ocupada, a próxima livre (até a 3010).
const PORTAS_DO_SERVIDOR = Array.from({ length: 11 }, (_, i) => 3000 + i);

// Sem porta digitada, testa as portas possíveis e usa a que responder como servidor do jogo.
async function descobrirPorta(host) {
  try {
    const porta = await Promise.any(PORTAS_DO_SERVIDOR.map(async (p) => {
      const status = await buscar(`http://${host}:${p}/api/status`, {}, 2500);
      if (status.nome !== NOME_DO_JOGO) throw new Error('outro programa');
      return p;
    }));
    return `http://${host}:${porta}`;
  } catch {
    const https = location.protocol === 'https:' && !/^(localhost|127\.)/.test(host)
      ? ' Esta página usa https e o navegador bloqueia chamadas http: abra o app pelo endereço do servidor.'
      : '';
    throw new Error(`Nenhum servidor da ${NOME_DO_JOGO} foi encontrado em ${host} (portas 3000 a 3010). Confira o endereço mostrado no computador do Mestre.${https}`);
  }
}

function textoFalhaDeRede(url) {
  let texto = 'Não foi possível falar com o servidor. Confira o endereço, se você está na mesma rede Wi-Fi e se o servidor está ligado.';
  const ehLocalhost = /^http:\/\/(localhost|127\.)/.test(url);
  if (location.protocol === 'https:' && url.startsWith('http:') && !ehLocalhost) {
    texto += ' Atenção: esta página usa https e o navegador bloqueia chamadas http. Abra o app pelo endereço do servidor.';
  }
  return texto;
}

async function buscar(url, opcoes = {}, limiteMs = 6000) {
  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), limiteMs);
  let resposta;
  try {
    resposta = await fetch(url, { ...opcoes, signal: controle.signal });
  } catch {
    throw new Error(textoFalhaDeRede(url));
  } finally {
    clearTimeout(relogio);
  }
  let dados = null;
  try {
    dados = await resposta.json();
  } catch {
    /* resposta que não é JSON */
  }
  if (!resposta.ok || !dados) {
    const erro = new Error((dados && dados.erro) || 'Resposta inesperada do servidor.');
    erro.status = resposta.status;
    throw erro;
  }
  return dados;
}

async function abrirSessao(base) {
  const status = await buscar(base + '/api/status');
  if (status.nome !== NOME_DO_JOGO) throw new Error('Este endereço não é um servidor da Ameaça Biológica.');
  estado.enderecos = status.enderecos || [];

  const entrada = await buscar(base + '/api/entrar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario: estado.usuario, senha: estado.senha }),
  });
  estado.token = entrada.token;

  await new Promise((ok, falha) => {
    const fonte = new EventSource(`${base}/api/eventos?token=${encodeURIComponent(entrada.token)}`);
    let abriu = false;
    fonte.addEventListener('presenca', (e) => {
      estado.conectados = JSON.parse(e.data).conectados;
      renderizar();
    });
    fonte.addEventListener('mesa', (e) => aoEventoDeMesa(JSON.parse(e.data)));
    fonte.addEventListener('ficha', (e) => { if (typeof aoEventoDeFicha === 'function') aoEventoDeFicha(JSON.parse(e.data)); });
    fonte.onopen = () => {
      abriu = true;
      estado.fonte = fonte;
      estado.tentativa = 0;
      definirModo('local');
      mensagemServidor('');
      ok();
      aoConectar();
    };
    fonte.onerror = () => {
      fonte.close();
      if (!abriu) falha(new Error('Não foi possível abrir a conexão em tempo real (o servidor pode estar cheio).'));
      else perderConexao();
    };
  });
}

async function conectar(endereco) {
  limparReconexao();
  let alvo;
  try {
    alvo = interpretarEndereco(endereco);
  } catch {
    return mensagemServidor('Endereço inválido. Exemplo: 192.168.0.10:3000', 'erro');
  }
  estado.quer = true;
  estado.base = null;
  renderizar();
  try {
    let base = alvo.url.origin;
    if (alvo.semPorta && alvo.url.protocol === 'http:') {
      mensagemServidor('Procurando o servidor…', 'info');
      base = await descobrirPorta(alvo.url.hostname);
    } else {
      mensagemServidor('Conectando…', 'info');
    }
    estado.base = base;
    await abrirSessao(base);
    gravarLS(CHAVES.servidor, base);
  } catch (erro) {
    estado.quer = false;
    fechar();
    definirModo('offline');
    mensagemServidor(erro.message, 'erro');
  }
}

function perderConexao() {
  estado.fonte = null;
  estado.conectados = [];
  definirModo('offline');
  if (!estado.quer) return;
  mensagemServidor('Conexão perdida. Tentando reconectar…', 'aviso');
  const espera = Math.min(3000 * (estado.tentativa + 1), 15000);
  estado.tentativa += 1;
  estado.timer = setTimeout(async () => {
    try {
      await abrirSessao(estado.base);
    } catch {
      if (estado.quer) perderConexao();
    }
  }, espera);
}

function limparReconexao() {
  clearTimeout(estado.timer);
  estado.timer = null;
}

function fechar() {
  if (estado.fonte) estado.fonte.close();
  estado.fonte = null;
  estado.token = null;
  estado.conectados = [];
}

function desconectar(silencioso = false) {
  estado.quer = false;
  limparReconexao();
  fechar();
  definirModo('offline');
  if (!silencioso) mensagemServidor('Desconectado. Você continua offline neste aparelho.', 'info');
}

// Se o app foi aberto pelo endereço do próprio servidor, conecta sozinho.
async function detectarServidorDeOrigem() {
  if (estado.quer || !/^https?:$/.test(location.protocol)) return;
  try {
    const status = await buscar(location.origin + '/api/status');
    if (status.nome === NOME_DO_JOGO) await conectar(location.origin);
  } catch {
    /* não é um servidor: segue offline */
  }
}

/* ---------- Tela ---------- */

function mostrarTela(nome) {
  estado.tela = nome;
  for (const id of ['login', 'lab', 'criar', 'mesa']) $('tela-' + id).hidden = nome !== id;
  window.scrollTo(0, 0);
}

function mensagem(elemento, texto, tipo = 'info') {
  elemento.hidden = !texto;
  elemento.textContent = texto || '';
  elemento.className = 'mensagem ' + tipo;
}
const mensagemServidor = (texto, tipo) => mensagem($('msg-servidor'), texto, tipo);

function definirModo(modo) {
  estado.modo = modo;
  renderizar();
}

function preencherLista(lista, itens, marcarVoce = false) {
  lista.replaceChildren();
  for (const item of itens) {
    const li = document.createElement('li');
    li.textContent = item;
    if (marcarVoce && item === estado.usuario) {
      const marca = document.createElement('span');
      marca.className = 'voce';
      marca.textContent = '(você)';
      li.append(marca);
    }
    lista.append(li);
  }
}

// Endereços de rede doméstica vêm primeiro; os terminados em .1 costumam ser adaptadores virtuais.
function pontuarEndereco(endereco) {
  const ip = endereco.replace(/^http:\/\//, '').split(':')[0];
  let pontos = 0;
  if (ip.startsWith('192.168.')) pontos += 3;
  else if (ip.startsWith('10.')) pontos += 2;
  else if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) pontos += 1;
  if (ip.endsWith('.1')) pontos -= 5;
  return pontos;
}

// Lista os endereços do servidor e mostra o QR Code do endereço escolhido.
// `sufixo` é acrescentado ao endereço no QR (ex.: /?mesa=ABC123); `aoEscolher` redesenha a tela.
function renderizarEnderecos(ul, qr, dica, sufixo, aoEscolher) {
  const lista = [...estado.enderecos].sort((a, b) => pontuarEndereco(b) - pontuarEndereco(a));
  if (!lista.includes(estado.enderecoEscolhido)) estado.enderecoEscolhido = lista[0] || null;

  ul.replaceChildren();
  for (const endereco of lista) {
    const li = document.createElement('li');
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'botao endereco' + (endereco === estado.enderecoEscolhido ? ' ativa' : '');
    botao.textContent = endereco.replace(/^http:\/\//, '');
    botao.addEventListener('click', () => {
      estado.enderecoEscolhido = endereco;
      aoEscolher();
    });
    li.append(botao);
    ul.append(li);
  }
  dica.hidden = lista.length < 2;

  const fonte = estado.enderecoEscolhido
    ? `${estado.base}/api/qr?texto=${encodeURIComponent(estado.enderecoEscolhido + sufixo)}`
    : '';
  if (qr.getAttribute('src') !== fonte) qr.setAttribute('src', fonte);
}

function renderizar() {
  if (!estado.usuario) return;
  $('nome-usuario').textContent = estado.usuario;

  $('pilula-offline').classList.toggle('ativa', estado.modo === 'offline');
  $('pilula-local').classList.toggle('ativa', estado.modo === 'local');

  let texto = 'Sem servidor: você está offline neste aparelho.';
  if (estado.modo === 'local') texto = `Conectado ao servidor local: ${estado.base}`;
  else if (estado.quer) texto = 'Tentando conectar ao servidor local…';
  $('texto-modo').textContent = texto;

  $('btn-conectar').hidden = estado.quer;
  $('btn-desconectar').hidden = !estado.quer;
  $('campo-servidor').disabled = estado.quer;
  if (estado.quer && estado.base) $('campo-servidor').value = estado.base.replace(/^http:\/\//, '');

  const conectado = estado.modo === 'local';
  $('bloco-enderecos').hidden = !(conectado && estado.enderecos.length);
  if (conectado) renderizarEnderecos($('enderecos'), $('qr'), $('dica-enderecos'), '', renderizar);
  $('vazio-conectados').hidden = conectado;
  preencherLista($('lista-conectados'), conectado ? estado.conectados : [], true);
  renderizarListaMesas();
  renderizarMesa();
}

function abrirLaboratorio() {
  mostrarTela('lab');
  $('campo-servidor').value = lerLS(CHAVES.servidor, '').replace(/^http:\/\//, '');
  renderizar();
  detectarServidorDeOrigem();
}

/* ---------- Eventos ---------- */

$('form-login').addEventListener('submit', (e) => {
  e.preventDefault();
  const erro = entrarLocal($('campo-usuario').value, $('campo-senha').value);
  mensagem($('msg-login'), erro, 'erro');
  if (!erro) abrirLaboratorio();
});

$('form-servidor').addEventListener('submit', (e) => {
  e.preventDefault();
  conectar($('campo-servidor').value);
});

$('btn-desconectar').addEventListener('click', () => desconectar());
$('btn-sair').addEventListener('click', sair);

let pedidoDeInstalacao = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  pedidoDeInstalacao = e;
  $('btn-instalar').hidden = false;
});
$('btn-instalar').addEventListener('click', async () => {
  if (!pedidoDeInstalacao) return;
  pedidoDeInstalacao.prompt();
  await pedidoDeInstalacao.userChoice;
  pedidoDeInstalacao = null;
  $('btn-instalar').hidden = true;
});

/* ---------- Início ---------- */

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {
    /* sem service worker (endereço http fora do localhost): o app funciona, só não fica guardado offline */
  });
}

iniciarMesas();

// Convite por QR Code: o app abre em /?mesa=CODIGO. Guarda o código e tira o parâmetro do endereço.
try {
  const convite = new URLSearchParams(location.search).get('mesa');
  if (convite) {
    estado.codigoPendente = convite;
    history.replaceState(null, '', location.pathname);
  }
} catch {
  /* sem suporte: a pessoa digita o código */
}

if (restaurarSessao()) abrirLaboratorio();
else mostrarTela('login');
