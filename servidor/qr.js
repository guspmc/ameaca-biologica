'use strict';
/*
 * Gerador de QR Code sem bibliotecas.
 * Modo byte, correção de erros nível M, versões 1 a 9 (até ~180 caracteres).
 * Serve para endereços do servidor local (http://192.168.0.10:3000).
 */

const VERSAO_MAX = 9;
// Índice = versão (nível M): bytes de correção por bloco e quantidade de blocos.
const ECC_POR_BLOCO = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22];
const NUM_BLOCOS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5];

function modulosDeDados(versao) {
  let r = (16 * versao + 128) * versao + 64;
  if (versao >= 2) {
    const n = Math.floor(versao / 7) + 2;
    r -= (25 * n - 10) * n - 55;
    if (versao >= 7) r -= 36;
  }
  return r;
}

const capacidadeDados = (versao) =>
  Math.floor(modulosDeDados(versao) / 8) - ECC_POR_BLOCO[versao] * NUM_BLOCOS[versao];

/* ---------- Reed-Solomon (corpo de Galois 0x11D) ---------- */

function mulGF(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function divisorRS(grau) {
  const r = new Array(grau).fill(0);
  r[grau - 1] = 1;
  let raiz = 1;
  for (let i = 0; i < grau; i++) {
    for (let j = 0; j < r.length; j++) {
      r[j] = mulGF(r[j], raiz);
      if (j + 1 < r.length) r[j] ^= r[j + 1];
    }
    raiz = mulGF(raiz, 2);
  }
  return r;
}

function restoRS(dados, divisor) {
  const r = new Array(divisor.length).fill(0);
  for (const b of dados) {
    const fator = b ^ r.shift();
    r.push(0);
    divisor.forEach((coef, i) => { r[i] ^= mulGF(coef, fator); });
  }
  return r;
}

/* ---------- Mensagem: bits, blocos e correção ---------- */

function montarPalavras(bytes, versao) {
  const bits = [];
  const empurrar = (valor, tamanho) => {
    for (let i = tamanho - 1; i >= 0; i--) bits.push((valor >>> i) & 1);
  };
  empurrar(0b0100, 4); // modo byte
  empurrar(bytes.length, 8); // contagem (8 bits nas versões 1 a 9)
  for (const b of bytes) empurrar(b, 8);

  const capacidadeBits = capacidadeDados(versao) * 8;
  empurrar(0, Math.min(4, capacidadeBits - bits.length));
  while (bits.length % 8) bits.push(0);
  for (let pad = 0xec; bits.length < capacidadeBits; pad ^= 0xec ^ 0x11) empurrar(pad, 8);

  const dados = [];
  for (let i = 0; i < bits.length; i += 8) dados.push(parseInt(bits.slice(i, i + 8).join(''), 2));

  const numBlocos = NUM_BLOCOS[versao];
  const eccBloco = ECC_POR_BLOCO[versao];
  const total = Math.floor(modulosDeDados(versao) / 8);
  const curtos = numBlocos - (total % numBlocos);
  const tamCurto = Math.floor(total / numBlocos);
  const divisor = divisorRS(eccBloco);

  const blocos = [];
  for (let i = 0, k = 0; i < numBlocos; i++) {
    const dat = dados.slice(k, k + tamCurto - eccBloco + (i < curtos ? 0 : 1));
    k += dat.length;
    const ecc = restoRS(dat, divisor);
    if (i < curtos) dat.push(0); // marcador, descartado ao intercalar
    blocos.push(dat.concat(ecc));
  }

  const resultado = [];
  for (let i = 0; i < blocos[0].length; i++) {
    blocos.forEach((bloco, j) => {
      if (i !== tamCurto - eccBloco || j >= curtos) resultado.push(bloco[i]);
    });
  }
  return resultado;
}

/* ---------- Desenho da matriz ---------- */

function penalidade(m) {
  const tam = m.length;
  let p = 0;
  for (let eixo = 0; eixo < 2; eixo++) {
    for (let a = 0; a < tam; a++) {
      let s = '';
      for (let b = 0; b < tam; b++) s += (eixo === 0 ? m[a][b] : m[b][a]) ? '1' : '0';
      let seq = 1;
      for (let b = 1; b <= tam; b++) {
        if (b < tam && s[b] === s[b - 1]) seq++;
        else {
          if (seq >= 5) p += 3 + (seq - 5);
          seq = 1;
        }
      }
      for (const padrao of ['10111010000', '00001011101']) {
        for (let i = s.indexOf(padrao); i !== -1; i = s.indexOf(padrao, i + 1)) p += 40;
      }
    }
  }
  let escuros = 0;
  for (let y = 0; y < tam; y++) {
    for (let x = 0; x < tam; x++) {
      if (m[y][x]) escuros++;
      if (x < tam - 1 && y < tam - 1 && m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) p += 3;
    }
  }
  p += Math.floor(Math.abs((escuros * 100) / (tam * tam) - 50) / 5) * 10;
  return p;
}

const MASCARAS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x, y) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

