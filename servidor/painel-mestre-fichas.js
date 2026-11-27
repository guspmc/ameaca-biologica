'use strict';

/*
 * Projeção operacional das Fichas para o Painel do Mestre.
 * As dependências de regras são injetadas para manter este módulo isolado
 * enquanto servidor/fichas.js e app/js/regras.js permanecem na main do Claude.
 */
const mesmo = (a, b) => String(a ?? '').toLocaleLowerCase('pt-BR') === String(b ?? '').toLocaleLowerCase('pt-BR');

function criarResumoFichasMestre({ carregar, infoMesa, calcular, condicoesCatalogo = [] }) {
  if (typeof calcular !== 'function') throw new TypeError('A função calcular das regras é obrigatória.');

  return {
    listar(mesaId, usuario) {
      const info = infoMesa(mesaId);
      if (!info) return { ok: false, status: 404, erro: 'Mesa não encontrada ou encerrada.' };
      if (!mesmo(info.mestre, usuario)) return { ok: false, status: 403, erro: 'Somente o Mestre desta Mesa pode consultar os dados operacionais.' };

      const aprovados = new Set((Array.isArray(info.aprovados) ? info.aprovados : []).map((nome) => String(nome).toLocaleLowerCase('pt-BR')));
      const todas = carregar() || {};
      const fichasMesa = todas[mesaId] && typeof todas[mesaId] === 'object' ? Object.values(todas[mesaId]) : [];
      const catalogo = new Map(condicoesCatalogo.map((c) => [c.id, c.nome]));

      const fichas = fichasMesa
        .filter((f) => f && f.estado === 'ativa' && aprovados.has(String(f.usuario ?? '').toLocaleLowerCase('pt-BR')))
        .map((f) => {
          const dados = f.dados || {};
          const calculados = calcular(dados);
          const condicoes = Array.isArray(dados.jogo?.condicoes) ? dados.jogo.condicoes : [];

          // Lista explícita de campos permitidos. Não incluir dados, atributos,
          // perícias, habilidades, história, conceito, inventário ou anotações.
          return {
            id: String(f.id || ''),
            jogador: String(f.usuario || ''),
            personagem: String(dados.nome || ''),
            nivel: Number(dados.nivel) || 1,
            pv: { atual: calculados.pv, maximo: calculados.pvMax, temporarios: calculados.pvTemp },
            sa: { atual: calculados.sa, maximo: calculados.saMax },
            bi: { atual: calculados.bi, maximo: calculados.biMax, fase: calculados.faseBI?.fase ?? null },
            defesa: calculados.defesa,
            reducaoDano: calculados.rd,
            iniciativa: calculados.iniciativa,
            movimento: calculados.movimento,
            condicoes: condicoes.map((id) => ({ id, nome: catalogo.get(id) || id })),
          };
        });

      return { ok: true, status: 200, fichas };
    },
  };
}

module.exports = { criarResumoFichasMestre };
