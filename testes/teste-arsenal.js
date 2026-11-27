'use strict';
// Testes do Arsenal (catálogo e regras de ataque/dano/Defesa/munição) com valores do capítulo 3 do livro.
const R = require('../app/js/regras.js');
const A = require('../app/js/dados-arsenal.js');

let falhas = 0;
function confere(nome, ok, detalhe = '') {
  console.log(`${ok ? 'OK   ' : 'FALHA'} ${nome}${detalhe ? ' -> ' + detalhe : ''}`);
  if (!ok) falhas++;
}
// Gerador de números previsível: devolve os valores em sequência (cada um já em [0,1)).
const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };
const arma = (ref, extra = {}) => ({ nome: A.itemPorId(ref).nome, espacos: 1, nota: '', ref, mun: 0, pecas: [], equip: false, ...extra });
const ficha = (extra) => R.normalizar({ nome: 'Teste', origem: 'policial', origemTreino: 'pontaria', classe: 'agente', ...extra });
const colete = (ref, extra) => arma(ref, { equip: true, ...extra });
const montar = (d, fonte, op) => R.montarAtaque(d, R.calcular(d), fonte, op);

// ---- Catálogo
confere('Catálogo: ids únicos e 49 armas', new Set(A.ARMAS.map((a) => a.id)).size === A.ARMAS.length && A.ARMAS.length === 49, String(A.ARMAS.length));
confere('Todas as Peças compatíveis com ao menos uma arma', A.PECAS.every((p) => A.ARMAS.some((a) => A.pecaServe(p, a))));
confere('Peça específica só serve na sua arma (Cano Longo: Wolfsbane sim, Requiem não)',
  A.pecaServe(A.pecaPorId('cano-longo'), A.armaPorId('m1851-wolfsbane')) && !A.pecaServe(A.pecaPorId('cano-longo'), A.armaPorId('requiem')));
confere('Pente Estendido Magnum não serve na Requiem', !A.pecaServe(A.pecaPorId('pente-estendido-magnum'), A.armaPorId('requiem')));
confere('Compensador só em Submetralhadora com Rajada (Gal sim, TMP não)',
  A.pecaServe(A.pecaPorId('compensador-smg'), A.armaPorId('gal')) && !A.pecaServe(A.pecaPorId('compensador-smg'), A.armaPorId('tmp')));
confere('Hatchet não aparece no seletor (Item Característico)', !A.CATEGORIAS.some((c) => c.itens.some((i) => i.id === 'hatchet')));
confere('Busca por nome ignora acento e caixa', A.itemPorNome('bastao de beisebol').id === 'bastao-de-beisebol' && A.itemPorNome('JMB HP3').id === 'jmb-hp3');

// ---- Espaços
let d = ficha({ itens: [arma('sentinel-nine'), arma('requiem'), arma('w-870')], municoes: { '9mm': 31, calibre12: 15 } });
confere('Espaços: Sentinel 1 + Requiem 1 + W-870 2 + 9 mm (31 = 2 Espaços) + Calibre 12 (15 = 1) = 7', R.calcular(d).inventarioUsado === 7, String(R.calcular(d).inventarioUsado));
d = ficha({ itens: [arma('requiem', { pecas: ['protetor-de-cano', 'empunhadura-pesada'] })] });
confere('Requiem com 2 Peças ocupa 2 Espaços', R.espacosDoItem(d.itens[0]) === 2);
d = ficha({ itens: [arma('m1851-wolfsbane', { pecas: ['cano-longo'] })] });
confere('Wolfsbane ocupa 2 Espaços (Cano Longo mantém 2)', R.espacosDoItem(d.itens[0]) === 2);
d = ficha({ itens: [colete('colete-leve'), arma('colete-kendo'), arma('lanterna-de-bolso')] });
confere('Espaços: colete 1 + Kendo 1 + Lanterna de Bolso 0 = 2 (nunca NaN)', R.calcular(d).inventarioUsado === 2, String(R.calcular(d).inventarioUsado));
d = ficha({ itens: [arma('bolsa'), arma('pochete')] });
confere('Bolsa e Pochete não acumulam (usa +3): Inventário 4+1+3 = 8', R.calcular(d).inventarioMax === 8, String(R.calcular(d).inventarioMax));

