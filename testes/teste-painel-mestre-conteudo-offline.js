'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const armazenamento = new Map();
let chamadas = [];
let respostaServidor = { conteudo: { versao: 3, anotacoes: 'Do servidor', encontros: [], documentos: [], itens: [] } };
const window = { renderizarMesa() {}, carregarMesaAtual() {} };
const contexto = vm.createContext({
  window,
  estado: { mesaId: 'mesa-offline', modo: 'offline', mesaAtual: { papel: 'mestre' }, base: '', token: '' },
  document: { activeElement: null },
  localStorage: {
    setItem(k,v) { armazenamento.set(k,v); },
    getItem(k) { return armazenamento.has(k) ? armazenamento.get(k) : null; },
    removeItem(k) { armazenamento.delete(k); }
  },
  buscar: async (...args) => { chamadas.push(args); return respostaServidor; },
  $: () => null,
  mensagem() {},
  setTimeout() {},
  URL: { createObjectURL() { return 'blob:test'; }, revokeObjectURL() {} },
  fetch: async () => ({ ok: true, json: async () => ({}) }),
  confirm: () => true,
  crypto: { randomUUID: () => 'id-teste' },
  process: { exitCode: 0 }
});
const codigo = fs.readFileSync(path.join(__dirname, '../app/js/painel-mestre-conteudo.js'), 'utf8');
vm.runInContext(codigo, contexto, { filename: 'painel-mestre-conteudo.js' });

(async () => {
  // O Bestiário deve usar o arquivo estático do PWA quando o Mestre está Offline.
  contexto.buscar = async (...args) => { chamadas.push(args); return [{ id: 'bow-teste', nome: 'Criatura de teste' }]; };
  await vm.runInContext('carregarBestiarioMestre()', contexto);
  assert.equal(chamadas[0][0], '/dados/bestiario.json');
  assert.equal(vm.runInContext('BESTIARIO_AB.length', contexto), 1);
  chamadas.length = 0;
  contexto.buscar = async (...args) => { chamadas.push(args); return respostaServidor; };

  // Conteúdo previamente sincronizado continua disponível quando a conexão cai durante a sessão.
  const sincronizado = { versao: 3, anotacoes: 'Sessão no laboratório', encontros: [{id:'e1'}], documentos: [], itens: [] };
  vm.runInContext('conteudoMestre = '+JSON.stringify(sincronizado), contexto);
  assert.equal(vm.runInContext('guardarConteudoMestreOffline(false)', contexto), true);
  vm.runInContext('conteudoMestre = null', contexto);
  await vm.runInContext('carregarConteudoMestre()', contexto);
  assert.equal(vm.runInContext('conteudoMestre.anotacoes', contexto), 'Sessão no laboratório');
  assert.equal(chamadas.length, 0);

  // Edições offline são guardadas e marcadas como pendentes.
  vm.runInContext('conteudoMestre = '+JSON.stringify({...JSON.parse(JSON.stringify(sincronizado)),anotacoes:'Nova pista descoberta'}), contexto);
  await vm.runInContext('salvarConteudoMestre()', contexto);
  assert.equal(vm.runInContext('conteudoMestreOfflinePendente()', contexto), true);
  assert.equal(vm.runInContext('lerConteudoMestreOffline().anotacoes', contexto), 'Nova pista descoberta');

  // Ao reconectar, o snapshot pendente é enviado antes de buscar dados novos.
  contexto.estado.modo = 'local';
  respostaServidor = { conteudo: { ...sincronizado, versao: 4, anotacoes: 'Nova pista descoberta' } };
  await vm.runInContext('carregarConteudoMestre()', contexto);
  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0][1].method, 'PUT');
  assert.equal(vm.runInContext('conteudoMestreOfflinePendente()', contexto), false);
  assert.equal(vm.runInContext('lerConteudoMestreOffline().versao', contexto), 4);

  // Conflito preserva a cópia pendente em vez de sobrescrever a versão remota.
  vm.runInContext('conteudoMestre = '+JSON.stringify({...JSON.parse(JSON.stringify(sincronizado)),versao:3,anotacoes:'Edição conflitante'}), contexto);
  contexto.estado.modo = 'offline';
  await vm.runInContext('salvarConteudoMestre()', contexto);
  contexto.estado.modo = 'local';
  vm.runInContext("buscar = async () => { const erro = new Error('Conflito'); erro.status = 409; throw erro; }", contexto);
  await vm.runInContext('salvarConteudoMestre()', contexto);
  assert.equal(vm.runInContext('conteudoMestreOfflinePendente()', contexto), true);
  assert.equal(vm.runInContext('lerConteudoMestreOffline().anotacoes', contexto), 'Edição conflitante');

  console.log('Conteúdo do Painel do Mestre offline: tudo OK');
})().catch(erro => { console.error(erro); process.exitCode = 1; });
