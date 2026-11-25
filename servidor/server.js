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

const PORTA = Number(process.env.PORTA) || 3000;
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
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
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
        nome: 'Ameaça Biológica',
        modo: 'local',
        versao: VERSAO,
        enderecos: enderecosLocais(),
        conectados: conectados(),
      });
    }

    if (url.pathname === '/api/entrar' && req.method === 'POST') {
      const corpo = await lerCorpo(req);
      const resultado = entrar(corpo.usuario, corpo.senha);
      return json(res, resultado.status || 200, resultado);
    }

    if (url.pathname === '/api/eventos' && req.method === 'GET') {
      return abrirEventos(req, res, url);
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

servidor.on('error', (erro) => {
  if (erro.code === 'EADDRINUSE') {
    console.error(`\n  A porta ${PORTA} já está em uso. Feche o outro servidor ou use outra porta:`);
    console.error('  set PORTA=3001 && node servidor\\server.js\n');
  } else {
    console.error(erro);
  }
  process.exit(1);
});

servidor.listen(PORTA, '0.0.0.0', () => {
  console.log('\n  AMEAÇA BIOLÓGICA · Laboratório (servidor local)');
  console.log(`  Versão ${VERSAO}\n`);
  console.log(`  Neste computador:  http://localhost:${PORTA}`);
  const enderecos = enderecosLocais();
  if (enderecos.length) {
    console.log('  Jogadores (mesma rede Wi-Fi):');
    for (const e of enderecos) console.log(`    ${e}`);
  } else {
    console.log('  Nenhuma rede encontrada: só este computador consegue acessar.');
  }
  console.log('\n  Se o Windows perguntar sobre o Firewall, permita o acesso em "Redes privadas".\n');
});