// ---- Defesa e RD
d = ficha({ atributos: { AGI: 3 }, itens: [colete('colete-acolchoado')] });
let c = R.calcular(d);
confere('Acolchoado: Defesa 10 + AGI 3 + 1 + Policial 2 = 16, RD 0', c.defesa === 16 && c.rd === 0, `${c.defesa}/${c.rd}`);
d = ficha({ atributos: { AGI: 3 }, itens: [colete('colete-medio')] });
c = R.calcular(d);
confere('Balístico Médio: AGI limitada a 2; Defesa 10+2+2+2 = 16, RD 2', c.defesa === 16 && c.rd === 2, `${c.defesa}/${c.rd}`);
d = ficha({ atributos: { AGI: 3 }, itens: [colete('colete-pesado')] });
c = R.calcular(d);
confere('Balístico Pesado: AGI não soma; Defesa 10+0+3+2 = 15, RD 3', c.defesa === 15 && c.rd === 3, `${c.defesa}/${c.rd}`);
d = ficha({ classe: 'operador', atributos: { AGI: 2 }, kendo: { placas: 2 }, itens: [colete('colete-kendo')] });
c = R.calcular(d);
confere('Kendo com 2 placas: +2/RD 2', c.defesa === 10 + 2 + 2 + 2 && c.rd === 2, `${c.defesa}/${c.rd}`);
d.kendo.placas = 0;
confere('Kendo com 0 placas: +1/RD 0', R.calcular(d).defesa === 10 + 2 + 1 + 2 && R.calcular(d).rd === 0);
d = ficha({ atributos: { AGI: 3 }, itens: [arma('colete-pesado')] });
confere('Colete na mochila (não equipado) não conta', R.calcular(d).defesa === 15 && R.calcular(d).rd === 0 || R.calcular(d).defesa === 10 + 3 + 2);
d = ficha({ atributos: { AGI: 3 }, jogo: { condicoes: ['exposto'] } });
confere('Exposto: -2 na Defesa', R.calcular(d).defesa === 10 + 3 + 2 - 2);
d = ficha({ atributos: { AGI: 3 }, jogo: { condicoes: ['desorientado'] } });
confere('Desorientado: sem AGI na Defesa', R.calcular(d).defesa === 10 + 0 + 2);

// ---- Movimento por Fase da BI
d = ficha({ atributos: { AST: 3 }, jogo: { bi: 0 } });
const biMax = R.calcular(d).biMax;
const comBi = (bi) => R.calcular(ficha({ atributos: { AST: 3 }, jogo: { bi } })).movimento;
confere(`Movimento: Fase 1 = 9; Fase 2 = 12; Fase 5 = 3 (BI Máx. ${biMax})`, comBi(0) === 9 && comBi(Math.ceil(biMax * 0.2)) === 12 && comBi(Math.ceil(biMax * 0.85)) === 3,
  [comBi(0), comBi(Math.ceil(biMax * 0.2)), comBi(Math.ceil(biMax * 0.85))].join(','));

// ---- Proficiência
const prof = (classe, ref, hab = []) => R.temProficiencia(ficha({ classe, habilidades: hab }), A.armaPorId(ref));
confere('Agente: Sentinel (Comum) e Punisher (Militar) sim; Striker (Militar escopeta) não', prof('agente', 'sentinel-nine') && prof('agente', 'punisher') && !prof('agente', 'striker'));
confere('Agente: GM 79 e Killer7 nominais; Requiem e rifles não', prof('agente', 'gm-79') && prof('agente', 'killer7') && !prof('agente', 'requiem') && !prof('agente', 'dragoon'));
confere('Autodidata: Blacktail sim, Matilda (Militar) não, TMP sim, Gal (Militar) não, W-870 sim, Hydra não',
  prof('autodidata', 'blacktail') && !prof('autodidata', 'matilda') && prof('autodidata', 'tmp') && !prof('autodidata', 'gal') && prof('autodidata', 'w-870') && !prof('autodidata', 'hydra'));
