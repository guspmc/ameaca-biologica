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

// Personagens não podem enviar bônus de Iniciativa diferente da AGI.
r=painel.atender('Mestre','PUT','mesa-1',{rodada:1,participantes:[
{id:'p1',nome:'Alice',tipo:'personagem',agi:3,bonusIniciativa:4,d20:12}
]});
assert.equal(r.status,400);
assert.match(r.dados.erro,/bônus de Iniciativa deve ser igual à AGI/);
// Referência da Ficha Ativa fica vinculada ao participante, sem expor o conteúdo da Ficha.
r=painel.atender('Mestre','PUT','mesa-1',{rodada:1,participantes:[
  {id:'p-ficha',nome:'Claire',tipo:'personagem',agi:4,bonusIniciativa:4,d20:0,fichaId:'0123456789abcdef'}
]});
assert.equal(r.status,200);
assert.equal(r.dados.combate.participantes[0].fichaId,'0123456789abcdef');
r=painel.atender('Mestre','PUT','mesa-1',{rodada:1,participantes:[
  {id:'p-ficha',nome:'Claire',tipo:'personagem',agi:4,bonusIniciativa:4,d20:0,fichaId:'id-invalido'}
]});
assert.equal(r.status,400);
assert.match(r.dados.erro,/Referência da Ficha/);

// Criaturas continuam podendo informar o bônus indicado em sua ficha.
r=painel.atender('Mestre','PUT','mesa-1',{rodada:1,participantes:[
{id:'c1',nome:'Infectado',tipo:'criatura',agi:1,bonusIniciativa:4,d20:12}
]});
assert.equal(r.status,200);
assert.equal(r.dados.combate.participantes[0].iniciativa,16);
// Criaturas selecionadas no Bestiário mantêm referência e valores de ficha,
// permitindo acompanhar PV sem alterar a ficha-base do catálogo.
r=painel.atender('Mestre','PUT','mesa-1',{rodada:1,participantes:[
{id:'b1',nome:'Cerberus',tipo:'criatura',agi:4,bonusIniciativa:4,d20:10,criaturaId:'cerberus',pvAtual:8,pvMaximo:12,defesa:14,movimento:'15 m'}
]});
assert.equal(r.status,200);
assert.equal(r.dados.combate.participantes[0].criaturaId,'cerberus');
assert.equal(r.dados.combate.participantes[0].pvAtual,8);
assert.equal(r.dados.combate.participantes[0].pvMaximo,12);
r=painel.atender('Mestre','PUT','mesa-1',{rodada:1,participantes:[
{id:'b1',nome:'Tirano perseguidor',tipo:'criatura',agi:1,bonusIniciativa:1,d20:10,criaturaId:'tirano-t103-perseguidor',pvAtual:80,pvMaximo:80,defesa:18,movimento:'9 m',perseguidor:true,fase:'perseguicao',pvPerseguicaoMaximo:80,pvCombateMaximo:135}
]});
assert.equal(r.status,200);
assert.equal(r.dados.combate.participantes[0].fase,'perseguicao');
assert.equal(r.dados.combate.participantes[0].pvCombateMaximo,135);
assert.equal(r.dados.combate.participantes[0].proximidadePerseguidor,5);
r=painel.atender('Mestre','PUT','mesa-1',{rodada:1,participantes:[
{id:'b1',nome:'Tirano perseguidor',tipo:'criatura',agi:1,bonusIniciativa:1,d20:10,criaturaId:'tirano-t103-perseguidor',pvAtual:80,pvMaximo:80,defesa:18,movimento:'9 m',perseguidor:true,fase:'perseguicao',pvPerseguicaoMaximo:80,pvCombateMaximo:135,proximidadePerseguidor:9}
]});
assert.equal(r.status,200);assert.equal(r.dados.combate.participantes[0].proximidadePerseguidor,9);
r=painel.atender('Mestre','PUT','mesa-1',{rodada:1,participantes:[
{id:'b1',nome:'Tirano perseguidor',tipo:'criatura',agi:1,bonusIniciativa:1,d20:10,criaturaId:'tirano-t103-perseguidor',pvAtual:80,pvMaximo:80,defesa:18,movimento:'9 m',perseguidor:true,fase:'perseguicao',pvPerseguicaoMaximo:80,pvCombateMaximo:135,proximidadePerseguidor:11}
]});
assert.equal(r.status,400);
r=painel.atender('Mestre','PUT','mesa-1',{rodada:1,participantes:[
{id:'b1',nome:'Cerberus',tipo:'criatura',agi:4,bonusIniciativa:4,d20:10,criaturaId:'cerberus',pvAtual:0,pvMaximo:12,defesa:14,movimento:'15 m'}
]});
assert.equal(r.status,200);
assert.equal(r.dados.combate.participantes[0].pvAtual,0);
r=painel.atender('Mestre','PUT','mesa-1',{rodada:1,participantes:[
{id:'b1',nome:'Cerberus',tipo:'criatura',agi:4,bonusIniciativa:4,d20:10,criaturaId:'cerberus',pvAtual:13,pvMaximo:12,defesa:14,movimento:'15 m'}
]});
assert.equal(r.status,400);


