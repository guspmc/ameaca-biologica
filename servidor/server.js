'use strict';
/*
 * Servidor local do Laboratório · Ameaça Biológica
 * Sem dependências: só o Node.js. Faz três coisas:
 *   1. Serve o app (pasta /app) para o navegador.
 *   2. Guarda dados em arquivos JSON (pasta /servidor/dados).
 *   3. Avisa todos os aparelhos em tempo real (SSE) quando algo muda.
 *
 * Segurança: só identifica jogadores numa rede local. Não use para
 * proteger nada importante e não use uma senha que você usa em outros lugares.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { qrSvg } = require('./qr');
const { criarMesas } = require('./mesas');
const { criarPainelMestre } = require('./painel-mestre');
const { criarConteudoMestre } = require('./painel-mestre-conteudo');

const NOME_DO_JOGO = 'Ameaça Biológica';
// Porta preferida. Se estiver ocupada, o servidor tenta as seguintes (até 11 portas: 3000 a 3010).
let PORTA = Number(process.env.PORTA) || 3000;
const PORTA_PREFERIDA = PORTA;
const TENTATIVAS_DE_PORTA = 11;
const MAX_PESSOAS = 10; // 1 Mestre + 9 Jogadores
const PASTA_APP = path.join(__dirname, '..', 'app');
const PASTA_DADOS = path.join(__dirname, 'dados');
const VERSAO = require('../package.json').version;

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Permite que o app, aberto de outro endereço, converse com este servidor.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Private-Network': 'true',
};

/* ---------- Armazenamento em JSON ---------- */

fs.mkdirSync(PASTA_DADOS, { recursive: true });

function lerDados(nome, padrao) {
  try {
    return JSON.parse(fs.readFileSync(path.join(PASTA_DADOS, nome), 'utf8'));
  } catch {
    return padrao;
  }
}

function salvarDados(nome, dados) {
  const alvo = path.join(PASTA_DADOS, nome);
  const temporario = alvo + '.tmp';
  fs.writeFileSync(temporario, JSON.stringify(dados, null, 2));
  fs.renameSync(temporario, alvo); // troca atômica: não corrompe se faltar luz
}

/* ---------- Usuários e sessões ---------- */

const usuarios = lerDados('usuarios.json', {}); // chave: nome em minúsculas
const sessoes = new Map(); // token -> nome do usuário

const REGEX_NOME = /^[\p{L}\p{N} _.-]{2,20}$/u;

function entrar(nome, senha) {
  nome = String(nome ?? '').trim();
  senha = String(senha ?? '');
  if (!REGEX_NOME.test(nome)) {
    return { ok: false, status: 400, erro: 'Nome de usuário inválido (use de 2 a 20 letras, números ou espaços).' };
  }
  if (senha.length < 4 || senha.length > 40) {
    return { ok: false, status: 400, erro: 'A senha deve ter de 4 a 40 caracteres.' };
  }

  const chave = nome.toLowerCase();
  let usuario = usuarios[chave];
  let criado = false;
  if (!usuario) {
    usuario = usuarios[chave] = { nome, senha, criadoEm: new Date().toISOString() };
    salvarDados('usuarios.json', usuarios);
    criado = true;
  } else if (usuario.senha !== senha) {
    return { ok: false, status: 401, erro: 'Senha incorreta para este usuário neste servidor.' };
  }

  const token = crypto.randomBytes(16).toString('hex');
  sessoes.set(token, usuario.nome);
  return { ok: true, token, usuario: usuario.nome, criado };
}

/* ---------- Tempo real (Server-Sent Events) ---------- */

const conexoes = new Map(); // id -> { res, usuario }