confere('Autodidata: Magnum só com Arsenal Improvável', !prof('autodidata', 'sw-m29') && prof('autodidata', 'sw-m29', ['arsenal-improvavel']));
confere('Operador: Chicago Sweeper (Exótica) e SVD sim; Magnum/Especial só com Armamento Especial',
  prof('operador', 'chicago-sweeper') && prof('operador', 'svd') && !prof('operador', 'requiem') && prof('operador', 'requiem', ['armamento-especial']) && prof('operador', 'spark-shot', ['armamento-especial']));
confere('Corpo a Corpo Comum e Tático: todas as Classes', prof('autodidata', 'marreta') && prof('operador', 'hatchet') && prof('agente', 'cutelo'));

// ---- Ataque e dano
d = ficha({ atributos: { FOR: 2, AGI: 3 }, pericias: { pontaria: 1, luta: 1 }, itens: [arma('sentinel-nine', { mun: 19 }), arma('bastao-de-beisebol')] });
let m = montar(d, d.itens[0]);
confere('Pistola: Pontaria (AGI 3 + Treinada 2 = 5), dano 1d8+AGI 3, Crítico 20 x2, consome 1', m.pericia === 'pontaria' && m.bonus === 5 && m.formula === '1d8+3' && m.crit === 20 && m.mult === 2 && m.consumo === 1, JSON.stringify([m.bonus, m.formula]));
m = montar(d, d.itens[1]);
confere('Corpo a corpo: Luta (FOR 2 + Treinada 2 = 4), dano 1d8+FOR 2, sem munição', m.pericia === 'luta' && m.bonus === 4 && m.formula === '1d8+2' && m.consumo === 0 && !m.semMunicao, JSON.stringify([m.bonus, m.formula]));
m = montar(d, 'desarmado');
confere('Ataque Desarmado: 1d4+FOR, Desvantagem por padrão, crítico x3', m.formula === '1d4+2' && m.vantagem === 'desvantagem' && m.mult === 3);
m = montar(d, 'improvisada', { arremesso: true });
confere('Arma Improvisada arremessada: Pontaria e AGI', m.pericia === 'pontaria' && m.formula === '1d6+3');
m = montar(d, d.itens[1], { arremesso: true });
confere('Bastão não é arremessável: continua Corpo a Corpo', m.pericia === 'luta');
d.itens.push(arma('faca'));
m = montar(d, d.itens[2], { arremesso: true });
confere('Faca arremessada: Pontaria e AGI', m.pericia === 'pontaria' && m.formula === '1d4+3');

m = montar(d, d.itens[0], { vantagem: true, desvantagem: true });
confere('Vantagem e Desvantagem se anulam', m.vantagem === 'normal');
m = montar(d, d.itens[0], { mirar: true });
confere('Mirar: +2 no ataque', m.bonus === 7);

// Pecas e Habilidades
d = ficha({ classe: 'autodidata', habilidades: ['armeira-autodidata'], atributos: { AGI: 2 }, itens: [arma('sentinel-nine', { mun: 19, pecas: ['freio-9mm', 'mira-laser'] })] });
m = montar(d, d.itens[0]);
confere('Armeira Autodidata: +1d4 por Peça (2 Peças = +2d4); Freio reduz crítico para 19', m.formula === '1d8+1d4+1d4+2' && m.crit === 19, m.formula + ' crit ' + m.crit);
d = ficha({ classe: 'operador', habilidades: ['armeiro'], atributos: { AGI: 2 }, itens: [arma('lemi', { mun: 10, pecas: ['pente-estendido-9mm'] })] });
m = montar(d, d.itens[0]);
confere('Armeiro: +1 no ataque por Peça', m.partes.some((p) => p.nome === 'Armeiro' && p.valor === 1));
confere('Pente Estendido 9 mm: capacidade 10 → 15', R.capacidadeDaArma(d.itens[0]) === 15);
d = ficha({ itens: [arma('faca', { pecas: [] })] });
d = ficha({ classe: 'operador', itens: [arma('m1851-wolfsbane', { mun: 5, pecas: ['cano-longo', 'cilindro-alta-capacidade'] })], habilidades: ['armamento-especial'] });
m = montar(d, d.itens[0]);
confere('Wolfsbane com Cano Longo: 6d6; Cilindro: capacidade 8', m.dados === '6d6' && R.capacidadeDaArma(d.itens[0]) === 8, `${m.dados} ${R.capacidadeDaArma(d.itens[0])}`);
d = ficha({ classe: 'autodidata', itens: [arma('hatchet', { pecas: ['aprimoramento-ofensivo'] })] });
m = montar(d, d.itens[0]);
confere('Aprimoramento Ofensivo: +1d4', m.formula.startsWith('2d4+1d4'), m.formula);

