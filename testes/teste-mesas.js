'use strict';
// Testa as Mesas pelo HTTP: criar, entrar por código, aprovação, limites, avisos e persistência.
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const RAIZ = path.join(__dirname, '..');
const PORTA = 3500;
const B = `http://localhost:${PORTA}`;
let falhas = 0;
const confere = (n, c, d = '') => { console.log(`${c ? 'OK   ' : 'FALHA'} ${n}${d ? ' -> ' + d : ''}`); if (!c) falhas++; };
const dorme = (ms) => new Promise((r) => setTimeout(r, ms));

async function chamar(token, metodo, rota, corpo) {
  const r = await fetch(B + rota, {
    method: metodo,
    headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(corpo ? { 'Content-Type': 'application/json' } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  let dados = null;
  try { dados = await r.json(); } catch { /* sem corpo */ }
  return { status: r.status, ...(dados || {}) };
}

async function entrar(usuario, senha = 'abcd') {
  const r = await fetch(B + '/api/entrar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario, senha }) });
  return (await r.json()).token;
}

// Escuta eventos em tempo real e guarda o que chegar.
function escutar(token) {
  const controle = new AbortController();
  const resultado = { texto: '', parar: () => controle.abort() };
  fetch(`${B}/api/eventos?token=${token}`, { signal: controle.signal }).then(async (r) => {
    const leitor = r.body.getReader();
    const dec = new TextDecoder();
    for (;;) {
      const { done, value } = await leitor.read();
      if (done) break;
      resultado.texto += dec.decode(value);
    }
  }).catch(() => {});
  return resultado;
}

function iniciar(pasta) {
  const filho = spawn('node', ['servidor/server.js'], { cwd: pasta, env: { ...process.env, PORTA: String(PORTA) } });
  filho.stdout.on('data', () => {});
  filho.stderr.on('data', () => {});
  return filho;
}

(async () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-mesas-'));
  fs.cpSync(RAIZ, pasta, { recursive: true, filter: (o) => !o.includes('/.git/') && !o.endsWith('/.git') });
  for (const f of fs.readdirSync(path.join(pasta, 'servidor', 'dados'))) {
    if (f !== '.gitkeep') fs.rmSync(path.join(pasta, 'servidor', 'dados', f));
  }
  let filho = iniciar(pasta);
  await dorme(1200);

  try {
    let [ana, beto, caio, dani] = await Promise.all(['Ana', 'Beto', 'Caio', 'Dani'].map((n) => entrar(n)));

    // ---- Criar ----
    let r = await chamar(null, 'GET', '/api/mesas');
    confere('sem login não acessa Mesas (401)', r.status === 401);
    r = await chamar(ana, 'POST', '/api/mesas', { nome: ' ', limiteJogadores: 2, limiteNivel: 1 });
    confere('nome vazio é recusado (400)', r.status === 400);
    for (const j of [1, 10, 'x']) {
      r = await chamar(ana, 'POST', '/api/mesas', { nome: 'Teste', limiteJogadores: j, limiteNivel: 1 });
      confere(`limite de jogadores ${j} é recusado (400)`, r.status === 400);
    }
    for (const n of [0, 11]) {
      r = await chamar(ana, 'POST', '/api/mesas', { nome: 'Teste', limiteJogadores: 3, limiteNivel: n });
      confere(`nível máximo ${n} é recusado (400)`, r.status === 400);
    }
    r = await chamar(ana, 'POST', '/api/mesas', { nome: 'Noite em Raccoon', limiteJogadores: 2, limiteNivel: 3 });
    const id = r.id;
    confere('Ana cria a Mesa e vira Mestre', r.status === 201 && /^[0-9a-f]{12}$/.test(id));

    r = await chamar(ana, 'GET', `/api/mesas/${id}`);
    let codigo = r.mesa.codigo;
    confere('Mestre vê papel, código e limites', r.mesa.papel === 'mestre' && /^[A-HJKMNP-Z2-9]{6}$/.test(codigo) && r.mesa.limiteJogadores === 2 && r.mesa.limiteNivel === 3);
    confere('código é mostrado no formato ABC-123', r.mesa.codigoFormatado === `${codigo.slice(0, 3)}-${codigo.slice(3)}`);

    // ---- Entrar por código ----
    r = await chamar(beto, 'GET', `/api/mesas/${id}`);
    confere('quem não é da Mesa não a enxerga (404)', r.status === 404);
    r = await chamar(beto, 'POST', '/api/mesas/entrar', { codigo: 'abc' });
    confere('código curto é recusado (400)', r.status === 400);
    r = await chamar(beto, 'POST', '/api/mesas/entrar', { codigo: 'ZZZZZZ' });
    confere('código inexistente (404)', r.status === 404);

    const eventosBeto = escutar(beto);
    const eventosDani = escutar(dani);
    await dorme(300);

    r = await chamar(beto, 'POST', '/api/mesas/entrar', { codigo: `${codigo.slice(0, 3).toLowerCase()} - ${codigo.slice(3)}` });
    confere('Beto entra com o código (minúsculas, espaço e hífen) e fica pendente', r.status === 200 && r.id === id && r.status_jogador === 'pendente');
    r = await chamar(beto, 'POST', '/api/mesas/entrar', { codigo });
    confere('entrar de novo não duplica o pedido', r.status === 200 && r.status_jogador === 'pendente' && (await chamar(ana, 'GET', `/api/mesas/${id}`)).mesa.jogadores.length === 1);
    r = await chamar(ana, 'POST', '/api/mesas/entrar', { codigo });
    confere('o Mestre que usa o próprio código só abre a Mesa', r.status === 200 && r.papel === 'mestre');

    r = await chamar(beto, 'GET', `/api/mesas/${id}`);
    confere('jogador pendente: vê status e não vê quem está na Mesa', r.mesa.papel === 'jogador' && r.mesa.status === 'pendente' && r.mesa.jogadores.length === 0 && r.mesa.codigo === undefined);
    r = await chamar(ana, 'GET', '/api/mesas');
    confere('lista do Mestre mostra 1 pedido pendente', r.mesas.length === 1 && r.mesas[0].papel === 'mestre' && r.mesas[0].pendentes === 1);
    r = await chamar(beto, 'GET', '/api/mesas');
    confere('lista do jogador mostra "pendente"', r.mesas.length === 1 && r.mesas[0].papel === 'jogador' && r.mesas[0].status === 'pendente');

    // ---- Aprovação ----
    r = await chamar(beto, 'POST', `/api/mesas/${id}/jogadores/Beto/aprovar`);
    confere('jogador não pode se aprovar (403)', r.status === 403);
    r = await chamar(ana, 'POST', `/api/mesas/${id}/jogadores/Fulano/aprovar`);
    confere('aprovar quem não pediu (404)', r.status === 404);
    r = await chamar(ana, 'POST', `/api/mesas/${id}/jogadores/Beto/aprovar`);
    confere('Ana aprova Beto', r.status === 200);
    r = await chamar(ana, 'POST', `/api/mesas/${id}/jogadores/Beto/aprovar`);
    confere('aprovar duas vezes (409)', r.status === 409);
    await dorme(300);
    confere('Beto (da Mesa) recebe aviso em tempo real', eventosBeto.texto.includes('event: mesa') && eventosBeto.texto.includes(id));
    confere('Dani (de fora) não recebe avisos da Mesa', !eventosDani.texto.includes('event: mesa'));

    r = await chamar(caio, 'POST', '/api/mesas/entrar', { codigo });
    r = await chamar(ana, 'POST', `/api/mesas/${id}/jogadores/Caio/aprovar`);
    confere('Ana aprova Caio', r.status === 200);
    r = await chamar(beto, 'GET', `/api/mesas/${id}`);
    confere('jogador aprovado vê quem está na Mesa', r.mesa.status === 'aprovado' && r.mesa.jogadores.map((j) => j.usuario).sort().join() === 'Beto,Caio');

    // ---- Limites ----
    r = await chamar(dani, 'POST', '/api/mesas/entrar', { codigo });
    confere('Mesa cheia: Dani não entra (409)', r.status === 409);
    r = await chamar(ana, 'POST', `/api/mesas/${id}/configurar`, { limiteJogadores: 1 });
    confere('limite abaixo do mínimo de 2 jogadores é recusado (400)', r.status === 400);
    r = await chamar(beto, 'POST', `/api/mesas/${id}/configurar`, { limiteJogadores: 5 });
    confere('jogador não configura a Mesa (403)', r.status === 403);
    r = await chamar(ana, 'POST', `/api/mesas/${id}/configurar`, { nome: 'Madrugada em Raccoon', limiteJogadores: 3, limiteNivel: 5 });
    confere('Mestre altera nome e limites', r.status === 200);
    r = await chamar(ana, 'GET', `/api/mesas/${id}`);
    confere('alterações valem', r.mesa.nome === 'Madrugada em Raccoon' && r.mesa.limiteJogadores === 3 && r.mesa.limiteNivel === 5);
    r = await chamar(ana, 'POST', `/api/mesas/${id}/configurar`, { limiteNivel: 11 });
    confere('nível 11 é recusado (400)', r.status === 400);

    r = await chamar(dani, 'POST', '/api/mesas/entrar', { codigo });
    confere('com vaga, Dani pede entrada', r.status === 200 && r.status_jogador === 'pendente');
    r = await chamar(ana, 'POST', `/api/mesas/${id}/jogadores/Dani/remover`);
    confere('remover quem ainda é pedido (409)', r.status === 409);
    r = await chamar(ana, 'POST', `/api/mesas/${id}/jogadores/Dani/aprovar`);
    confere('Ana aprova Dani (3 jogadores)', r.status === 200);
    r = await chamar(ana, 'POST', `/api/mesas/${id}/configurar`, { limiteJogadores: 2 });
    confere('limite menor que os jogadores aprovados é recusado (409)', r.status === 409);
    r = await chamar(ana, 'POST', `/api/mesas/${id}/jogadores/Dani/remover`);
    confere('Ana remove Dani da Mesa', r.status === 200);
    r = await chamar(dani, 'GET', `/api/mesas/${id}`);
    confere('quem foi removido deixa de ver a Mesa (404)', r.status === 404);
    r = await chamar(dani, 'POST', '/api/mesas/entrar', { codigo });
    confere('removido pode pedir entrada de novo', r.status === 200 && r.status_jogador === 'pendente');
    r = await chamar(ana, 'POST', `/api/mesas/${id}/jogadores/Dani/recusar`);
    confere('Ana recusa o novo pedido de Dani', r.status === 200);
    r = await chamar(dani, 'GET', `/api/mesas/${id}`);
    confere('quem foi recusado deixa de ver a Mesa (404)', r.status === 404);
    r = await chamar(ana, 'POST', `/api/mesas/${id}/jogadores/Caio/recusar`);
    confere('recusar quem já foi aprovado (409)', r.status === 409);

    // ---- Código novo ----
    r = await chamar(beto, 'POST', `/api/mesas/${id}/novo-codigo`);
    confere('jogador não gera código (403)', r.status === 403);
    r = await chamar(ana, 'POST', `/api/mesas/${id}/novo-codigo`);
    const codigoAntigo = codigo;
    codigo = (await chamar(ana, 'GET', `/api/mesas/${id}`)).mesa.codigo;
    confere('novo código é diferente', r.status === 200 && codigo !== codigoAntigo);
    r = await chamar(dani, 'POST', '/api/mesas/entrar', { codigo: codigoAntigo });
    confere('código antigo deixa de valer (404)', r.status === 404);
    r = await chamar(beto, 'GET', `/api/mesas/${id}`);
    confere('quem já estava na Mesa continua nela', r.status === 200 && r.mesa.status === 'aprovado');

    // ---- Persistência: reinicia o servidor ----
    eventosBeto.parar(); eventosDani.parar();
    filho.kill();
    await dorme(500);
    filho = iniciar(pasta);
    await dorme(1200);
    [ana, beto, caio] = await Promise.all(['Ana', 'Beto', 'Caio'].map((n) => entrar(n)));
    r = await chamar(ana, 'GET', `/api/mesas/${id}`);
    confere('depois de reiniciar, a Mesa continua com código, limites e jogadores', r.mesa && r.mesa.codigo === codigo && r.mesa.limiteJogadores === 3 && r.mesa.jogadores.length === 2);
    confere('arquivo mesas.json gravado sem sobras', fs.existsSync(path.join(pasta, 'servidor', 'dados', 'mesas.json')) && !fs.existsSync(path.join(pasta, 'servidor', 'dados', 'mesas.json.tmp')));

    // ---- Sair e encerrar ----
    r = await chamar(ana, 'POST', `/api/mesas/${id}/sair`);
    confere('Mestre não pode sair da própria Mesa (409)', r.status === 409);
    r = await chamar(beto, 'POST', `/api/mesas/${id}/sair`);
    confere('Beto sai da Mesa', r.status === 200 && (await chamar(beto, 'GET', `/api/mesas/${id}`)).status === 404);
    r = await chamar(caio, 'POST', `/api/mesas/${id}/encerrar`);
    confere('jogador não encerra a Mesa (403)', r.status === 403);
    r = await chamar(ana, 'POST', `/api/mesas/${id}/jogadores/Caio/remover`);
    confere('Mestre remove Caio', r.status === 200);
    r = await chamar(ana, 'POST', `/api/mesas/${id}/encerrar`);
    confere('Ana encerra a Mesa', r.status === 200 && (await chamar(ana, 'GET', `/api/mesas/${id}`)).status === 404);

    // ---- Limite de Mesas por Mestre ----
    let ultimo = null;
    for (let i = 1; i <= 6; i++) ultimo = await chamar(ana, 'POST', '/api/mesas', { nome: `Mesa ${i}`, limiteJogadores: 3, limiteNivel: 1 });
    confere('Mestre pode ter até 5 Mesas (a 6ª é recusada, 409)', ultimo.status === 409);

    // ---- Nome com HTML é guardado como texto (a tela escapa) ----
    r = await chamar(beto, 'POST', '/api/mesas', { nome: '<img src=x onerror=alert(1)>', limiteJogadores: 3, limiteNivel: 1 });
    confere('nome com HTML é aceito como texto simples', r.status === 201 && (await chamar(beto, 'GET', `/api/mesas/${r.id}`)).mesa.nome === '<img src=x onerror=alert(1)>');
  } catch (e) {
    console.log('ERRO NO TESTE', e);
    falhas++;
  } finally {
    filho.kill();
    fs.rmSync(pasta, { recursive: true, force: true });
  }
  console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO OK');
  process.exit(falhas ? 1 : 0);
})();
