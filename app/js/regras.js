'use strict';
/*
 * Regras da Ficha de Personagem (Arquivo do Jogador v1.0, capítulos 1, 2 e 5).
 * Sem tela e sem rede: o app usa para calcular e o servidor usa para validar.
 *   normalizar(dados)         -> dados limpos e com tipos seguros
 *   calcular(dados)           -> valores derivados (PV, SA, BI, Defesa, Perícias...)
 *   validar(dados, opcoes)    -> { erros, pendencias }: erro = quebra regra; pendência = ficha ainda incompleta
 * Funciona no navegador (variável global REGRAS) e no Node (require).
 */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(require('./dados-livro.js'));
  else raiz.REGRAS = fabrica(raiz.LIVRO);
})(typeof self !== 'undefined' ? self : this, function (LIVRO) {
  const LIMITES = { rascunhos: 5, ativas: 3, nivelMax: 10, itens: 60 };
  const ATRIBUTO_IDS = LIVRO.ATRIBUTOS.map((a) => a.id);
  const PERICIA_IDS = LIVRO.PERICIAS.map((p) => p.id);
  const BONUS_IDS = ['pv', 'sa', 'bi', 'defesa', 'inventario', 'movimento'];
  const CONDICAO_IDS = LIVRO.CONDICOES.map((c) => c.id);

  const origemPorId = (id) => LIVRO.ORIGENS.find((o) => o.id === id) || null;
  const classePorId = (id) => LIVRO.CLASSES.find((c) => c.id === id) || null;
  const habilidadePorId = (id) => LIVRO.HABILIDADES.find((h) => h.id === id) || null;

  /* ---------- Limpeza ---------- */

  const texto = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, max);
  function inteiro(v, minimo, maximo, padrao) {
    const n = Math.trunc(Number(v));
    if (!Number.isFinite(n)) return padrao;
    return Math.min(maximo, Math.max(minimo, n));
  }
  const dentro = (v, lista) => (lista.includes(v) ? v : '');

  function novaFicha() {
    return normalizar({});
  }

  function normalizar(entrada) {
    const d = entrada && typeof entrada === 'object' ? entrada : {};
    const origem = dentro(d.origem, LIVRO.ORIGENS.map((o) => o.id));
    const atributos = {};
    for (const id of ATRIBUTO_IDS) atributos[id] = inteiro(d.atributos && d.atributos[id], 0, 5, 1);
    const pericias = {};
    for (const id of PERICIA_IDS) pericias[id] = inteiro(d.pericias && d.pericias[id], 0, 2, 0);
    const bonus = {};
    for (const id of BONUS_IDS) bonus[id] = inteiro(d.bonus && d.bonus[id], -20, 50, 0);

    const origemPericias = Array.isArray(d.origemPericias) ? d.origemPericias.slice(0, 2).map((p) => dentro(p, PERICIA_IDS)) : [];
    while (origemPericias.length < 2) origemPericias.push('');

    const habilidades = [];
    for (const id of Array.isArray(d.habilidades) ? d.habilidades : []) {
      if (habilidadePorId(id) && !habilidades.includes(id)) habilidades.push(id);
    }

    const itens = (Array.isArray(d.itens) ? d.itens : []).slice(0, LIMITES.itens).map((i) => ({
      nome: texto(i && i.nome, 60),
      espacos: inteiro(i && i.espacos, 0, 20, 1),
      nota: texto(i && i.nota, 200),
    }));

    const j = d.jogo && typeof d.jogo === 'object' ? d.jogo : {};
    const condicoes = [];
    for (const id of Array.isArray(j.condicoes) ? j.condicoes : []) {
      if (CONDICAO_IDS.includes(id) && !condicoes.includes(id)) condicoes.push(id);
    }

    return {
      nome: texto(d.nome, 40),
      conceito: texto(d.conceito, 120),
      historia: texto(d.historia, 3000),
      origem,
      origemPericias,
      origemTreino: dentro(d.origemTreino, PERICIA_IDS),
      classe: dentro(d.classe, LIVRO.CLASSES.map((c) => c.id)),
      nivel: inteiro(d.nivel, 1, LIMITES.nivelMax, 1),
      atributos,
      pericias,
      treinoExtra: dentro(d.treinoExtra, PERICIA_IDS),
      habilidades,
      equipamentoInicial: dentro(d.equipamentoInicial, ['A', 'B', 'C']),
      bonus,
      itens,
      moedas: inteiro(d.moedas, 0, 99, 0),
      anotacoes: texto(d.anotacoes, 3000),
      // Valores de jogo (mudam durante a partida). null = "cheio" (igual ao máximo).
      jogo: {
        pv: j.pv == null ? null : inteiro(j.pv, 0, 999, 0),
        pvTemp: inteiro(j.pvTemp, 0, 999, 0),
        sa: j.sa == null ? null : inteiro(j.sa, 0, 99, 0),
        bi: inteiro(j.bi, 0, 999, 0),
        condicoes,
      },
    };
  }

  /* ---------- Cálculos ---------- */

  const contarAte = (niveis, nivel) => niveis.filter((n) => n <= nivel).length;

  // Perícias que recebem treinamento gratuito (Origem e Tentativa e Erro).
  function periciasGratuitas(d) {
    const livres = new Set();
    if (d.origemTreino) livres.add(d.origemTreino);
    if (d.habilidades.includes('tentativa-e-erro') && d.treinoExtra) livres.add(d.treinoExtra);
    return livres;
  }

  // A "outra" Perícia da Origem entra na lista permitida da Classe na criação.
  function outraPericiaDaOrigem(d) {
    const o = origemPorId(d.origem);
    if (!o) return '';
    const duas = o.pericias || d.origemPericias;
    return duas.find((p) => p && p !== d.origemTreino) || '';
  }

  function somaBonus(d) {
    const total = { pv: 0, sa: 0, bi: 0, defesa: 0, inventario: 0, movimento: 0 };
    const fontes = [origemPorId(d.origem), ...d.habilidades.map(habilidadePorId)];
    for (const fonte of fontes) {
      if (fonte && fonte.bonus) for (const k of BONUS_IDS) total[k] += fonte.bonus[k] || 0;
    }
    for (const k of BONUS_IDS) total[k] += d.bonus[k];
    return total;
  }

  function faseBI(bi, biMax) {
    if (biMax <= 0) return { colapso: false, fase: 1 };
    if (bi >= biMax) return { colapso: true, fase: null };
    return { colapso: false, fase: Math.floor((bi * 5) / biMax) + 1 };
  }

  function calcular(d) {
    const classe = classePorId(d.classe);
    const a = d.atributos;
    const b = somaBonus(d);
    const livres = periciasGratuitas(d);

    const pericias = {};
    const graus = {};
    let gastos = 0;
    for (const p of LIVRO.PERICIAS) {
      const efetivo = Math.max(d.pericias[p.id], livres.has(p.id) ? 1 : 0);
      graus[p.id] = efetivo;
      pericias[p.id] = a[p.atributo] + LIVRO.GRAUS[efetivo].bonus;
      gastos += efetivo - (livres.has(p.id) ? 1 : 0);
    }
    const pontosTotal = classe ? classe.pontos + contarAte(LIVRO.PROGRESSAO.pontoPericia, d.nivel) : 0;

    const pvMax = classe ? (classe.pvPorNivel + a.VIG) * d.nivel + b.pv : 0;
    const saMax = Math.max(0, a.AGI + a.AST + b.sa);
    const biMax = classe ? classe.biBase + a.AST + b.bi : 0;

    const pv = d.jogo.pv == null ? pvMax : Math.min(d.jogo.pv, pvMax);
    const sa = d.jogo.sa == null ? saMax : Math.min(d.jogo.sa, saMax);
    const bi = Math.min(d.jogo.bi, Math.max(biMax, 0));

    const espacosItens = d.itens.reduce((s, i) => s + i.espacos, 0);
    const espacosMoedas = Math.ceil(d.moedas / 3);

    return {
      pvMax, saMax, biMax, pv, sa, bi, pvTemp: d.jogo.pvTemp,
      vulneravel: pvMax > 0 && pv * 5 <= pvMax,
      desacordado: pvMax > 0 && pv === 0,
      faseBI: faseBI(bi, biMax),
      defesa: 10 + a.AGI + b.defesa,
      iniciativa: a.AGI,
      movimento: 9 + b.movimento,
      inventarioMax: 4 + a.FOR + b.inventario,
      inventarioUsado: espacosItens + espacosMoedas,
      pericias, graus,
      passivos: {
        percepcao: 10 + pericias.percepcao,
        fortitude: 10 + pericias.fortitude,
        reflexos: 10 + pericias.reflexos,
        vontade: 10 + pericias.vontade,
      },
      pontosPericia: { total: pontosTotal, gastos },
      bonus: b,
    };
  }

  // Quantas Habilidades de cada tipo a personagem tem direito neste Nível.
  function vagasDeHabilidade(nivel) {
    const P = LIVRO.PROGRESSAO;
    return {
      basica: contarAte(P.basica, nivel),
      avancada: contarAte(P.avancada, nivel),
      superior: contarAte(P.superior, nivel),
      avassaladora: contarAte(P.avassaladora, nivel),
    };
  }

  // Itens que a escolha de Equipamento Inicial acrescenta (Erva Verde + Lanterna Simples + opção da Classe).
  function equipamentoInicial(classeId, opcao) {
    const classe = classePorId(classeId);
    const escolha = classe && classe.equipamento[opcao];
    if (!escolha) return null;
    return {
      itens: [...LIVRO.EQUIPAMENTO_COMUM, ...escolha.itens].map((i) => ({ nome: i.nome, espacos: i.espacos, nota: '' })),
      moedas: escolha.moedas,
    };
  }

  /* ---------- Validação ---------- */

  function validar(d, opcoes = {}) {
    const erros = [];
    const pendencias = [];
    const classe = classePorId(d.classe);
    const origem = origemPorId(d.origem);

    if (d.nome.trim().length < 2) pendencias.push('Dê um nome ao personagem.');
    if (!origem) pendencias.push('Escolha uma Origem.');
    if (!classe) pendencias.push('Escolha uma Classe.');

    if (opcoes.limiteNivel != null && d.nivel > opcoes.limiteNivel) {
      erros.push(`Esta Mesa só aceita personagens até o Nível ${opcoes.limiteNivel}.`);
    }

    // Origem
    if (origem) {
      const duas = origem.pericias || d.origemPericias;
      if (!origem.pericias) {
        if (!duas[0] || !duas[1]) pendencias.push('Amnésico: escolha duas Perícias.');
        else if (duas[0] === duas[1]) erros.push('Amnésico: as duas Perícias devem ser diferentes.');
      }
      if (!d.origemTreino) pendencias.push('Escolha qual Perícia da Origem recebe Treinamento gratuito.');
      else if (!duas.includes(d.origemTreino)) erros.push('O Treinamento gratuito deve ser uma das Perícias da Origem.');
    }

    // Atributos (criação: 1 em cada + 3 pontos; um Atributo pode cair a 0; máximo 3 na criação, 5 depois)
    const ganhos = contarAte(LIVRO.PROGRESSAO.atributo, d.nivel);
    const permitido = 4 + 3 + ganhos;
    const valores = ATRIBUTO_IDS.map((id) => d.atributos[id]);
    const soma = valores.reduce((s, v) => s + v, 0);
    const maximo = Math.min(5, 3 + ganhos);
    if (valores.some((v) => v > maximo)) erros.push(`Nenhum Atributo pode passar de ${maximo} no Nível ${d.nivel}.`);
    if (valores.filter((v) => v === 0).length > 1) erros.push('Só um Atributo pode ser reduzido a 0.');
    if (soma > permitido) erros.push(`Atributos demais: o total para o Nível ${d.nivel} é ${permitido} (você usou ${soma}).`);
    else if (soma < permitido) pendencias.push(`Distribua todos os pontos de Atributo (faltam ${permitido - soma}).`);

    // Habilidades
    const vagas = vagasDeHabilidade(d.nivel);
    const tem = { basica: [], avancada: [], superior: [], avassaladora: [] };
    for (const id of d.habilidades) {
      const h = habilidadePorId(id);
      if (classe && h.classe !== classe.id) erros.push(`${h.nome} não pertence à Classe ${classe.nome}.`);
      tem[h.tier].push(h);
    }
    for (const tier of LIVRO.TIERS) {
      const n = tem[tier.id].length;
      if (n > vagas[tier.id]) erros.push(`Habilidades ${tier.nome}s demais: o Nível ${d.nivel} permite ${vagas[tier.id]}.`);
      else if (n < vagas[tier.id]) pendencias.push(`Escolha ${vagas[tier.id] - n} Habilidade(s) ${tier.nome}(s).`);
    }
    for (const h of tem.avancada) {
      if (!tem.basica.some((b) => b.ramo === h.ramo)) erros.push(`${h.nome} exige uma Habilidade Básica do ramo ${h.ramo}.`);
    }
    for (const h of tem.superior) {
      if (!tem.avancada.some((b) => b.ramo === h.ramo)) erros.push(`${h.nome} exige uma Habilidade Avançada do ramo ${h.ramo}.`);
    }

    // Perícias
    if (classe) {
      const c = calcular(d);
      const livres = periciasGratuitas(d);
      const permitidas = new Set([...classe.permitidas, outraPericiaDaOrigem(d)].filter(Boolean));
      for (const p of LIVRO.PERICIAS) {
        const custo = c.graus[p.id] - (livres.has(p.id) ? 1 : 0);
        if (custo > 0 && !permitidas.has(p.id)) {
          erros.push(`${p.nome}: os pontos de Perícia só podem ir para a lista da Classe (ou a outra Perícia da Origem).`);
        }
      }
      if (c.pontosPericia.gastos > c.pontosPericia.total) {
        erros.push(`Pontos de Perícia demais: você tem ${c.pontosPericia.total} e usou ${c.pontosPericia.gastos}.`);
      } else if (c.pontosPericia.gastos < c.pontosPericia.total) {
        pendencias.push(`Distribua os pontos de Perícia (faltam ${c.pontosPericia.total - c.pontosPericia.gastos}).`);
      }
      if (d.habilidades.includes('tentativa-e-erro')) {
        if (!d.treinoExtra) pendencias.push('Tentativa e Erro: escolha a Perícia adicional para Treinar.');
        else if (d.treinoExtra === d.origemTreino) erros.push('Tentativa e Erro: escolha uma Perícia diferente da Treinada pela Origem.');
      }
    }

    return { erros, pendencias };
  }

  return {
    LIMITES, novaFicha, normalizar, calcular, validar, vagasDeHabilidade, equipamentoInicial,
    origemPorId, classePorId, habilidadePorId, periciasGratuitas, outraPericiaDaOrigem,
  };
});
