'use strict';
/* Extensão independente do Painel do Mestre. Regras: Arquivo do Jogador p. 76 e Arquivo do Mestre p. 14. */
const renderizarMesaBase = renderizarMesa;
const carregarMesaAtualBase = carregarMesaAtual;
let combateMestre=null, carregandoCombate=false, salvandoCombate=false, conflitoCombate=false;

// O snapshot local mantém o estado do Mestre durante quedas de conexão.
// A sincronização usa a versão otimista já validada pelo servidor.
function chaveCombateOffline(){return 'ab-combate-mestre:'+String(estado.mesaId||'');}
function guardarCombateOffline(pendente=true){
  if(!combateMestre||!estado.mesaId)return false;
  try{localStorage.setItem(chaveCombateOffline(),JSON.stringify({estado:combateMestre,pendente:!!pendente,atualizadoEm:new Date().toISOString()}));return true;}
  catch{return false;}
}
function envelopeCombateOffline(){
  try{const bruto=localStorage.getItem(chaveCombateOffline());if(!bruto)return null;const salvo=JSON.parse(bruto);
    // Compatibilidade com snapshots antigos, que ainda não tinham metadados.
    return salvo&&salvo.estado&&typeof salvo.estado==='object'?salvo:{estado:salvo,pendente:true};
  }catch{return null;}
}
function lerCombateOffline(){const salvo=envelopeCombateOffline();return salvo?.estado||null;}
function combateOfflinePendente(){return envelopeCombateOffline()?.pendente===true;}
function limparCombateOffline(){try{localStorage.removeItem(chaveCombateOffline());}catch{}}

