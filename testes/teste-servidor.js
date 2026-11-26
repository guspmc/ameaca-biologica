'use strict';
// Sobe o servidor numa porta de teste, confere as rotas e desliga o servidor ao final.
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const RAIZ = path.join(__dirname, '..');
const PORTA = 3456;
const B = `http://localhost:${PORTA}`;
let falhas = 0;

function confere(nome, condicao, detalhe = '') {
  console.log(`${condicao ? 'OK   ' : 'FALHA'} ${nome}${detalhe ? ' -> ' + detalhe : ''}`);
  if (!condicao) falhas++;
}
const dorme = (ms) => new Promise((r) => setTimeout(r, ms));
const post = (rota, corpo) =>
  fetch(B + rota, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });

// Lê eventos SSE por um tempo e devolve o texto recebido.
async function ouvir(token, ms) {
  const controle = new AbortController();
  const resposta = await fetch(`${B}/api/eventos?token=${token}`, { signal: controle.signal });
  let texto = '';
  const leitor = resposta.body.getReader();
  const decodificador = new TextDecoder();
  const parar = setTimeout(() => controle.abort(), ms);
  try {
    for (;;) {
      const { done, value } = await leitor.read();
      if (done) break;
      texto += decodificador.decode(value);
    }
  } catch { /* abortado de propósito */ }
  clearTimeout(parar);
  return { status: resposta.status, texto };
}

