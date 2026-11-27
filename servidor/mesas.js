'use strict';
/*
 * Regras das Mesas (sem HTTP): criar, entrar por código, aprovar jogadores, limites.
 * Cada função devolve { ok: true, ... } ou { ok: false, status, erro }.
 * `avisar` lista quem deve receber um aviso em tempo real depois da mudança.
 *
 * O Mestre não tem acesso às Fichas dos Jogadores (elas ainda não existem neste módulo
 * e, quando existirem, ficam fora das visões do Mestre).
 */

const crypto = require('crypto');

// Sem I, L, O, 0 e 1, para o código não ser confundido ao ser lido em voz alta.
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const TAM_CODIGO = 6;

const LIMITES = {
  jogadoresMin: 2, // 1 Mestre + 2 Jogadores = 3 pessoas
  jogadoresMax: 9, // 1 Mestre + 9 Jogadores = 10 pessoas
  nivelMin: 1,
  nivelMax: 10, // o livro tem Níveis de 1 a 10
  mesasNoServidor: 30,
  mesasPorMestre: 5,
  pedidosPorMesa: 20,
};

const erro = (status, mensagem) => ({ ok: false, status, erro: mensagem });
const mesmo = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
const normalizarCodigo = (texto) => String(texto ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const formatarCodigo = (codigo) => `${codigo.slice(0, 3)}-${codigo.slice(3)}`;

function validarNome(valor) {
  const nome = String(valor ?? '').replace(/\s+/g, ' ').trim();
  if (nome.length < 2 || nome.length > 40 || /[\u0000-\u001f\u007f]/.test(nome)) {
    return { erro: 'O nome da Mesa deve ter de 2 a 40 caracteres.' };
  }
  return { valor: nome };
}

function validarInteiro(valor, minimo, maximo, rotulo) {
  const n = Number(valor);
  if (!Number.isInteger(n) || n < minimo || n > maximo) {
    return { erro: `${rotulo} deve ser um número de ${minimo} a ${maximo}.` };
  }
  return { valor: n };
}

function criarMesas({ carregar, salvar }) {
  const mesas = carregar(); // { id: mesa }
  const gravar = () => salvar(mesas);

  const aprovados = (m) => m.jogadores.filter((j) => j.status === 'aprovado');
  const pendentes = (m) => m.jogadores.filter((j) => j.status === 'pendente');
  const membros = (m) => [m.mestre, ...m.jogadores.map((j) => j.usuario)];
  const acharJogador = (m, nome) => m.jogadores.find((j) => mesmo(j.usuario, nome));

  function gerarCodigo() {
    for (;;) {
      let codigo = '';
      for (const byte of crypto.randomBytes(TAM_CODIGO)) codigo += ALFABETO[byte % ALFABETO.length];
      if (!Object.values(mesas).some((m) => m.codigo === codigo)) return codigo;
    }
  }

  // Quem não faz parte da Mesa recebe "não encontrada", sem saber que ela existe.
  function mesaDoMembro(usuario, id) {
    const m = mesas[id];
    if (!m || !(mesmo(m.mestre, usuario) || acharJogador(m, usuario))) {
      return { falha: erro(404, 'Mesa não encontrada. Ela pode ter sido encerrada.') };
    }
    return { m };
  }

  function mesaDoMestre(usuario, id) {
    const r = mesaDoMembro(usuario, id);
    if (r.falha) return r;
    if (!mesmo(r.m.mestre, usuario)) return { falha: erro(403, 'Só o Mestre pode fazer isso.') };
    return r;
  }

  function resumo(m, usuario) {
    const base = {
      id: m.id,
      nome: m.nome,
      mestre: m.mestre,
      limiteJogadores: m.limiteJogadores,
      limiteNivel: m.limiteNivel,
      aprovados: aprovados(m).length,
      criadaEm: m.criadaEm,
    };
    if (mesmo(m.mestre, usuario)) return { ...base, papel: 'mestre', pendentes: pendentes(m).length };
    return { ...base, papel: 'jogador', status: acharJogador(m, usuario).status };
  }

  return {
    limites: LIMITES,

    listar(usuario) {
      const lista = Object.values(mesas)
        .filter((m) => mesmo(m.mestre, usuario) || acharJogador(m, usuario))
        .map((m) => resumo(m, usuario))
        .sort((a, b) => (a.criadaEm < b.criadaEm ? 1 : -1));
      return { ok: true, status: 200, mesas: lista };
    },

    criar(usuario, campos) {
      const nome = validarNome(campos.nome);
      if (nome.erro) return erro(400, nome.erro);
      const jogadores = validarInteiro(campos.limiteJogadores, LIMITES.jogadoresMin, LIMITES.jogadoresMax, 'O limite de jogadores');
      if (jogadores.erro) return erro(400, jogadores.erro);
      const nivel = validarInteiro(campos.limiteNivel, LIMITES.nivelMin, LIMITES.nivelMax, 'O nível máximo');
      if (nivel.erro) return erro(400, nivel.erro);

      const todas = Object.values(mesas);
      if (todas.length >= LIMITES.mesasNoServidor) return erro(409, 'Este servidor atingiu o limite de Mesas. Encerre alguma Mesa antiga.');
      if (todas.filter((m) => mesmo(m.mestre, usuario)).length >= LIMITES.mesasPorMestre) {
        return erro(409, `Você já é Mestre de ${LIMITES.mesasPorMestre} Mesas. Encerre uma antes de criar outra.`);
      }

      const id = crypto.randomBytes(6).toString('hex');
      mesas[id] = {
        id,
        nome: nome.valor,
        codigo: gerarCodigo(),
        mestre: usuario,
        limiteJogadores: jogadores.valor,
        limiteNivel: nivel.valor,
        criadaEm: new Date().toISOString(),
        jogadores: [],
      };
      gravar();
      return { ok: true, status: 201, id, avisar: [usuario] };
    },

    detalhe(usuario, id) {
      const r = mesaDoMembro(usuario, id);
      if (r.falha) return r.falha;
      const m = r.m;
      const base = {
        id: m.id,
        nome: m.nome,
        mestre: m.mestre,
        limiteJogadores: m.limiteJogadores,
        limiteNivel: m.limiteNivel,
      };
      if (mesmo(m.mestre, usuario)) {
        return {
          ok: true,
          status: 200,
          mesa: {
            ...base,
            papel: 'mestre',
            codigo: m.codigo,
            codigoFormatado: formatarCodigo(m.codigo),
            jogadores: m.jogadores.map((j) => ({ usuario: j.usuario, status: j.status, desde: j.desde })),
          },
        };
      }
      const eu = acharJogador(m, usuario);
      return {
        ok: true,
        status: 200,
        mesa: {
          ...base,
          papel: 'jogador',
          status: eu.status,
          // Quem ainda não foi aprovado não vê quem está na Mesa.
          jogadores: eu.status === 'aprovado' ? aprovados(m).map((j) => ({ usuario: j.usuario, status: j.status })) : [],
        },
      };
    },

    entrar(usuario, codigoDigitado) {
      const codigo = normalizarCodigo(codigoDigitado);
      if (codigo.length !== TAM_CODIGO) return erro(400, `Digite o código da Mesa (${TAM_CODIGO} letras e números).`);
      const m = Object.values(mesas).find((x) => x.codigo === codigo);
      if (!m) return erro(404, 'Nenhuma Mesa com esse código. Confira com o Mestre.');

      // Quem já faz parte da Mesa (inclusive o Mestre) só precisa entrar uma vez: abre a Mesa.
      if (mesmo(m.mestre, usuario)) return { ok: true, status: 200, id: m.id, papel: 'mestre' };
      const existente = acharJogador(m, usuario);
      if (existente) return { ok: true, status: 200, id: m.id, papel: 'jogador', status_jogador: existente.status };

      if (aprovados(m).length >= m.limiteJogadores) return erro(409, 'Esta Mesa já está cheia.');
      if (pendentes(m).length >= LIMITES.pedidosPorMesa) return erro(409, 'Há pedidos demais aguardando o Mestre desta Mesa.');

      m.jogadores.push({ usuario, status: 'pendente', desde: new Date().toISOString() });
      gravar();
      return { ok: true, status: 200, id: m.id, papel: 'jogador', status_jogador: 'pendente', avisar: membros(m) };
    },

    // acao: 'aprovar' | 'recusar' | 'remover'
    decidir(usuario, id, alvo, acao) {
      const r = mesaDoMestre(usuario, id);
      if (r.falha) return r.falha;
      const m = r.m;
      const jogador = acharJogador(m, alvo);
      if (!jogador) return erro(404, 'Jogador não encontrado nesta Mesa.');
      const avisar = membros(m);

      if (acao === 'aprovar') {
        if (jogador.status !== 'pendente') return erro(409, 'Este jogador já foi aprovado.');
        if (aprovados(m).length >= m.limiteJogadores) {
          return erro(409, `A Mesa já tem ${m.limiteJogadores} jogadores. Aumente o limite ou remova alguém antes de aprovar.`);
        }
        jogador.status = 'aprovado';
      } else if (acao === 'recusar') {
        if (jogador.status !== 'pendente') return erro(409, 'Este jogador já foi aprovado. Use "Remover".');
        m.jogadores.splice(m.jogadores.indexOf(jogador), 1);
      } else if (acao === 'remover') {
        if (jogador.status !== 'aprovado') return erro(409, 'Este pedido ainda não foi aprovado. Use "Recusar".');
        m.jogadores.splice(m.jogadores.indexOf(jogador), 1);
      } else {
        return erro(404, 'Rota não encontrada.');
      }
      gravar();
      return { ok: true, status: 200, id: m.id, avisar };
    },

    configurar(usuario, id, campos) {
      const r = mesaDoMestre(usuario, id);
      if (r.falha) return r.falha;
      const m = r.m;
      const novo = {};

      if (campos.nome !== undefined) {
        const nome = validarNome(campos.nome);
        if (nome.erro) return erro(400, nome.erro);
        novo.nome = nome.valor;
      }
      if (campos.limiteJogadores !== undefined) {
        const j = validarInteiro(campos.limiteJogadores, LIMITES.jogadoresMin, LIMITES.jogadoresMax, 'O limite de jogadores');
        if (j.erro) return erro(400, j.erro);
        if (j.valor < aprovados(m).length) {
          return erro(409, `Há ${aprovados(m).length} jogadores aprovados: o limite não pode ser menor. Remova alguém primeiro.`);
        }
        novo.limiteJogadores = j.valor;
      }
      if (campos.limiteNivel !== undefined) {
        const n = validarInteiro(campos.limiteNivel, LIMITES.nivelMin, LIMITES.nivelMax, 'O nível máximo');
        if (n.erro) return erro(400, n.erro);
        novo.limiteNivel = n.valor;
      }

      Object.assign(m, novo);
      gravar();
      return { ok: true, status: 200, id: m.id, avisar: membros(m) };
    },

    // Gera outro código. Quem já está na Mesa continua nela.
    novoCodigo(usuario, id) {
      const r = mesaDoMestre(usuario, id);
      if (r.falha) return r.falha;
      r.m.codigo = gerarCodigo();
      gravar();
      return { ok: true, status: 200, id: r.m.id, avisar: [r.m.mestre] };
    },

    encerrar(usuario, id) {
      const r = mesaDoMestre(usuario, id);
      if (r.falha) return r.falha;
      const avisar = membros(r.m);
      delete mesas[id];
      gravar();
      return { ok: true, status: 200, id, avisar };
    },

    // Informações internas para outros módulos (ex.: fichas.js).
    // Devolve null se a Mesa não existir.
    info(id) {
      const m = mesas[id];
      if (!m) return null;
      return {
        mestre: m.mestre,
        limiteNivel: m.limiteNivel,
        membros: membros(m),
        aprovados: aprovados(m).map((j) => j.usuario),
      };
    },

    sair(usuario, id) {
      const r = mesaDoMembro(usuario, id);
      if (r.falha) return r.falha;
      const m = r.m;
      if (mesmo(m.mestre, usuario)) return erro(409, 'O Mestre não pode sair da própria Mesa. Encerre a Mesa se quiser acabar com ela.');
      const avisar = membros(m);
      m.jogadores.splice(m.jogadores.indexOf(acharJogador(m, usuario)), 1);
      gravar();
      return { ok: true, status: 200, id: m.id, avisar };
    },
  };
}

module.exports = { criarMesas, LIMITES };
