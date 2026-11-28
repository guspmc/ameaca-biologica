'use strict';

// Conteúdo operacional do Painel do Mestre: separado das Fichas dos Jogadores.
function criarConteudoMestre({ carregar, salvar, ehMestre }) {
  const dados = carregar() || {};
  const vazio = (mesaId) => ({ mesaId, versao: 0, anotacoes: '', encontros: [], documentos: [], itens: [] });

  function validarTexto(valor, maximo) {
    return typeof valor === 'string' ? valor.trim().slice(0, maximo) : '';
  }

  function normalizar(corpo, mesaId, versao) {
    if (!corpo || typeof corpo !== 'object') return { erro: 'Conteúdo inválido.' };
    const anotacoes = validarTexto(corpo.anotacoes, 12000);
    const listas = {};
    for (const [chave, limite, campos] of [
      ['encontros', 40, ['id', 'nome', 'nivel', 'jogadores', 'dificuldade', 'pontos', 'orcamento', 'composicao', 'criaturas', 'cenario', 'direcao']],
      ['documentos', 60, ['id', 'titulo', 'tipo', 'conteudo', 'arquivoUrl', 'visivel']],
      ['itens', 100, ['id', 'nome', 'categoria', 'descricao', 'efeito', 'imagemUrl', 'visivel']]
    ]) {
      const origem = Array.isArray(corpo[chave]) ? corpo[chave] : [];
      if (origem.length > limite) return { erro: 'Limite de registros excedido em ' + chave + '.' };
      if (origem.some(item => !item || typeof item !== 'object' || Array.isArray(item))) return { erro: 'Há um registro inválido em ' + chave + '.' };
      if (chave === 'encontros' && origem.some(item => Array.isArray(item?.criaturas) && item.criaturas.length > 30)) return { erro: 'Um encontro pode conter até 30 tipos de criaturas.' };
      listas[chave] = origem.map((item) => {
        const novo = {};
        for (const campo of campos) {
          if (campo === 'criaturas') {
            novo.criaturas = Array.isArray(item.criaturas) ? item.criaturas.slice(0,30).map(c => ({
              id: validarTexto(c?.id, 80),
              quantidade: Number.isInteger(Number(c?.quantidade)) ? Math.max(1, Math.min(20, Number(c.quantidade))) : 1
            })).filter(c => c.id) : [];
          }
          else if (campo === 'visivel') novo.visivel = Boolean(item.visivel);
          else if (campo === 'imagemUrl' || campo === 'arquivoUrl') {
            const url = validarTexto(item[campo], 1000);
            try { const parsed = new URL(url); novo[campo] = ['http:', 'https:'].includes(parsed.protocol) ? url : ''; }
            catch { novo[campo] = ''; }
          }
          else if (['nivel', 'jogadores', 'pontos', 'orcamento'].includes(campo)) novo[campo] = Number.isFinite(Number(item[campo])) ? Math.max(0, Math.min(100, Math.round(Number(item[campo])))) : 0;
          else novo[campo] = validarTexto(item[campo], campo === 'conteudo' || campo === 'descricao' || campo === 'direcao' || campo === 'cenario' || campo === 'efeito' || campo === 'composicao' ? 12000 : 100);
        }
        if (!novo.id) novo.id = require('crypto').randomUUID();
        return novo;
      });
    }
    return { valor: { mesaId, versao, anotacoes, ...listas, atualizadoEm: new Date().toISOString() } };
  }

  return {
    publicacoes(mesaId) {
      const mesa = dados[mesaId] || vazio(mesaId);
      return {
        documentos: mesa.documentos.filter(doc => doc.visivel).map(({ id, titulo, tipo, conteudo, arquivoUrl }) => ({ id, titulo, tipo, conteudo, arquivoUrl })),
        itens: mesa.itens.filter(item => item.visivel).map(({ id, nome, categoria, descricao, efeito, imagemUrl }) => ({ id, nome, categoria, descricao, efeito, imagemUrl }))
      };
    },
    documentosPublicos(mesaId) {
      return this.publicacoes(mesaId).documentos;
    },
    apagar(mesaId) {
      if (Object.prototype.hasOwnProperty.call(dados, mesaId)) {
        delete dados[mesaId];
        salvar(dados);
      }
    },
    atender(usuario, metodo, mesaId, corpo) {
      if (!ehMestre(usuario, mesaId)) return { status: 403, dados: { erro: 'Somente o Mestre desta Mesa pode acessar estes recursos.' } };
      if (metodo === 'GET') {
        const atual = dados[mesaId] || vazio(mesaId);
        return { status: 200, dados: { conteudo: { ...atual, versao: Number(atual.versao) || 0 } } };
      }
      if (metodo !== 'PUT') return { status: 405, dados: { erro: 'Método não permitido.' } };
      const atual = dados[mesaId] || vazio(mesaId);
      const versaoAtual = Number(atual.versao) || 0;
      if (!Number.isInteger(corpo?.versao) || corpo.versao !== versaoAtual) {
        return { status: 409, dados: { erro: 'O conteúdo da Mesa foi alterado em outro aparelho ou aba. Suas alterações locais não foram gravadas; carregue a versão do servidor antes de continuar.', versaoAtual } };
      }
      const r = normalizar(corpo, mesaId, versaoAtual + 1);
      if (r.erro) return { status: 400, dados: { erro: r.erro } };
      dados[mesaId] = r.valor;
      salvar(dados);
      return { status: 200, dados: { conteudo: dados[mesaId] } };
    }
  };
}

module.exports = { criarConteudoMestre };