function conectados() {
  const nomes = new Set([...conexoes.values()].map((c) => c.usuario));
  return [...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function transmitir(evento, dados) {
  const mensagem = `event: ${evento}\ndata: ${JSON.stringify(dados)}\n\n`;
  for (const c of conexoes.values()) c.res.write(mensagem);
}

// Avisa só os usuários indicados (ex.: quem faz parte de uma Mesa que mudou).
function avisarUsuarios(nomes, evento, dados) {
  const alvos = new Set(nomes.map((n) => n.toLowerCase()));
  const mensagem = `event: ${evento}\ndata: ${JSON.stringify(dados)}\n\n`;
  for (const c of conexoes.values()) {
    if (alvos.has(c.usuario.toLowerCase())) c.res.write(mensagem);
  }
}

function abrirEventos(req, res, url) {
  const usuario = sessoes.get(url.searchParams.get('token'));
  if (!usuario) return json(res, 401, { erro: 'Sessão inválida. Entre novamente.' });

  const jaEstaNaLista = conectados().includes(usuario);
  if (!jaEstaNaLista && conectados().length >= MAX_PESSOAS) {
    return json(res, 409, { erro: `Servidor cheio (máximo de ${MAX_PESSOAS} pessoas).` });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    ...CORS,
  });
  res.write('retry: 3000\n\n');

  const id = crypto.randomUUID();
  conexoes.set(id, { res, usuario });
  transmitir('presenca', { conectados: conectados() });

  req.on('close', () => {
    conexoes.delete(id);
    transmitir('presenca', { conectados: conectados() });
  });
}

// Mantém as conexões vivas atrás de roteadores e navegadores impacientes.
setInterval(() => {
  for (const c of conexoes.values()) c.res.write(': batimento\n\n');
}, 25000).unref();

/* ---------- Utilidades HTTP ---------- */

function json(res, status, objeto) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...CORS,
  });
  res.end(JSON.stringify(objeto));
}

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    let texto = '';
    req.on('data', (parte) => {
      texto += parte;
      if (texto.length > 100_000) {
        reject(new Error('Corpo grande demais'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(texto ? JSON.parse(texto) : {});
      } catch (erro) {
        reject(erro);
      }
    });
    req.on('error', reject);
  });
}

function enderecosLocais() {
  const lista = [];
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const i of interfaces || []) {
      if ((i.family === 'IPv4' || i.family === 4) && !i.internal) {
        lista.push(`http://${i.address}:${PORTA}`);
      }
    }
  }
  return lista;
}

