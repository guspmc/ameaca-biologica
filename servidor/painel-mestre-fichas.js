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
      const nomesCondicoes = new Map((Array.isArray(condicoesCatalogo) ? condicoesCatalogo : []).map((c) => [String(c.id), String(c.nome)]));
      const fichas = fichasMesa
        .filter((f) => f && f.estado === 'ativa' && aprovados.has(String(f.usuario ?? '').toLocaleLowerCase('pt-BR')))
        .map((f) => {
          const dados = f.dados || {};
          const calculados = calcular(dados);
          // Lista explícita e mínima de campos permitidos ao Mestre: somente leitura.
          return {
            id: String(f.id || ''),
            jogador: String(f.usuario || ''),
            personagem: String(dados.nome || ''),
            pv: { atual: calculados.pv, maximo: calculados.pvMax },
            sa: { atual: calculados.sa, maximo: calculados.saMax },
            bi: { atual: calculados.bi, maximo: calculados.biMax },
            defesa: calculados.defesa,
            iniciativa: calculados.iniciativa,
            condicoes: (Array.isArray(dados.jogo?.condicoes) ? dados.jogo.condicoes : [])
              .map((id) => nomesCondicoes.get(String(id)))
              .filter(Boolean),
            periciasPassivas: {
              percepcao: calculados.passivos?.percepcao ?? null,
              fortitude: calculados.passivos?.fortitude ?? null,
              reflexos: calculados.passivos?.reflexos ?? null,
              vontade: calculados.passivos?.vontade ?? null,
            },
          };
        });

      return { ok: true, status: 200, fichas };
    },
  };
}

module.exports = { criarResumoFichasMestre };
