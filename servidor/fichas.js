'use strict';
/*
 * Regras das Fichas de Personagem (sem HTTP).
 * Fichas ficam em dados/fichas.json: { mesaId: { fichaId: ficha } }
 * Estados: 'rascunho' | 'pendente' | 'ativa'
 *
 * Regras:
 *   - Mestre NÃO tem acesso ao conteúdo das Fichas; vê só nome do jogador + nome do personagem.
 *   - Jogador pode ter até LIMITES.rascunhos rascunhos e LIMITES.ativas fichas ativas.
 *   - Rascunho pode ser editado livremente; Ativa só permite alterar campos de jogo (pv, sa, bi...).
 *   - Pendente está bloqueada até o Mestre aprovar ou recusar.
 *   - Nível da Ficha não pode passar do limiteNivel da Mesa.
 */

const crypto = require('crypto');
const REGRAS = require('../app/js/regras.js');
const mesmo = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
const erro = (status, mensagem) => ({ ok: false, status, erro: mensagem });

function criarFichas({ carregar, salvar, infoMesa }) {
  // fichas: { mesaId: { fichaId: ficha } }
  const fichas = carregar();
  const gravar = () => salvar(fichas);

  function porMesa(mesaId) {
    return fichas[mesaId] || {};
  }

  function doJogador(mesaId, usuario) {
    return Object.values(porMesa(mesaId)).filter((f) => mesmo(f.usuario, usuario));
  }

  function achar(mesaId, fichaId) {
    return (fichas[mesaId] || {})[fichaId] || null;
  }

  // Garante que a Mesa existe e o usuário é membro aprovado (ou o Mestre).
  function verificarAcesso(mesaId, usuario) {
    const info = infoMesa(mesaId);
    if (!info) return { falha: erro(404, 'Mesa não encontrada ou encerrada.') };
    // Mestre pode ver as fichas (mas só vê nome, não os dados completos — aplicado nas rotas).
    if (mesmo(info.mestre, usuario)) return { info, papel: 'mestre' };
    const estaAprovado = info.aprovados.some((u) => mesmo(u, usuario));
    if (!estaAprovado) return { falha: erro(403, 'Você não está aprovado nesta Mesa.') };
    return { info, papel: 'jogador' };
  }

  return {
    // ---- Leitura ----

    // Jogador lista suas fichas; Mestre lista só id+usuario+personagem (sem dados completos).
    listar(mesaId, usuario) {
      const r = verificarAcesso(mesaId, usuario);
      if (r.falha) return r.falha;

      if (r.papel === 'mestre') {
        // Mestre vê apenas identificação de cada ficha.
        const lista = Object.values(porMesa(mesaId)).map((f) => ({
          id: f.id,
          usuario: f.usuario,
          personagem: f.dados.nome,
          estado: f.estado,
          atualizadaEm: f.atualizadaEm,
        }));
        return { ok: true, status: 200, fichas: lista };
      }

      // Jogador vê suas fichas completas.
      const lista = doJogador(mesaId, usuario).map((f) => ({
        id: f.id,
        estado: f.estado,
        personagem: f.dados.nome,
        criadaEm: f.criadaEm,
        atualizadaEm: f.atualizadaEm,
        dados: f.dados,
      }));
      return { ok: true, status: 200, fichas: lista };
    },

    obter(mesaId, usuario, fichaId) {
      const r = verificarAcesso(mesaId, usuario);
      if (r.falha) return r.falha;
      const f = achar(mesaId, fichaId);
      if (!f) return erro(404, 'Ficha não encontrada.');

      if (r.papel === 'mestre') {
        // Mestre só vê identificação.
        return { ok: true, status: 200, ficha: { id: f.id, usuario: f.usuario, personagem: f.dados.nome, estado: f.estado } };
      }
      if (!mesmo(f.usuario, usuario)) return erro(403, 'Esta ficha não é sua.');
      return { ok: true, status: 200, ficha: { id: f.id, estado: f.estado, dados: f.dados } };
    },

    // ---- Criação ----

    criar(mesaId, usuario) {
      const r = verificarAcesso(mesaId, usuario);
      if (r.falha) return r.falha;
      if (r.papel === 'mestre') return erro(403, 'O Mestre não cria Fichas de Personagem.');

      const minhas = doJogador(mesaId, usuario);
      const rascunhos = minhas.filter((f) => f.estado === 'rascunho').length;
      if (rascunhos >= REGRAS.LIMITES.rascunhos) {
        return erro(409, `Você já tem ${REGRAS.LIMITES.rascunhos} rascunhos. Exclua um antes de criar outro.`);
      }

      const id = crypto.randomBytes(8).toString('hex');
      const agora = new Date().toISOString();
      if (!fichas[mesaId]) fichas[mesaId] = {};
      fichas[mesaId][id] = {
        id,
        usuario,
        estado: 'rascunho',
        criadaEm: agora,
        atualizadaEm: agora,
        dados: REGRAS.novaFicha(),
      };
      gravar();
      return { ok: true, status: 201, id };
    },

    // ---- Edição ----

    // Rascunho: salva dados normalizados (tudo, exceto limite de nível).
    // Ativa: salva só campos de jogo (pv, pvTemp, sa, bi, condicoes) e inventário (itens, moedas, anotações).
    // Pendente: bloqueada.
    salvar(mesaId, usuario, fichaId, dadosEntrada) {
      const r = verificarAcesso(mesaId, usuario);
      if (r.falha) return r.falha;
      if (r.papel === 'mestre') return erro(403, 'O Mestre não edita Fichas de Personagem.');

      const f = achar(mesaId, fichaId);
      if (!f) return erro(404, 'Ficha não encontrada.');
      if (!mesmo(f.usuario, usuario)) return erro(403, 'Esta ficha não é sua.');
      if (f.estado === 'pendente') return erro(409, 'Esta ficha está aguardando aprovação. Retire a solicitação para editá-la.');

      if (f.estado === 'rascunho') {
        f.dados = REGRAS.normalizar(dadosEntrada);
      } else {
        // Ativa: só campos de jogo.
        const j = dadosEntrada && dadosEntrada.jogo ? dadosEntrada.jogo : {};
        const atual = REGRAS.calcular(f.dados);
        const e = dadosEntrada || {};
        const novo = REGRAS.normalizar({
          ...f.dados,
          jogo: j,
          itens: Array.isArray(e.itens) ? e.itens : f.dados.itens,
          moedas: e.moedas !== undefined ? e.moedas : f.dados.moedas,
          anotacoes: e.anotacoes !== undefined ? e.anotacoes : f.dados.anotacoes,
        });
        // Garante que pv/sa não passam do máximo atual.
        if (novo.jogo.pv !== null) novo.jogo.pv = Math.min(novo.jogo.pv, atual.pvMax);
        if (novo.jogo.sa !== null) novo.jogo.sa = Math.min(novo.jogo.sa, atual.saMax);
        f.dados = novo;
      }

      f.atualizadaEm = new Date().toISOString();
      gravar();
      return { ok: true, status: 200, id: fichaId };
    },

    excluir(mesaId, usuario, fichaId) {
      const r = verificarAcesso(mesaId, usuario);
      if (r.falha) return r.falha;
      if (r.papel === 'mestre') return erro(403, 'O Mestre não exclui Fichas de Personagem.');

      const f = achar(mesaId, fichaId);
      if (!f) return erro(404, 'Ficha não encontrada.');
      if (!mesmo(f.usuario, usuario)) return erro(403, 'Esta ficha não é sua.');
      if (f.estado === 'ativa') return erro(409, 'Desative a ficha antes de excluí-la.');

      delete fichas[mesaId][fichaId];
      gravar();
      return { ok: true, status: 200, id: fichaId };
    },

    // ---- Fluxo de aprovação ----

    solicitar(mesaId, usuario, fichaId) {
      const r = verificarAcesso(mesaId, usuario);
      if (r.falha) return r.falha;
      if (r.papel === 'mestre') return erro(403, 'O Mestre não solicita aprovação de Fichas.');

      const f = achar(mesaId, fichaId);
      if (!f) return erro(404, 'Ficha não encontrada.');
      if (!mesmo(f.usuario, usuario)) return erro(403, 'Esta ficha não é sua.');
      if (f.estado !== 'rascunho') return erro(409, 'Só rascunhos podem ser enviados para aprovação.');

      // Validar segundo as regras do livro + limite de nível da Mesa.
      const info = r.info;
      const v = REGRAS.validar(f.dados, { limiteNivel: info.limiteNivel });
      if (v.erros.length > 0 || v.pendencias.length > 0) {
        return erro(422, 'A ficha tem problemas: ' + [...v.erros, ...v.pendencias].join(' | '));
      }

      // Verificar limite de fichas ativas+pendentes.
      const minhas = doJogador(mesaId, usuario);
      const contagem = minhas.filter((x) => x.id !== fichaId && (x.estado === 'ativa' || x.estado === 'pendente')).length;
      if (contagem >= REGRAS.LIMITES.ativas) {
        return erro(409, `Você já tem ${REGRAS.LIMITES.ativas} fichas ativas ou pendentes.`);
      }

      f.estado = 'pendente';
      f.atualizadaEm = new Date().toISOString();
      gravar();
      return { ok: true, status: 200, id: fichaId, avisar: info.membros };
    },

    // Jogador retira o pedido (volta para rascunho).
    retirar(mesaId, usuario, fichaId) {
      const r = verificarAcesso(mesaId, usuario);
      if (r.falha) return r.falha;
      if (r.papel === 'mestre') return erro(403, 'O Mestre não retira solicitações de Fichas.');

      const f = achar(mesaId, fichaId);
      if (!f) return erro(404, 'Ficha não encontrada.');
      if (!mesmo(f.usuario, usuario)) return erro(403, 'Esta ficha não é sua.');
      if (f.estado !== 'pendente') return erro(409, 'Esta ficha não está aguardando aprovação.');

      f.estado = 'rascunho';
      f.atualizadaEm = new Date().toISOString();
      gravar();
      return { ok: true, status: 200, id: fichaId };
    },

    // Jogador desativa uma ficha ativa (volta para rascunho).
    desativar(mesaId, usuario, fichaId) {
      const r = verificarAcesso(mesaId, usuario);
      if (r.falha) return r.falha;
      if (r.papel === 'mestre') return erro(403, 'O Mestre não desativa Fichas de Personagem.');

      const f = achar(mesaId, fichaId);
      if (!f) return erro(404, 'Ficha não encontrada.');
      if (!mesmo(f.usuario, usuario)) return erro(403, 'Esta ficha não é sua.');
      if (f.estado !== 'ativa') return erro(409, 'Só fichas ativas podem ser desativadas.');

      f.estado = 'rascunho';
      f.atualizadaEm = new Date().toISOString();
      gravar();
      return { ok: true, status: 200, id: fichaId };
    },

    // ---- Mestre: aprovar / recusar ----

    // Lista solicitações pendentes para o Mestre (só id, jogador, personagem — sem conteúdo).
    solicitacoes(mesaId, usuario) {
      const info = infoMesa(mesaId);
      if (!info) return erro(404, 'Mesa não encontrada ou encerrada.');
      if (!mesmo(info.mestre, usuario)) return erro(403, 'Só o Mestre pode ver as solicitações.');

      const lista = Object.values(porMesa(mesaId))
        .filter((f) => f.estado === 'pendente')
        .map((f) => ({ id: f.id, usuario: f.usuario, personagem: f.dados.nome, enviadaEm: f.atualizadaEm }));
      return { ok: true, status: 200, solicitacoes: lista };
    },

    // acao: 'aprovar' | 'recusar'
    decidir(mesaId, usuario, fichaId, acao) {
      const info = infoMesa(mesaId);
      if (!info) return erro(404, 'Mesa não encontrada ou encerrada.');
      if (!mesmo(info.mestre, usuario)) return erro(403, 'Só o Mestre pode aprovar ou recusar Fichas.');

      const f = achar(mesaId, fichaId);
      if (!f) return erro(404, 'Ficha não encontrada.');
      if (f.estado !== 'pendente') return erro(409, 'Esta ficha não está aguardando aprovação.');

      if (acao === 'aprovar') {
        // Revalida na hora da aprovação (limiteNivel pode ter mudado).
        const v = REGRAS.validar(f.dados, { limiteNivel: info.limiteNivel });
        if (v.erros.length > 0) {
          return erro(422, 'A ficha tem erros que impedem a aprovação: ' + v.erros.join(' | '));
        }
        f.estado = 'ativa';
      } else if (acao === 'recusar') {
        f.estado = 'rascunho';
      } else {
        return erro(404, 'Ação desconhecida.');
      }

      f.atualizadaEm = new Date().toISOString();
      gravar();
      return { ok: true, status: 200, id: fichaId, avisar: info.membros };
    },

    // Limpa todas as fichas de uma Mesa encerrada.
    purgar(mesaId) {
      if (fichas[mesaId]) {
        delete fichas[mesaId];
        gravar();
      }
    },
  };
}

module.exports = { criarFichas };
