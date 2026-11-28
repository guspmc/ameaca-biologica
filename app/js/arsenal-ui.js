'use strict';
/*
 * Arsenal na tela da Ficha (carregado depois de ficha.js; usa h, REGRAS, ARSENAL, fichaAtual, calc, redesenhar...).
 *   - Inventário: itens do Arsenal (armas com carregador e Peças, coletes, consumíveis), reserva de munição.
 *   - Combate: cartões de ataque com teste, dano, Vantagem/Desvantagem, modos e consumo de munição.
 */

const opcoesAtaque = {};     // chave do ataque -> escolhas da pessoa (modo, Mirar, Vantagem...)
const resultadosAtaque = {}; // chave do ataque -> linhas do último resultado
let avisoArsenal = '';
let janelaSA = 0;            // SA gastos em Esforço e Manobras desde o fim do último turno (limite de 3)

function limparAtaques() {
  for (const k of Object.keys(opcoesAtaque)) delete opcoesAtaque[k];
  for (const k of Object.keys(resultadosAtaque)) delete resultadosAtaque[k];
}

// Salva e redesenha depois de qualquer mudança no Arsenal.
function mudouArsenal(aviso = '') {
  avisoArsenal = aviso;
  agendarSalvarFicha();
  redesenhar();
}

const sinal = (n) => (n >= 0 ? '+' : '') + n;
const textoCrit = (m) => (m.crit < 20 ? `${m.crit}–20` : '20') + ` ×${m.mult}`;

/* ---------- Inventário ---------- */

