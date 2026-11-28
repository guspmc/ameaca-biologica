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
  if (typeof module === 'object' && module.exports) module.exports = fabrica(require('./dados-livro.js'), require('./dados-arsenal.js'));
  else raiz.REGRAS = fabrica(raiz.LIVRO, raiz.ARSENAL);
})(typeof self !== 'undefined' ? self : this, function (LIVRO, ARSENAL) {
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

    const itens = (Array.isArray(d.itens) ? d.itens : []).slice(0, LIMITES.itens).map((i) => {
      const ref = i && ARSENAL.itemPorId(i.ref) ? i.ref : '';
      const cat = ref ? ARSENAL.itemPorId(ref) : null;
      const pecas = [];
      for (const pid of cat && cat.tipo === 'arma' && i && Array.isArray(i.pecas) ? i.pecas : []) {
        if (ARSENAL.pecaPorId(pid) && !pecas.includes(pid)) pecas.push(pid);
      }
      return {
        nome: texto(i && i.nome, 60) || (cat ? cat.nome : ''),
        espacos: inteiro(i && i.espacos, 0, 20, 1),
        nota: texto(i && i.nota, 200),
        ref,
        mun: inteiro(i && i.mun, 0, 999, 0),
        pecas: pecas.slice(0, 3),
        equip: !!(cat && cat.tipo === 'protecao' && i.equip),
      };
    });

    const municoes = {};
    for (const m of ARSENAL.MUNICOES) {
      const q = inteiro(d.municoes && d.municoes[m.id], 0, 9999, 0);
      if (q > 0) municoes[m.id] = q;
    }

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
      municoes,
      kendo: { placas: inteiro(d.kendo && d.kendo.placas, 0, 3, 0) },
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

  /* ---------- Arsenal: Espaços, proteção, capacidade ---------- */

  const catalogo = (item) => (item && item.ref ? ARSENAL.itemPorId(item.ref) : null);
  const pecasDoItem = (item) => (item.pecas || []).map(ARSENAL.pecaPorId).filter(Boolean);

  // Espaços que o item ocupa (item do Arsenal: valor do livro; item livre: o que a pessoa digitou).
  function espacosDoItem(item) {
    const cat = catalogo(item);
    if (!cat) return item.espacos;
    if (cat.tipo !== 'arma') return cat.espacos ?? 1; // sem Espaços indicados no livro, o item ocupa 1
    const pecas = pecasDoItem(item);
    let e = cat.modular ? (pecas.length >= 2 ? 2 : 1) : cat.espacos;
    for (const p of pecas) if (p.mods.espacosArma) e = Math.max(e, p.mods.espacosArma);
    return e;
  }

  // Munições da mesma pilha (grupo) dividem os Espaços: ex.: Cartuchos GM 79 comuns e especiais, 10 por Espaço.
  function espacosMunicao(municoes) {
    const pilhas = {};
    for (const m of ARSENAL.MUNICOES) pilhas[m.grupo || m.id] = (pilhas[m.grupo || m.id] || 0) + (municoes[m.id] || 0);
    return Object.entries(pilhas).reduce((s, [id, q]) => s + Math.ceil(q / ARSENAL.municaoPorId(id).porEspaco), 0);
  }

  // Colete equipado (só um vale): { def, rd, capAgi } ou null.
  function protecaoEquipada(d) {
    const item = d.itens.find((i) => i.equip && catalogo(i) && catalogo(i).tipo === 'protecao');
    if (!item) return null;
    const cat = catalogo(item);
    const v = cat.kendo ? ARSENAL.KENDO[d.kendo.placas] : cat;
    return { nome: item.nome, def: v.def, rd: v.rd, capAgi: v.capAgi };
  }

  // Bolsa e Pochete não acumulam: vale a maior.
  const bonusExpansao = (d) =>
    d.itens.reduce((m, i) => { const c = catalogo(i); return c && c.tipo === 'expansao' ? Math.max(m, c.bonus) : m; }, 0);

  // Capacidade máxima do carregador (base + Peças).
  function capacidadeDaArma(item) {
    const cat = catalogo(item);
    if (!cat || cat.pente == null) return 0;
    let cap = cat.pente;
    for (const p of pecasDoItem(item)) {
      const c = p.mods.capacidade;
      cap += typeof c === 'object' ? (c[cat.familia] || 0) : (c || 0);
    }
    return cap;
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

    const espacosItens = d.itens.reduce((s, i) => s + espacosDoItem(i), 0) + espacosMunicao(d.municoes);
    const espacosMoedas = Math.ceil(d.moedas / 3);

    // Defesa: 10 + AGI (limitada pelo colete) + colete + bônus. Desorientado perde AGI; Exposto -2.
    const prot = protecaoEquipada(d);
    const cond = d.jogo.condicoes;
    let agiDefesa = cond.includes('desorientado') ? 0 : a.AGI;
    if (prot && prot.capAgi != null) agiDefesa = Math.min(agiDefesa, prot.capAgi);
    const defesa = 10 + agiDefesa + (prot ? prot.def : 0) + b.defesa - (cond.includes('exposto') ? 2 : 0);

    // Movimento: Fase 2 a 4 da BI +3 m; Fase 5 -6 m (perde os benefícios); Intoxicado -3 m.
    const fase = faseBI(bi, biMax);
    let movimento = 9 + b.movimento;
    if (fase.fase >= 2 && fase.fase <= 4) movimento += 3;
    else if (fase.fase === 5) movimento -= 6;
    if (cond.includes('intoxicado')) movimento -= 3;
    movimento = Math.max(0, movimento);

    return {
      pvMax, saMax, biMax, pv, sa, bi, pvTemp: d.jogo.pvTemp,
      vulneravel: pvMax > 0 && pv * 5 <= pvMax,
      desacordado: pvMax > 0 && pv === 0,
      faseBI: fase,
      defesa,
      rd: prot ? prot.rd : 0,
      iniciativa: a.AGI,
      movimento,
      inventarioMax: 4 + a.FOR + b.inventario + bonusExpansao(d),
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

  /* ---------- Arsenal: Proficiência, ataque e dano (capítulo 3) ---------- */

  const ORDEM_GRAU = ['comum', 'tatica', 'militar', 'exotica'];
  const ate = (grau, limite) => ORDEM_GRAU.indexOf(grau) <= ORDEM_GRAU.indexOf(limite);

  // Proficiência por Classe (e Habilidades que a ampliam). Corpo a Corpo Comum/Tática: todas as Classes.
  function temProficiencia(d, arma) {
    if (!arma || !arma.familia) return true;
    if (arma.familia === 'corpo') return !arma.grau || ate(arma.grau, 'tatica');
    const hab = (id) => d.habilidades.includes(id);
    if (d.classe === 'agente') {
      if (arma.id === 'gm-79' || arma.id === 'killer7') return true;
      if (arma.familia === 'pistola' || arma.familia === 'smg') return ate(arma.grau, 'militar');
      if (arma.familia === 'escopeta') return ate(arma.grau, 'tatica');
      return false;
    }
    if (d.classe === 'autodidata') {
      if (arma.familia === 'pistola') return ate(arma.grau, 'tatica');
      if (arma.familia === 'escopeta') return arma.grau === 'comum';
      if (arma.familia === 'smg') return ate(arma.grau, 'tatica');
      if (arma.familia === 'magnum') return hab('arsenal-improvavel');
      return false;
    }
    if (d.classe === 'operador') {
      if (arma.familia === 'magnum' || arma.familia === 'especial') return hab('armamento-especial');
      return true;
    }
    return false;
  }

  /* Dados: "2d4+1d6+3" */
  function somaDados(dano, extra) {
    const m = /^(\d+)d(\d+)$/.exec(dano || '');
    return m ? `${Number(m[1]) + extra}d${m[2]}` : dano;
  }

  // Rola uma expressão. explode: cada resultado máximo gera outro dado (Motosserra). rng devolve [0,1).
  function rolarExpressao(expr, rng = Math.random, explode = false) {
    const partes = [];
    let total = 0;
    const termos = String(expr || '').replace(/\s+/g, '').replace(/-/g, '+-').split('+').filter(Boolean);
    for (const t of termos) {
      const m = /^(-?)(\d+)d(\d+)$/.exec(t);
      if (m) {
        const sinal = m[1] ? -1 : 1;
        const lado = Number(m[3]);
        const dados = [];
        const n = Math.min(Number(m[2]), 50);
        for (let i = 0; i < n; i++) {
          let v = 1 + Math.floor(rng() * lado);
          dados.push(v);
          let extras = 0;
          while (explode && v === lado && extras < 20) { v = 1 + Math.floor(rng() * lado); dados.push(v); extras++; }
        }
        const soma = sinal * dados.reduce((s, x) => s + x, 0);
        partes.push({ termo: t, dados, soma });
        total += soma;
      } else if (/^-?\d+$/.test(t)) {
        partes.push({ termo: t, dados: [], soma: Number(t) });
        total += Number(t);
      }
    }
    return { total, partes };
  }

  // Fontes de ataque: itens da Ficha ligados a uma arma do Arsenal + ataques básicos.
  function armasDaFicha(d) {
    const lista = [];
    d.itens.forEach((item, idx) => { const c = catalogo(item); if (c && c.tipo === 'arma') lista.push({ idx, item, cat: c }); });
    return lista;
  }

  const DESV_CONDICOES = { cego: 'Cego', caido: 'Caído', imobilizado: 'Imobilizado', intoxicado: 'Intoxicado' };

  /*
   * Monta o ataque sem rolar nada. fonte = item da Ficha (arma do Arsenal) ou o id de um ataque básico.
   * op = { modo: 'normal'|'cadenciado'|'rajada'|'carregado', arremesso, mirar, vantagem, desvantagem }
   */
  function montarAtaque(d, c, fonte, op = {}) {
    const basico = typeof fonte === 'string' ? ARSENAL.ATAQUES_BASICOS.find((a) => a.id === fonte) : null;
    const item = basico ? null : fonte;
    const cat = basico ? { ...basico, familia: 'corpo', pente: null } : catalogo(item);
    if (!cat || (!basico && cat.tipo !== 'arma')) return null;
    const pecas = item ? pecasDoItem(item) : [];
    const avisos = [];
    const corpo = cat.familia === 'corpo';
    const arremesso = !!op.arremesso && (basico ? !!basico.arremesso : !!cat.arremessavel || /Arremess/.test(cat.props || ''));
    const aCorpo = corpo && !arremesso;
    const periciaId = aCorpo ? 'luta' : 'pontaria';
    const atributo = aCorpo ? 'FOR' : 'AGI';

    // Modo
    let modo = ['cadenciado', 'rajada', 'carregado'].includes(op.modo) ? op.modo : 'normal';
    const proficiente = temProficiencia(d, cat);
    const habilitaCad = pecas.some((p) => p.mods.habilitaCadenciado);
    if (cat.soRajada) modo = 'rajada';
    if (modo === 'cadenciado' && !(cat.cadenciado || habilitaCad)) { modo = 'normal'; avisos.push('Esta arma não permite Disparo Cadenciado.'); }
    if (modo === 'rajada' && !cat.rajada) { modo = 'normal'; avisos.push('Esta arma não permite Rajada.'); }
    if (modo === 'carregado' && !cat.carregado) modo = 'normal';
    if ((modo === 'cadenciado' || modo === 'rajada') && !proficiente) { modo = 'normal'; avisos.push('Sem Proficiência não há Rajada nem Disparo Cadenciado.'); }

    // Consumo de munição
    let consumo = 0;
    if (!corpo) {
      consumo = cat.consumo || 1;
      if (modo === 'cadenciado') consumo = habilitaCad && cat.id === 'matilda' ? 3 : 5;
      if (modo === 'rajada') consumo = 10;
      if (modo === 'carregado') consumo = cat.carregado.consumo;
    }

    // Dano
    let dados = cat.dano;
    if (modo === 'carregado') dados = cat.carregado.dano;
    if (modo === 'cadenciado') dados = somaDados(dados, 2);
    for (const p of pecas) if (p.mods.danoDados) dados = somaDados(dados, p.mods.danoDados);
    const extras = [];
    for (const p of pecas) if (p.mods.danoExtra) extras.push(p.mods.danoExtra);
    if (!corpo && d.habilidades.includes('armeira-autodidata')) for (let i = 0; i < pecas.length; i++) extras.push('1d4');
    const fase = c.faseBI.fase;
    if (aCorpo && fase === 4) extras.push('1d4');
    const fixo = cat.mortal ? 0 : d.atributos[atributo];
    const semDano = !!cat.mortal || !dados;
    const formula = semDano ? '' : [dados, ...extras, ...(fixo ? [String(fixo)] : [])].join('+');

    // Teste de ataque
    const partes = [{ nome: LIVRO.PERICIAS.find((p) => p.id === periciaId).nome, valor: c.pericias[periciaId] }];
    if (fase === 3) partes.push({ nome: 'BI Fase 3', valor: 2 });
    if (fase === 4) partes.push({ nome: 'BI Fase 4', valor: 3 });
    if (d.habilidades.includes('armeiro') && pecas.length) partes.push({ nome: 'Armeiro', valor: pecas.length });
    if (op.mirar && !corpo) partes.push({ nome: 'Mirar', valor: 2 });
    const bonus = partes.reduce((s, p) => s + p.valor, 0);

    const motivosDesv = [];
    if (op.desvantagem) motivosDesv.push('marcada por você');
    if (!proficiente) motivosDesv.push('sem Proficiência');
    if (cat.desvantagem) motivosDesv.push(cat.nome);
    if (fase === 5) motivosDesv.push('BI Fase 5');
    for (const [id, nome] of Object.entries(DESV_CONDICOES)) if (d.jogo.condicoes.includes(id)) motivosDesv.push(nome);
    const vant = !!op.vantagem;
    const desv = motivosDesv.length > 0;
    const vantagem = vant && !desv ? 'vantagem' : desv && !vant ? 'desvantagem' : 'normal';
    if (d.jogo.condicoes.some((x) => ['atordoado', 'incapacitado', 'desorientado'].includes(x))) avisos.push('Uma Condição da Ficha impede Atacar.');

    let crit = cat.crit;
    for (const p of pecas) if (p.mods.crit) crit -= p.mods.crit;
    crit = Math.max(2, crit);

    const municaoAtual = item ? item.mun : 0;
    const semMunicao = !corpo && consumo > municaoAtual;
    return {
      nome: cat.nome, familia: cat.familia, modo, arremesso, proficiente, avisos,
      pericia: periciaId, partes, bonus,
      vantagem, motivosDesv, dados, extras, fixo, formula, semDano,
      crit, mult: cat.mult, explode: !!cat.explode,
      rolaAtaque: modo !== 'rajada' && !cat.mortal,
      salvamento: modo === 'rajada' ? 'Rajada em Cone de 4,5 m: Reflexos DT 12 (sucesso sofre metade).' : '',
      consumo, municaoAtual, semMunicao, municaoId: cat.municao || null,
      mortal: !!cat.mortal,
    };
  }

  // Rola o ataque montado. Devolve tudo o que a tela precisa mostrar.
  function resolverAtaque(m, rng = Math.random) {
    if (!m.rolaAtaque) {
      const area = m.semDano ? null : rolarExpressao(m.formula, rng, m.explode);
      return { d20: [], escolhido: null, total: null, critico: false, critSeAcertar: false, dano: area, danoCritico: null };
    }
    const qtd = m.vantagem === 'normal' ? 1 : 2;
    const d20 = Array.from({ length: qtd }, () => 1 + Math.floor(rng() * 20));
    const escolhido = m.vantagem === 'desvantagem' ? Math.min(...d20) : Math.max(...d20);
    const dano = m.semDano ? null : rolarExpressao(m.formula, rng, m.explode);
    const critico = escolhido === 20;
    const critSeAcertar = !critico && m.crit < 20 && escolhido >= m.crit;
    return {
      d20, escolhido, total: escolhido + m.bonus, critico, critSeAcertar, dano,
      danoCritico: dano ? dano.total * m.mult : null,
    };
  }

  // Gasta munição do pente (o que tem no pente é da arma; a reserva fica em d.municoes). Devolve true se gastou.
  function gastarMunicao(item, consumo) {
    if (consumo > item.mun) return false;
    item.mun -= consumo;
    return true;
  }

  // Recarrega a arma com a munição da reserva. Devolve quantas unidades entraram.
  function recarregar(d, item) {
    const cat = catalogo(item);
    if (!cat || cat.pente == null || !cat.municao) return 0;
    const falta = Math.max(0, capacidadeDaArma(item) - item.mun);
    const reserva = d.municoes[cat.municao] || 0;
    const n = Math.min(falta, reserva);
    item.mun += n;
    const resto = reserva - n;
    if (resto > 0) d.municoes[cat.municao] = resto; else delete d.municoes[cat.municao];
    return n;
  }

  // Usa um consumível de cura. manual = { cura, bi, pvTemp } (valores rolados fora do app). Remove o item.
  function usarConsumivel(d, idx, opcoes = {}) {
    const item = d.itens[idx];
    const cat = catalogo(item);
    if (!cat || cat.tipo !== 'consumivel' || cat.uso === false) return null;
    const c = calcular(d);
    const rng = opcoes.rng || Math.random;
    const manual = opcoes.manual || {};
    const rel = { nome: cat.nome, cura: 0, bi: 0, pvTemp: 0, semIntoxicacao: false, texto: [] };
    const valor = (chave, expr) => (manual[chave] != null ? Math.max(0, Math.trunc(Number(manual[chave])) || 0) : rolarExpressao(expr, rng).total);
    let pv = c.pv;
    if (cat.curaTotal) { rel.cura = c.pvMax - pv; pv = c.pvMax; rel.texto.push('Recupera todos os PV'); }
    else if (cat.cura) { rel.cura = valor('cura', cat.cura); pv = Math.min(c.pvMax, pv + rel.cura); rel.texto.push(`+${rel.cura} PV`); }
    d.jogo.pv = pv >= c.pvMax ? null : pv;
    if (cat.bi) { rel.bi = valor('bi', cat.bi); d.jogo.bi = Math.max(0, d.jogo.bi - rel.bi); rel.texto.push(`-${rel.bi} BI`); }
    if (cat.pvTemp) { rel.pvTemp = valor('pvTemp', cat.pvTemp); d.jogo.pvTemp = Math.max(d.jogo.pvTemp, rel.pvTemp); rel.texto.push(`${rel.pvTemp} PV Temporários`); }
    if (cat.semIntoxicacao) {
      const k = d.jogo.condicoes.indexOf('intoxicado');
      if (k >= 0) { d.jogo.condicoes.splice(k, 1); rel.semIntoxicacao = true; rel.texto.push('Intoxicação removida'); }
    }
    d.itens.splice(idx, 1);
    return rel;
  }

  // Itens que a escolha de Equipamento Inicial acrescenta (Erva Verde + Lanterna Simples + opção da Classe).
  function equipamentoInicial(classeId, opcao) {
    const classe = classePorId(classeId);
    const escolha = classe && classe.equipamento[opcao];
    if (!escolha) return null;
    // Itens que existem no Arsenal viram itens do catálogo (arma já carregada, colete já equipado).
    const itens = [...LIVRO.EQUIPAMENTO_COMUM, ...escolha.itens].map((i) => {
      const cat = ARSENAL.itemPorNome(i.nome);
      if (!cat) return { nome: i.nome, espacos: i.espacos, nota: '', ref: '', mun: 0, pecas: [], equip: false };
      return {
        nome: cat.nome, espacos: cat.espacos, nota: '', ref: cat.id, pecas: [],
        mun: cat.tipo === 'arma' && cat.pente != null ? cat.pente : 0,
        equip: cat.tipo === 'protecao',
      };
    });
    return { itens, moedas: escolha.moedas };
  }

  /* ---------- Subir de Nível (capítulo 1, "Progressão de Personagem"; capítulo 6, "Progressão e Nível") ---------- */

  // Maior Nível liberado pela contagem opcional de Missões Completadas.
  function nivelPorMissoes(missoes) {
    const t = LIVRO.PROGRESSAO.missoes;
    let n = 1;
    for (let i = 0; i < t.length; i++) if (missoes >= t[i]) n = i + 1;
    return n;
  }

  // O que o Nível recebe: +1 Atributo, +1 Ponto de Perícia e/ou uma Habilidade (tipo indicado).
  function ganhosDoNivel(nivel) {
    const P = LIVRO.PROGRESSAO;
    const tier = ['basica', 'avancada', 'superior', 'avassaladora'].find((t) => P[t].includes(nivel)) || null;
    return { atributo: P.atributo.includes(nivel), pontoPericia: P.pontoPericia.includes(nivel), habilidade: tier };
  }

  // Foto da Ficha no Nível anterior: é o que a evolução não pode mudar.
  function fotoBase(d) {
    return JSON.parse(JSON.stringify({
      nivel: d.nivel, origem: d.origem, origemPericias: d.origemPericias, origemTreino: d.origemTreino, classe: d.classe,
      atributos: d.atributos, pericias: d.pericias, habilidades: d.habilidades, treinoExtra: d.treinoExtra,
    }));
  }

  // Na evolução, Identificação e Nível não são editáveis: volta ao valor da foto (+1 Nível).
  function travarEvolucao(d, base) {
    d.nivel = base.nivel + 1;
    d.origem = base.origem; d.origemPericias = base.origemPericias.slice(); d.origemTreino = base.origemTreino; d.classe = base.classe;
    return d;
  }

  // Erros específicos de uma evolução (além de `validar`): nada do Nível anterior pode ser desfeito.
  function validarEvolucao(d, base) {
    const erros = [];
    if (!base) return erros;
    if (d.nivel !== base.nivel + 1) erros.push(`Uma evolução sobe exatamente 1 Nível (de ${base.nivel} para ${base.nivel + 1}).`);
    if (d.origem !== base.origem || d.classe !== base.classe || d.origemTreino !== base.origemTreino
      || d.origemPericias.join() !== base.origemPericias.join()) erros.push('Origem e Classe não mudam ao subir de Nível.');
    const g = ganhosDoNivel(d.nivel);
    let ganhoAtr = 0;
    for (const id of ATRIBUTO_IDS) {
      if (d.atributos[id] < base.atributos[id]) erros.push('Atributos não podem diminuir ao subir de Nível.');
      ganhoAtr += d.atributos[id] - base.atributos[id];
    }
    if (ganhoAtr > (g.atributo ? 1 : 0)) {
      erros.push(g.atributo ? 'O Nível ' + d.nivel + ' concede só +1 Atributo.' : `O Nível ${d.nivel} não concede Atributo.`);
    }
    for (const p of PERICIA_IDS) {
      if (d.pericias[p] < base.pericias[p]) erros.push('O Treinamento já adquirido em Perícias não pode diminuir.');
    }
    for (const id of base.habilidades) {
      if (!d.habilidades.includes(id)) erros.push('Habilidades já escolhidas não podem ser trocadas ao subir de Nível.');
    }
    const novas = d.habilidades.filter((id) => !base.habilidades.includes(id)).map(habilidadePorId).filter(Boolean);
    if (novas.some((h) => h.tier !== g.habilidade)) {
      erros.push(g.habilidade ? `O Nível ${d.nivel} concede apenas Habilidade ${LIVRO.TIERS.find((t) => t.id === g.habilidade).nome}.` : `O Nível ${d.nivel} não concede Habilidade.`);
    }
    if (base.habilidades.includes('tentativa-e-erro') && d.treinoExtra !== base.treinoExtra) erros.push('A Perícia extra de Tentativa e Erro já foi escolhida.');
    return [...new Set(erros)];
  }

  /* ---------- Inventário em blocos (Espaços) ---------- */

  // Blocos que ocupam Espaços, na ordem: itens (um bloco com N Espaços), munição por pilha e Moedas.
  // Itens com 0 Espaços (Lanterna de Bolso/de Cabeça) vão em `semEspaco`. Itens Característicos de Classe não entram aqui.
  function blocosInventario(d) {
    const blocos = [];
    const semEspaco = [];
    d.itens.forEach((item, idx) => {
      const e = espacosDoItem(item);
      if (e <= 0) semEspaco.push({ tipo: 'item', idx, espacos: 0 });
      else blocos.push({ tipo: 'item', idx, espacos: e });
    });
    const pilhas = {};
    for (const m of ARSENAL.MUNICOES) {
      const q = d.municoes[m.id] || 0;
      if (q > 0) { const g = m.grupo || m.id; (pilhas[g] = pilhas[g] || []).push({ id: m.id, q }); }
    }
    for (const [g, partes] of Object.entries(pilhas)) {
      const total = partes.reduce((s, p) => s + p.q, 0);
      blocos.push({ tipo: 'municao', grupo: g, partes, total, espacos: Math.ceil(total / ARSENAL.municaoPorId(g).porEspaco) });
    }
    if (d.moedas > 0) blocos.push({ tipo: 'moedas', total: d.moedas, espacos: Math.ceil(d.moedas / 3) });
    const usados = blocos.reduce((s, b) => s + b.espacos, 0);
    return { blocos, semEspaco, usados };
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

    // Arsenal: Peças compatíveis e em número permitido, carregador, colete e Espaços
    for (const item of d.itens) {
      const cat = catalogo(item);
      if (!cat) continue;
      if (cat.tipo === 'arma') {
        const pecas = pecasDoItem(item);
        if (pecas.length > cat.pecas) erros.push(`${item.nome}: só aceita ${cat.pecas} Peça(s) Extra(s).`);
        for (const p of pecas) if (!ARSENAL.pecaServe(p, cat)) erros.push(`${item.nome}: a Peça ${p.nome} não serve nesta arma.`);
        if (cat.pente != null && item.mun > capacidadeDaArma(item)) erros.push(`${item.nome}: o carregador comporta ${capacidadeDaArma(item)}.`);
      }
    }
    if (d.itens.filter((i) => i.equip).length > 1) erros.push('Só um colete pode ficar equipado.');
    const c2 = calcular(d);
    if (c2.inventarioUsado > c2.inventarioMax) {
      erros.push(`Inventário acima do limite: ${c2.inventarioUsado} Espaços usados para ${c2.inventarioMax}.`);
    }

    return { erros, pendencias };
  }

  return {
    LIMITES, novaFicha, normalizar, calcular, validar, vagasDeHabilidade, equipamentoInicial,
    nivelPorMissoes, ganhosDoNivel, fotoBase, travarEvolucao, validarEvolucao, blocosInventario,
    espacosDoItem, capacidadeDaArma, protecaoEquipada, temProficiencia, armasDaFicha, montarAtaque, resolverAtaque,
    gastarMunicao, recarregar, usarConsumivel, rolarExpressao, somaDados,
    origemPorId, classePorId, habilidadePorId, periciasGratuitas, outraPericiaDaOrigem,
  };
});
