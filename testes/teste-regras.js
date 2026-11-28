'use strict';
// Testes das regras da Ficha (app/js/regras.js) com os exemplos e fórmulas do livro.
const R = require('../app/js/regras.js');
const L = require('../app/js/dados-livro.js');

let falhas = 0;
function confere(nome, ok, detalhe = '') {
  console.log(`${ok ? 'OK   ' : 'FALHA'} ${nome}${detalhe ? ' -> ' + detalhe : ''}`);
  if (!ok) falhas++;
}
const base = (extra) => R.normalizar({ nome: 'Teste', origem: 'policial', origemTreino: 'pontaria', classe: 'agente', ...extra });

// Exemplos do capítulo 2
let c = R.calcular(base({ atributos: { AGI: 2 } }));
confere('Claire: AGI 2 + Pontaria Treinada = Pontaria 4', c.pericias.pontaria === 4, String(c.pericias.pontaria));
c = R.calcular(base({ atributos: { AST: 2 }, pericias: { percepcao: 2 } }));
confere('Jill: AST 2 + Mestre em Percepção = 5; passiva 15', c.pericias.percepcao === 5 && c.passivos.percepcao === 15);

// Fórmulas do "Passo a Passo" e "Toques Finais" para cada Classe (nível 1, VIG 2, AGI 2, AST 2, FOR 1)
const attrs = { FOR: 1, AGI: 2, VIG: 2, AST: 2 };
const esperado = { agente: [12, 8 + 2], autodidata: [10, 10 + 2], operador: [14, 6 + 2] };
for (const [classe, [pv, bi]] of Object.entries(esperado)) {
  c = R.calcular(R.normalizar({ classe, atributos: attrs }));
  confere(`${classe}: PV ${pv}, BI Máxima ${bi}, SA 4, Defesa 12, Inventário 5, Movimento 9`,
    c.pvMax === pv && c.biMax === bi && c.saMax === 4 && c.defesa === 12 && c.inventarioMax === 5 && c.movimento === 9,
    JSON.stringify([c.pvMax, c.biMax, c.saMax, c.defesa, c.inventarioMax, c.movimento]));
}
c = R.calcular(R.normalizar({ classe: 'agente', atributos: { FOR: 1, AGI: 1, VIG: 1, AST: 1 }, nivel: 3 }));
confere('PV por Nível: (10 + VIG) x Nível = 33 no Nível 3', c.pvMax === 33, String(c.pvMax));

// Bônus citados no livro
c = R.calcular(R.normalizar({ classe: 'operador', origem: 'cobaia', habilidades: ['parrudo'] }));
confere('Cobaia (+2 BI) + Parrudo (+5 PV, +3 BI)', c.bonus.bi === 5 && c.bonus.pv === 5 && c.biMax === 6 + 1 + 5 && c.pvMax === 13 + 5, JSON.stringify(c.bonus));
c = R.calcular(R.normalizar({ classe: 'agente', origem: 'policial' }));
confere('Policial: +2 Defesa', c.defesa === 10 + 1 + 2);
c = R.calcular(R.normalizar({ classe: 'agente', origem: 'universitaria' }));
confere('Universitária: +1 SA Máxima', c.saMax === 1 + 1 + 1);
c = R.calcular(R.normalizar({ classe: 'agente', origem: 'mochileiro' }));
confere('Mochileiro: +1 Inventário', c.inventarioMax === 4 + 1 + 1);

// Inventário: itens + Moedas Antigas (até 3 por Espaço)
c = R.calcular(R.normalizar({ classe: 'agente', itens: [{ nome: 'Faca', espacos: 1 }, { nome: 'Erva Verde', espacos: 1 }], moedas: 4 }));
confere('Inventário: 2 itens + 4 Moedas (2 Espaços) = 4', c.inventarioUsado === 4, String(c.inventarioUsado));