function painelMestreEmEdicao(){
  const raiz=$('bloco-combate-mestre'),ativo=document.activeElement;
  return Boolean(raiz&&ativo&&raiz.contains(ativo)&&['INPUT','TEXTAREA','SELECT'].includes(ativo.tagName));
}
const CONDICOES_OFICIAIS_AB = [
  {nome:'Nível Negativo',tipo:'progressao',pagina:101,efeito:'Perda de 1 Nível por Morte: a Personagem retorna à última Sala de Descanso visitada e reverte os benefícios daquele nível.',duracao:'Permanece até a progressão recuperar o Nível perdido.'},
  {nome:'Penalidade por Morte no Nível 1',tipo:'progressao',pagina:101,efeito:'No Nível 1, em vez de cair para o Nível 0, a Personagem sofre −2 em Testes de Atributo, Perícia e Ataque.',duracao:'Até subir de Nível.'},
  {nome:'Agarrado',pagina:81,efeito:'Movimento passa a 0 e não pode receber bônus de Movimento. A criatura que agarra pode arrastar o alvo com Movimento pela metade, salvo alvo 2+ categorias menor.',duracao:'Termina se quem agarra ficar Incapacitado, se o alvo sair do alcance por efeito externo ou se o alvo escapar usando sua Ação e Atletismo/Reflexos contra a DT original do Agarrão.'},
  {nome:'Amedrontado',pagina:81,efeito:'Tem Desvantagem em testes aplicáveis enquanto perceber a fonte do medo, tenta se afastar/fugir dela e não pode se aproximar voluntariamente.',duracao:'Conforme a fonte do medo.'},
  {nome:'Atordoado',pagina:81,efeito:'Não pode realizar Ações, Reações ou Movimento. Ataques e Manobras ofensivas resistidas contra o alvo recebem Vantagem.',duracao:'Conforme a fonte; algumas Habilidades usam até o início/fim de turno indicado.'},
  {nome:'Caído',pagina:81,efeito:'Só pode se deslocar Rastejando. Levantar custa metade do Movimento. Seus Ataques têm Desvantagem; Ataques Corpo a Corpo contra você têm Vantagem e Ataques à distância contra você têm Desvantagem. Com Movimento 0, não pode se levantar.',duracao:'Até se levantar ou outro efeito remover.'},
  {nome:'Cego',pagina:82,efeito:'Tem Desvantagem em seus Ataques; Ataques contra ele têm Vantagem; falha automaticamente em testes que dependam exclusivamente de visão.',duracao:'Conforme a fonte.'},
  {nome:'Colapso Viral',pagina:82,efeito:'Consequência de atingir a BI Máxima. Ver “Colapso”, Capítulo 5 — Bio-Infecção.',duracao:'—'},
  {nome:'Corrosão',pagina:82,efeito:'A pele e tecidos sofrem ação corrosiva. Causa 1d4 de Dano ao final de cada turno.',duracao:'Se a fonte não definir duração, dura até ser encerrada por um Teste bem-sucedido ou pela duração específica da fonte. No início do turno, faça Fortitude DT 12; em sucesso, a Corrosão termina imediatamente e não causa seu Dano naquele turno. Em falha, ela permanece e causa 1d4 de Dano ao final do turno. Fora de combate, causa Dano uma única vez por exposição, salvo regra específica.'},
  {nome:'Cabeça Carmesim',pagina:82,efeito:'Transformação posterior de um Zumbi. Ver “Crimson”, Capítulo 5 — Bio-Infecção.',duracao:'—'},
  {nome:'Desacordado',pagina:82,efeito:'A personagem fica inconsciente: não realiza Ações ou Reações e não percebe conscientemente o ambiente. Ver “0 PV”, Capítulo 4 — Regras e Combate. Ver “Colapso”, Capítulo 5 — Bio-Infecção.',duracao:'Em 0 PV, segue Testes de Reanimação. Outras fontes determinam como despertar.'},
  {nome:'Desorientado',pagina:82,efeito:'Não pode usar Atacar, tem Desvantagem em Testes de Perícia e perde a contribuição de AGI na Defesa.',duracao:'Conforme a fonte.'},
  {nome:'Enfraquecido',pagina:82,efeito:'Desvantagem em Testes baseados em FOR e em Fortitude.',duracao:'A fonte determina duração e cura.'},
  {nome:'Exposto',pagina:82,efeito:'Sofre -2 na Defesa. Exposto não impõe penalidade em Ataques, Perícias, Reações ou outros valores.',duracao:'Quando causado por Falha Crítica, dura até o final do próximo turno da criatura.'},
  {nome:'Imobilizado',pagina:82,efeito:'Movimento 0; Desvantagem nos próprios Ataques; Ataques contra o alvo têm Vantagem; Desvantagem em Reflexos.',duracao:'Conforme a fonte.'},
  {nome:'Incapacitado',pagina:82,efeito:'Não pode realizar Ações nem Reações.',duracao:'Conforme a fonte.'},
  {nome:'Intoxicado',pagina:82,efeito:'Movimento reduzido em 3 m. Desvantagem em Testes de Ataque e Testes de Perícia. Testes de Atributo permanecem normais.',duracao:'Conforme a fonte.'},
  {nome:'Queimadura',pagina:83,efeito:'O corpo está em chamas. Sofre 1d6 de Dano ao final de cada turno.',duracao:'Se a fonte não definir duração, dura 1d4 rodadas. No início de cada turno, Reflexos DT 12 apaga completamente as chamas em sucesso. Fora de combate, aplica o Dano apenas uma vez.'},
  {nome:'Surdo',pagina:83,efeito:'Falha automaticamente em testes que dependam exclusivamente de audição.',duracao:'Conforme a fonte.'},
  {nome:'Surpreendido',pagina:83,efeito:'No primeiro turno em que estiver Surpreendido, não pode se mover nem realizar Ações. Enquanto estiver Surpreendido, não pode usar Reações nem gastar SA.',duracao:'Normalmente termina ao fim do primeiro turno da própria criatura, salvo efeito específico.'},
  {nome:'Vulnerável',pagina:83,efeito:'Uma criatura fica Vulnerável enquanto seus PV atuais forem iguais ou inferiores a 1/5 dos PV máximos. A condição habilita efeitos específicos, como Morte Instantânea por Finalizar, Pisão ou propriedades de armas; ela não derrota nem mata o alvo por si só.',duracao:'Dura enquanto os PV permanecerem em 1/5 do máximo ou menos, salvo regra específica.'},
  {nome:'Infectado Especial',pagina:83,efeito:'Transformação causada pela Bio-Infecção. Ver “Infectado”, Capítulo 5 — Bio-Infecção.',duracao:'—'}
];
function duracaoInicialCondicao(){
  // A referência do livro explica a regra geral; o campo de duração registra
  // somente o término específico desta aplicação da condição.
  return '';
}
function referenciaPaginaCondicao(item){
  return 'Arquivo do Jogador, p. '+item.pagina;
}
function apiPainelMestre(metodo='GET',corpo) {
  return buscar(estado.base+'/api/painel-mestre/'+encodeURIComponent(estado.mesaId)+'/combate',{
    method:metodo,headers:{Authorization:'Bearer '+estado.token,...(corpo?{'Content-Type':'application/json'}:{})},
    body:corpo?JSON.stringify(corpo):undefined
  });
}
async function carregarCombateMestre(silencioso=false,forcar=false) {
  if(!estado.mesaId||estado.mesaAtual?.papel!=='mestre'||carregandoCombate||salvandoCombate||(!forcar&&(conflitoCombate||painelMestreEmEdicao())))return;
  if(estado.modo!=='local'){
    const local=lerCombateOffline();
    if(local){combateMestre=local;desenharCombateMestre();}
    return;
  }
  const pendente=lerCombateOffline();
  if(pendente&&combateOfflinePendente()&&!conflitoCombate){
    combateMestre=pendente;
    desenharCombateMestre();
    await salvarCombateMestre();
    return;
  }
  carregandoCombate=true;
  try{const r=await apiPainelMestre();combateMestre=r.combate;conflitoCombate=false;guardarCombateOffline(false);desenharCombateMestre();}
  catch(e){
    const local=lerCombateOffline();if(!combateMestre&&local){combateMestre=local;desenharCombateMestre();}
    if(!silencioso)mensagem($('aviso-mesa'),e.message,'aviso');
  }
  finally{carregandoCombate=false;}
}
let salvarCombatePendente=false;
async function salvarCombateMestre() {
  if(!combateMestre)return;
  if(salvandoCombate){salvarCombatePendente=true;return;}
  if(estado.modo!=='local'){
    const salvo=guardarCombateOffline();
    desenharCombateMestre();
    mensagem($('aviso-mesa'),salvo?'Alterações guardadas neste aparelho. Serão sincronizadas quando o servidor voltar.':'Não foi possível guardar as alterações offline neste navegador.','aviso');
    return;
  }
  salvandoCombate=true;
  let erro=null;
  try{
    do{
      salvarCombatePendente=false;
      const copia=JSON.parse(JSON.stringify(combateMestre));
      const r=await apiPainelMestre('PUT',copia);
      combateMestre=r.combate;
      guardarCombateOffline(false);
    }while(salvarCombatePendente);
  }catch(e){
    erro=e;
    if(e.status===409)conflitoCombate=true;
    else guardarCombateOffline();
  }
  finally{
    salvandoCombate=false;
    desenharCombateMestre();
    if(erro)mensagem($('aviso-mesa'),eStatusOffline(erro)?'Sem conexão com o servidor. Alterações guardadas neste aparelho e aguardam sincronização.':erro.message,eStatusOffline(erro)?'aviso':'erro');
  }
}
function eStatusOffline(erro){return !erro?.status||erro.status>=500;}
function ordenarCombateMestre(){
  combateMestre.participantes.sort((a,b)=>{
    if(a.entradaTardia!==b.entradaTardia)return a.entradaTardia?1:-1;
    // Quem entra após o início permanece no fim, na ordem em que chegou.
    if(a.entradaTardia&&b.entradaTardia)return a.ordem-b.ordem;
    return b.iniciativa-a.iniciativa||b.agi-a.agi||b.d20-a.d20||a.ordem-b.ordem;
  });
}
function preencherSeletorCriaturasCombate(){
  const seletor=$('combate-criatura-catalogo');
  if(!seletor)return;
  const atual=seletor.value;
  seletor.replaceChildren();
  const vazio=document.createElement('option');vazio.value='';vazio.textContent='Selecionar do Bestiário (opcional)';seletor.append(vazio);
  for(const criatura of (window.BESTIARIO_AB||[])){
    const op=document.createElement('option');op.value=criatura.id;op.textContent=criatura.nome+' · '+criatura.categoria;seletor.append(op);
  }
  seletor.value=atual;
}
function proximaOrdemCombate(){return combateMestre.participantes.reduce((maior,p)=>Math.max(maior,Number.isInteger(p.ordem)?p.ordem:-1),-1)+1;}
function prepararEncontroNoCombate(encontro){
  if(!combateMestre||!Array.isArray(encontro?.criaturas)){mensagem($('aviso-mesa'),'Não foi possível preparar este encontro.','erro');return;}
  const catalogo=window.BESTIARIO_AB||[];
  const novas=[];
  for(const entrada of encontro.criaturas){
    const criatura=catalogo.find(x=>x.id===entrada.id);
    if(!criatura)continue;
    const quantidade=Math.max(1,Math.min(20,Number(entrada.quantidade)||1));
    for(let i=0;i<quantidade;i++){
      let nome=quantidade>1?criatura.nome+' '+(i+1):criatura.nome;
      let sufixo=2;
      while(combateMestre.participantes.some(p=>p.nome.toLocaleLowerCase('pt-BR')===nome.toLocaleLowerCase('pt-BR'))||novas.some(p=>p.nome.toLocaleLowerCase('pt-BR')===nome.toLocaleLowerCase('pt-BR'))){nome=criatura.nome+' ('+sufixo+')';sufixo++;}
      novas.push({id:(crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random()).slice(0,40),nome,tipo:'criatura',
        agi:criatura.atributos.agi,bonusIniciativa:criatura.iniciativa,d20:0,iniciativa:0,
        criaturaId:criatura.id,pvAtual:criatura.categoria==='Perseguidor'?criatura.pvPerseguicao:criatura.pv,
        pvMaximo:criatura.categoria==='Perseguidor'?criatura.pvPerseguicao:criatura.pv,defesa:criatura.defesa,movimento:criatura.movimento,
        ...(criatura.categoria==='Perseguidor'?{perseguidor:true,fase:'perseguicao',pvPerseguicaoMaximo:criatura.pvPerseguicao,proximidadePerseguidor:5,
          pvCombateMaximo:(window.BESTIARIO_AB||[]).find(x=>x.id===criatura.formaCombateId)?.pv||null}:{}),
        entradaTardia:combateMestre.combateAtivo,ordem:proximaOrdemCombate()+novas.length});
    }
  }
  if(!novas.length){mensagem($('aviso-mesa'),'As criaturas deste encontro não foram encontradas no Bestiário.','aviso');return;}
  if(combateMestre.participantes.length+novas.length>30){mensagem($('aviso-mesa'),'O combate aceita até 30 participantes. Remova alguém antes de adicionar este encontro.','aviso');return;}
  combateMestre.participantes.push(...novas);ordenarCombateMestre();salvarCombateMestre();
  mensagem($('aviso-mesa'),novas.length+' criatura(s) adicionada(s) à ordem de combate. Role a Iniciativa quando estiver pronto.','info');
  $('bloco-combate-mestre')?.scrollIntoView({behavior:'smooth',block:'start'});
}
if(typeof window!=='undefined')window.prepararEncontroNoCombate=prepararEncontroNoCombate;

