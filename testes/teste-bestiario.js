'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
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
console.log('Bestiário: 22 criaturas comuns e 2 Perseguidores; estrutura de fichas OK');
