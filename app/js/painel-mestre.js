'use strict';
/* Extensão independente do Painel do Mestre. Regras: Arquivo do Jogador p. 76 e Arquivo do Mestre p. 14. */
const renderizarMesaBase = renderizarMesa;
const carregarMesaAtualBase = carregarMesaAtual;
let combateMestre=null, carregandoCombate=false, salvandoCombate=false;
function apiPainelMestre(metodo='GET',corpo) {
  return buscar(estado.base+'/api/painel-mestre/'+encodeURIComponent(estado.mesaId)+'/combate',{
    method:metodo,headers:{Authorization:'Bearer '+estado.token,...(corpo?{'Content-Type':'application/json'}:{})},
    body:corpo?JSON.stringify(corpo):undefined
  });
}
async function carregarCombateMestre(silencioso=false) {
  if(!estado.mesaId||estado.modo!=='local'||estado.mesaAtual?.papel!=='mestre'||carregandoCombate)return;
  carregandoCombate=true;
  try{const r=await apiPainelMestre();combateMestre=r.combate;desenharCombateMestre();}
  catch(e){if(!silencioso)mensagem($('aviso-mesa'),e.message,'erro');}
  finally{carregandoCombate=false;}
}
async function salvarCombateMestre() {
  if(!combateMestre||salvandoCombate)return;
  salvandoCombate=true;
  try{const r=await apiPainelMestre('PUT',combateMestre);combateMestre=r.combate;desenharCombateMestre();}
  catch(e){mensagem($('aviso-mesa'),e.message,'erro');}
  finally{salvandoCombate=false;}
}
function ordenarCombateMestre(){
  combateMestre.participantes.sort((a,b)=>{
    if(a.entradaTardia!==b.entradaTardia)return a.entradaTardia?1:-1;
    return b.iniciativa-a.iniciativa||b.agi-a.agi||b.d20-a.d20||a.ordem-b.ordem;
  });
}
function adicionarParticipanteCombate(ev){
  ev.preventDefault();
  const nome=$('combate-nome').value.trim(),tipo=$('combate-tipo').value,agi=Number($('combate-agi').value),bonus=Number($('combate-bonus').value);
  if(!nome||!Number.isInteger(agi)||agi < -10||agi>30||!Number.isInteger(bonus)||bonus < -10||bonus>30){mensagem($('combate-msg'),'Informe nome, AGI e bônus de Iniciativa válidos.','erro');return;}
  if(combateMestre.participantes.some(p=>p.nome.toLocaleLowerCase('pt-BR')===nome.toLocaleLowerCase('pt-BR'))){mensagem($('combate-msg'),'Já existe um participante com esse nome.','erro');return;}
  combateMestre.participantes.push({id:(crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random()).slice(0,40),nome,tipo,agi,bonusIniciativa:bonus,d20:0,iniciativa:0,entradaTardia:combateMestre.combateAtivo,ordem:combateMestre.participantes.length});
  $('combate-nome').value='';ordenarCombateMestre();salvarCombateMestre();
}
function rolarIniciativasCombate(){
  if(!combateMestre.participantes.length)return;
  for(const p of combateMestre.participantes){p.d20=Math.floor(Math.random()*20)+1;p.iniciativa=p.d20+p.bonusIniciativa;}
  ordenarCombateMestre();combateMestre.turnoAtual=combateMestre.participantes[0]?.id||null;combateMestre.combateAtivo=true;combateMestre.rodada=1;salvarCombateMestre();
}
function ajustarD20Combate(id,valor){
  const p=combateMestre.participantes.find(x=>x.id===id),n=Number(valor);
  if(!p||!Number.isInteger(n)||n<1||n>20)return;
  p.d20=n;p.iniciativa=n+p.bonusIniciativa;ordenarCombateMestre();salvarCombateMestre();
}
function avancarTurnoCombate(){
  const lista=combateMestre.participantes;if(!lista.length)return;
  const i=lista.findIndex(p=>p.id===combateMestre.turnoAtual);
  if(i<0||i===lista.length-1){combateMestre.rodada++;combateMestre.turnoAtual=lista[0].id;}
  else combateMestre.turnoAtual=lista[i+1].id;
  salvarCombateMestre();
}
function removerParticipanteCombate(id){
  const i=combateMestre.participantes.findIndex(p=>p.id===id);if(i<0)return;
  const eraAtual=combateMestre.turnoAtual===id;combateMestre.participantes.splice(i,1);
  if(eraAtual)combateMestre.turnoAtual=combateMestre.participantes[Math.min(i,combateMestre.participantes.length-1)]?.id||null;
  salvarCombateMestre();
}
function novoCombateMestre(){
  if(!confirm('Iniciar novo combate? A ordem e a rodada atuais serão reiniciadas.'))return;
  combateMestre={mesaId:estado.mesaId,combateAtivo:false,rodada:1,turnoAtual:null,participantes:[]};salvarCombateMestre();
}
function empateIniciativaMestre(){
  const a=combateMestre.participantes;
  return a.some((p,i)=>i>0&&!p.entradaTardia&&!a[i-1].entradaTardia&&p.iniciativa===a[i-1].iniciativa&&p.agi===a[i-1].agi&&p.d20===a[i-1].d20);
}
function desenharCombateMestre(){
  const raiz=$('bloco-combate-mestre');if(!raiz||!combateMestre)return;
  const lista=$('combate-lista');lista.replaceChildren();
  for(const p of combateMestre.participantes){
    const li=document.createElement('li');li.className='combate-participante'+(p.id===combateMestre.turnoAtual?' turno-atual':'')+(p.entradaTardia?' entrada-tardia':'');
    const identidade=document.createElement('div');identidade.className='combate-identidade';
    const nome=document.createElement('strong');nome.textContent=p.nome;
    const tipo=document.createElement('span');tipo.className='dica';tipo.textContent=(p.tipo==='criatura'?'Criatura':'Personagem')+(p.entradaTardia?' · entrou após o início':'');
    identidade.append(nome,tipo);
    const dados=document.createElement('div');dados.className='combate-dados';
    const total=document.createElement('strong');total.textContent=p.d20?String(p.iniciativa):'—';
    const detalhe=document.createElement('span');detalhe.className='dica';detalhe.textContent=p.d20?'d20 '+p.d20+' + '+p.bonusIniciativa:'AGI '+p.agi+' · bônus '+p.bonusIniciativa;
    dados.append(total,detalhe);
    const d20=document.createElement('input');d20.type='number';d20.min='1';d20.max='20';d20.value=p.d20||'';d20.placeholder='d20';d20.setAttribute('aria-label','Resultado natural do d20 de '+p.nome);d20.addEventListener('change',()=>ajustarD20Combate(p.id,d20.value));
    const remover=document.createElement('button');remover.type='button';remover.className='botao pequeno perigo';remover.textContent='Remover';remover.addEventListener('click',()=>removerParticipanteCombate(p.id));
    li.append(identidade,dados,d20,remover);lista.append(li);
  }
  $('combate-rodada').textContent=String(combateMestre.rodada);
  $('combate-status').textContent=combateMestre.combateAtivo?'Combate em andamento':'Preparação';
  $('combate-avancar').disabled=!combateMestre.combateAtivo||!combateMestre.participantes.length;
  $('combate-empate').hidden=!empateIniciativaMestre();
  $('combate-vazio').hidden=combateMestre.participantes.length>0;
  raiz.hidden=false;
}
function montarPainelCombateMestre(){
  const raiz=$('conteudo-mesa');
  if(!$('bloco-combate-mestre')&&estado.mesaAtual?.papel==='mestre'){
    const card=document.createElement('section');card.className='cartao painel-combate';card.id='bloco-combate-mestre';
    const h=document.createElement('h2');h.textContent='Combate e iniciativa';
    const resumo=document.createElement('div');resumo.className='combate-resumo';
    const status=document.createElement('strong');status.id='combate-status';status.textContent='Preparação';
    const rodada=document.createElement('span');rodada.className='combate-rodada';rodada.append('Rodada ');
    const numero=document.createElement('strong');numero.id='combate-rodada';numero.textContent='1';rodada.append(numero);resumo.append(status,rodada);
    const ajuda=document.createElement('p');ajuda.className='dica';ajuda.textContent='Personagens: 1d20 + AGI. Criaturas: 1d20 + Iniciativa da ficha. Empates: AGI, depois resultado natural; persistindo, role novamente.';
    const empate=document.createElement('p');empate.id='combate-empate';empate.className='mensagem aviso';empate.hidden=true;empate.textContent='Empate persistente: os participantes empatados devem rolar novamente.';
    const form=document.createElement('form');form.id='combate-form';form.className='combate-form';form.addEventListener('submit',adicionarParticipanteCombate);
    function campo(rotulo,id,tipo,valor){const l=document.createElement('label');l.textContent=rotulo;const e=document.createElement(tipo);e.id=id;if(tipo==='input'){e.type='number';e.min='-10';e.max='30';e.value=valor;e.required=true;}return [l,e];}
    const ln=document.createElement('label');ln.textContent='Participante';const nome=document.createElement('input');nome.id='combate-nome';nome.required=true;nome.maxLength=40;nome.placeholder='Nome';
    const lt=document.createElement('label');lt.textContent='Tipo';const tipo=document.createElement('select');tipo.id='combate-tipo';
    for(const x of [['personagem','Personagem'],['criatura','Criatura']]){const o=document.createElement('option');o.value=x[0];o.textContent=x[1];tipo.append(o);}
    const [la,agi]=campo('AGI (desempate)','combate-agi','input','0');const [lb,bonus]=campo('Bônus de Iniciativa','combate-bonus','input','0');
    agi.addEventListener('change',()=>{if(tipo.value==='personagem')bonus.value=agi.value;});
    tipo.addEventListener('change',()=>{if(tipo.value==='personagem')bonus.value=agi.value;});
    const add=document.createElement('button');add.type='submit';add.className='botao primario';add.textContent='Adicionar';form.append(ln,nome,lt,tipo,la,agi,lb,bonus,add);
    const acoes=document.createElement('div');acoes.className='linha combate-acoes';
    function acao(texto,classe,fn,id){const b=document.createElement('button');b.type='button';b.className='botao '+classe;b.textContent=texto;if(id)b.id=id;b.addEventListener('click',fn);return b;}
    acoes.append(acao('Rolar iniciativa','primario',rolarIniciativasCombate),acao('Próximo turno','',avancarTurnoCombate,'combate-avancar'),acao('Novo combate','',novoCombateMestre));
    const vazio=document.createElement('p');vazio.id='combate-vazio';vazio.className='dica';vazio.textContent='Adicione personagens e criaturas para preparar a ordem de iniciativa.';
    const ul=document.createElement('ol');ul.id='combate-lista';ul.className='lista combate-lista';
    card.append(h,resumo,ajuda,empate,form,acoes,vazio,ul);raiz.append(card);
  }
  if(combateMestre)desenharCombateMestre();
}
function renderizarMesa(){renderizarMesaBase();if(estado.tela==='mesa'&&estado.mesaAtual?.papel==='mestre')montarPainelCombateMestre();}
async function carregarMesaAtual(){await carregarMesaAtualBase();if(estado.tela==='mesa'&&estado.mesaAtual?.papel==='mestre')await carregarCombateMestre(true);}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&estado.tela==='mesa'&&estado.mesaAtual?.papel==='mestre')carregarCombateMestre(true);});
setInterval(()=>{if(!document.hidden&&estado.tela==='mesa'&&estado.mesaAtual?.papel==='mestre'&&!salvandoCombate)carregarCombateMestre(true);},4000);