function selecionarCriaturaIniciativa(){
  const id=$('combate-criatura-catalogo')?.value;
  const criatura=(window.BESTIARIO_AB||[]).find(x=>x.id===id);
  if(!criatura)return;
  $('combate-tipo').value='criatura';
  $('combate-nome').value=criatura.nome;
  $('combate-agi').value=criatura.atributos.agi;
  $('combate-bonus').value=criatura.iniciativa;
}
function adicionarParticipanteCombate(ev){
  ev.preventDefault();
  const criatura=(window.BESTIARIO_AB||[]).find(x=>x.id===$('combate-criatura-catalogo')?.value);
  const nome=$('combate-nome').value.trim()||(criatura?.nome||''),tipo=criatura?'criatura':$('combate-tipo').value;
  const agi=criatura?criatura.atributos.agi:Number($('combate-agi').value),bonus=criatura?criatura.iniciativa:Number($('combate-bonus').value);
  if(!nome||!Number.isInteger(agi)||agi < -10||agi>30||!Number.isInteger(bonus)||bonus < -10||bonus>30){mensagem($('combate-msg'),'Informe nome, AGI e bônus de Iniciativa válidos.','erro');return;}
  if(combateMestre.participantes.some(p=>p.nome.toLocaleLowerCase('pt-BR')===nome.toLocaleLowerCase('pt-BR'))){mensagem($('combate-msg'),'Já existe um participante com esse nome.','erro');return;}
  const participante={id:(crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random()).slice(0,40),nome,tipo,agi,bonusIniciativa:bonus,d20:0,iniciativa:0,entradaTardia:combateMestre.combateAtivo,ordem:proximaOrdemCombate()};
  if(criatura)Object.assign(participante,{criaturaId:criatura.id,pvAtual:criatura.categoria==='Perseguidor'?criatura.pvPerseguicao:criatura.pv,
    pvMaximo:criatura.categoria==='Perseguidor'?criatura.pvPerseguicao:criatura.pv,defesa:criatura.defesa,movimento:criatura.movimento,
    ...(criatura.categoria==='Perseguidor'?{perseguidor:true,fase:'perseguicao',pvPerseguicaoMaximo:criatura.pvPerseguicao,proximidadePerseguidor:5,
      pvCombateMaximo:(window.BESTIARIO_AB||[]).find(x=>x.id===criatura.formaCombateId)?.pv||null}:{})});
  combateMestre.participantes.push(participante);
  $('combate-nome').value='';$('combate-criatura-catalogo').value='';ordenarCombateMestre();salvarCombateMestre();
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
  if(i<0||i===lista.length-1){
    for(const p of lista){
      if(p.perseguidor&&p.fase==='perseguicao'&&p.aguardandoRetorno&&
        Number.isInteger(p.rodadasAtordoado)&&p.rodadaInicioAtordoado<combateMestre.rodada){
        p.rodadasAtordoado=Math.max(0,p.rodadasAtordoado-1);
      }
    }
    combateMestre.rodada++;combateMestre.turnoAtual=lista[0].id;
  } else combateMestre.turnoAtual=lista[i+1].id;
  const atual=lista.find(p=>p.id===combateMestre.turnoAtual);
  if(atual?.perseguidor&&atual.fase==='perseguicao'&&atual.aguardandoRetorno&&atual.rodadasAtordoado===0){
    atual.pvAtual=atual.pvPerseguicaoMaximo;atual.pvMaximo=atual.pvPerseguicaoMaximo;
    atual.aguardandoRetorno=false;atual.rodadaInicioAtordoado=null;
  }
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
  const duracao=$('condicao-duracao-'+id)?.value.trim()||'';
  const observacao=$('condicao-observacao-'+id)?.value.trim()||'';
  p.condicoes=p.condicoes||[];
  if(p.condicoes.some(x=>x.nome.toLocaleLowerCase('pt-BR')===nome.toLocaleLowerCase('pt-BR'))){
    mensagem($('aviso-mesa'),'Os efeitos mecânicos da mesma condição não se acumulam; esta nova instância terá sua duração acompanhada separadamente.','aviso');
  }
  const itemOficial=CONDICOES_OFICIAIS_AB.find(x=>x.nome===nome);
  const tipo=itemOficial?.tipo==='progressao'?'progressao':'condicao';
  p.condicoes.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),tipo,nome,duracao,observacao,notificacao:{id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),estado:'pendente',criadaEm:new Date().toISOString()}});
  salvarCombateMestre();
}
function ajustarProximidadePerseguidor(id,delta){
  const p=combateMestre?.participantes.find(x=>x.id===id);
  if(!p?.perseguidor||p.fase!=='perseguicao')return;
  const atual=Number.isInteger(p.proximidadePerseguidor)?p.proximidadePerseguidor:5;
  p.proximidadePerseguidor=Math.max(0,Math.min(10,atual+delta));
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
    if(p.tipo==='personagem'&&p.fichaId){
      const fichaVinculada=(resumoFichasMestre||[]).find(f=>f.id===p.fichaId);
      if(fichaVinculada){
        const recursosFicha=document.createElement('p');recursosFicha.className='dica';
        recursosFicha.textContent='Ficha · PV '+fichaVinculada.pv.atual+'/'+fichaVinculada.pv.maximo+
          ' · SA '+fichaVinculada.sa.atual+'/'+fichaVinculada.sa.maximo+
          ' · BI '+fichaVinculada.bi.atual+'/'+fichaVinculada.bi.maximo+
          ' · Defesa '+fichaVinculada.defesa;
        li.append(recursosFicha);
      }
    }
    if(p.tipo==='criatura'&&p.pvMaximo!==undefined){
      const ficha=document.createElement('p');ficha.className='dica';ficha.textContent=(p.perseguidor&&p.fase==='perseguicao'?'PV de Perseguição ':'PV ')+p.pvAtual+'/'+p.pvMaximo+' · Defesa '+p.defesa+' · Movimento '+p.movimento;
      const pv=document.createElement('input');pv.type='number';pv.min='0';pv.max=String(p.pvMaximo);pv.value=p.pvAtual;pv.disabled=Boolean(p.perseguidor&&p.fase==='perseguicao'&&p.aguardandoRetorno);pv.setAttribute('aria-label','PV atuais de '+p.nome);
      pv.addEventListener('change',()=>{
        const valor=Number(pv.value);
        if(Number.isInteger(valor)&&valor>=0&&valor<=p.pvMaximo&&!pv.disabled){
          const pvAnterior=p.pvAtual;p.pvAtual=valor;
          if(p.perseguidor&&p.fase==='perseguicao'&&pvAnterior>0&&valor===0){
            p.rodadasAtordoado=Math.floor(Math.random()*4)+1;
            p.aguardandoRetorno=true;p.rodadaInicioAtordoado=combateMestre.rodada;
          }
          salvarCombateMestre();
        }else pv.value=p.pvAtual;
      });
      li.append(ficha,pv);
      if(p.perseguidor&&p.fase==='perseguicao'){
        if(p.aguardandoRetorno){
          const atordoado=document.createElement('p');atordoado.className='mensagem aviso';
          atordoado.textContent=p.rodadasAtordoado>0?'Atordoado pela regra de Perseguição · '+p.rodadasAtordoado+' rodada(s) restante(s). Não recebe Dano nesse período.':'Atordoado · aguardando seu próximo turno para recuperar todos os PV de Perseguição.';
          li.append(atordoado);
        }
        const regra=document.createElement('p');regra.className='dica';regra.textContent='Durante a perseguição: não pode sofrer Morte Instantânea normalmente nem fica Vulnerável. Efeito direto de Morte Instantânea reduz PV de Perseguição a 0.';
        li.append(regra);
        const distancia=document.createElement('section');distancia.className='regua-perseguidor';
        const tituloDistancia=document.createElement('strong');tituloDistancia.textContent='Proximidade do perseguidor';
        const valorDistancia=Number.isInteger(p.proximidadePerseguidor)?p.proximidadePerseguidor:5;
        const legenda=document.createElement('div');legenda.className='regua-legenda';
        const perto=document.createElement('span');perto.textContent='ALCANÇANDO';
        const longe=document.createElement('span');longe.textContent='DISTANTE';legenda.append(perto,longe);
        const trilho=document.createElement('div');trilho.className='regua-trilho';trilho.setAttribute('role','meter');trilho.setAttribute('aria-label','Distância relativa do perseguidor');trilho.setAttribute('aria-valuemin','0');trilho.setAttribute('aria-valuemax','10');trilho.setAttribute('aria-valuenow',String(valorDistancia));
        const intensidade=(10-valorDistancia)/10,corInicial=[245,245,245],corFinal=[200,16,46];
        const rgb=corInicial.map((c,i)=>Math.round(c+(corFinal[i]-c)*intensidade));
        trilho.style.backgroundColor='rgb('+rgb.join(',')+')';trilho.style.color=intensidade>=0.48?'#fff':'#202020';
        const valorNaRegua=document.createElement('strong');valorNaRegua.className='regua-valor';valorNaRegua.textContent=valorDistancia+' / 10';trilho.append(valorNaRegua);
        const estadoDistancia=document.createElement('p');estadoDistancia.className='regua-estado';estadoDistancia.textContent=valorDistancia===0?'O perseguidor alcançou o grupo':valorDistancia<=2?'Perigo iminente':valorDistancia<=4?'Está muito próximo':valorDistancia<=7?'A perseguição continua':'O grupo abriu distância';
        const controles=document.createElement('div');controles.className='regua-controles';
        const aproximar=document.createElement('button');aproximar.type='button';aproximar.className='botao pequeno perigo';aproximar.textContent='− Aproximar';aproximar.disabled=valorDistancia===0;aproximar.addEventListener('click',()=>ajustarProximidadePerseguidor(p.id,-1));
        const afastar=document.createElement('button');afastar.type='button';afastar.className='botao pequeno';afastar.textContent='+ Afastar';afastar.disabled=valorDistancia===10;afastar.addEventListener('click',()=>ajustarProximidadePerseguidor(p.id,1));
        controles.append(aproximar,afastar);distancia.append(tituloDistancia,legenda,trilho,estadoDistancia,controles);li.append(distancia);
        const avancar=document.createElement('button');avancar.type='button';avancar.className='botao pequeno';avancar.textContent='Declarar Forma de Combate';
        avancar.disabled=!Number.isInteger(p.pvCombateMaximo)||p.pvCombateMaximo<1;
        avancar.addEventListener('click',()=>{if(!confirm('Encerrar a Fase de Perseguição e iniciar a Forma de Combate com '+p.pvCombateMaximo+' PV?'))return;p.fase='combate';p.pvAtual=p.pvCombateMaximo;p.pvMaximo=p.pvCombateMaximo;p.rodadasAtordoado=0;p.aguardandoRetorno=false;p.rodadaInicioAtordoado=null;salvarCombateMestre();});
        li.append(avancar);
      }
    }
    const condicoes=document.createElement('div');condicoes.className='combate-condicoes';
    for(const condicao of (p.condicoes||[])){
      const tag=document.createElement('div');tag.className='condicao-combate';
      const texto=document.createElement('span');texto.textContent=(condicao.tipo==='progressao'?'Progressão · ':'')+condicao.nome+' · '+(condicao.duracao||'término não registrado')+(condicao.observacao?' · '+condicao.observacao:'')+(condicao.notificacao?.estado==='pendente'?' · aviso pendente de entrega':condicao.notificacao?.estado==='entregue'?' · aviso entregue':'');
      const editar=document.createElement('button');editar.type='button';editar.className='botao pequeno';editar.textContent='Editar';editar.setAttribute('aria-label','Editar duração e observação de '+condicao.nome);
      const excluir=document.createElement('button');excluir.type='button';excluir.className='botao pequeno';excluir.textContent='×';excluir.setAttribute('aria-label','Remover condição '+condicao.nome);
      const editorEdicao=document.createElement('div');editorEdicao.className='condicao-edicao';editorEdicao.hidden=true;
      const duracaoEdicao=document.createElement('input');duracaoEdicao.type='text';duracaoEdicao.maxLength=80;duracaoEdicao.value=condicao.duracao||'';duracaoEdicao.setAttribute('aria-label','Duração ou término de '+condicao.nome);
      const observacaoEdicao=document.createElement('textarea');observacaoEdicao.rows=2;observacaoEdicao.maxLength=300;observacaoEdicao.value=condicao.observacao||'';observacaoEdicao.setAttribute('aria-label','Observação de '+condicao.nome);
      const salvarEdicao=document.createElement('button');salvarEdicao.type='button';salvarEdicao.className='botao pequeno primario';salvarEdicao.textContent='Salvar';
      const cancelarEdicao=document.createElement('button');cancelarEdicao.type='button';cancelarEdicao.className='botao pequeno';cancelarEdicao.textContent='Cancelar';
      editar.addEventListener('click',()=>{editorEdicao.hidden=!editorEdicao.hidden;if(!editorEdicao.hidden)duracaoEdicao.focus();});
      salvarEdicao.addEventListener('click',()=>{condicao.duracao=duracaoEdicao.value.trim();condicao.observacao=observacaoEdicao.value.trim();salvarCombateMestre();});
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
    const duracaoRotulo=document.createElement('label');duracaoRotulo.textContent='Duração / término desta aplicação';const duracao=document.createElement('input');duracao.id='condicao-duracao-'+p.id;duracao.type='text';duracao.maxLength=80;duracao.placeholder='Registre quando esta aplicação termina';duracao.setAttribute('aria-label','Duração ou momento de término');
    const observacaoRotulo=document.createElement('label');observacaoRotulo.textContent='Observação (opcional)';const observacao=document.createElement('textarea');observacao.id='condicao-observacao-'+p.id;observacao.rows=2;observacao.maxLength=300;observacao.placeholder='Fonte, teste necessário ou detalhe da cena';observacao.setAttribute('aria-label','Observação da condição');
    function atualizarReferencia(){const item=CONDICOES_OFICIAIS_AB.find(x=>x.nome===seletor.value);referencia.replaceChildren();if(item){const efeito=document.createElement('p');efeito.textContent='Efeito: '+item.efeito;const dur=document.createElement('p');dur.textContent='Duração/remoção no livro: '+item.duracao;const pagina=document.createElement('p');pagina.className='condicao-pagina';pagina.textContent=referenciaPaginaCondicao(item);referencia.append(efeito,dur,pagina);duracao.value=duracaoInicialCondicao(item);}else{referencia.textContent=seletor.value==='__manual__'?'Condição personalizada: registre o efeito e o término nas observações.':'Selecione uma condição para consultar seu efeito e a orientação de duração do livro.';duracao.value='';}manualInput.hidden=seletor.value!=='__manual__';}
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
    const lc=document.createElement('label');lc.textContent='Criatura do Bestiário';const catalogo=document.createElement('select');catalogo.id='combate-criatura-catalogo';catalogo.addEventListener('change',selecionarCriaturaIniciativa);
    const ln=document.createElement('label');ln.textContent='Participante';const nome=document.createElement('input');nome.id='combate-nome';nome.required=true;nome.maxLength=40;nome.placeholder='Nome do personagem ou criatura';
    const lt=document.createElement('label');lt.textContent='Tipo';const tipo=document.createElement('select');tipo.id='combate-tipo';
    for(const x of [['personagem','Personagem'],['criatura','Criatura']]){const o=document.createElement('option');o.value=x[0];o.textContent=x[1];tipo.append(o);}
    const [la,agi]=campo('AGI (desempate)','combate-agi','input','0');const [lb,bonus]=campo('Bônus de Iniciativa','combate-bonus','input','0');
    agi.addEventListener('change',()=>{if(tipo.value==='personagem')bonus.value=agi.value;});
    tipo.addEventListener('change',()=>{if(tipo.value==='personagem'){bonus.value=agi.value;catalogo.value='';}});
    const add=document.createElement('button');add.type='submit';add.className='botao primario';add.textContent='Adicionar';form.append(lc,catalogo,ln,nome,lt,tipo,la,agi,lb,bonus,add);
    preencherSeletorCriaturasCombate();
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
function renderizarMesa(){const ativo=document.activeElement,raiz=$('conteudo-mesa');if(ativo&&raiz&&raiz.contains(ativo)&&['INPUT','TEXTAREA','SELECT'].includes(ativo.tagName)){estado.redesenharMesa=true;return;}renderizarMesaBase();if(estado.tela==='mesa'&&estado.mesaAtual?.papel==='mestre'){montarResumoFichasMestre();montarPainelCombateMestre();}}
const fontesEventosFicha = new WeakSet();
function observarEventosFicha() {
  const fonte = estado.fonte;
  if (!fonte || fontesEventosFicha.has(fonte) || typeof fonte.addEventListener !== 'function') return;
  fontesEventosFicha.add(fonte);
  fonte.addEventListener('ficha', evento => {
    let dados; try { dados = JSON.parse(evento.data); } catch { return; }
    const mesaEvento = dados.mesaId || dados.id; // O servidor de Fichas da main emite { mesaId, fichaId }.
    if (mesaEvento === estado.mesaId && estado.tela === 'mesa' && estado.mesaAtual?.papel === 'mestre') carregarResumoFichasMestre();
  });
}
let mesaCombateCarregada=null;
async function carregarMesaAtual(){const id=estado.mesaId;if(id!==mesaCombateCarregada){combateMestre=null;conflitoCombate=false;resumoFichasMestre=[];mesaCombateCarregada=id;}await carregarMesaAtualBase();observarEventosFicha();if(estado.tela==='mesa'&&estado.mesaAtual?.papel==='mestre'){await carregarCombateMestre(true);await carregarResumoFichasMestre();}}
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
function adicionarFichaAtivaAoCombate(ficha) {
  if (!combateMestre || !ficha) {
    mensagem($('aviso-mesa'), 'O combate ainda não está carregado. Tente novamente em instantes.', 'aviso');
    return;
  }
  const nome = String(ficha.personagem || '').trim();
  const agi = Number(ficha.iniciativa);
  if (!nome || !Number.isInteger(agi) || agi < -10 || agi > 30) {
    mensagem($('aviso-mesa'), 'Não foi possível obter nome e AGI válidos desta Ficha Ativa.', 'erro');
    return;
  }
  if (combateMestre.participantes.length >= 30) {
    mensagem($('aviso-mesa'), 'O combate aceita até 30 participantes.', 'aviso');
    return;
  }
  if (combateMestre.participantes.some(p => p.nome.toLocaleLowerCase('pt-BR') === nome.toLocaleLowerCase('pt-BR'))) {
    mensagem($('aviso-mesa'), 'Este personagem já está na ordem de combate.', 'aviso');
    return;
  }
  const participante = {
    id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()).slice(0, 40),
    nome, tipo: 'personagem', agi, bonusIniciativa: agi, fichaId: String(ficha.id),
    d20: 0, iniciativa: 0,
    entradaTardia: Boolean(combateMestre.combateAtivo),
    ordem: combateMestre.participantes.length,
  };
  combateMestre.participantes.push(participante);
  ordenarCombateMestre();
  salvarCombateMestre();
  montarResumoFichasMestre();
  mensagem($('aviso-mesa'), nome + ' foi adicionado à iniciativa usando a AGI da Ficha Ativa.', 'info');
  $('bloco-combate-mestre')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    nome.textContent = ficha.personagem;
    const jogador = document.createElement('p');
    jogador.className = 'dica';
    jogador.textContent = 'Jogador: ' + ficha.jogador;
    const recursos = document.createElement('p');
    recursos.textContent = 'PV ' + ficha.pv.atual + '/' + ficha.pv.maximo +
      ' · SA ' + ficha.sa.atual + '/' + ficha.sa.maximo +
      ' · BI ' + ficha.bi.atual + '/' + ficha.bi.maximo;
    const combate = document.createElement('p');
    combate.textContent = 'Defesa ' + ficha.defesa + ' · Iniciativa ' + ficha.iniciativa;
    const passivos = ficha.periciasPassivas || {};
    const testes = document.createElement('p');
    testes.textContent = 'Passivos — Percepção ' + (passivos.percepcao ?? '—') +
      ' · Fortitude ' + (passivos.fortitude ?? '—') +
      ' · Reflexos ' + (passivos.reflexos ?? '—') +
      ' · Vontade ' + (passivos.vontade ?? '—');
    const acoes = document.createElement('div');
    acoes.className = 'linha';
    const adicionar = document.createElement('button');
    adicionar.type = 'button';
    adicionar.className = 'botao pequeno primario';
    const jaNaIniciativa = Boolean(combateMestre?.participantes.some(p =>
      p.nome.toLocaleLowerCase('pt-BR') === String(ficha.personagem || '').toLocaleLowerCase('pt-BR')));
    adicionar.textContent = jaNaIniciativa ? 'Já está na iniciativa' : 'Adicionar à iniciativa';
    adicionar.disabled = jaNaIniciativa || !combateMestre || combateMestre.participantes.length >= 30;
    adicionar.addEventListener('click', () => adicionarFichaAtivaAoCombate(ficha));
    acoes.append(adicionar);
    item.append(nome, jogador, recursos, combate, testes, acoes);
    lista.append(item);
  }
}

