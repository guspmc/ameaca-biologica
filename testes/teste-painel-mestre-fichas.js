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
    exJogador: { id: 'ex', usuario: 'Bia', estado: 'ativa', dados: { nome: 'Ada' } },
  },
};
const calcular = () => ({
  pv: 5, pvMax: 10, pvTemp: 2, sa: 2, saMax: 4, bi: 1, biMax: 3,
  faseBI: { fase: 1 }, defesa: 14, rd: 1, iniciativa: 3, movimento: 9,
  passivos: { percepcao: 15, fortitude: 12, reflexos: 14, vontade: 11 },
});
const painel = criarResumoFichasMestre({
  carregar: () => fichas,
  infoMesa: (id) => id === 'mesaA' ? { mestre: 'Mestre', aprovados: ['Ana'] } : null,
  calcular,
  condicoesCatalogo: [{ id: 'cego', nome: 'Cego' }],
});

assert.equal(painel.listar('mesaA', 'Ana').status, 403, 'Jogador não pode consultar a projeção do Mestre');
assert.equal(painel.listar('inexistente', 'Mestre').status, 404, 'Mesa inexistente deve ser recusada');
const resposta = painel.listar('mesaA', 'Mestre');
assert.equal(resposta.status, 200);
assert.equal(resposta.fichas.length, 1, 'Somente Ficha ativa de jogador ainda aprovado');
const resumo = resposta.fichas[0];
assert.equal(resumo.personagem, 'Claire');
assert.equal(resumo.jogador, 'Ana');
assert.deepEqual(resumo.pv, { atual: 5, maximo: 10, temporarios: 2 });
assert.deepEqual(resumo.sa, { atual: 2, maximo: 4 });
assert.deepEqual(resumo.bi, { atual: 1, maximo: 3, fase: 1 });
assert.deepEqual(resumo.periciasPassivas, { percepcao: 15, fortitude: 12, reflexos: 14, vontade: 11 });
assert.deepEqual(resumo.condicoes, [{ id: 'cego', nome: 'Cego' }]);
assert.deepEqual(Object.keys(resumo).sort(), [
  'bi', 'condicoes', 'defesa', 'id', 'iniciativa', 'jogador',
  'movimento', 'nivel', 'personagem', 'periciasPassivas', 'pv', 'reducaoDano', 'sa',
].sort());
assert.ok(!JSON.stringify(resumo).includes('SEGREDO'));
assert.ok(!JSON.stringify(resumo).includes('ANOTAÇÃO PRIVADA'));
assert.ok(!JSON.stringify(resumo).includes('atributos'));
assert.ok(!JSON.stringify(resumo).includes('habilidades'));
console.log('Projeção operacional das Fichas para o Mestre: OK');