// Fases da BI e Vulnerável
c = R.calcular(R.normalizar({ classe: 'agente', atributos: { AST: 2 }, jogo: { bi: 0 } }));
const f = (bi, max) => R.calcular(R.normalizar({ classe: 'operador', atributos: { AST: 4 }, jogo: { bi } })).faseBI;
confere('BI 0/10 = Fase 1; BI 2 = Fase 2; BI 8 = Fase 5; BI 10 = Colapso',
  f(0).fase === 1 && f(2).fase === 2 && f(8).fase === 5 && f(10).colapso === true);
c = R.calcular(R.normalizar({ classe: 'operador', atributos: { VIG: 3 }, jogo: { pv: 3 } }));
confere('Vulnerável com PV <= 1/5 do máximo (3 de 15)', c.vulneravel === true && c.pvMax === 15);
c = R.calcular(R.normalizar({ classe: 'operador', atributos: { VIG: 3 }, jogo: { pv: 4 } }));
confere('Não Vulnerável com 4 de 15', c.vulneravel === false);
c = R.calcular(R.normalizar({ classe: 'operador', jogo: { pv: 0 } }));
confere('0 PV = Desacordado', c.desacordado === true);

// Validação de criação
let v = R.validar(base({ atributos: { FOR: 1, AGI: 3, VIG: 2, AST: 1 }, pericias: { furtividade: 1, reflexos: 1, percepcao: 1, luta: 1 }, habilidades: ['rolamento'] }), { limiteNivel: 1 });
confere('Agente completo e correto: sem erros nem pendências', v.erros.length === 0 && v.pendencias.length === 0, JSON.stringify(v));
v = R.validar(base({ atributos: { FOR: 3, AGI: 3, VIG: 3, AST: 1 } }));
confere('Atributos acima do total: erro', v.erros.some((e) => e.includes('Atributos demais')));
v = R.validar(base({ atributos: { FOR: 4, AGI: 1, VIG: 1, AST: 1 } }));
confere('Atributo 4 na criação: erro (máximo 3)', v.erros.some((e) => e.includes('passar de 3')));
v = R.validar(base({ atributos: { FOR: 0, AGI: 3, VIG: 3, AST: 1 } }));
confere('Reduzir um Atributo a 0 é permitido (3+3+1+0 = 7)', v.erros.length === 0, JSON.stringify(v.erros));
v = R.validar(base({ atributos: { FOR: 0, AGI: 0, VIG: 3, AST: 3 } }));
confere('Dois Atributos em 0: erro', v.erros.some((e) => e.includes('Só um Atributo')));
v = R.validar(base({ atributos: { FOR: 1, AGI: 3, VIG: 2, AST: 1 }, pericias: { furtividade: 2, reflexos: 2, percepcao: 1 } }));
confere('Pontos de Perícia demais: erro (5 > 4)', v.erros.some((e) => e.includes('Pontos de Perícia demais')), JSON.stringify(v.erros));
v = R.validar(base({ atributos: { FOR: 1, AGI: 3, VIG: 2, AST: 1 }, pericias: { medicina: 1, furtividade: 1, reflexos: 1, percepcao: 1 } }));
confere('Perícia fora da lista da Classe: erro (Medicina para Agente)', v.erros.some((e) => e.includes('Medicina')));
v = R.validar(R.normalizar({ nome: 'Leon', origem: 'militar', origemTreino: 'percepcao', classe: 'agente', atributos: { FOR: 1, AGI: 3, VIG: 2, AST: 1 }, pericias: { pontaria: 1, furtividade: 1, reflexos: 1, luta: 1 }, habilidades: ['rolamento'] }));
confere('A outra Perícia da Origem entra na lista (Militar: Pontaria)', v.erros.length === 0 && v.pendencias.length === 0, JSON.stringify(v));

