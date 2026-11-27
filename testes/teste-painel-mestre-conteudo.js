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
  encontros: [{ id: 'e1', nome: 'Corredor', nivel: 2, jogadores: 4, dificuldade: 'Tenso', pontos: 4, composicao: '2 × Infectado', criaturas: [{ id: 'infectado', quantidade: 2 }] }],
  documentos: [{ id: 'd1', titulo: 'Relatório', tipo: 'Arquivo', conteudo: 'Projeto T', arquivoUrl: 'https://exemplo.test/relatorio.pdf', visivel: true }],
  itens: [{ id: 'i1', nome: 'Cartão', categoria: 'Chave', descricao: 'Acesso restrito', efeito: 'Abre a ala B', imagemUrl: 'https://exemplo.test/cartao.png', visivel: true }, { id: 'i2', nome: 'Chave mestra', visivel: false }]
});
assert.equal(r.status, 200);
assert.equal(r.dados.conteudo.documentos[0].visivel, true);
assert.deepEqual(r.dados.conteudo.encontros[0].criaturas, [{ id: 'infectado', quantidade: 2 }]);
assert.equal(r.dados.conteudo.itens[0].nome, 'Cartão');
assert.equal(modulo.documentosPublicos('mesa-1')[0].titulo, 'Relatório');
assert.equal(modulo.documentosPublicos('mesa-1')[0].conteudo, 'Projeto T');
assert.equal(modulo.publicacoes('mesa-1').itens.length, 1);
assert.equal(modulo.publicacoes('mesa-1').itens[0].nome, 'Cartão');
assert.equal(modulo.publicacoes('mesa-1').itens[0].imagemUrl, 'https://exemplo.test/cartao.png');
assert.equal(modulo.publicacoes('mesa-1').documentos[0].arquivoUrl, 'https://exemplo.test/relatorio.pdf');
assert.equal(modulo.atender('Mestre', 'PUT', 'mesa-1', { itens: [{ nome: 'Item inseguro', imagemUrl: 'javascript:alert(1)', visivel: true }] }).dados.conteudo.itens[0].imagemUrl, '');
assert.equal(modulo.atender('Mestre', 'PUT', 'mesa-1', { documentos: Array(61).fill({ titulo: 'x' }) }).status, 400);
assert.equal(modulo.atender('Mestre', 'PUT', 'mesa-1', { encontros: [{ criaturas: Array(31).fill({ id: 'infectado', quantidade: 1 }) }] }).status, 400);
modulo.apagar('mesa-1');
assert.equal(modulo.atender('Mestre', 'GET', 'mesa-1').dados.conteudo.itens.length, 0);
console.log('Conteúdo do Painel do Mestre: tudo OK');
