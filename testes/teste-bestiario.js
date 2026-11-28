'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const catalogo = JSON.parse(fs.readFileSync(path.join(__dirname, '../app/dados/bestiario.json'), 'utf8'));
assert.equal(catalogo.length, 24, 'O catálogo deve conter 22 criaturas comuns e 2 fichas de Perseguidores.');
const ids = new Set();
const pontos = { Comum: 1, Perigosa: 2, Elite: 4, Chefe: 8, Perseguidor: null };
for (const criatura of catalogo) {
  assert.ok(criatura.id && !ids.has(criatura.id), 'IDs devem existir e ser únicos.');
  ids.add(criatura.id);
  assert.ok(criatura.nome && criatura.funcao && criatura.tamanho);
  assert.equal(criatura.pontos, pontos[criatura.categoria], 'Pontuação deve corresponder à categoria de ameaça.');
  if(criatura.categoria==='Perseguidor'){assert.ok(Number.isInteger(criatura.pvPerseguicao));assert.ok(criatura.formaCombateId);}
  for (const campo of ['defesa','iniciativa']) assert.ok(Number.isInteger(criatura[campo]), criatura.nome + ': ' + campo);
  if(criatura.categoria==='Perseguidor') assert.ok(Number.isInteger(criatura.pvPerseguicao), criatura.nome + ': pvPerseguicao');
  else assert.ok(Number.isInteger(criatura.pv), criatura.nome + ': pv');
  for (const campo of ['for','agi','vig','ast']) assert.ok(Number.isInteger(criatura.atributos[campo]));
  for (const campo of ['fortitude','reflexos','vontade','percepcao']) assert.ok(Number.isInteger(criatura.resistencias[campo]));
  assert.ok(criatura.ataques.length > 0 && criatura.tracos.length > 0);
}
assert.ok(catalogo.some(c => c.id === 'nemesis-t-type-forma-final' && c.pv === 220));
assert.ok(catalogo.some(c => c.id === 'infectado' && c.pv === 15));
assert.ok(catalogo.some(c => c.id === 'tirano-t103-perseguidor' && c.pvPerseguicao === 80));
assert.ok(catalogo.some(c => c.id === 'nemesis-t-type-perseguidor' && c.pvPerseguicao === 100));

// Regressão: o sorteio automático não pode incluir Chefes nem Perseguidores.
const moduloCliente = fs.readFileSync(path.join(__dirname, '../app/js/painel-mestre-conteudo.js'), 'utf8');
assert.ok(moduloCliente.includes("nome: c.nome, categoria: c.categoria, pontos: c.pontos"),
  'O catálogo auxiliar precisa preservar o campo categoria.');
const prefixo = moduloCliente.slice(0, moduloCliente.indexOf('function elemento('));
const contexto = { Math: Object.create(Math) };
contexto.Math.random = () => 0;
const resultado = vm.runInNewContext(prefixo + `
  CRIATURAS_AB = [
    { id: 'comum', nome: 'Comum', categoria: 'Comum', pontos: 1 },
    { id: 'elite', nome: 'Elite', categoria: 'Elite', pontos: 4 },
    { id: 'chefe', nome: 'Chefe', categoria: 'Chefe', pontos: 8 },
    { id: 'perseguidor', nome: 'Perseguidor', categoria: 'Perseguidor', pontos: null }
  ];
  sortearEncontroAB(1, 4, 0);
`, contexto);
assert.ok(resultado.criaturas.length > 0);
assert.ok(resultado.criaturas.every(c => c.id !== 'chefe' && c.id !== 'perseguidor'),
  'O sorteio automático deve excluir Chefes e Perseguidores.');
console.log('Bestiário: 22 criaturas comuns e 2 Perseguidores; estrutura de fichas OK');