function servirArquivo(req, res, url) {
  let relativo;
  try {
    relativo = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400);
    return res.end('Endereço inválido');
  }
  if (relativo.endsWith('/')) relativo += 'index.html';

  const arquivo = path.normalize(path.join(PASTA_APP, relativo));
  if (!arquivo.startsWith(PASTA_APP + path.sep)) {
    res.writeHead(403);
    return res.end('Acesso negado');
  }

  fs.readFile(arquivo, (erro, conteudo) => {
    if (erro) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Não encontrado');
    }
    res.writeHead(200, {
      'Content-Type': TIPOS[path.extname(arquivo).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(req.method === 'HEAD' ? undefined : conteudo);
  });
}

/* ---------- Mesas ---------- */

const mesas = criarMesas({
  carregar: () => lerDados('mesas.json', {}),
  salvar: (dados) => salvarDados('mesas.json', dados),
});

// Dados operacionais do Mestre ficam separados dos dados e das Fichas dos Jogadores.
const painelMestre = criarPainelMestre({
  carregar: () => lerDados('painel-mestre.json', {}),
  salvar: (dados) => salvarDados('painel-mestre.json', dados),
  ehMestre: (usuario, id) => {
    const r = mesas.detalhe(usuario, id);
    return Boolean(r.ok && r.mesa && r.mesa.papel === 'mestre');
  },
});

const conteudoMestre = criarConteudoMestre({
  carregar: () => lerDados('painel-mestre-conteudo.json', {}),
  salvar: (dados) => salvarDados('painel-mestre-conteudo.json', dados),
  ehMestre: (usuario, id) => {
    const r = mesas.detalhe(usuario, id);
    return Boolean(r.ok && r.mesa && r.mesa.papel === 'mestre');
  },
});

// Rotas: GET/POST /api/mesas, POST /api/mesas/entrar, GET /api/mesas/:id e ações do Mestre/Jogador.
async function rotasMesas(req, res, url) {
  const usuario = sessoes.get((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
  if (!usuario) return json(res, 401, { erro: 'Sessão inválida. Entre novamente.' });

  const partes = url.pathname.split('/').filter(Boolean).slice(2).map(decodeURIComponent);
  const metodo = req.method;
  const [id, acao] = partes;
  let r = null;

  if (partes.length === 0) {
    if (metodo === 'GET') r = mesas.listar(usuario);
    else if (metodo === 'POST') r = mesas.criar(usuario, await lerCorpo(req));
  } else if (id === 'entrar' && partes.length === 1 && metodo === 'POST') {
    r = mesas.entrar(usuario, (await lerCorpo(req)).codigo);
  } else if (partes.length === 1 && metodo === 'GET') {
    r = mesas.detalhe(usuario, id);
  } else if (partes.length === 2 && metodo === 'POST') {
    if (acao === 'configurar') r = mesas.configurar(usuario, id, await lerCorpo(req));
    else if (acao === 'novo-codigo') r = mesas.novoCodigo(usuario, id);
    else if (acao === 'encerrar') {
      r = mesas.encerrar(usuario, id);
      if (r.ok) { painelMestre.apagar(id); conteudoMestre.apagar(id); }
    }
    else if (acao === 'sair') r = mesas.sair(usuario, id);
  } else if (partes.length === 4 && partes[1] === 'jogadores' && metodo === 'POST') {
    r = mesas.decidir(usuario, id, partes[2], partes[3]);
  }

  if (!r) return json(res, 404, { erro: 'Rota não encontrada.' });
  if (!r.ok) return json(res, r.status, { erro: r.erro });
  if (r.avisar) avisarUsuarios(r.avisar, 'mesa', { id: r.id });
  const { ok, status, avisar, ...resposta } = r;
  return json(res, status, resposta);
}

/* ---------- Rotas ---------- */

const servidor = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');

    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS);
      return res.end();
    }

    if (url.pathname === '/api/status' && req.method === 'GET') {
      return json(res, 200, {
        nome: NOME_DO_JOGO,
        modo: 'local',
        versao: VERSAO,
        porta: PORTA,
        enderecos: enderecosLocais(),
        conectados: conectados(),
      });
    }

    if (url.pathname === '/api/qr' && req.method === 'GET') {
      const texto = url.searchParams.get('texto') || '';
      if (!/^https?:\/\/\S{4,110}$/i.test(texto)) return json(res, 400, { erro: 'Texto inválido para o QR Code.' });
      res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=3600', ...CORS });
      return res.end(qrSvg(texto));
    }

    if (url.pathname === '/api/entrar' && req.method === 'POST') {
      const corpo = await lerCorpo(req);
      const resultado = entrar(corpo.usuario, corpo.senha);
      return json(res, resultado.status || 200, resultado);
    }

    if (url.pathname === '/api/eventos' && req.method === 'GET') {
      return abrirEventos(req, res, url);
    }

    if (url.pathname.startsWith('/api/painel-mestre/')) {
      const usuario = sessoes.get((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
      if (!usuario) return json(res, 401, { erro: 'Sessão inválida. Entre novamente.' });
      const partesPainel = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
      if (partesPainel.length !== 4 || partesPainel[1] !== 'painel-mestre' || !['combate', 'conteudo'].includes(partesPainel[3])) {
        return json(res, 404, { erro: 'Rota do Painel do Mestre não encontrada.' });
      }
      const corpoPainel = req.method === 'PUT' ? await lerCorpo(req) : undefined;
      const modulo = partesPainel[3] === 'combate' ? painelMestre : conteudoMestre;
      const resultadoPainel = modulo.atender(usuario, req.method, partesPainel[2], corpoPainel);
      if (resultadoPainel.status === 200 && req.method === 'PUT') avisarUsuarios([usuario], 'mesa', { id: partesPainel[2] });
      return json(res, resultadoPainel.status, resultadoPainel.dados);
    }

    if (url.pathname.startsWith('/api/mesas/') && url.pathname.endsWith('/documentos') && req.method === 'GET') {
      const usuario = sessoes.get((req.headers.authorization || '').replace(/^Bearer\\s+/i, ''));
      if (!usuario) return json(res, 401, { erro: 'Sessão inválida. Entre novamente.' });
      const partesDocs = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
      if (partesDocs.length !== 4 || partesDocs[0] !== 'api' || partesDocs[1] !== 'mesas') {
        return json(res, 404, { erro: 'Rota de documentos não encontrada.' });
      }
      const acesso = mesas.detalhe(usuario, partesDocs[2]);
      if (!acesso.ok) return json(res, acesso.status || 403, { erro: acesso.erro || 'Você não faz parte desta Mesa.' });
      return json(res, 200, { documentos: conteudoMestre.documentosPublicos(partesDocs[2]) });
    }

    if (url.pathname === '/api/mesas' || url.pathname.startsWith('/api/mesas/')) {
      return await rotasMesas(req, res, url);
    }

    if (url.pathname.startsWith('/api/')) {
      return json(res, 404, { erro: 'Rota não encontrada.' });
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405);
      return res.end();
    }
    return servirArquivo(req, res, url);
  } catch {
    if (!res.headersSent) json(res, 400, { erro: 'Requisição inválida.' });
  }
});