(async () => {
  // Cópia isolada do projeto, para não sujar a pasta de dados real.
  const copia = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-teste-'));
  fs.cpSync(RAIZ, copia, { recursive: true, filter: (o) => !o.includes('.git') });
  for (const f of fs.readdirSync(path.join(copia, 'servidor', 'dados'))) {
    if (f !== '.gitkeep') fs.rmSync(path.join(copia, 'servidor', 'dados', f));
  }

  const filho = spawn('node', ['servidor/server.js'], { cwd: copia, env: { ...process.env, PORTA: String(PORTA) } });
  let saida = '';
  filho.stdout.on('data', (d) => (saida += d));
  filho.stderr.on('data', (d) => (saida += d));
  await dorme(1200);

  try {
    const st = await (await fetch(B + '/api/status')).json();
    confere('status identifica o jogo', st.nome === 'Ameaça Biológica' && st.modo === 'local', JSON.stringify(st));

    let r = await post('/api/entrar', { usuario: 'Ana', senha: '123' });
    confere('senha com 3 caracteres é recusada (400)', r.status === 400);

    r = await post('/api/entrar', { usuario: 'A', senha: 'abcd' });
    confere('nome com 1 caractere é recusado (400)', r.status === 400);

    r = await post('/api/entrar', { usuario: 'Ana', senha: 'abcd' });
    const ana = await r.json();
    confere('cria usuário Ana', r.status === 200 && ana.criado === true && /^[0-9a-f]{32}$/.test(ana.token));

    r = await post('/api/entrar', { usuario: 'ana', senha: 'zzzz' });
    confere('senha errada é recusada (401)', r.status === 401);

    r = await post('/api/entrar', { usuario: 'ANA', senha: 'abcd' });
    const ana2 = await r.json();
    confere('usuário é reconhecido sem diferenciar maiúsculas', r.status === 200 && ana2.criado === false && ana2.usuario === 'Ana');

    r = await fetch(`${B}/api/eventos?token=invalido`);
    confere('eventos com token inválido (401)', r.status === 401);

    const b = await (await post('/api/entrar', { usuario: 'Beto', senha: '1234' })).json();
    const pAna = ouvir(ana.token, 2500);
    await dorme(500);
    const pBeto = ouvir(b.token, 1200);
    const [vAna, vBeto] = await Promise.all([pAna, pBeto]);
    confere('Ana recebe presença com ela mesma', vAna.texto.includes('event: presenca') && vAna.texto.includes('["Ana"]'));
    confere('Ana é avisada quando Beto entra', vAna.texto.includes('["Ana","Beto"]'));
    confere('Ana é avisada quando Beto sai', vAna.texto.trim().endsWith('{"conectados":["Ana"]}'));
    confere('Beto vê os dois ao entrar', vBeto.texto.includes('["Ana","Beto"]'));

    for (const [rota, tipo] of [['/', 'text/html'], ['/js/app.js', 'javascript'], ['/css/estilo.css', 'text/css'],
      ['/manifest.webmanifest', 'manifest+json'], ['/sw.js', 'javascript'], ['/icons/icon-192.png', 'image/png']]) {
      const x = await fetch(B + rota);
      confere(`serve ${rota}`, x.status === 200 && (x.headers.get('content-type') || '').includes(tipo), x.status + ' ' + x.headers.get('content-type'));
    }

    // Fluxo de publicação: Mestre cria Mesa, aprova Jogador e compartilha documentos/itens.
    const criada = await fetch(B + '/api/mesas', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + ana.token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: 'Mesa de teste', limiteJogadores: 2, limiteNivel: 1 })
    });
    const mesaCriada = await criada.json();
    confere('Mestre cria Mesa para testar publicações', criada.status === 201 && Boolean(mesaCriada.id));
    const detalheMestre = await (await fetch(B + '/api/mesas/' + mesaCriada.id, { headers: { Authorization: 'Bearer ' + ana.token } })).json();
    const entradaMesa = await fetch(B + '/api/mesas/entrar', {
      method: 'POST', headers: { Authorization: 'Bearer ' + b.token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo: detalheMestre.mesa.codigo })
    });
    confere('Jogador solicita entrada na Mesa', entradaMesa.status === 200);
    const aprovacao = await fetch(B + '/api/mesas/' + mesaCriada.id + '/jogadores/Beto/aprovar', {
      method: 'POST', headers: { Authorization: 'Bearer ' + ana.token }
    });
    confere('Mestre aprova Jogador', aprovacao.status === 200);
    const privado = await fetch(B + '/api/mesas/' + mesaCriada.id + '/publicacoes', { headers: { Authorization: 'Bearer ' + b.token } });
    confere('Jogador aprovado consulta publicações vazias', privado.status === 200);
    const conteudo = await fetch(B + '/api/painel-mestre/' + mesaCriada.id + '/conteudo', {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + ana.token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        anotacoes: 'Somente o Mestre vê',
        encontros: [],
        documentos: [
          { id: 'doc-publico', titulo: 'Relatório', tipo: 'Arquivo', conteudo: 'Documento compartilhado', visivel: true },
          { id: 'doc-privado', titulo: 'Segredo', tipo: 'Nota', conteudo: 'Documento reservado', visivel: false }
        ],
        itens: [
          { id: 'item-publico', nome: 'Cartão de acesso', categoria: 'Chave', descricao: 'Cartão azul', efeito: 'Abre a ala B', visivel: true },
          { id: 'item-privado', nome: 'Protótipo', categoria: 'Equipamento', visivel: false }
        ]
      })
    });
    confere('Mestre salva conteúdo e publicações', conteudo.status === 200);
    const publicacoes = await (await fetch(B + '/api/mesas/' + mesaCriada.id + '/publicacoes', { headers: { Authorization: 'Bearer ' + b.token } })).json();
    confere('Jogador recebe apenas documento e item publicados',
      publicacoes.documentos?.length === 1 && publicacoes.documentos[0].titulo === 'Relatório' &&
      publicacoes.itens?.length === 1 && publicacoes.itens[0].nome === 'Cartão de acesso');
    const naoAprovado = await post('/api/entrar', { usuario: 'Caio', senha: '1234' });
    const caio = await naoAprovado.json();
    const pedidoCaio = await fetch(B + '/api/mesas/entrar', {
      method: 'POST', headers: { Authorization: 'Bearer ' + caio.token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo: detalheMestre.mesa.codigo })
    });
    const tentativaPendente = await fetch(B + '/api/mesas/' + mesaCriada.id + '/publicacoes', { headers: { Authorization: 'Bearer ' + caio.token } });
    confere('Jogador pendente não acessa publicações', pedidoCaio.status === 200 && tentativaPendente.status === 403);
    const tentativaEstranha = await fetch(B + '/api/mesas/' + mesaCriada.id + '/publicacoes');
    confere('Publicações exigem autenticação', tentativaEstranha.status === 401);

    // Tentativas de sair da pasta do app
    for (const rota of ['/..%2fservidor%2fserver.js', '/%2e%2e/servidor/dados/usuarios.json', '/..%5cservidor%5cserver.js']) {
      const x = await fetch(B + rota);
      confere(`bloqueia ${rota}`, x.status === 403 || x.status === 404, String(x.status));
    }

    const salvo = JSON.parse(fs.readFileSync(path.join(copia, 'servidor', 'dados', 'usuarios.json'), 'utf8'));
    confere('usuários gravados em disco', salvo.ana && salvo.beto && !fs.existsSync(path.join(copia, 'servidor', 'dados', 'usuarios.json.tmp')));
  } catch (e) {
    console.log('ERRO NO TESTE', e);
    falhas++;
  } finally {
    filho.kill();
    fs.rmSync(copia, { recursive: true, force: true });
  }
  console.log('\n--- saída do servidor ---\n' + saida);
  console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO OK');
  process.exit(falhas ? 1 : 0);
})();
