'use strict';

const assert = require('assert');
const { criarResumoFichasMestre } = require('../servidor/painel-mestre-fichas');

const fichas = {
  mesaA: {
    ativa: {
      id: 'ativa', usuario: 'Ana', estado: 'ativa', dados: {
        nome: 'Claire', conceito: 'Sobrevivente', historia: 'SEGREDO',
        origem: 'policial', origemTreino: 'pontaria', classe: 'agente', nivel: 1,
        atributos: { FOR: 1, AGI: 3, VIG: 2, AST: 1 },
        pericias: { furtividade: 1, reflexos: 1, percepcao: 1, luta: 1 },
        habilidades: ['rolamento'], equipamentoInicial: 'A',
        anotacoes: 'ANOTAÇÃO PRIVADA',
        jogo: { pv: 5, sa: 2, bi: 1, condicoes: ['cego'] },
      },
    },
    rascunho: { id: 'rascunho', usuario: 'Ana', estado: 'rascunho', dados: { nome: 'Rascunho' } },
    pendente: { id: 'pendente', usuario: 'Ana', estado: 'pendente', dados: { nome: 'Pendente' } },
    exJogador: { id: 'ex', usuario: 'Bia', estado: 'ativa', dados: { nome: 'Ada' } },
  },
};

const painel = criarResumoFichasMestre({
  carregar: () => fichas,
  infoMesa: (id) => id === 'mesaA' ? { mestre: 'Mestre', aprovados: ['Ana'] } : null,
});

const negado = painel.listar('mesaA', 'Ana');
assert.equal(negado.status, 403, 'Jogador não pode consultar a projeção do Mestre');

const inexistente = painel.listar('inexistente', 'Mestre');
assert.equal(inexistente.status, 404, 'Mesa inexistente deve ser recusada');

const resposta = painel.listar('mesaA', 'Mestre');
assert.equal(resposta.status, 200);
assert.equal(resposta.fichas.length, 1, 'Somente Ficha ativa de jogador ainda aprovado');
const resumo = resposta.fichas[0];
assert.equal(resumo.personagem, 'Claire');
assert.equal(resumo.jogador, 'Ana');
assert.equal(resumo.pv.atual, 5);
assert.equal(resumo.sa.atual, 2);
assert.equal(resumo.bi.atual, 1);
assert.deepEqual(resumo.condicoes, [{ id: 'cego', nome: 'Cego' }]);
assert.deepEqual(Object.keys(resumo).sort(), [
  'bi', 'condicoes', 'defesa', 'id', 'iniciativa', 'jogador',
  'movimento', 'nivel', 'personagem', 'pv', 'reducaoDano', 'sa',
].sort());
assert.ok(!JSON.stringify(resumo).includes('SEGREDO'));
assert.ok(!JSON.stringify(resumo).includes('ANOTAÇÃO PRIVADA'));
assert.ok(!JSON.stringify(resumo).includes('atributos'));
assert.ok(!JSON.stringify(resumo).includes('habilidades'));

console.log('Projeção operacional das Fichas para o Mestre: OK');
