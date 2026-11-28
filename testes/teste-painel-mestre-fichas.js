'use strict';

const assert = require('assert');
const { criarResumoFichasMestre } = require('../servidor/painel-mestre-fichas');

const fichas = {
  mesaA: {
    ativa: {
      id: 'ativa', usuario: 'Ana', estado: 'ativa', dados: {
        nome: 'Claire', conceito: 'Sobrevivente', historia: 'SEGREDO',
        nivel: 1, atributos: { FOR: 1 }, habilidades: ['segredo'],
        anotacoes: 'ANOTAÇÃO PRIVADA', jogo: { condicoes: ['cego'] },
      },
    },
    rascunho: { id: 'rascunho', usuario: 'Ana', estado: 'rascunho', dados: { nome: 'Rascunho' } },
    pendente: { id: 'pendente', usuario: 'Ana', estado: 'pendente', dados: { nome: 'Pendente' } },
    ativaBia: { id: 'ativa-bia', usuario: 'Bia', estado: 'ativa', dados: { nome: 'Jill' } },
    exJogador: { id: 'ex', usuario: 'Caio', estado: 'ativa', dados: { nome: 'Ada' } },
  },
};
const calcular = () => ({
  pv: 5, pvMax: 10, pvTemp: 2, sa: 2, saMax: 4, bi: 1, biMax: 3,
  faseBI: { fase: 1 }, defesa: 14, rd: 1, iniciativa: 3, movimento: 9,
  passivos: { percepcao: 15, fortitude: 12, reflexos: 14, vontade: 11 },
});
const painel = criarResumoFichasMestre({
  carregar: () => fichas,
  infoMesa: (id) => id === 'mesaA' ? { mestre: 'Mestre', aprovados: ['Ana', 'Bia'] } : null,
  calcular,
  condicoesCatalogo: [{ id: 'cego', nome: 'Cego' }],
});

assert.equal(painel.listar('mesaA', 'Ana').status, 403, 'Jogador não pode consultar a projeção do Mestre');
assert.equal(painel.listar('inexistente', 'Mestre').status, 404, 'Mesa inexistente deve ser recusada');
const resposta = painel.listar('mesaA', 'Mestre');
assert.equal(resposta.status, 200);
assert.equal(resposta.fichas.length, 2, 'Duas Fichas ativas de Jogadores aprovados devem aparecer');
const resumo = resposta.fichas.find(f => f.jogador === 'Ana');
assert.ok(resumo, 'A Ficha da Ana deve estar presente');
assert.equal(resumo.personagem, 'Claire');
const resumoBia = resposta.fichas.find(f => f.jogador === 'Bia');
assert.ok(resumoBia, 'A Ficha da Bia deve estar presente');
assert.equal(resumoBia.personagem, 'Jill');
assert.ok(!resposta.fichas.some(f => f.jogador === 'Caio'), 'Ficha de usuário não aprovado não pode aparecer');
assert.equal(resumo.jogador, 'Ana');
assert.deepEqual(resumo.pv, { atual: 5, maximo: 10 });
assert.deepEqual(resumo.sa, { atual: 2, maximo: 4 });
assert.deepEqual(resumo.bi, { atual: 1, maximo: 3 });
assert.deepEqual(resumo.periciasPassivas, { percepcao: 15, fortitude: 12, reflexos: 14, vontade: 11 });
assert.ok(!('condicoes' in resumo), 'Condições não são expostas ao Mestre');
assert.deepEqual(Object.keys(resumo).sort(), [
  'bi', 'defesa', 'id', 'iniciativa', 'jogador', 'personagem', 'periciasPassivas', 'pv', 'sa',
].sort());
assert.ok(!JSON.stringify(resumo).includes('SEGREDO'));
assert.ok(!JSON.stringify(resumo).includes('ANOTAÇÃO PRIVADA'));
assert.ok(!JSON.stringify(resumo).includes('atributos'));
assert.ok(!JSON.stringify(resumo).includes('habilidades'));
assert.ok(!JSON.stringify(resumo).includes('condicoes'));
assert.ok(!('nivel' in resumo));
assert.ok(!('movimento' in resumo));
assert.ok(!('reducaoDano' in resumo));
assert.ok(!('temporarios' in resumo.pv));
assert.ok(!('fase' in resumo.bi));
console.log('Projeção operacional das Fichas para o Mestre: OK');