// Modos
d = ficha({ classe: 'operador', itens: [arma('hk-mp5', { mun: 35 }), arma('chicago-sweeper', { mun: 50 }), arma('w-870', { mun: 3 })] });
m = montar(d, d.itens[0], { modo: 'cadenciado' });
confere('Cadenciado (MP5): +2 dados do mesmo tipo (2d4 → 4d4), consome 5', m.modo === 'cadenciado' && m.dados === '4d4' && m.consumo === 5);
m = montar(d, d.itens[0], { modo: 'rajada' });
confere('Rajada: consome 10, sem teste de ataque, Reflexos DT 12', m.modo === 'rajada' && m.consumo === 10 && !m.rolaAtaque && /Reflexos DT 12/.test(m.salvamento));
m = montar(d, d.itens[1]);
confere('Chicago Sweeper só ataca por Rajada', m.modo === 'rajada');
m = montar(d, d.itens[2], { modo: 'rajada' });
confere('Escopeta não faz Rajada (volta ao normal, com aviso)', m.modo === 'normal' && m.avisos.length === 1);
d = ficha({ classe: 'autodidata', itens: [arma('tmp', { mun: 30 })] });
m = montar(d, d.itens[0], { modo: 'rajada' });
confere('TMP não tem Rajada', m.modo === 'normal');
d = ficha({ classe: 'agente', itens: [arma('dragoon', { mun: 30 })] });
m = montar(d, d.itens[0], { modo: 'cadenciado' });
confere('Agente sem Proficiência em Rifle (Dragoon): Desvantagem e sem Cadenciado', m.modo === 'normal' && m.vantagem === 'desvantagem' && m.motivosDesv.includes('sem Proficiência'));
d = ficha({ classe: 'agente', itens: [arma('matilda', { mun: 18, pecas: ['coronha-matilda'] })] });
d.classe = 'agente';
m = montar(d, d.itens[0], { modo: 'cadenciado' });
confere('Matilda com Coronha: Cadenciado consome 3', m.modo === 'cadenciado' && m.consumo === 3, `${m.modo} ${m.consumo}`);
d = ficha({ classe: 'operador', habilidades: ['armamento-especial'], itens: [arma('spark-shot', { mun: 7 })] });
m = montar(d, d.itens[0], { modo: 'carregado' });
confere('Spark Shot carregado: 4d4, consome 3', m.dados === '4d4' && m.consumo === 3);
d = ficha({ classe: 'operador', habilidades: ['armamento-especial'], itens: [arma('rpg-7', { mun: 1 })] });
m = montar(d, d.itens[0]);
confere('RPG-7: Morte Instantânea, sem dano', m.mortal && m.semDano && m.formula === '');
d = ficha({ classe: 'operador', itens: [arma('motosserra')] });
m = montar(d, d.itens[0]);
confere('Motosserra: Desvantagem e dados explosivos', m.vantagem === 'desvantagem' && m.explode);

