'use strict';
const {criarPainelMestre}=require('../servidor/painel-mestre');
const assert=require('assert');
let guardado={};
const painel=criarPainelMestre({carregar:()=>guardado,salvar:d=>{guardado=JSON.parse(JSON.stringify(d));},ehMestre:(u,m)=>u==='Mestre'&&m==='mesa-1'});
let r=painel.atender('Jogador','GET','mesa-1');assert.equal(r.status,403);
r=painel.atender('Mestre','GET','mesa-1');assert.equal(r.status,200);assert.equal(r.dados.combate.rodada,1);
r=painel.atender('Mestre','PUT','mesa-1',{combateAtivo:true,rodada:1,turnoAtual:'p1',participantes:[
{id:'p1',nome:'Alice',tipo:'personagem',agi:3,bonusIniciativa:3,d20:12},
{id:'p2',nome:'Infectado',tipo:'criatura',agi:1,bonusIniciativa:4,d20:12}]});
assert.equal(r.status,200);assert.equal(r.dados.combate.participantes[0].nome,'Infectado');assert.equal(r.dados.combate.participantes[0].iniciativa,16);
r=painel.atender('Mestre','PUT','mesa-1',{rodada:0,participantes:[]});assert.equal(r.status,400);
r=painel.atender('Mestre','PUT','mesa-1',{rodada:1,participantes:[
{id:'x',nome:'A',agi:1,bonusIniciativa:1,d20:20},{id:'y',nome:'a',agi:1,bonusIniciativa:1,d20:19}]});assert.equal(r.status,400);
console.log('Painel do Mestre: tudo OK');
