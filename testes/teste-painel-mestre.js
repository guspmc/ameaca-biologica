'use strict';
const {criarPainelMestre}=require('../servidor/painel-mestre');
const assert=require('assert');
let guardado={};
const painel=criarPainelMestre({carregar:()=>guardado,salvar:d=>{guardado=JSON.parse(JSON.stringify(d));},ehMestre:(u,m)=>u==='Mestre'&&m==='mesa-1'});
let r=painel.atender('Jogador','GET','mesa-1');assert.equal(r.status,403);
r=painel.atender('Mestre','GET','mesa-1');assert.equal(r.status,200);assert.equal(r.dados.combate.rodada,1);
r=painel.atender('Mestre','PUT','mesa-1',{combateAtivo:true,rodada:1,turnoAtual:'p1',participantes:[
{id:'p1',nome:'Alice',tipo:'personagem',agi:3,bonusIniciativa:3,d20:12,condicoes:[{id:'c1',nome:'Exposto',duracao:'até o fim do próximo turno'},{id:'c2',nome:'Exposto',duracao:'1 rodada'}]},
{id:'p2',nome:'Infectado',tipo:'criatura',agi:1,bonusIniciativa:4,d20:12}]});
assert.equal(r.status,200);assert.equal(r.dados.combate.participantes[0].nome,'Infectado');assert.equal(r.dados.combate.participantes[0].iniciativa,16);
assert.equal(r.dados.combate.participantes.find(p=>p.id==='p1').condicoes.length,2);
const onzeCondicoes=Array.from({length:11},(_,i)=>({id:'cond-'+i,nome:'Condição '+i,duracao:'1 rodada',observacao:''}));
r=painel.atender('Mestre','PUT','mesa-1',{combateAtivo:true,rodada:1,turnoAtual:'p1',participantes:[
{id:'p1',nome:'Alice',tipo:'personagem',agi:3,bonusIniciativa:3,d20:12,condicoes:onzeCondicoes}]});
assert.equal(r.status,200);assert.equal(r.dados.combate.participantes[0].condicoes.length,11);
const trintaEUma=Array.from({length:31},(_,i)=>({id:'limite-'+i,nome:'Condição '+i,duracao:'',observacao:''}));
r=painel.atender('Mestre','PUT','mesa-1',{rodada:1,participantes:[
{id:'p1',nome:'Alice',agi:3,bonusIniciativa:3,d20:12,condicoes:trintaEUma}]});
assert.equal(r.status,400);
r=painel.atender('Mestre','PUT','mesa-1',{rodada:0,participantes:[]});assert.equal(r.status,400);
painel.apagar('mesa-1');r=painel.atender('Mestre','GET','mesa-1');assert.equal(r.dados.combate.participantes.length,0);
r=painel.atender('Mestre','PUT','mesa-1',{rodada:1,participantes:[
{id:'x',nome:'A',agi:1,bonusIniciativa:1,d20:20},{id:'y',nome:'a',agi:1,bonusIniciativa:1,d20:19}]});assert.equal(r.status,400);

// Participantes que entram depois do início permanecem no fim da ordem,
// mesmo que tenham iniciativa superior, inclusive após uma nova gravação.
r=painel.atender('Mestre','PUT','mesa-1',{combateAtivo:true,rodada:2,turnoAtual:'p1',participantes:[
{id:'p1',nome:'Alice',tipo:'personagem',agi:1,bonusIniciativa:1,d20:5},
{id:'p2',nome:'Criatura tardia',tipo:'criatura',agi:3,bonusIniciativa:10,d20:20,entradaTardia:true}
]});
assert.equal(r.status,200);
assert.deepEqual(r.dados.combate.participantes.map(p=>p.id),['p1','p2']);
r=painel.atender('Mestre','PUT','mesa-1',{combateAtivo:true,rodada:2,turnoAtual:'p1',participantes:[
{id:'p1',nome:'Alice',tipo:'personagem',agi:1,bonusIniciativa:1,d20:5},
{id:'p2',nome:'Criatura tardia',tipo:'criatura',agi:3,bonusIniciativa:10,d20:20}
]});
assert.equal(r.status,200);
assert.equal(r.dados.combate.participantes[1].entradaTardia,true);
assert.equal(r.dados.combate.participantes[1].iniciativa,30);

// O servidor não aceita turno apontando para participante inexistente.
r=painel.atender('Mestre','PUT','mesa-1',{rodada:2,turnoAtual:'inexistente',participantes:[
{id:'p1',nome:'Alice',agi:1,bonusIniciativa:1,d20:5}
]});
assert.equal(r.status,400);

// Dados de condições são limitados e normalizados no servidor.
r=painel.atender('Mestre','PUT','mesa-1',{rodada:1,participantes:[
{id:'p1',nome:'Alice',agi:1,bonusIniciativa:1,d20:5,condicoes:[
{id:'c1',nome:'  Exposto  ',duracao:'x'.repeat(100),observacao:'y'.repeat(400)}
]}
]});
assert.equal(r.status,200);
const condicao=r.dados.combate.participantes[0].condicoes[0];
assert.equal(condicao.nome,'Exposto');
assert.equal(condicao.duracao.length,80);
assert.equal(condicao.observacao.length,300);

console.log('Painel do Mestre: tudo OK');
