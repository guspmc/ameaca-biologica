'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const codigo = fs.readFileSync(path.join(__dirname, '../app/js/painel-mestre.js'), 'utf8');
const raizPainel = { contains: (el) => el && el.dentroDoPainel === true };
const documento = { hidden: false, activeElement: null, addEventListener() {}, getElementById: (id) => id === 'bloco-combate-mestre' ? raizPainel : null };
const contexto = vm.createContext({
  document: documento,
  $: (id) => documento.getElementById(id),
  confirm: () => true,
  estado: { mesaId: 'mesa-teste' },
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

// A consulta periódica não pode redesenhar o painel enquanto o Mestre digita ou seleciona um campo.
documento.activeElement = { tagName: 'INPUT', dentroDoPainel: true };
assert.equal(vm.runInContext('painelMestreEmEdicao()', contexto), true);
documento.activeElement = { tagName: 'TEXTAREA', dentroDoPainel: true };
assert.equal(vm.runInContext('painelMestreEmEdicao()', contexto), true);
documento.activeElement = { tagName: 'BUTTON', dentroDoPainel: true };
assert.equal(vm.runInContext('painelMestreEmEdicao()', contexto), false);
documento.activeElement = { tagName: 'INPUT', dentroDoPainel: false };
assert.equal(vm.runInContext('painelMestreEmEdicao()', contexto), false);

preparar(participantes, 'b', 8);
vm.runInContext('combateMestre.versao = 7; salvarCombateMestre = () => {}; novoCombateMestre()', contexto);
assert.equal(estado().versao, 7);
assert.equal(estado().participantes.length, 0);


// O catálogo contém exatamente as 20 condições listadas nas pp. 81–83 do Arquivo do Jogador.
const catalogoCondicoes = JSON.parse(vm.runInContext('JSON.stringify(CONDICOES_OFICIAIS_AB)', contexto));
const nomesCondicoesEsperados = [
  'Agarrado', 'Amedrontado', 'Atordoado', 'Caído', 'Cego',
  'Colapso Viral', 'Corrosão', 'Cabeça Carmesim', 'Desacordado',
  'Desorientado', 'Enfraquecido', 'Exposto', 'Imobilizado',
  'Incapacitado', 'Intoxicado', 'Queimadura', 'Surdo',
  'Surpreendido', 'Vulnerável', 'Infectado Especial'
];
assert.deepEqual(catalogoCondicoes.map(c => c.nome), nomesCondicoesEsperados);
assert.equal(new Set(catalogoCondicoes.map(c => c.nome)).size, 20);
assert.ok(catalogoCondicoes.every(c => c.efeito && c.duracao));

const condicaoPorNome = nome => catalogoCondicoes.find(c => c.nome === nome);
// As referências do livro fazem parte da descrição, não do campo de duração.
// Estas três entradas não trazem duração/remoção própria nas pp. 81–83.
assert.equal(condicaoPorNome('Colapso Viral').efeito,
  'Consequência de atingir a BI Máxima. Ver “Colapso”, Capítulo 5 — Bio-Infecção.');
assert.equal(condicaoPorNome('Cabeça Carmesim').efeito,
  'Transformação posterior de um Zumbi. Ver “Crimson”, Capítulo 5 — Bio-Infecção.');
assert.equal(condicaoPorNome('Infectado Especial').efeito,
  'Transformação causada pela Bio-Infecção. Ver “Infectado”, Capítulo 5 — Bio-Infecção.');
assert.equal(condicaoPorNome('Colapso Viral').duracao, '—');
assert.equal(condicaoPorNome('Cabeça Carmesim').duracao, '—');
assert.equal(condicaoPorNome('Infectado Especial').duracao, '—');
assert.equal(condicaoPorNome('Desacordado').efeito,
  'A personagem fica inconsciente: não realiza Ações ou Reações e não percebe conscientemente o ambiente. Ver “0 PV”, Capítulo 4 — Regras e Combate. Ver “Colapso”, Capítulo 5 — Bio-Infecção.');
assert.equal(condicaoPorNome('Desacordado').duracao,
  'Em 0 PV, segue Testes de Reanimação. Outras fontes determinam como despertar.');


// Avançar o turno não reduz nem encerra automaticamente a duração de condições.
preparar([{
  id: 'a', nome: 'Alice', iniciativa: 20, agi: 3, d20: 17, ordem: 0,
  condicoes: [{ id: 'c1', nome: 'Queimadura', duracao: '1d4 rodadas', observacao: 'Teste no início do turno' }]
}], 'a', 3);
vm.runInContext('avancarTurnoCombate()', contexto);
assert.equal(estado().rodada, 4);
assert.equal(estado().participantes[0].condicoes[0].duracao, '1d4 rodadas');
assert.equal(estado().participantes[0].condicoes[0].observacao, 'Teste no início do turno');

console.log('Painel do Mestre: turnos, remoção, edição e versão OK');