function linhaItemArsenal(item, idx, remover) {
  const cat = ARSENAL.itemPorId(item.ref);
  const d = fichaAtual.dados;
  const esp = REGRAS.espacosDoItem(item);
  const partes = [];

  if (cat.tipo === 'arma') {
    const grau = ARSENAL.GRAUS.find((g) => g.id === cat.grau);
    const resumo = [grau ? grau.nome : null, cat.dano ? `Dano ${cat.dano}` : 'Sem dano', `Crít. ${cat.crit < 20 ? cat.crit + '–20' : 20} ×${cat.mult}`, cat.alcance, `${cat.maos} mão(s)`, cat.preco ? `${cat.preco} Moeda(s)` : null]
      .filter(Boolean).join(' · ');
    partes.push(h('p', { class: 'dica' }, resumo));
    if (cat.pente != null && cat.municao) {
      const cap = REGRAS.capacidadeDaArma(item);
      const mun = ARSENAL.municaoPorId(cat.municao);
      const reserva = d.municoes[cat.municao] || 0;
      partes.push(h('div', { class: 'linha-municao' },
        h('span', {}, `Carregador (${mun.nome}):`),
        h('input', { type: 'number', min: '0', max: String(cap), value: item.mun, class: 'item-espacos',
          onchange: (e) => { item.mun = Math.min(cap, Math.max(0, Number(e.target.value) || 0)); mudouArsenal(); } }),
        h('span', {}, `/ ${cap}`),
        h('button', { type: 'button', class: 'botao pequeno', disabled: item.mun >= cap || reserva === 0,
          onclick: () => { const n = REGRAS.recarregar(d, item); mudouArsenal(`${item.nome}: recarregou ${n}.`); } }, 'Recarregar')));
    }
    if (cat.pecas > 0) {
      const instaladas = item.pecas.map(ARSENAL.pecaPorId).filter(Boolean);
      const livres = ARSENAL.pecasDaArma(cat).filter((p) => !item.pecas.includes(p.id));
      partes.push(h('div', { class: 'pecas' },
        h('span', { class: 'dica' }, `Peças Extras (${instaladas.length}/${cat.pecas}):`),
        ...instaladas.map((p) => h('div', { class: 'peca-linha' },
          h('span', {}, h('strong', {}, p.nome), ' · ', p.efeito),
          h('button', { type: 'button', class: 'botao pequeno perigo', 'aria-label': 'Remover Peça',
            onclick: () => { item.pecas = item.pecas.filter((x) => x !== p.id); mudouArsenal(); } }, '✕'))),
        instaladas.length < cat.pecas && livres.length
          ? h('select', { class: 'sel-peca', 'aria-label': 'Instalar Peça Extra',
              onchange: (e) => { if (e.target.value) { item.pecas.push(e.target.value); mudouArsenal(); } } },
              h('option', { value: '' }, '+ Instalar Peça Extra...'),
              ...livres.map((p) => h('option', { value: p.id }, p.nome)))
          : null));
    }
    if (cat.props) partes.push(h('p', { class: 'dica' }, cat.props));
  } else if (cat.tipo === 'protecao') {
    const v = cat.kendo ? ARSENAL.KENDO[d.kendo.placas] : cat;
    partes.push(h('p', { class: 'dica' },
      `Defesa +${v.def} · RD ${v.rd} · ` + (v.capAgi == null ? 'AGI total' : v.capAgi === 0 ? 'sem AGI na Defesa' : `AGI limitada a +${v.capAgi}`)));
    partes.push(h('label', { class: 'cond-label' + (item.equip ? ' ativa' : '') },
      h('input', { type: 'checkbox', checked: item.equip,
        onchange: (e) => { d.itens.forEach((i) => { i.equip = false; }); item.equip = e.target.checked; mudouArsenal(); } }),
      ' Equipado'));
    if (cat.kendo) {
      partes.push(h('label', {}, 'Placas instaladas (1 Moeda cada)'));
      partes.push(h('select', { onchange: (e) => { d.kendo.placas = Number(e.target.value); mudouArsenal(); } },
        ...[0, 1, 2, 3].map((n) => h('option', { value: String(n), selected: d.kendo.placas === n }, `${n} placa(s)`))));
    }
  } else if (cat.tipo === 'consumivel') {
    partes.push(h('p', { class: 'dica' }, cat.efeito));
    if (cat.uso !== false) {
      partes.push(h('button', { type: 'button', class: 'botao pequeno primario', onclick: () => usarItem(idx) }, 'Usar'));
    }
  } else if (cat.tipo === 'expansao') {
    partes.push(h('p', { class: 'dica' }, cat.efeito + ' Não acumula com outra Expansão (vale a maior).'));
  }

  return h('div', { class: 'item-arsenal' },
    h('div', { class: 'item-topo' },
      h('strong', {}, item.nome),
      h('span', { class: 'etiqueta' }, `${esp} Esp.`),
      h('button', { type: 'button', class: 'botao pequeno perigo', onclick: remover, 'aria-label': 'Remover item' }, '✕')),
    ...partes,
    h('input', { class: 'item-nota', type: 'text', placeholder: 'Nota', value: item.nota, maxlength: '200',
      oninput: (e) => { item.nota = e.target.value; agendarSalvarFicha(); } }));
}

// Usa um consumível: Manual pergunta o resultado rolado na mesa; Automático rola sozinho.
function usarItem(idx) {
  const d = fichaAtual.dados;
  const cat = ARSENAL.itemPorId(d.itens[idx].ref);
  const manual = {};
  if (modoRolagem !== 'automatico') {
    for (const [chave, expr] of [['cura', cat.cura], ['bi', cat.bi], ['pvTemp', cat.pvTemp]]) {
      if (!expr) continue;
      const r = window.prompt(`${cat.nome}: role ${expr} e informe o resultado.`, '');
      if (r === null) return;
      manual[chave] = r;
    }
  }
  const rel = REGRAS.usarConsumivel(d, idx, { manual });
  if (!rel) return;
  limparAtaques();
  mudouArsenal(`${rel.nome}: ${rel.texto.join(', ') || 'usado'}.`);
}

const avisoDoArsenal = () => (avisoArsenal ? h('div', { class: 'mensagem aviso' }, avisoArsenal) : null);

/* ---------- Combate: ataques ---------- */

function painelAtaques(d) {
  const fontes = [
    ...REGRAS.armasDaFicha(d).map((a) => ({ chave: 'i' + a.idx, item: a.item, cat: a.cat })),
    { chave: 'b-desarmado', basico: 'desarmado' },
    { chave: 'b-improvisada', basico: 'improvisada' },
  ];
  return h('div', { class: 'ataques-bloco' },
    h('div', { class: 'ataques' }, fontes.map((f) => cartaoAtaque(d, f))),
    recolher('manobras', 'Manobras de SA', painelManobras(d), true));
}

