'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAX_BYTES = 10 * 1024 * 1024;
const TIPOS = Object.freeze({
  '.pdf': { mime: 'application/pdf', extensoes: ['.pdf'] },
  '.png': { mime: 'image/png', extensoes: ['.png'] },
  '.jpg': { mime: 'image/jpeg', extensoes: ['.jpg', '.jpeg'] },
  '.webp': { mime: 'image/webp', extensoes: ['.webp'] },
  '.txt': { mime: 'text/plain', extensoes: ['.txt'] },
});

function criarArquivosMestre({ pasta }) {
  const raiz = path.resolve(pasta);
  function pastaMesa(mesaId) {
    if (!/^[a-f0-9]{12}$/i.test(String(mesaId))) throw new Error('Mesa inválida.');
    return path.join(raiz, mesaId);
  }
  function nomeSeguro(nome) {
    return path.basename(String(nome || 'arquivo').replace(/\\/g, '/')).replace(/[^\\p{L}\\p{N}._ -]/gu, '_').slice(0, 100) || 'arquivo';
  }
  function salvar(mesaId, nomeOriginal, mimeInformado, buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 1) return { ok: false, status: 400, erro: 'O arquivo está vazio.' };
    if (buffer.length > MAX_BYTES) return { ok: false, status: 413, erro: 'O arquivo excede o limite de 10 MB.' };
    const nome = nomeSeguro(nomeOriginal);
    const ext = path.extname(nome).toLowerCase();
    const tipo = Object.values(TIPOS).find(t => t.extensoes.includes(ext));
    if (!tipo || tipo.mime !== String(mimeInformado || '').toLowerCase()) {
      return { ok: false, status: 415, erro: 'Formato não permitido. Use PDF, PNG, JPG, WEBP ou TXT.' };
    }
    const dir = pastaMesa(mesaId);
    fs.mkdirSync(dir, { recursive: true });
    const id = crypto.randomUUID();
    const arquivo = id + ext;
    fs.writeFileSync(path.join(dir, arquivo), buffer, { flag: 'wx' });
    return { ok: true, arquivo: id + ext, nome, mime: tipo.mime, tamanho: buffer.length };
  }
  function ler(mesaId, arquivo) {
    if (!/^[0-9a-f-]{36}\\.(pdf|png|jpg|jpeg|webp|txt)$/i.test(String(arquivo))) return null;
    const dir = pastaMesa(mesaId);
    const caminho = path.join(dir, arquivo);
    try {
      const dados = fs.readFileSync(caminho);
      const ext = path.extname(arquivo).toLowerCase();
      const tipo = Object.values(TIPOS).find(t => t.extensoes.includes(ext));
      return tipo ? { dados, mime: tipo.mime } : null;
    } catch { return null; }
  }
  function apagarMesa(mesaId) {
    const dir = pastaMesa(mesaId);
    fs.rmSync(dir, { recursive: true, force: true });
  }
  return { salvar, ler, apagarMesa, MAX_BYTES };
}

module.exports = { criarArquivosMestre, MAX_BYTES };
