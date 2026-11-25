'use strict';
/*
 * Gera os ícones do app (app/icons/icon-192.png e icon-512.png) sem bibliotecas.
 * Uso: node ferramentas/gerar-icones.js
 * Desenho: fundo escuro, anel externo e três anéis entrelaçados (símbolo de risco biológico simplificado).
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const FUNDO = [11, 15, 12];
const ACENTO = [61, 220, 132];

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function bloco(tipo, dados) {
  const tamanho = Buffer.alloc(4);
  tamanho.writeUInt32BE(dados.length);
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
  const soma = Buffer.alloc(4);
  soma.writeUInt32BE(crc32(corpo));
  return Buffer.concat([tamanho, corpo, soma]);
}

function png(tamanho, rgba) {
  const cabecalho = Buffer.alloc(13);
  cabecalho.writeUInt32BE(tamanho, 0);
  cabecalho.writeUInt32BE(tamanho, 4);
  cabecalho[8] = 8; // 8 bits por canal
  cabecalho[9] = 6; // RGBA
  const linhas = Buffer.alloc((tamanho * 4 + 1) * tamanho);
  for (let y = 0; y < tamanho; y++) {
    rgba.copy(linhas, y * (tamanho * 4 + 1) + 1, y * tamanho * 4, (y + 1) * tamanho * 4);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    bloco('IHDR', cabecalho),
    bloco('IDAT', zlib.deflateSync(linhas)),
    bloco('IEND', Buffer.alloc(0)),
  ]);
}

// Cobertura (0 a 1) de um anel de raio r e espessura e, com borda suave de 1 pixel.
function anel(distancia, raio, espessura) {
  const d = Math.abs(distancia - raio) - espessura / 2;
  return Math.min(1, Math.max(0, 0.5 - d));
}

function desenhar(tamanho) {
  const rgba = Buffer.alloc(tamanho * tamanho * 4);
  const c = tamanho / 2;
  const centros = [0, 1, 2].map((k) => {
    const ang = ((k * 120 - 90) * Math.PI) / 180;
    return [c + Math.cos(ang) * 0.13 * tamanho, c + Math.sin(ang) * 0.13 * tamanho];
  });

  for (let y = 0; y < tamanho; y++) {
    for (let x = 0; x < tamanho; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let cobertura = anel(Math.hypot(px - c, py - c), 0.36 * tamanho, 0.022 * tamanho);
      for (const [cx, cy] of centros) {
        cobertura = Math.max(cobertura, anel(Math.hypot(px - cx, py - cy), 0.15 * tamanho, 0.03 * tamanho));
      }
      cobertura = Math.max(cobertura, Math.min(1, Math.max(0, 0.5 - (Math.hypot(px - c, py - c) - 0.035 * tamanho))));

      const i = (y * tamanho + x) * 4;
      for (let k = 0; k < 3; k++) rgba[i + k] = Math.round(FUNDO[k] + (ACENTO[k] - FUNDO[k]) * cobertura);
      rgba[i + 3] = 255;
    }
  }
  return rgba;
}

const pasta = path.join(__dirname, '..', 'app', 'icons');
fs.mkdirSync(pasta, { recursive: true });
for (const tamanho of [192, 512]) {
  fs.writeFileSync(path.join(pasta, `icon-${tamanho}.png`), png(tamanho, desenhar(tamanho)));
  console.log(`icon-${tamanho}.png gerado`);
}
