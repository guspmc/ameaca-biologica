'use strict';
const assert = require('assert');
const { criarConteudoMestre } = require('../servidor/painel-mestre-conteudo');
let guardado = {};
const modulo = criarConteudoMestre({
  carregar: () => guardado,
  salvar: dados => { guardado = JSON.parse(JSON.stringify(dados)); },
  ehMestre: (usuario, mesa) => usuario === 'Mestre' && mesa === 'mesa-1'
});
assert.equal(modulo.atender('Jogador', 'GET', 'mesa-1').status, 403);
assert.deepEqual(modulo.atender('Mestre', 'GET', 'mesa-1').dados.conteudo.documentos, []);
let r = modulo.atender('Mestre', 'PUT', 'mesa-1', {
  anotacoes: 'Pista: laboratório subterrâneo',
  encontros: [{ id: 'e1', nome: 'Corredor', nivel: 2, jogadores: 4, dificuldade: 'Tenso', pontos: 4, composicao: '4 × Infectado' }],
  documentos: [{ id: 'd1', titulo: 'Relatório', tipo: 'Arquivo', conteudo: 'Projeto T', visivel: true }],
  itens: [{ id: 'i1', nome: 'Cartão', categoria: 'Chave', descricao: 'Acesso restrito', efeito: 'Abre a ala B' }]
});
assert.equal(r.status, 200);
assert.equal(r.dados.conteudo.documentos[0].visivel, true);
assert.equal(r.dados.conteudo.itens[0].nome, 'Cartão');
assert.equal(modulo.atender('Mestre', 'PUT', 'mesa-1', { documentos: Array(61).fill({ titulo: 'x' }) }).status, 400);
modulo.apagar('mesa-1');
assert.equal(modulo.atender('Mestre', 'GET', 'mesa-1').dados.conteudo.itens.length, 0);
console.log('Conteúdo do Painel do Mestre: tudo OK');
