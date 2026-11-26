'use strict';

// Conteúdo operacional do Painel do Mestre: separado das Fichas dos Jogadores.
function criarConteudoMestre({ carregar, salvar, ehMestre }) {
  const dados = carregar() || {};
  const vazio = (mesaId) => ({ mesaId, anotacoes: '', encontros: [], documentos: [], itens: [] });

  function validarTexto(valor, maximo) {
    return typeof valor === 'string' ? valor.trim().slice(0, maximo) : '';
  }

  function normalizar(corpo, mesaId) {
    if (!corpo || typeof corpo !== 'object') return { erro: 'Conteúdo inválido.' };
    const anotacoes = validarTexto(corpo.anotacoes, 12000);
    const listas = {};
    for (const [chave, limite, campos] of [
      ['encontros', 40, ['id', 'nome', 'nivel', 'jogadores', 'dificuldade', 'pontos', 'composicao', 'cenario', 'direcao']],
      ['documentos', 60, ['id', 'titulo', 'tipo', 'conteudo', 'visivel']],
      ['itens', 100, ['id', 'nome', 'categoria', 'descricao', 'efeito']]
    ]) {
      const origem = Array.isArray(corpo[chave]) ? corpo[chave] : [];
      if (origem.length > limite) return { erro: 'Limite de registros excedido em ' + chave + '.' };
      listas[chave] = origem.map((item) => {
        const novo = {};
        for (const campo of campos) {
          if (campo === 'visivel') novo.visivel = Boolean(item.visivel);
          else if (['nivel', 'jogadores', 'pontos'].includes(campo)) novo[campo] = Number.isFinite(Number(item[campo])) ? Math.max(0, Math.min(100, Math.round(Number(item[campo])))) : 0;
          else novo[campo] = validarTexto(item[campo], campo === 'conteudo' || campo === 'descricao' || campo === 'direcao' || campo === 'cenario' || campo === 'efeito' || campo === 'composicao' ? 12000 : 100);
        }
        if (!novo.id) novo.id = require('crypto').randomUUID();
        return novo;
      });
    }
    return { valor: { mesaId, anotacoes, ...listas, atualizadoEm: new Date().toISOString() } };
  }

  return {
    documentosPublicos(mesaId) {
      return (dados[mesaId]?.documentos || []).filter(doc => doc.visivel).map(({ id, titulo, tipo, conteudo }) => ({ id, titulo, tipo, conteudo }));
    },
    apagar(mesaId) {
      if (Object.prototype.hasOwnProperty.call(dados, mesaId)) {
        delete dados[mesaId];
        salvar(dados);
      }
    },
    atender(usuario, metodo, mesaId, corpo) {
      if (!ehMestre(usuario, mesaId)) return { status: 403, dados: { erro: 'Somente o Mestre desta Mesa pode acessar estes recursos.' } };
      if (metodo === 'GET') return { status: 200, dados: { conteudo: dados[mesaId] || vazio(mesaId) } };
      if (metodo !== 'PUT') return { status: 405, dados: { erro: 'Método não permitido.' } };
      const r = normalizar(corpo, mesaId);
      if (r.erro) return { status: 400, dados: { erro: r.erro } };
      dados[mesaId] = r.valor;
      salvar(dados);
      return { status: 200, dados: { conteudo: dados[mesaId] } };
    }
  };
}

module.exports = { criarConteudoMestre };