// Controle otimista de versão: uma segunda sessão não pode sobrescrever
// uma gravação feita depois da versão que ela carregou.
r=painel.atender('Mestre','GET','mesa-1');
const versaoA=r.dados.combate.versao;
const gravacaoA={versao:versaoA,rodada:3,turnoAtual:null,participantes:[]};
r=painel.atender('Mestre','PUT','mesa-1',gravacaoA);
assert.equal(r.status,200);
assert.equal(r.dados.combate.versao,versaoA+1);
const gravacaoObsoleta={versao:versaoA,rodada:8,turnoAtual:null,participantes:[]};
r=painel.atender('Mestre','PUT','mesa-1',gravacaoObsoleta);
assert.equal(r.status,409);
assert.equal(r.dados.versaoAtual,versaoA+1);
assert.equal(painel.atender('Mestre','GET','mesa-1').dados.combate.rodada,3);
// A versão também avança em gravações sucessivas da mesma sessão.
r=painel.atender('Mestre','PUT','mesa-1',{versao:versaoA+1,rodada:4,turnoAtual:null,participantes:[]});
assert.equal(r.status,200);
assert.equal(r.dados.combate.versao,versaoA+2);


// Atordoamento dos Perseguidores: 1d4 rodadas, imunidade a dano no período
// e recuperação integral quando voltam a agir.
r=painel.atender('Mestre','PUT','mesa-1',{rodada:2,participantes:[
{id:'perseguidor',nome:'Tirano',tipo:'criatura',agi:1,bonusIniciativa:1,d20:10,criaturaId:'tirano-t103-perseguidor',pvAtual:0,pvMaximo:80,defesa:18,movimento:'9 m',perseguidor:true,fase:'perseguicao',pvPerseguicaoMaximo:80,pvCombateMaximo:135,proximidadePerseguidor:5,rodadasAtordoado:2,aguardandoRetorno:true,rodadaInicioAtordoado:2}
]});
assert.equal(r.status,200);
assert.equal(r.dados.combate.participantes[0].rodadasAtordoado,2);
assert.equal(r.dados.combate.participantes[0].aguardandoRetorno,true);
r=painel.atender('Mestre','PUT','mesa-1',{rodada:2,participantes:[
{id:'perseguidor',nome:'Tirano',tipo:'criatura',agi:1,bonusIniciativa:1,d20:10,criaturaId:'tirano-t103-perseguidor',pvAtual:0,pvMaximo:80,defesa:18,movimento:'9 m',perseguidor:true,fase:'perseguicao',pvPerseguicaoMaximo:80,pvCombateMaximo:135,proximidadePerseguidor:5,rodadasAtordoado:5,aguardandoRetorno:true,rodadaInicioAtordoado:2}
]});
assert.equal(r.status,400);

// O servidor preserva a ordem de chegada dos participantes tardios.
r=painel.atender('Mestre','PUT','mesa-1',{rodada:3,turnoAtual:'a',combateAtivo:true,participantes:[
{id:'a',nome:'Alice',tipo:'personagem',agi:3,bonusIniciativa:3,d20:17,iniciativa:20,ordem:0},
{id:'t1',nome:'Tardio 1',tipo:'personagem',agi:1,bonusIniciativa:1,d20:0,iniciativa:0,ordem:1,entradaTardia:true},
{id:'t2',nome:'Tardio 2',tipo:'personagem',agi:8,bonusIniciativa:8,d20:0,iniciativa:0,ordem:2,entradaTardia:true}
]});
assert.equal(r.status,200);
assert.deepEqual(r.dados.combate.participantes.map(p=>p.id),['a','t1','t2']);

console.log('Painel do Mestre: tudo OK');