// Habilidades: vagas e pré-requisitos
v = R.validar(base({ nivel: 2, habilidades: ['rolamento', 'anatomia-de-combate'] }));
confere('Nível 2: duas Básicas de ramos diferentes são aceitas', !v.erros.some((e) => e.includes('Habilidades')), JSON.stringify(v.erros));
v = R.validar(base({ nivel: 1, habilidades: ['rolamento', 'anatomia-de-combate'] }));
confere('Nível 1: só 1 Básica (a 2ª é erro)', v.erros.some((e) => e.includes('Básicas demais')));
v = R.validar(base({ nivel: 4, habilidades: ['rolamento', 'anatomia-de-combate', 'finalizacao-a-distancia'] }));
confere('Avançada sem Básica do mesmo ramo: ok quando a Básica existe (Impiedoso)', !v.erros.some((e) => e.includes('exige')));
v = R.validar(base({ nivel: 4, habilidades: ['rolamento', 'nao-vai-escapar', 'finalizacao-a-distancia'] }));
confere('Avançada sem Básica do mesmo ramo: erro', v.erros.some((e) => e.includes('exige uma Habilidade Básica do ramo Impiedoso')));
v = R.validar(base({ habilidades: ['parrudo'] }));
confere('Habilidade de outra Classe: erro', v.erros.some((e) => e.includes('não pertence')));
v = R.validar(base({ nivel: 5, atributos: { FOR: 1, AGI: 3, VIG: 2, AST: 1 } }));
confere('Nível 5 permite +2 Atributos (total 9)', v.pendencias.some((p) => p.includes('faltam 2')), JSON.stringify(v.pendencias));
v = R.validar(base({ nivel: 3 }), { limiteNivel: 2 });
confere('Nível acima do limite da Mesa: erro', v.erros.some((e) => e.includes('até o Nível 2')));
v = R.validar(base({ nivel: 4, habilidades: ['curiosa', 'tentativa-e-erro'], classe: 'autodidata', origemTreino: 'pontaria', treinoExtra: 'pontaria' }));
confere('Tentativa e Erro: Perícia extra igual à da Origem é erro', v.erros.some((e) => e.includes('Tentativa e Erro')));

// Equipamento inicial
const eq = R.equipamentoInicial('agente', 'A');
confere('Equipamento A do Agente: Erva Verde, Lanterna Simples, Sentinel Nine, Colete Acolchoado; 0 moedas', eq.itens.map((i) => i.nome).join() === 'Erva Verde,Lanterna Simples,Sentinel Nine,Colete Acolchoado' && eq.moedas === 0);
confere('Equipamento C: só 3 Moedas Antigas', R.equipamentoInicial('operador', 'C').moedas === 3);

// Limpeza
const sujo = R.normalizar({ nome: 'x'.repeat(500), nivel: 99, atributos: { FOR: 'abc', AGI: 99 }, habilidades: ['nada', 'rolamento', 'rolamento'], itens: [{ nome: '<b>', espacos: -5 }], jogo: { pv: -3, condicoes: ['cego', 'x'] } });
confere('normalizar limita tamanhos, números e ids', sujo.nome.length === 40 && sujo.nivel === 10 && sujo.atributos.FOR === 1 && sujo.atributos.AGI === 5
  && sujo.habilidades.length === 1 && sujo.itens[0].espacos === 0 && sujo.jogo.pv === 0 && sujo.jogo.condicoes.length === 1);
confere('Dados do livro: 3 Classes, 12 Perícias, 17 Origens, 30 Habilidades (10 por Classe)',
  L.CLASSES.length === 3 && L.PERICIAS.length === 12 && L.ORIGENS.length === 17 && L.HABILIDADES.length === 30
  && L.CLASSES.every((cl) => L.HABILIDADES.filter((h) => h.classe === cl.id).length === 10));


// Progressão (capítulo 6) e ganhos por Nível (capítulo 1)
confere('Missões Completadas -> Nível liberado (0:1, 1:2, 3:3, 6:4, 41:9, 42:10)', [0, 1, 3, 6, 41, 42].map(R.nivelPorMissoes).join() === '1,2,3,4,9,10');
const gn = (n) => JSON.stringify(R.ganhosDoNivel(n));
confere('Nível 2: Habilidade Básica; 3: +1 Atributo; 4: Avançada + Ponto de Perícia; 8: Superior + Ponto; 10: Avassaladora',
  gn(2) === '{"atributo":false,"pontoPericia":false,"habilidade":"basica"}' && gn(3) === '{"atributo":true,"pontoPericia":false,"habilidade":null}'
  && gn(4) === '{"atributo":false,"pontoPericia":true,"habilidade":"avancada"}' && gn(8) === '{"atributo":false,"pontoPericia":true,"habilidade":"superior"}'
  && gn(10) === '{"atributo":false,"pontoPericia":false,"habilidade":"avassaladora"}');