/* ---------- Combate: Manobras que usam SA (capítulo 4: "SA e Esforço", "Ações e Manobras Universais") ---------- */

const MANOBRAS_SA = [
  { nome: 'Esforço: Movimento, Ação Bônus ou Reação extra', custo: 1, texto: 'Ação Livre. 1 SA compra um Movimento, uma Ação Bônus ou uma Reação. Interação Gratuita com Objeto não pode ser comprada.' },
  { nome: 'Esforço: Ação extra', custo: 2, texto: 'Ação Livre. 2 SA compram uma Ação (por exemplo, um segundo Ataque). Não existe Ataque Extra básico.' },
  { nome: 'Mirar', custo: 1, texto: 'Declare antes do Ataque: +2 no Teste de Ataque e escolha uma região do alvo. Marque "Mirar" no cartão do ataque, que já desconta o SA.', semBotao: true },
  { nome: 'Fuga', custo: 1, texto: 'Depois de uma Disparada (Ação convertida em Movimento), gaste 1 SA para receber um terceiro Movimento (27 m com Movimento 9 m).' },
  { nome: 'Contra-Ataque', custo: 1, texto: 'Depois de Aparar ou Esquivar com sucesso: 1 SA + Reação para um Ataque normal contra a Defesa do agressor. Pode ser preciso comprar uma Reação por Esforço.' },
  { nome: 'Finalizar', custo: 3, texto: 'Manobra que não gasta sua Ação nem Movimento: Ataque contra a Defesa, podendo se deslocar até seu Movimento só para alcançar o alvo. Em acerto, Fortitude do alvo com DT = resultado do Ataque; em falha, Dano normal +3d6. Vulnerável que possa sofrer Morte Instantânea é morto.' },
  { nome: 'Finalização Dupla', custo: 3, texto: 'Reação + 3 SA, depois que um aliado Finalizar e o alvo sobreviver (para quem ainda não agiu na rodada). Compromete a Ação e o Movimento do seu próximo turno.' },
];

function gastarSA(n, nome) {
  if (calc.sa < n) { resultadosAtaque['manobras'] = [`Sem SA para ${nome} (precisa de ${n}, você tem ${calc.sa}).`]; redesenhar(); return; }
  fichaAtual.dados.jogo.sa = calc.sa - n;
  janelaSA += n;
  resultadosAtaque['manobras'] = [`${nome}: gastou ${n} SA (restam ${calc.sa - n}).`];
  agendarSalvarFicha();
  redesenhar();
}

function painelManobras(d) {
  const linhas = resultadosAtaque['manobras'] || [];
  return h('div', { class: 'manobras' },
    h('p', { class: 'dica' }, `Janela de 3 SA: do fim de um turno seu até o fim do próximo, no máximo 3 SA em Esforço e Manobras (custos de Habilidades não entram). Gastos nesta janela: ${janelaSA}/3.`),
    ...MANOBRAS_SA.map((m) => h('div', { class: 'manobra' },
      h('div', {}, h('strong', {}, m.nome), h('span', { class: 'etiqueta' }, `${m.custo} SA`), h('span', { class: 'dica' }, m.texto)),
      m.semBotao ? null : h('button', { type: 'button', class: 'botao pequeno', disabled: calc.sa < m.custo || janelaSA + m.custo > 3,
        title: janelaSA + m.custo > 3 ? 'Passaria do limite de 3 SA da janela.' : '', onclick: () => gastarSA(m.custo, m.nome) }, `Gastar ${m.custo} SA`))),
    h('button', { type: 'button', class: 'botao pequeno', onclick: () => { janelaSA = 0; redesenhar(); } }, 'Fim do meu turno (zera a janela)'),
    linhas.length ? h('div', { class: 'resultado-rolagem' }, ...linhas.map((l) => h('div', {}, l))) : null);
}

