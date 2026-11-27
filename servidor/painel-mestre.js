'use strict';
function criarPainelMestre({ carregar, salvar, ehMestre }) {
  const dados = carregar() || {};
  const vazio = (mesaId) => ({ mesaId, versao:0, combateAtivo:false, rodada:1, turnoAtual:null, participantes:[], atualizadoEm:new Date().toISOString() });
  function ordenar(lista) {
    return [...lista].sort((a,b) => {
      if (a.entradaTardia !== b.entradaTardia) return a.entradaTardia ? 1 : -1;
      return b.iniciativa-a.iniciativa || b.agi-a.agi || b.d20-a.d20 || a.ordem-b.ordem;
    });
  }
  function validar(corpo, anterior, mesaId) {
    if (!corpo || typeof corpo !== 'object' || !Array.isArray(corpo.participantes)) return { erro:'Dados de combate inválidos.' };
    if (corpo.participantes.length > 30) return { erro:'O combate aceita até 30 participantes.' };
    const ids=new Set(), nomes=new Set(), participantes=[];
    for (let i=0;i<corpo.participantes.length;i++) {
      const p=corpo.participantes[i] || {};
      const id=String(p.id || '').slice(0,40), nome=String(p.nome || '').trim().slice(0,40);
      const tipo=p.tipo==='criatura'?'criatura':'personagem';
      const agi=Number(p.agi), bonus=Number(p.bonusIniciativa), d20=Number(p.d20);
      if (!id || ids.has(id) || !nome || !Number.isInteger(agi) || agi < -10 || agi > 30 ||
          !Number.isInteger(bonus) || bonus < -10 || bonus > 30 || !Number.isInteger(d20) || d20 < 0 || d20 > 20)
        return { erro:'Confira nome, AGI, bônus de Iniciativa e resultado do d20 de cada participante.' };
      if (tipo==='personagem' && bonus!==agi) return { erro:'Para Personagens, o bônus de Iniciativa deve ser igual à AGI.' };
      const chave=nome.toLocaleLowerCase('pt-BR');
      if (nomes.has(chave)) return { erro:'Não use nomes repetidos no mesmo combate.' };
      ids.add(id); nomes.add(chave);
      const original=anterior.participantes.find(x=>x.id===id);
      if (Array.isArray(p.condicoes) && p.condicoes.length > 30) return { erro:'Cada participante pode ter até 30 instâncias de condições.' };
      const condicoes = Array.isArray(p.condicoes) ? p.condicoes.slice(0, 30).map((x) => ({
        id: String(x.id || require('crypto').randomUUID()).slice(0, 40),
        nome: String(x.nome || '').trim().slice(0, 60),
        duracao: String(x.duracao || '').trim().slice(0, 80),
        observacao: String(x.observacao || '').trim().slice(0, 300)
      })).filter(x => x.nome) : (original?.condicoes || []);
      const participante={ id,nome,tipo,agi,bonusIniciativa:bonus,d20,iniciativa:d20?d20+bonus:0,condicoes,
        entradaTardia:original?original.entradaTardia:Boolean(p.entradaTardia),ordem:original?original.ordem:i };
      if(tipo==='criatura' && p.criaturaId){
        const pvMaximo=Number(p.pvMaximo),pvAtual=Number(p.pvAtual),defesa=Number(p.defesa);
        if(typeof p.criaturaId!=='string'||p.criaturaId.length>80||!Number.isInteger(pvMaximo)||pvMaximo<1||pvMaximo>9999||
          !Number.isInteger(pvAtual)||pvAtual<0||pvAtual>pvMaximo||!Number.isInteger(defesa)||defesa<0||defesa>100||
          typeof p.movimento!=='string'||p.movimento.length>80) return {erro:'Dados de ficha da Criatura inválidos.'};
        const extra={criaturaId:p.criaturaId,pvAtual,pvMaximo,defesa,movimento:p.movimento};
        if(p.perseguidor){
          const pvPerseguicaoMaximo=Number(p.pvPerseguicaoMaximo),pvCombateMaximo=p.pvCombateMaximo==null?null:Number(p.pvCombateMaximo);
          if(p.fase!=='perseguicao'&&p.fase!=='combate'||!Number.isInteger(pvPerseguicaoMaximo)||pvPerseguicaoMaximo<1||pvPerseguicaoMaximo>9999||
            (pvCombateMaximo!==null&&(!Number.isInteger(pvCombateMaximo)||pvCombateMaximo<1||pvCombateMaximo>9999)))return {erro:'Dados da Fase de Perseguição inválidos.'};
          Object.assign(extra,{perseguidor:true,fase:p.fase,pvPerseguicaoMaximo,pvCombateMaximo});
        }
        Object.assign(participante,extra);
      }
      participantes.push(participante);
    }
    const rodada=Number(corpo.rodada);
    if (!Number.isInteger(rodada) || rodada<1 || rodada>9999) return { erro:'Rodada inválida.' };
    const turnoAtual=corpo.turnoAtual==null?null:String(corpo.turnoAtual);
    if (turnoAtual && !participantes.some(p=>p.id===turnoAtual)) return { erro:'O turno atual não pertence a este combate.' };
    return { valor:{ mesaId,versao:(Number(anterior.versao)||0)+1,combateAtivo:Boolean(corpo.combateAtivo),rodada,turnoAtual,participantes:ordenar(participantes),atualizadoEm:new Date().toISOString() } };
  }
  return {
    apagar(mesaId) {
      if (Object.prototype.hasOwnProperty.call(dados, mesaId)) {
        delete dados[mesaId];
        salvar(dados);
      }
    },
    atender(usuario,metodo,mesaId,corpo) {
      if (!ehMestre(usuario,mesaId)) return {status:403,dados:{erro:'Somente o Mestre desta Mesa pode acessar o Painel do Mestre.'}};
      const atual=dados[mesaId] || vazio(mesaId);
      if (metodo==='GET') return {status:200,dados:{combate:{...atual,versao:Number(atual.versao)||0}}};
      if (metodo!=='PUT') return {status:405,dados:{erro:'Método não permitido.'}};
      const versaoAtual=Number(atual.versao)||0;
      if (corpo?.versao !== undefined && corpo.versao !== versaoAtual) return {status:409,dados:{erro:'Este combate foi alterado em outro aparelho ou aba. Seus dados locais não foram gravados; atualize a Mesa antes de continuar.',versaoAtual}};
      const r=validar(corpo,atual,mesaId);
      if (r.erro) return {status:400,dados:{erro:r.erro}};
      dados[mesaId]=r.valor; salvar(dados);
      return {status:200,dados:{combate:dados[mesaId]}};
    }
  };
}
module.exports={criarPainelMestre};