// Evolução: nada do Nível anterior se desfaz
const base0 = R.normalizar({ nome: 'E', origem: 'policial', origemTreino: 'pontaria', origemPericias: ['percepcao', 'pontaria'], classe: 'agente', nivel: 1,
  atributos: { FOR: 1, AGI: 3, VIG: 2, AST: 1 }, habilidades: ['rolamento'] });
const foto = R.fotoBase(base0);
const evo = (mut) => { const d = JSON.parse(JSON.stringify(base0)); d.nivel = 2; mut(d); return R.validarEvolucao(d, foto); };
confere('Evolução sem mudanças proibidas: sem erros do guia', evo(() => {}).length === 0);
confere('Evolução: Atributo no Nível 2 é recusado', evo((d) => { d.atributos.FOR = 2; }).some((e) => /Atributo/.test(e)));
confere('Evolução: baixar Atributo é recusado', evo((d) => { d.atributos.AGI = 2; }).some((e) => /diminuir/.test(e)));
confere('Evolução: trocar Origem/Classe é recusado', evo((d) => { d.classe = 'operador'; }).some((e) => /Origem e Classe/.test(e)));
confere('Evolução: perder Habilidade é recusado', evo((d) => { d.habilidades = ['anatomia-de-combate']; }).some((e) => /trocadas/.test(e)));
confere('Evolução: Habilidade Avançada no Nível 2 é recusada (só Básica)', evo((d) => { d.habilidades.push('finalizacao-a-distancia'); }).some((e) => /Básica/.test(e)));
confere('Evolução: Habilidade Básica no Nível 2 é aceita', evo((d) => { d.habilidades.push('anatomia-de-combate'); }).length === 0);
const d3 = JSON.parse(JSON.stringify(base0)); d3.nivel = 3; d3.atributos.FOR = 2;
confere('Nível 3: +1 Atributo é aceito; +2 não', R.validarEvolucao(d3, { ...foto, nivel: 2 }).length === 0 && R.validarEvolucao({ ...d3, atributos: { ...d3.atributos, AST: 2 } }, { ...foto, nivel: 2 }).length === 1);
confere('travarEvolucao devolve Identificação e põe Nível +1', R.travarEvolucao({ ...base0, classe: 'operador', nivel: 9 }, foto).classe === 'agente' && R.travarEvolucao({ ...base0, nivel: 9 }, foto).nivel === 2);

// Inventário em blocos
const dInv = R.normalizar({ atributos: { FOR: 1, AGI: 1, VIG: 1, AST: 1 }, moedas: 4, municoes: { '9mm': 31, 'gm79': 5, 'gm79-acido': 6 },
  itens: [{ ref: 'w-870', nome: 'W-870' }, { ref: 'lanterna-de-bolso', nome: 'Lanterna de Bolso' }] });
const bl = R.blocosInventario(dInv);
confere('Blocos: W-870 = 2 Espaços; Lanterna de Bolso = sem Espaço; 31 de 9 mm = 2; Moedas (4) = 2; GM 79 comum+ácido (11) = 2 (mesma pilha)',
  bl.blocos.find((b) => b.tipo === 'item').espacos === 2 && bl.semEspaco.length === 1 && bl.blocos.find((b) => b.grupo === '9mm').espacos === 2
  && bl.blocos.find((b) => b.tipo === 'moedas').espacos === 2 && bl.blocos.find((b) => b.grupo === 'gm79').espacos === 2 && bl.usados === 8, JSON.stringify(bl));
confere('Espaços usados dos blocos = Espaços usados do cálculo', bl.usados === R.calcular(dInv).inventarioUsado, `${bl.usados} x ${R.calcular(dInv).inventarioUsado}`);

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO OK');
process.exit(falhas ? 1 : 0);