function cartaoAtaque(d, f) {
  const op = opcoesAtaque[f.chave] || (opcoesAtaque[f.chave] = { modo: 'normal', mirar: false, vantagem: false, desvantagem: false, arremesso: false });
  const m = REGRAS.montarAtaque(d, calc, f.basico || f.item, op);
  if (!m) return null;
  const cat = f.cat;
  const pecas = f.item ? f.item.pecas.map(ARSENAL.pecaPorId).filter(Boolean) : [];

  // Quais opções esta arma oferece
  const modos = [['normal', 'Normal']];
  if (cat && !cat.soRajada) {
    if (cat.cadenciado || pecas.some((p) => p.mods.habilitaCadenciado)) modos.push(['cadenciado', 'Disparo Cadenciado']);
    if (cat.rajada) modos.push(['rajada', 'Rajada']);
    if (cat.carregado) modos.push(['carregado', 'Disparo Carregado']);
  }
  const arremessavel = f.basico ? f.basico === 'improvisada' : /Arremess/.test(cat.props || '');
  const aDistancia = m.pericia === 'pontaria';

  const caixa = (campo, rotulo) => h('label', { class: 'cond-label' + (op[campo] ? ' ativa' : '') },
    h('input', { type: 'checkbox', checked: op[campo], onchange: (e) => { op[campo] = e.target.checked; redesenhar(); } }), ' ' + rotulo);

  const linhas = resultadosAtaque[f.chave] || [];
  const bloqueado = m.semMunicao;
  const temMiraLaser = pecas.some((p) => p.id === 'mira-laser');

  return h('div', { class: 'cartao-ataque' },
    h('div', { class: 'item-topo' },
      h('strong', {}, m.nome),
      m.modo !== 'normal' ? h('span', { class: 'etiqueta' }, m.modo === 'rajada' ? 'Rajada' : m.modo === 'cadenciado' ? 'Cadenciado' : 'Carregado') : null),
    h('div', { class: 'combate-stats' },
      h('div', { class: 'stat-linha' }, h('span', {}, m.rolaAtaque ? LIVRO.PERICIAS.find((p) => p.id === m.pericia).nome : 'Teste'),
        h('strong', {}, m.rolaAtaque ? sinal(m.bonus) : 'Reflexos'))
      , h('div', { class: 'stat-linha' }, h('span', {}, 'Dano'), h('strong', {}, m.semDano ? '—' : m.formula))
      , h('div', { class: 'stat-linha' }, h('span', {}, 'Crítico'), h('strong', {}, m.rolaAtaque ? textoCrit(m) : '—'))
      , m.consumo ? h('div', { class: 'stat-linha' }, h('span', {}, 'Munição'), h('strong', {}, `${m.municaoAtual} (−${m.consumo})`)) : null),
    m.partes.length > 1 ? h('p', { class: 'dica' }, m.partes.map((p) => `${p.nome} ${sinal(p.valor)}`).join(' · ')) : null,
    m.vantagem !== 'normal' ? h('p', { class: 'dica' }, (m.vantagem === 'vantagem' ? 'Vantagem' : 'Desvantagem') + (m.motivosDesv.length && m.vantagem === 'desvantagem' ? ': ' + m.motivosDesv.join(', ') : '')) : null,
    m.vantagem === 'normal' && m.motivosDesv.length && op.vantagem ? h('p', { class: 'dica' }, 'Vantagem e Desvantagem se anulam (' + m.motivosDesv.join(', ') + ').') : null,
    ...m.avisos.map((a) => h('p', { class: 'dica' }, a)),
    m.salvamento ? h('p', { class: 'dica' }, m.salvamento) : null,
    h('div', { class: 'opcoes-ataque' },
      modos.length > 1
        ? h('select', { 'aria-label': 'Modo de ataque', onchange: (e) => { op.modo = e.target.value; redesenhar(); } },
            ...modos.map(([v, r]) => h('option', { value: v, selected: m.modo === v }, r)))
        : null,
      aDistancia ? caixa('mirar', 'Mirar (+2, 1 SA' + (temMiraLaser ? '; Mira Laser: 1/turno grátis' : '') + ')') : null,
      arremessavel ? caixa('arremesso', 'Arremesso') : null,
      caixa('vantagem', 'Vantagem'),
      caixa('desvantagem', 'Desvantagem')),
    h('div', { class: 'acoes-ataque' },
      h('button', { type: 'button', class: 'botao primario', disabled: bloqueado, onclick: () => atacar(d, f, m, op) },
        bloqueado ? 'Sem munição' : 'Atacar'),
      botaoRecarregar(d, f)),
    linhas.length ? h('div', { class: 'resultado-rolagem' }, ...linhas.map((l) => h('div', {}, l))) : null);
}

