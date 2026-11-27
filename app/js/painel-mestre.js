'use strict';
/* Extensão independente do Painel do Mestre. Regras: Arquivo do Jogador p. 76 e Arquivo do Mestre p. 14. */
const renderizarMesaBase = renderizarMesa;
const carregarMesaAtualBase = carregarMesaAtual;
let combateMestre=null, carregandoCombate=false, salvandoCombate=false, conflitoCombate=false;
function painelMestreEmEdicao(){
  const raiz=$('bloco-combate-mestre'),ativo=document.activeElement;
  return Boolean(raiz&&ativo&&raiz.contains(ativo)&&['INPUT','TEXTAREA','SELECT'].includes(ativo.tagName));
}
const CONDICOES_OFICIAIS_AB = [
  {nome:'Agarrado',efeito:'Movimento passa a 0 e não pode receber bônus de Movimento. A criatura que agarra pode arrastar o alvo com Movimento pela metade, salvo alvo 2+ categorias menor.',duracao:'Termina se quem agarra ficar Incapacitado, se o alvo sair do alcance por efeito externo ou se o alvo escapar usando sua Ação e Atletismo/Reflexos contra a DT original do Agarrão.'},
  {nome:'Amedrontado',efeito:'Tem Desvantagem em testes aplicáveis enquanto perceber a fonte do medo, tenta se afastar/fugir dela e não pode se aproximar voluntariamente.',duracao:'Conforme a fonte do medo.'},
  {nome:'Atordoado',efeito:'Não pode realizar Ações, Reações ou Movimento. Ataques e Manobras ofensivas resistidas contra o alvo recebem Vantagem.',duracao:'Conforme a fonte; algumas Habilidades usam até o início/fim de turno indicado.'},
  {nome:'Caído',efeito:'Só pode se deslocar Rastejando. Levantar custa metade do Movimento. Seus Ataques têm Desvantagem; Ataques Corpo a Corpo contra você têm Vantagem e Ataques à distância contra você têm Desvantagem. Com Movimento 0, não pode se levantar.',duracao:'Até se levantar ou outro efeito remover.'},
  {nome:'Cego',efeito:'Tem Desvantagem em seus Ataques; Ataques contra ele têm Vantagem; falha automaticamente em testes que dependam exclusivamente de visão.',duracao:'Conforme a fonte.'},
  {nome:'Colapso Viral',efeito:'Consequência de atingir a BI Máxima.',duracao:'Ver “Colapso”, Capítulo 5 — Bio-Infecção.'},
  {nome:'Corrosão',efeito:'A pele e tecidos sofrem ação corrosiva. Causa 1d4 de Dano ao final de cada turno.',duracao:'Se a fonte não definir duração, dura até ser encerrada por um Teste bem-sucedido ou pela duração específica da fonte. No início do turno, faça Fortitude DT 12; em sucesso, a Corrosão termina imediatamente e não causa seu Dano naquele turno. Em falha, ela permanece e causa 1d4 de Dano ao final do turno. Fora de combate, causa Dano uma única vez por exposição, salvo regra específica.'},
  {nome:'Cabeça Carmesim',efeito:'Transformação posterior de um Zumbi.',duracao:'Ver “Crimson”, Capítulo 5 — Bio-Infecção.'},
  {nome:'Desacordado',efeito:'A personagem fica inconsciente: não realiza Ações ou Reações e não percebe conscientemente o ambiente.',duracao:'Em 0 PV, segue Testes de Reanimação. Outras fontes determinam como despertar. Ver “0 PV”, Capítulo 4, e “Colapso”, Capítulo 5 — Bio-Infecção.'},
  {nome:'Desorientado',efeito:'Não pode usar Atacar, tem Desvantagem em Testes de Perícia e perde a contribuição de AGI na Defesa.',duracao:'Conforme a fonte.'},
  {nome:'Enfraquecido',efeito:'Desvantagem em Testes baseados em FOR e em Fortitude.',duracao:'A fonte determina duração e cura.'},
  {nome:'Exposto',efeito:'Sofre -2 na Defesa. Exposto não impõe penalidade em Ataques, Perícias, Reações ou outros valores.',duracao:'Quando causado por Falha Crítica, dura até o final do próximo turno da criatura.'},
  {nome:'Imobilizado',efeito:'Movimento 0; Desvantagem nos próprios Ataques; Ataques contra o alvo têm Vantagem; Desvantagem em Reflexos.',duracao:'Conforme a fonte.'},
  {nome:'Incapacitado',efeito:'Não pode realizar Ações nem Reações.',duracao:'Conforme a fonte.'},
  {nome:'Intoxicado',efeito:'Movimento reduzido em 3 m. Desvantagem em Testes de Ataque e Testes de Perícia. Testes de Atributo permanecem normais.',duracao:'Conforme a fonte.'},
  {nome:'Queimadura',efeito:'O corpo está em chamas. Sofre 1d6 de Dano ao final de cada turno.',duracao:'Se a fonte não definir duração, dura 1d4 rodadas. No início de cada turno, Reflexos DT 12 apaga completamente as chamas em sucesso. Fora de combate, aplica o Dano apenas uma vez.'},
  {nome:'Surdo',efeito:'Falha automaticamente em testes que dependam exclusivamente de audição.',duracao:'Conforme a fonte.'},
  {nome:'Surpreendido',efeito:'No primeiro turno em que estiver Surpreendido, não pode se mover nem realizar Ações. Enquanto estiver Surpreendido, não pode usar Reações nem gastar SA.',duracao:'Normalmente termina ao fim do primeiro turno da própria criatura, salvo efeito específico.'},
  {nome:'Vulnerável',efeito:'Uma criatura fica Vulnerável enquanto seus PV atuais forem iguais ou inferiores a 1/5 dos PV máximos. A condição habilita efeitos específicos, como Morte Instantânea por Finalizar, Pisão ou propriedades de armas; ela não derrota nem mata o alvo por si só.',duracao:'Dura enquanto os PV permanecerem em 1/5 do máximo ou menos, salvo regra específica.'},
  {nome:'Infectado Especial',efeito:'Transformação causada pela Bio-Infecção.',duracao:'Ver “Infectado”, Capítulo 5 — Bio-Infecção.'}
];
function apiPainelMestre(metodo='GET',corpo) {
  return buscar(estado.base+'/api/painel-mestre/'+encodeURIComponent(estado.mesaId)+'/combate',{
    method:metodo,headers:{Authorization:'Bearer '+estado.token,...(corpo?{'Content-Type':'application/json'}:{})},
    body:corpo?JSON.stringify(corpo):undefined
  });
}
async function carregarCombateMestre(silencioso=false,forcar=false) {
  if(!estado.mesaId||estado.modo!=='local'||estado.mesaAtual?.papel!=='mestre'||carregandoCombate||salvandoCombate||(!forcar&&(conflitoCombate||painelMestreEmEdicao())))return;
  carregandoCombate=true;
  try{const r=await apiPainelMestre();combateMestre=r.combate;conflitoCombate=false;desenharCombateMestre();}
  catch(e){if(!silencioso)mensagem($('aviso-mesa'),e.message,'erro');}
  finally{carregandoCombate=false;}
}
let salvarCombatePendente=false;
async function salvarCombateMestre() {
  if(!combateMestre)return;
  if(salvandoCombate){salvarCombatePendente=true;return;}
  salvandoCombate=true;
  let erro=null;
  try{
    do{
      salvarCombatePendente=false;
      const copia=JSON.parse(JSON.stringify(combateMestre));
      const r=await apiPainelMestre('PUT',copia);
      if(!salvarCombatePendente)combateMestre=r.combate;
    }while(salvarCombatePendente);
  }catch(e){erro=e;if(e.status===409)conflitoCombate=true;}
  finally{
    salvandoCombate=false;
    desenharCombateMestre();
    if(erro)mensagem($('aviso-mesa'),erro.message,'erro');
  }
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
  combateMestre={mesaId:estado.mesaId,versao:Number(combateMestre.versao)||0,combateAtivo:false,rodada:1,turnoAtual:null,participantes:[]};salvarCombateMestre();
}
function empateIniciativaMestre(){
  const a=combateMestre.participantes;
  return a.some((p,i)=>i>0&&p.d20>0&&a[i-1].d20>0&&!p.entradaTardia&&!a[i-1].entradaTardia&&p.iniciativa===a[i-1].iniciativa&&p.agi===a[i-1].agi&&p.d20===a[i-1].d20);
}
function rerrolarEmpatesIniciativaMestre(){
  const lista=combateMestre.participantes,empatados=new Set();
  for(let i=1;i<lista.length;i++){
    const atual=lista[i],anterior=lista[i-1];
    if(atual.d20>0&&anterior.d20>0&&!atual.entradaTardia&&!anterior.entradaTardia&&atual.iniciativa===anterior.iniciativa&&atual.agi===anterior.agi&&atual.d20===anterior.d20){
      empatados.add(atual.id);empatados.add(anterior.id);
    }
  }
  if(!empatados.size)return;
  for(const p of lista){
    if(empatados.has(p.id)){p.d20=Math.floor(Math.random()*20)+1;p.iniciativa=p.d20+p.bonusIniciativa;}
  }
  ordenarCombateMestre();salvarCombateMestre();
}
function adicionarCondicaoCombate(id){
  const p=combateMestre.participantes.find(x=>x.id===id);if(!p)return;
  const select=$('condicao-selecao-'+id),manualInput=$('condicao-manual-'+id);
  const nome=select?.value==='__manual__'?manualInput?.value.trim():select?.value;
  if(!nome){mensagem($('aviso-mesa'),'Selecione uma condição ou informe o nome personalizado.','erro');return;}
  const duracao=$('condicao-duracao-'+id)?.value.trim()||'Conforme a fonte';
  const observacao=$('condicao-observacao-'+id)?.value.trim()||'';
  p.condicoes=p.condicoes||[];
  if(p.condicoes.some(x=>x.nome.toLocaleLowerCase('pt-BR')===nome.toLocaleLowerCase('pt-BR'))){
    alert('Os efeitos mecânicos da mesma condição não se acumulam; esta nova instância terá sua duração acompanhada separadamente.');
  }
  p.condicoes.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),nome,duracao,observacao});
  salvarCombateMestre();
}
function removerCondicaoCombate(id,condicaoId){
  const p=combateMestre.participantes.find(x=>x.id===id);if(!p)return;
  p.condicoes=(p.condicoes||[]).filter(x=>x.id!==condicaoId);salvarCombateMestre();
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
    li.append(identidade,dados,d20,remover);
    const condicoes=document.createElement('div');condicoes.className='combate-condicoes';
    for(const condicao of (p.condicoes||[])){
      const tag=document.createElement('div');tag.className='condicao-combate';
      const texto=document.createElement('span');texto.textContent=condicao.nome+' · '+(condicao.duracao||'duração não definida')+(condicao.observacao?' · '+condicao.observacao:'');
      const editar=document.createElement('button');editar.type='button';editar.className='botao pequeno';editar.textContent='Editar';editar.setAttribute('aria-label','Editar duração e observação de '+condicao.nome);
      const excluir=document.createElement('button');excluir.type='button';excluir.className='botao pequeno';excluir.textContent='×';excluir.setAttribute('aria-label','Remover condição '+condicao.nome);
      const editorEdicao=document.createElement('div');editorEdicao.className='condicao-edicao';editorEdicao.hidden=true;
      const duracaoEdicao=document.createElement('input');duracaoEdicao.type='text';duracaoEdicao.maxLength=80;duracaoEdicao.value=condicao.duracao||'';duracaoEdicao.setAttribute('aria-label','Duração ou término de '+condicao.nome);
      const observacaoEdicao=document.createElement('textarea');observacaoEdicao.rows=2;observacaoEdicao.maxLength=300;observacaoEdicao.value=condicao.observacao||'';observacaoEdicao.setAttribute('aria-label','Observação de '+condicao.nome);
      const salvarEdicao=document.createElement('button');salvarEdicao.type='button';salvarEdicao.className='botao pequeno primario';salvarEdicao.textContent='Salvar';
      const cancelarEdicao=document.createElement('button');cancelarEdicao.type='button';cancelarEdicao.className='botao pequeno';cancelarEdicao.textContent='Cancelar';
      editar.addEventListener('click',()=>{editorEdicao.hidden=!editorEdicao.hidden;if(!editorEdicao.hidden)duracaoEdicao.focus();});
      salvarEdicao.addEventListener('click',()=>{condicao.duracao=duracaoEdicao.value.trim()||'Conforme a fonte';condicao.observacao=observacaoEdicao.value.trim();salvarCombateMestre();});
      cancelarEdicao.addEventListener('click',()=>{editorEdicao.hidden=true;});
      excluir.addEventListener('click',()=>removerCondicaoCombate(p.id,condicao.id));
      editorEdicao.append(duracaoEdicao,observacaoEdicao,salvarEdicao,cancelarEdicao);
      tag.append(texto,editar,excluir,editorEdicao);condicoes.append(tag);
    }
    const seletor=document.createElement('select');seletor.id='condicao-selecao-'+p.id;seletor.className='condicao-seletor';seletor.setAttribute('aria-label','Selecionar condição para '+p.nome);
    const instrucao=document.createElement('option');instrucao.value='';instrucao.textContent='Selecionar condição oficial…';seletor.append(instrucao);
    for(const item of CONDICOES_OFICIAIS_AB){const opcao=document.createElement('option');opcao.value=item.nome;opcao.textContent=item.nome;seletor.append(opcao);}
    const manual=document.createElement('option');manual.value='__manual__';manual.textContent='Outra condição (inserir manualmente)';seletor.append(manual);
    const referencia=document.createElement('div');referencia.className='condicao-referencia dica';referencia.setAttribute('aria-live','polite');referencia.textContent='Selecione uma condição para consultar seu efeito e a orientação de duração do livro.';
    const manualInput=document.createElement('input');manualInput.id='condicao-manual-'+p.id;manualInput.type='text';manualInput.maxLength=60;manualInput.placeholder='Nome da condição personalizada';manualInput.setAttribute('aria-label','Nome da condição personalizada');manualInput.hidden=true;
    const duracaoRotulo=document.createElement('label');duracaoRotulo.textContent='Duração / término';const duracao=document.createElement('input');duracao.id='condicao-duracao-'+p.id;duracao.type='text';duracao.maxLength=80;duracao.placeholder='Ex.: até o fim do próximo turno';duracao.setAttribute('aria-label','Duração ou momento de término');
    const observacaoRotulo=document.createElement('label');observacaoRotulo.textContent='Observação (opcional)';const observacao=document.createElement('textarea');observacao.id='condicao-observacao-'+p.id;observacao.rows=2;observacao.maxLength=300;observacao.placeholder='Fonte, teste necessário ou detalhe da cena';observacao.setAttribute('aria-label','Observação da condição');
    function atualizarReferencia(){const item=CONDICOES_OFICIAIS_AB.find(x=>x.nome===seletor.value);referencia.replaceChildren();if(item){const efeito=document.createElement('p');efeito.textContent='Efeito: '+item.efeito;const dur=document.createElement('p');dur.textContent='Duração/remoção no livro: '+item.duracao;referencia.append(efeito,dur);duracao.value=item.duracao.length<=80?item.duracao:'Conforme a fonte';}else{referencia.textContent=seletor.value==='__manual__'?'Condição personalizada: registre o efeito e o término nas observações.':'Selecione uma condição para consultar seu efeito e a orientação de duração do livro.';duracao.value='';}manualInput.hidden=seletor.value!=='__manual__';}
    seletor.addEventListener('change',atualizarReferencia);
    const adicionar=document.createElement('button');adicionar.type='button';adicionar.className='botao pequeno';adicionar.textContent='Aplicar condição';adicionar.addEventListener('click',()=>adicionarCondicaoCombate(p.id));
    condicoes.append(seletor,referencia,manualInput,duracaoRotulo,duracao,observacaoRotulo,observacao,adicionar);li.append(condicoes);lista.append(li);
  }
  $('combate-rodada').textContent=String(combateMestre.rodada);
  $('combate-status').textContent=combateMestre.combateAtivo?'Combate em andamento':'Preparação';
  $('combate-avancar').disabled=!combateMestre.combateAtivo||!combateMestre.participantes.length;
  const conflito=$('combate-conflito');if(conflito)conflito.hidden=!conflitoCombate;
  const haEmpate=empateIniciativaMestre();
  $('combate-empate').hidden=!haEmpate;
  $('combate-rerrolar').hidden=!haEmpate;
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
    const conflito=document.createElement('div');conflito.id='combate-conflito';conflito.className='mensagem aviso';conflito.hidden=true;
    const conflitoTexto=document.createElement('p');conflitoTexto.textContent='Este combate foi alterado em outra aba ou aparelho. Suas alterações locais foram preservadas, mas não foram gravadas. Não continue editando até decidir como recuperar os dados.';
    const recarregar=document.createElement('button');recarregar.type='button';recarregar.className='botao pequeno';recarregar.textContent='Descartar alterações locais e carregar versão do servidor';
    recarregar.addEventListener('click',()=>{if(confirm('Isso substituirá os dados locais deste combate pela versão salva no servidor. Deseja continuar?'))carregarCombateMestre(false,true);});
    conflito.append(conflitoTexto,recarregar);
    const ajuda=document.createElement('p');ajuda.className='dica';ajuda.textContent='Personagens: 1d20 + AGI. Criaturas: 1d20 + Iniciativa da ficha. Empates: AGI, depois resultado natural; persistindo, role novamente.';
    const empate=document.createElement('p');empate.id='combate-empate';empate.className='mensagem aviso';empate.hidden=true;empate.textContent='Empate persistente: os participantes empatados devem rolar novamente.';
    const rerrolar=document.createElement('button');rerrolar.type='button';rerrolar.id='combate-rerrolar';rerrolar.className='botao pequeno';rerrolar.textContent='Rerrolar desempate';rerrolar.hidden=true;rerrolar.addEventListener('click',rerrolarEmpatesIniciativaMestre);
    const form=document.createElement('form');form.id='combate-form';form.className='combate-form';form.addEventListener('submit',adicionarParticipanteCombate);
    function campo(rotulo,id,tipo,valor){const l=document.createElement('label');l.textContent=rotulo;const e=document.createElement(tipo);e.id=id;if(tipo==='input'){e.type='number';e.min='-10';e.max='30';e.value=valor;e.required=true;}return [l,e];}
    const ln=document.createElement('label');ln.textContent='Participante';const nome=document.createElement('input');nome.id='combate-nome';nome.required=true;nome.maxLength=40;nome.placeholder='Nome';
    const lt=document.createElement('label');lt.textContent='Tipo';const tipo=document.createElement('select');tipo.id='combate-tipo';
    for(const x of [['personagem','Personagem'],['criatura','Criatura']]){const o=document.createElement('option');o.value=x[0];o.textContent=x[1];tipo.append(o);}
    const [la,agi]=campo('AGI (desempate)','combate-agi','input','0');const [lb,bonus]=campo('Bônus de Iniciativa','combate-bonus','input','0');
    agi.addEventListener('change',()=>{if(tipo.value==='personagem')bonus.value=agi.value;});
    tipo.addEventListener('change',()=>{if(tipo.value==='personagem')bonus.value=agi.value;});
    const add=document.createElement('button');add.type='submit';add.className='botao primario';add.textContent='Adicionar';form.append(ln,nome,lt,tipo,la,agi,lb,bonus,add);
    const msg=document.createElement('p');msg.id='combate-msg';msg.className='mensagem';msg.hidden=true;
    const acoes=document.createElement('div');acoes.className='linha combate-acoes';
    function acao(texto,classe,fn,id){const b=document.createElement('button');b.type='button';b.className='botao '+classe;b.textContent=texto;if(id)b.id=id;b.addEventListener('click',fn);return b;}
    acoes.append(acao('Rolar iniciativa','primario',rolarIniciativasCombate),acao('Próximo turno','',avancarTurnoCombate,'combate-avancar'),acao('Novo combate','',novoCombateMestre));
    const vazio=document.createElement('p');vazio.id='combate-vazio';vazio.className='dica';vazio.textContent='Adicione personagens e criaturas para preparar a ordem de iniciativa.';
    const ul=document.createElement('ol');ul.id='combate-lista';ul.className='lista combate-lista';
    card.append(h,resumo,conflito,ajuda,empate,rerrolar,form,msg,acoes,vazio,ul);raiz.append(card);
  }
  if(combateMestre)desenharCombateMestre();
}
function renderizarMesa(){const ativo=document.activeElement,raiz=$('conteudo-mesa');if(ativo&&raiz&&raiz.contains(ativo)&&['INPUT','TEXTAREA','SELECT'].includes(ativo.tagName)){estado.redesenharMesa=true;return;}renderizarMesaBase();if(estado.tela==='mesa'&&estado.mesaAtual?.papel==='mestre')montarResumoFichasMestre();montarPainelCombateMestre();}
let mesaCombateCarregada=null;
async function carregarMesaAtual(){const id=estado.mesaId;if(id!==mesaCombateCarregada){combateMestre=null;conflitoCombate=false;mesaCombateCarregada=id;}await carregarMesaAtualBase();if(estado.tela==='mesa'&&estado.mesaAtual?.papel==='mestre'){await carregarCombateMestre(true);await carregarResumoFichasMestre();}}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&estado.tela==='mesa'&&estado.mesaAtual?.papel==='mestre')carregarCombateMestre(true);carregarResumoFichasMestre();});
setInterval(()=>{if(!document.hidden&&estado.tela==='mesa'&&estado.mesaAtual?.papel==='mestre'&&!salvandoCombate&&!painelMestreEmEdicao())carregarCombateMestre(true);carregarResumoFichasMestre();},4000);
 
