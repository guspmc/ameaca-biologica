'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const codigo = fs.readFileSync(path.join(__dirname, '../app/js/painel-mestre.js'), 'utf8');
const raizPainel = { contains: (el) => el && el.dentroDoPainel === true, scrollIntoView() {} };
const documento = { hidden: false, activeElement: null, addEventListener() {}, getElementById: (id) => id === 'bloco-combate-mestre' ? raizPainel : null };
const contexto = vm.createContext({
  document: documento,
  $: (id) => documento.getElementById(id),
  confirm: () => true,
  estado: { mesaId: 'mesa-teste' },
  setInterval() {},
  renderizarMesa() {},
  carregarMesaAtual() {},
  crypto: { randomUUID: () => 'ficha-combate-id' },
  mensagem() {}
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

// Participantes tardios mantêm a ordem de chegada, mesmo com AGI/iniciativa diferentes.
preparar([
  {id:'a',nome:'Alice',iniciativa:20,agi:3,d20:17,ordem:0,entradaTardia:false},
  {id:'t1',nome:'Tardio 1',iniciativa:0,agi:1,d20:0,ordem:1,entradaTardia:true},
  {id:'t2',nome:'Tardio 2',iniciativa:0,agi:8,d20:0,ordem:2,entradaTardia:true}
], 'a', 3);
vm.runInContext('ordenarCombateMestre()', contexto);
assert.deepEqual(estado().participantes.map(p=>p.id), ['a','t1','t2']);
vm.runInContext("combateMestre.participantes.push({id:'t3',nome:'Tardio 3',iniciativa:0,agi:20,d20:0,ordem:3,entradaTardia:true}); ordenarCombateMestre()", contexto);
assert.deepEqual(estado().participantes.map(p=>p.id), ['a','t1','t2','t3']);
assert.equal(estado().turnoAtual,'a');

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


// Uma Ficha Ativa aprovada pode entrar na iniciativa com nome e AGI calculada.
preparar([], null, 1);
vm.runInContext("adicionarFichaAtivaAoCombate({ id: '0123456789abcdef', personagem: 'Claire', iniciativa: 4 })", contexto);
let combateFicha = estado();
assert.equal(combateFicha.participantes.length, 1);
assert.equal(combateFicha.participantes[0].nome, 'Claire');
assert.equal(combateFicha.participantes[0].tipo, 'personagem');
assert.equal(combateFicha.participantes[0].agi, 4);
assert.equal(combateFicha.participantes[0].bonusIniciativa, 4);
assert.equal(combateFicha.participantes[0].fichaId, '0123456789abcdef');
assert.equal(combateFicha.participantes[0].d20, 0);
assert.equal(combateFicha.participantes[0].entradaTardia, true);
// Não duplica um personagem já adicionado.
vm.runInContext("adicionarFichaAtivaAoCombate({ personagem: 'claire', iniciativa: 4 })", contexto);
assert.equal(estado().participantes.length, 1);
// Não aceita AGI fora dos limites do rastreador.
vm.runInContext("adicionarFichaAtivaAoCombate({ personagem: 'Chris', iniciativa: 99 })", contexto);
assert.equal(estado().participantes.length, 1);

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

assert.equal(vm.runInContext('duracaoInicialCondicao('+JSON.stringify(condicaoPorNome('Colapso Viral'))+')', contexto), '');
assert.equal(vm.runInContext('duracaoInicialCondicao('+JSON.stringify(condicaoPorNome('Cabeça Carmesim'))+')', contexto), '');
assert.equal(vm.runInContext('duracaoInicialCondicao('+JSON.stringify(condicaoPorNome('Infectado Especial'))+')', contexto), '');
assert.equal(vm.runInContext('duracaoInicialCondicao('+JSON.stringify(condicaoPorNome('Corrosão'))+')', contexto), '');
assert.equal(condicaoPorNome('Agarrado').pagina, 81);
assert.equal(condicaoPorNome('Corrosão').pagina, 82);
assert.equal(condicaoPorNome('Queimadura').pagina, 83);
assert.ok(catalogoCondicoes.every(c => Number.isInteger(c.pagina) && c.pagina >= 81 && c.pagina <= 83));



// Avançar o turno não reduz nem encerra automaticamente a duração de condições.
preparar([{
  id: 'a', nome: 'Alice', iniciativa: 20, agi: 3, d20: 17, ordem: 0,
  condicoes: [{ id: 'c1', nome: 'Queimadura', duracao: '1d4 rodadas', observacao: 'Teste no início do turno' }]
}], 'a', 3);
vm.runInContext('avancarTurnoCombate()', contexto);
assert.equal(estado().rodada, 4);
assert.equal(estado().participantes[0].condicoes[0].duracao, '1d4 rodadas');
assert.equal(estado().participantes[0].condicoes[0].observacao, 'Teste no início do turno');


// Perseguidor reduzido a 0 PV: a contagem só avança ao fechar rodadas
// completas após o atordoamento; recupera PV ao chegar seu próximo turno.
preparar([
  {id:'p',nome:'Tirano',tipo:'criatura',perseguidor:true,fase:'perseguicao',pvAtual:0,pvMaximo:80,pvPerseguicaoMaximo:80,rodadasAtordoado:2,aguardandoRetorno:true,rodadaInicioAtordoado:2},
  {id:'a',nome:'Alice',iniciativa:20,agi:3,d20:17,ordem:0}
], 'p', 2);
vm.runInContext('Math.random = () => 0', contexto);
vm.runInContext('avancarTurnoCombate()', contexto);
assert.equal(estado().participantes[0].rodadasAtordoado,2);
assert.equal(estado().turnoAtual,'a');
vm.runInContext('avancarTurnoCombate()', contexto);
assert.equal(estado().rodada,3);
assert.equal(estado().participantes[0].rodadasAtordoado,2);
assert.equal(estado().participantes[0].pvAtual,0);
vm.runInContext('avancarTurnoCombate()', contexto);
assert.equal(estado().turnoAtual,'a');
vm.runInContext('avancarTurnoCombate()', contexto);
assert.equal(estado().rodada,4);
assert.equal(estado().participantes[0].rodadasAtordoado,1);
assert.equal(estado().participantes[0].pvAtual,0);
vm.runInContext('avancarTurnoCombate()', contexto);
assert.equal(estado().turnoAtual,'a');
vm.runInContext('avancarTurnoCombate()', contexto);
assert.equal(estado().rodada,5);
assert.equal(estado().participantes[0].rodadasAtordoado,0);
assert.equal(estado().participantes[0].pvAtual,80);
assert.equal(estado().participantes[0].aguardandoRetorno,false);

console.log('Painel do Mestre: turnos OK');
