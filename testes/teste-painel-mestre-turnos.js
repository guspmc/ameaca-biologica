'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const codigo = fs.readFileSync(path.join(__dirname, '../app/js/painel-mestre.js'), 'utf8');
const contexto = vm.createContext({
  document: { hidden: false, addEventListener() {} },
  setInterval() {},
  renderizarMesa() {},
  carregarMesaAtual() {}
});
vm.runInContext(codigo, contexto, { filename: 'painel-mestre.js' });

function preparar(participantes, turnoAtual, rodada = 1) {
  vm.runInContext(`
    combateMestre = {
      mesaId: 'mesa-teste',
      combateAtivo: true,
      rodada: ${rodada},
      turnoAtual: ${JSON.stringify(turnoAtual)},
      participantes: ${JSON.stringify(participantes)}
    };
    salvarCombateMestre = () => {};
  `, contexto);
}

function estado() {
  return JSON.parse(vm.runInContext('JSON.stringify(combateMestre)', contexto));
}

const participantes = [
  { id: 'a', nome: 'Alice', iniciativa: 20, agi: 3, d20: 17, ordem: 0 },
  { id: 'b', nome: 'Bruno', iniciativa: 15, agi: 2, d20: 13, ordem: 1 },
  { id: 'c', nome: 'Clara', iniciativa: 10, agi: 1, d20: 9, ordem: 2 }
];

// Avançar no meio da ordem muda apenas o participante atual.
preparar(participantes, 'a', 2);
vm.runInContext('avancarTurnoCombate()', contexto);
assert.equal(estado().turnoAtual, 'b');
assert.equal(estado().rodada, 2);

// Ao concluir o último participante, volta ao primeiro e incrementa a rodada.
preparar(participantes, 'c', 2);
vm.runInContext('avancarTurnoCombate()', contexto);
assert.equal(estado().turnoAtual, 'a');
assert.equal(estado().rodada, 3);

// Remover o participante atual no meio da ordem seleciona quem vem em seguida.
preparar(participantes, 'b', 4);
vm.runInContext("removerParticipanteCombate('b')", contexto);
assert.equal(estado().turnoAtual, 'c');
assert.deepEqual(estado().participantes.map(p => p.id), ['a', 'c']);
assert.equal(estado().rodada, 4);

// Remover o último participante atual seleciona o participante anterior.
preparar(participantes, 'c', 5);
vm.runInContext("removerParticipanteCombate('c')", contexto);
assert.equal(estado().turnoAtual, 'b');
assert.equal(estado().rodada, 5);

// Remover alguém que não está no turno não altera o turno atual.
preparar(participantes, 'c', 6);
vm.runInContext("removerParticipanteCombate('a')", contexto);
assert.equal(estado().turnoAtual, 'c');
assert.equal(estado().rodada, 6);

// Remover o único participante deixa o combate sem turno atual.
preparar([participantes[0]], 'a', 7);
vm.runInContext("removerParticipanteCombate('a')", contexto);
assert.equal(estado().turnoAtual, null);
assert.equal(estado().participantes.length, 0);

// Avançar sem participantes não altera rodada nem turno.
vm.runInContext('avancarTurnoCombate()', contexto);
assert.equal(estado().rodada, 7);
assert.equal(estado().turnoAtual, null);

console.log('Painel do Mestre: transições de turno e remoção OK');