// Devolve a matriz de módulos (true = escuro), indexada [linha][coluna].
function gerarMatriz(texto) {
  const bytes = Buffer.from(String(texto), 'utf8');
  let versao = 1;
  while (versao <= VERSAO_MAX && 12 + bytes.length * 8 > capacidadeDados(versao) * 8) versao++;
  if (versao > VERSAO_MAX) throw new Error('Texto longo demais para o QR Code.');

  const palavras = montarPalavras(bytes, versao);
  const tam = versao * 4 + 17;
  const m = Array.from({ length: tam }, () => new Array(tam).fill(false));
  const fixo = Array.from({ length: tam }, () => new Array(tam).fill(false));
  const pintar = (x, y, v) => { m[y][x] = v; fixo[y][x] = true; };

  // Linhas de temporização
  for (let i = 0; i < tam; i++) {
    pintar(6, i, i % 2 === 0);
    pintar(i, 6, i % 2 === 0);
  }
  // Marcadores de canto
  for (const [cx, cy] of [[3, 3], [tam - 4, 3], [3, tam - 4]]) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < tam && y >= 0 && y < tam) pintar(x, y, dist !== 2 && dist !== 4);
      }
    }
  }
  // Marcadores de alinhamento
  if (versao > 1) {
    const n = Math.floor(versao / 7) + 2;
    const passo = Math.ceil((versao * 4 + 4) / (n * 2 - 2)) * 2;
    const pos = [6];
    for (let p = tam - 7; pos.length < n; p -= passo) pos.splice(1, 0, p);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) pintar(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    }
  }

  const desenharFormato = (mascara) => {
    const d = mascara; // nível M = 0b00
    let r = d;
    for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const bits = ((d << 10) | r) ^ 0x5412;
    const bit = (i) => ((bits >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i++) pintar(8, i, bit(i));
    pintar(8, 7, bit(6));
    pintar(8, 8, bit(7));
    pintar(7, 8, bit(8));
    for (let i = 9; i < 15; i++) pintar(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) pintar(tam - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) pintar(8, tam - 15 + i, bit(i));
    pintar(8, tam - 8, true);
  };
  desenharFormato(0); // reserva a área; é refeito com a máscara escolhida

  if (versao >= 7) {
    let r = versao;
    for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
    const bits = (versao << 12) | r;
    for (let i = 0; i < 18; i++) {
      const v = ((bits >>> i) & 1) !== 0;
      const a = tam - 11 + (i % 3);
      const b = Math.floor(i / 3);
      pintar(a, b, v);
      pintar(b, a, v);
    }
  }

  // Dados em zigue-zague
  let k = 0;
  for (let direita = tam - 1; direita >= 1; direita -= 2) {
    if (direita === 6) direita = 5;
    for (let vert = 0; vert < tam; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = direita - j;
        const sobe = ((direita + 1) & 2) === 0;
        const y = sobe ? tam - 1 - vert : vert;
        if (!fixo[y][x] && k < palavras.length * 8) {
          m[y][x] = ((palavras[k >>> 3] >>> (7 - (k & 7))) & 1) !== 0;
          k++;
        }
      }
    }
  }

  const aplicar = (mascara) => {
    for (let y = 0; y < tam; y++) {
      for (let x = 0; x < tam; x++) {
        if (!fixo[y][x] && MASCARAS[mascara](x, y)) m[y][x] = !m[y][x];
      }
    }
  };

  let melhor = 0;
  let menor = Infinity;
  for (let mascara = 0; mascara < 8; mascara++) {
    aplicar(mascara);
    desenharFormato(mascara);
    const p = penalidade(m);
    if (p < menor) { menor = p; melhor = mascara; }
    aplicar(mascara); // desfaz
  }
  aplicar(melhor);
  desenharFormato(melhor);
  return m;
}

function qrSvg(texto, borda = 4) {
  const matriz = gerarMatriz(texto);
  const n = matriz.length + borda * 2;
  let d = '';
  matriz.forEach((linha, y) => linha.forEach((escuro, x) => {
    if (escuro) d += `M${x + borda} ${y + borda}h1v1h-1z`;
  }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" role="img" aria-label="QR Code"><rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

module.exports = { gerarMatriz, qrSvg };