// Resumo operacional das Fichas: a API entrega somente a projeção autorizada,
// nunca o conteúdo completo que permanece privado do Jogador.
let resumoFichasMestre = [];
let carregandoResumoFichasMestre = false;
async function carregarResumoFichasMestre() {
  if (!estado.mesaId || estado.modo !== 'local' || estado.mesaAtual?.papel !== 'mestre' || carregandoResumoFichasMestre) return;
  carregandoResumoFichasMestre = true;
  try {
    const r = await buscar(estado.base + '/api/painel-mestre/' + encodeURIComponent(estado.mesaId) + '/fichas', {
      headers: { Authorization: 'Bearer ' + estado.token },
    });
    resumoFichasMestre = Array.isArray(r.fichas) ? r.fichas : [];
    montarResumoFichasMestre();
  } catch {
    // Compatibilidade durante a integração entre branches: a rota só existe
    // quando o servidor recebe também os módulos de Ficha da main.
  } finally {
    carregandoResumoFichasMestre = false;
  }
}
function montarResumoFichasMestre() {
  if (estado.mesaAtual?.papel !== 'mestre' || estado.tela !== 'mesa') return;
  const raiz = $('conteudo-mesa');
  if (!raiz) return;
  let card = $('bloco-resumo-fichas-mestre');
  if (!card) {
    card = document.createElement('section');
    card.id = 'bloco-resumo-fichas-mestre';
    card.className = 'cartao painel-combate';
    const titulo = document.createElement('h2');
    titulo.textContent = 'Personagens da Mesa';
    const ajuda = document.createElement('p');
    ajuda.className = 'dica';
    ajuda.textContent = 'Resumo operacional das Fichas Ativas aprovadas. O conteúdo completo das Fichas continua privado dos Jogadores.';
    const lista = document.createElement('div');
    lista.id = 'resumo-fichas-lista';
    card.append(titulo, ajuda, lista);
    raiz.prepend(card);
  }
  const lista = $('resumo-fichas-lista');
  lista.replaceChildren();
  if (!resumoFichasMestre.length) {
    const vazio = document.createElement('p');
    vazio.className = 'dica';
    vazio.textContent = 'Nenhuma Ficha Ativa aprovada nesta Mesa.';
    lista.append(vazio);
    return;
  }
  for (const ficha of resumoFichasMestre) {
    const item = document.createElement('article');
    item.className = 'subpainel-mestre';
    const nome = document.createElement('h3');
    nome.textContent = ficha.personagem + ' · Nível ' + ficha.nivel;
    const jogador = document.createElement('p');
    jogador.className = 'dica';
    jogador.textContent = 'Jogador: ' + ficha.jogador;
    const recursos = document.createElement('p');
    recursos.textContent = 'PV ' + ficha.pv.atual + '/' + ficha.pv.maximo +
      (ficha.pv.temporarios ? ' (+' + ficha.pv.temporarios + ' temporários)' : '') +
      ' · SA ' + ficha.sa.atual + '/' + ficha.sa.maximo +
      ' · BI ' + ficha.bi.atual + '/' + ficha.bi.maximo +
      (ficha.bi.fase ? ' (Fase ' + ficha.bi.fase + ')' : ' (Colapso)');
    const combate = document.createElement('p');
    combate.textContent = 'Defesa ' + ficha.defesa + ' · RD ' + ficha.reducaoDano +
      ' · Iniciativa +' + ficha.iniciativa + ' · Movimento ' + ficha.movimento + ' m';
    const passivos = ficha.periciasPassivas || {};
    const testes = document.createElement('p');
    testes.textContent = 'Passivos — Percepção ' + (passivos.percepcao ?? '—') +
      ' · Fortitude ' + (passivos.fortitude ?? '—') +
      ' · Reflexos ' + (passivos.reflexos ?? '—') +
      ' · Vontade ' + (passivos.vontade ?? '—');
    const condicoes = document.createElement('p');
    condicoes.className = 'dica';
    condicoes.textContent = ficha.condicoes?.length
      ? 'Condições: ' + ficha.condicoes.map(c => c.nome).join(', ')
      : 'Condições: nenhuma';
    item.append(nome, jogador, recursos, combate, testes, condicoes);
    lista.append(item);
  }
}