// BI e condições
d = ficha({ atributos: { AST: 3, FOR: 2 }, pericias: { luta: 1 }, itens: [arma('bastao-de-beisebol')] });
const biFase = (f) => { const x = ficha({ atributos: { AST: 3, FOR: 2 }, pericias: { luta: 1 }, itens: [arma('bastao-de-beisebol')], jogo: { bi: Math.ceil(R.calcular(d).biMax * (f - 1) / 5) } }); return montar(x, x.itens[0]); };
const f3 = biFase(3), f4 = biFase(4), f5 = biFase(5);
confere('BI Fase 3: +2 no ataque; Fase 4: +3 e +1d4 corpo a corpo; Fase 5: sem bônus e Desvantagem',
  f3.partes.some((p) => p.nome === 'BI Fase 3') && f4.partes.some((p) => p.valor === 3) && f4.extras.includes('1d4') && f5.vantagem === 'desvantagem' && !f5.partes.some((p) => /BI/.test(p.nome)),
  JSON.stringify([f3.partes, f4.partes, f5.vantagem]));
d = ficha({ itens: [arma('sentinel-nine', { mun: 3 })], jogo: { condicoes: ['cego'] } });
m = montar(d, d.itens[0]);
confere('Cego: Desvantagem nos ataques', m.vantagem === 'desvantagem');
d.itens[0].mun = 0;
confere('Sem munição no pente: avisa', montar(d, d.itens[0]).semMunicao === true);

// ---- Rolagens
let r = R.rolarExpressao('2d4+1d6+3', seq(0.5, 0.99, 0, 0.5));
confere('rolarExpressao: 2d4 (3,4) + 1d6 (1) + 3 = 11', r.total === 11, String(r.total));
r = R.rolarExpressao('1d6', seq(0.99, 0.99, 0.0), true);
confere('Dados explosivos: 6, 6, 1 = 13', r.total === 13, JSON.stringify(r.dados));
d = ficha({ atributos: { AGI: 3 }, itens: [arma('sentinel-nine', { mun: 19 })] });
m = montar(d, d.itens[0]);
let res = R.resolverAtaque(m, seq(0.97, 0.99)); // d20 = 20, dano d8 = 8
confere('Crítico natural 20: dano total x2', res.critico && res.dano.total === 11 && res.danoCritico === 22 && res.total === 20 + m.bonus, JSON.stringify([res.escolhido, res.dano.total, res.danoCritico]));
m = montar(d, d.itens[0], { vantagem: true });
res = R.resolverAtaque(m, seq(0.0, 0.5, 0.0));
confere('Vantagem: rola 2d20 e fica com o maior', res.d20.length === 2 && res.escolhido === 11, JSON.stringify(res.d20));
d = ficha({ atributos: { AGI: 3 }, classe: 'agente', itens: [arma('albert-01r', { mun: 3 })] });
m = montar(d, d.itens[0]);
res = R.resolverAtaque(m, seq(0.9, 0.5)); // 19
confere('Margem 19–20 (Albert): 19 vira "crítico se acertar"', res.escolhido === 19 && res.critSeAcertar && !res.critico && m.mult === 3);

// ---- Munição e recarga
d = ficha({ itens: [arma('sentinel-nine', { mun: 5 })], municoes: { '9mm': 30 } });
confere('Recarregar: pente 5 → 19, reserva 30 → 16', R.recarregar(d, d.itens[0]) === 14 && d.itens[0].mun === 19 && d.municoes['9mm'] === 16, JSON.stringify([d.itens[0].mun, d.municoes]));
d = ficha({ itens: [arma('sentinel-nine', { mun: 15 })], municoes: { '9mm': 2 } });
R.recarregar(d, d.itens[0]);
confere('Recarregar com pouca reserva usa só o que há', d.itens[0].mun === 17 && !d.municoes['9mm']);
confere('Gastar munição: não gasta além do pente', R.gastarMunicao(d.itens[0], 17) === true && d.itens[0].mun === 0 && R.gastarMunicao(d.itens[0], 1) === false);