// Puxa da reserva (Inventário) a munição que falta no carregador, sem passar da capacidade da arma.
function botaoRecarregar(d, f) {
  const cat = f.cat;
  if (!f.item || !cat || cat.pente == null || !cat.municao) return null;
  const cap = REGRAS.capacidadeDaArma(f.item);
  const reserva = d.municoes[cat.municao] || 0;
  const cheio = f.item.mun >= cap;
  return h('button', { type: 'button', class: 'botao recarregar', disabled: cheio || reserva === 0,
    title: cheio ? 'O carregador já está cheio.' : reserva === 0 ? 'Sem munição na reserva do Inventário.' : '',
    onclick: () => {
      const n = REGRAS.recarregar(d, f.item);
      resultadosAtaque[f.chave] = [`Recarregou ${n}: carregador ${f.item.mun}/${cap}. Reserva restante: ${d.municoes[cat.municao] || 0}.`];
      mudouArsenal();
    } }, `Recarregar (reserva ${reserva})`);
}

function atacar(d, f, m, op) {
  const mirou = op.mirar && m.partes.some((p) => p.nome === 'Mirar');
  const miraLaser = f.item && f.item.pecas.includes('mira-laser');
  if (mirou && !miraLaser && calc.sa < 1) {
    resultadosAtaque[f.chave] = ['Sem SA para Mirar.'];
    redesenhar();
    return;
  }
  if (mirou && !miraLaser) { d.jogo.sa = calc.sa - 1; janelaSA += 1; }
  if (f.item && m.consumo) REGRAS.gastarMunicao(f.item, m.consumo);

  const linhas = [];
  const vant = m.vantagem === 'vantagem' ? ' (Vantagem)' : m.vantagem === 'desvantagem' ? ' (Desvantagem)' : '';
  if (modoRolagem === 'automatico') {
    const r = REGRAS.resolverAtaque(m);
    if (m.rolaAtaque) {
      linhas.push(`d20 (${r.d20.join(', ')})${vant} → ${r.escolhido} ${sinal(m.bonus)} = ${r.total}` +
        (r.critico ? ' · CRÍTICO!' : r.critSeAcertar ? ' · crítico se o ataque acertar a Defesa' : ''));
    }
    if (r.dano) {
      const detalhe = r.dano.partes.filter((p) => p.dados.length).map((p) => p.dados.join('+')).join(' | ');
      let t = `Dano ${m.formula}: ${r.dano.total} [${detalhe}]`;
      if (r.critico) t += ` → crítico ×${m.mult} = ${r.danoCritico}`;
      else if (r.critSeAcertar) t += ` (se crítico: ${r.danoCritico})`;
      linhas.push(t);
    } else if (m.mortal) linhas.push('Morte Instantânea: veja a regra no livro (Chefes e criaturas com regra própria avançam de fase).');
  } else {
    if (m.rolaAtaque) linhas.push(`Role 1d20 ${sinal(m.bonus)}${vant}. Crítico no ${textoCrit(m)}.`);
    if (!m.semDano) linhas.push(`Dano: ${m.formula}${m.rolaAtaque ? ` (crítico: multiplique o total por ${m.mult})` : ''}`);
    else if (m.mortal) linhas.push('Morte Instantânea: veja a regra no livro.');
    if (m.explode) linhas.push('Cada 6 no dano gera mais um dado.');
  }
  if (m.salvamento) linhas.push(m.salvamento);
  if (m.consumo) linhas.push(`Gastou ${m.consumo} de munição (restam ${m.municaoAtual - m.consumo}).`);
  if (mirou && !miraLaser) linhas.push('Gastou 1 SA ao Mirar.');
  resultadosAtaque[f.chave] = linhas;
  agendarSalvarFicha();
  redesenhar();
}
