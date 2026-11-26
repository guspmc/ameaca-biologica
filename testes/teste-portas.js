'use strict';
// Testa a escolha de porta: porta ocupada, servidor duplicado, todas ocupadas e a rota do QR.
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');

const RAIZ = path.join(__dirname, '..');
let falhas = 0;
const confere = (n, c, d = '') => { console.log(`${c ? 'OK   ' : 'FALHA'} ${n}${d ? ' -> ' + d : ''}`); if (!c) falhas++; };
const dorme = (ms) => new Promise((r) => setTimeout(r, ms));

function ocupar(porta) {
  return new Promise((ok) => {
    const s = http.createServer((q, r) => { r.writeHead(200); r.end('outro programa'); });
    s.listen(porta, '0.0.0.0', () => ok(s));
  });
}

function iniciar(copia, porta) {
  const filho = spawn('node', ['servidor/server.js'], { cwd: copia, env: { ...process.env, PORTA: String(porta) } });
  const r = { saida: '', codigo: null, filho };
  filho.stdout.on('data', (d) => (r.saida += d));
  filho.stderr.on('data', (d) => (r.saida += d));
  filho.on('exit', (c) => (r.codigo = c));
  return r;
}

(async () => {
  const copia = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-portas-'));
  fs.cpSync(RAIZ, copia, { recursive: true, filter: (o) => !o.includes('/.git/') && !o.endsWith('/.git') });
  const abertos = [];
  const filhos = [];
  try {
    // 1) Porta preferida ocupada por outro programa -> usa a seguinte
    abertos.push(await ocupar(3460));
    const a = iniciar(copia, 3460); filhos.push(a.filho);
    await dorme(1500);
    confere('porta ocupada: usa a seguinte (3461)', a.saida.includes('Usando a porta 3461') && a.saida.includes('http://localhost:3461'), a.saida.split('\n').filter((l) => /porta|localhost/.test(l)).join(' | '));
    confere('aviso aparece uma única vez e só com a porta real', (a.saida.match(/Neste computador/g) || []).length === 1 && !a.saida.includes('localhost:3460'), a.saida.split('\n').filter((l) => /localhost/.test(l)).join(' | '));
    const st = await (await fetch('http://localhost:3461/api/status')).json();
    confere('status informa a porta real', st.porta === 3461, String(st.porta));
    confere('servidor continua vivo', a.codigo === null);

    // 2) Segundo servidor aberto por engano -> avisa e encerra sem abrir outro
    const b = iniciar(copia, 3460); filhos.push(b.filho);
    await dorme(2500);
    confere('segundo servidor reconhece o primeiro e encerra', b.codigo === 0 && b.saida.includes('já está ligado em http://localhost:3461'), `codigo=${b.codigo}`);

    // 3) Rota do QR
    let r = await fetch('http://localhost:3461/api/qr?texto=' + encodeURIComponent('http://192.168.0.10:3461'));
    const svg = await r.text();
    confere('QR: devolve SVG', r.status === 200 && r.headers.get('content-type') === 'image/svg+xml' && svg.startsWith('<svg') && svg.includes('<path'));
    r = await fetch('http://localhost:3461/api/qr?texto=abc');
    confere('QR: texto que não é endereço é recusado (400)', r.status === 400);
    r = await fetch('http://localhost:3461/api/qr?texto=' + encodeURIComponent('http://' + 'x'.repeat(200)));
    confere('QR: texto longo demais é recusado (400)', r.status === 400);
    r = await fetch('http://localhost:3461/api/qr');
    confere('QR: sem texto é recusado (400)', r.status === 400);

    // 4) Todas as 11 portas ocupadas -> erro claro e código de saída 1
    for (let p = 3470; p <= 3480; p++) abertos.push(await ocupar(p));
    const c = iniciar(copia, 3470); filhos.push(c.filho);
    await dorme(3000);
    confere('todas as portas ocupadas: encerra com erro claro', c.codigo === 1 && c.saida.includes('Nenhuma porta livre de 3470 a 3480'), `codigo=${c.codigo} ${c.saida.trim().split('\n').slice(-2).join(' ')}`);

    // 5) Navegador: abre na porta real só quando ABRIR_NAVEGADOR=1 (xdg-open falso registra o endereço)
    const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-bin-'));
    const registro = path.join(bin, 'aberto.txt');
    fs.writeFileSync(path.join(bin, 'xdg-open'), `#!/bin/sh\necho "$1" >> "${registro}"\n`, { mode: 0o755 });
    abertos.push(await ocupar(3490));
    const d = spawn('node', ['servidor/server.js'], { cwd: copia, env: { ...process.env, PORTA: '3490', ABRIR_NAVEGADOR: '1', PATH: bin + ':' + process.env.PATH } });
    filhos.push(d);
    await dorme(2000);
    const aberto = fs.existsSync(registro) ? fs.readFileSync(registro, 'utf8').trim().split('\n') : [];
    confere('ABRIR_NAVEGADOR=1: abre o navegador uma vez, na porta real (3491)', aberto.length === 1 && aberto[0] === 'http://localhost:3491', JSON.stringify(aberto));
    fs.rmSync(registro, { force: true });
    const e = spawn('node', ['servidor/server.js'], { cwd: copia, env: { ...process.env, PORTA: '3492', PATH: bin + ':' + process.env.PATH } });
    filhos.push(e);
    await dorme(1500);
    confere('sem ABRIR_NAVEGADOR nada é aberto', !fs.existsSync(registro));
    fs.rmSync(bin, { recursive: true, force: true });
  } catch (e) {
    console.log('ERRO NO TESTE', e);
    falhas++;
  } finally {
    for (const f of filhos) f.kill();
    for (const s of abertos) s.close();
    fs.rmSync(copia, { recursive: true, force: true });
  }
  console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO OK');
  process.exit(falhas ? 1 : 0);
})();
