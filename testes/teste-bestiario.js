'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const catalogo = JSON.parse(fs.readFileSync(path.join(__dirname, '../app/dados/bestiario.json'), 'utf8'));
assert.equal(catalogo.length, 22, 'O catálogo deve conter as 22 criaturas das pp. 28–49 do Arquivo do Mestre.');
const ids = new Set();
const pontos = { Comum: 1, Perigosa: 2, Elite: 4, Chefe: 8 };
for (const criatura of catalogo) {
  assert.ok(criatura.id && !ids.has(criatura.id), 'IDs devem existir e ser únicos.');
  ids.add(criatura.id);
  assert.ok(criatura.nome && criatura.funcao && criatura.tamanho);
  assert.equal(criatura.pontos, pontos[criatura.categoria], 'Pontuação deve corresponder à categoria de ameaça.');
  for (const campo of ['pv','defesa','iniciativa']) assert.ok(Number.isInteger(criatura[campo]), criatura.nome + ': ' + campo);
  for (const campo of ['for','agi','vig','ast']) assert.ok(Number.isInteger(criatura.atributos[campo]));
  for (const campo of ['fortitude','reflexos','vontade','percepcao']) assert.ok(Number.isInteger(criatura.resistencias[campo]));
  assert.ok(criatura.ataques.length > 0 && criatura.tracos.length > 0);
}
assert.ok(catalogo.some(c => c.id === 'nemesis-t-type-forma-final' && c.pv === 220));
assert.ok(catalogo.some(c => c.id === 'infectado' && c.pv === 15));
console.log('Bestiário: 22 criaturas e estrutura de fichas OK');