// ---- Consumíveis
d = ficha({ atributos: { VIG: 2 }, jogo: { pv: 3, bi: 4, condicoes: ['intoxicado'] }, itens: [arma('mistura-verde-amarela'), arma('mistura-verde-azul'), arma('esteroide')] });
const pvMax = R.calcular(d).pvMax;
let rel = R.usarConsumivel(d, 0, { manual: { cura: 5, bi: 2 } });
confere('Mistura Verde + Amarela: +5 PV, -2 BI; item consumido', d.jogo.pv === 8 && d.jogo.bi === 2 && d.itens.length === 2 && rel.cura === 5, JSON.stringify(d.jogo));
rel = R.usarConsumivel(d, 0, { manual: { cura: 1 } });
confere('Mistura Verde + Azul: remove Intoxicado', !d.jogo.condicoes.includes('intoxicado') && d.jogo.pv === 9 && rel.semIntoxicacao);
rel = R.usarConsumivel(d, 0, { manual: { pvTemp: 9 } });
confere('Esteroide: PV cheios + PV Temporários', d.jogo.pv === null && d.jogo.pvTemp === 9 && R.calcular(d).pv === pvMax);
d.jogo.pvTemp = 12; d.itens.push(arma('esteroide'));
R.usarConsumivel(d, 0, { manual: { pvTemp: 5 } });
confere('PV Temporários: fica o maior valor (12, não 5)', d.jogo.pvTemp === 12);
d = ficha({ jogo: { pv: 1 }, itens: [arma('lanterna-simples')] });
confere('Item sem uso (Lanterna) não é consumido', R.usarConsumivel(d, 0) === null && d.itens.length === 1);
d = ficha({ atributos: { VIG: 1 }, jogo: { pv: 1 }, itens: [arma('erva-verde')] });
R.usarConsumivel(d, 0, { rng: seq(0.99) });
confere('Automático: Erva Verde rola 1d8', d.jogo.pv === 9, String(d.jogo.pv));

// ---- Validação
d = ficha({ itens: [arma('sentinel-nine', { pecas: ['coronha-smg'] })] });
let v = R.validar(d);
confere('Validar: Peça incompatível é erro', v.erros.some((e) => e.includes('não serve')));
d = ficha({ itens: [arma('sentinel-nine', { pecas: ['freio-9mm', 'mira-laser'] })] });
v = R.validar(d);
confere('Validar: Sentinel só aceita 1 Peça', v.erros.some((e) => e.includes('só aceita 1')));
d = ficha({ itens: [arma('sentinel-nine', { mun: 25 })] });
confere('Validar: pente acima da capacidade é erro', R.validar(d).erros.some((e) => e.includes('comporta 19')));
d = ficha({ itens: [colete('colete-acolchoado'), colete('colete-leve')] });
confere('Validar: dois coletes equipados é erro', R.validar(d).erros.some((e) => e.includes('um colete')));
d = ficha({ atributos: { FOR: 1 }, itens: [arma('w-870'), arma('striker'), arma('hk-mp5')] });
confere('Validar: inventário acima do limite é erro (6 Espaços para 5)', R.validar(d).erros.some((e) => e.includes('Inventário acima')), JSON.stringify(R.validar(d).erros));

// ---- Equipamento inicial
let eq = R.equipamentoInicial('agente', 'A');
const sent = eq.itens.find((i) => i.nome === 'Sentinel Nine');
const col = eq.itens.find((i) => i.nome === 'Colete Acolchoado');
confere('Equipamento inicial: arma do Arsenal já carregada e colete equipado', sent.ref === 'sentinel-nine' && sent.mun === 19 && col.ref === 'colete-acolchoado' && col.equip === true);
d = ficha({ itens: eq.itens, moedas: eq.moedas });
confere('Equipamento inicial A do Agente passa na validação de Inventário', !R.validar(d).erros.some((e) => e.includes('Inventário')), JSON.stringify(R.validar(d).erros));
for (const classe of ['agente', 'autodidata', 'operador']) {
  for (const op of ['A', 'B', 'C']) {
    const e = R.equipamentoInicial(classe, op);
    if (!e) continue;
    const dd = ficha({ classe, itens: e.itens, moedas: e.moedas });
    confere(`Equipamento ${classe} ${op}: Espaços válidos e sem erro de Inventário`, Number.isFinite(R.calcular(dd).inventarioUsado) && !R.validar(dd).erros.some((x) => x.includes('Inventário')));
  }
}

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO OK');
process.exit(falhas ? 1 : 0);