/* ---------- Início: testa as portas antes de subir ---------- */

// Pergunta a uma porta ocupada se quem está lá já é um servidor desta aplicação.
function jaEhNossoServidor(porta) {
  return new Promise((resolve) => {
    const pedido = http.get({ host: '127.0.0.1', port: porta, path: '/api/status', timeout: 1500 }, (resposta) => {
      let texto = '';
      resposta.on('data', (parte) => { texto += parte; });
      resposta.on('end', () => {
        try { resolve(JSON.parse(texto).nome === NOME_DO_JOGO); } catch { resolve(false); }
      });
    });
    pedido.on('timeout', () => { pedido.destroy(); resolve(false); });
    pedido.on('error', () => resolve(false));
  });
}

// O iniciar.bat liga ABRIR_NAVEGADOR=1 para abrir o Laboratório na porta que realmente ficou valendo.
function abrirNavegador(endereco) {
  if (process.env.ABRIR_NAVEGADOR !== '1') return;
  const [comando, argumentos] =
    process.platform === 'win32' ? ['cmd', ['/c', 'start', '', endereco]]
      : process.platform === 'darwin' ? ['open', [endereco]]
        : ['xdg-open', [endereco]];
  try {
    const filho = spawn(comando, argumentos, { detached: true, stdio: 'ignore' });
    filho.on('error', () => {});
    filho.unref();
  } catch {
    /* sem navegador: o endereço continua aparecendo na janela */
  }
}

function anunciar() {
  console.log('\n  AMEAÇA BIOLÓGICA · Laboratório (servidor local)');
  console.log(`  Versão ${VERSAO}\n`);
  if (PORTA !== PORTA_PREFERIDA) {
    console.log(`  A porta ${PORTA_PREFERIDA} estava ocupada. Usando a porta ${PORTA}.\n`);
  }
  console.log(`  Neste computador:  http://localhost:${PORTA}`);
  const enderecos = enderecosLocais();
  if (enderecos.length) {
    console.log('  Jogadores (mesma rede Wi-Fi):');
    for (const e of enderecos) console.log(`    ${e}`);
  } else {
    console.log('  Nenhuma rede encontrada: só este computador consegue acessar.');
  }
  console.log('\n  Se o Windows perguntar sobre o Firewall, permita o acesso em "Redes privadas".\n');
  abrirNavegador(`http://localhost:${PORTA}`);
}

function ouvir(porta, restantes) {
  // Os dois avisos são registrados a cada tentativa e removidos juntos: um callback deixado
  // por uma tentativa que falhou dispararia depois, anunciando a porta errada.
  const aoOuvir = () => {
    servidor.removeListener('error', aoFalhar);
    PORTA = porta;
    anunciar();
  };
  const aoFalhar = async (erro) => {
    servidor.removeListener('listening', aoOuvir);
    // Porta em uso (EADDRINUSE) ou reservada pelo Windows (EACCES): tenta a próxima.
    if (erro.code !== 'EADDRINUSE' && erro.code !== 'EACCES') {
      console.error(erro);
      process.exit(1);
    }
    if (await jaEhNossoServidor(porta)) {
      console.log(`\n  O servidor já está ligado em http://localhost:${porta}. Não é preciso abrir outro.\n`);
      abrirNavegador(`http://localhost:${porta}`);
      setTimeout(() => process.exit(0), 1000);
      return;
    }
    if (restantes <= 1) {
      console.error(`\n  Nenhuma porta livre de ${PORTA_PREFERIDA} a ${porta}. Feche algum programa ou escolha outra faixa:`);
      console.error('  set PORTA=4000 && node servidor\\server.js\n');
      process.exit(1);
    }
    ouvir(porta + 1, restantes - 1);
  };
  servidor.once('error', aoFalhar);
  servidor.once('listening', aoOuvir);
  servidor.listen(porta, '0.0.0.0');
}

ouvir(PORTA, TENTATIVAS_DE_PORTA);
