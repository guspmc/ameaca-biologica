'use strict';
/*
 * Inventário em blocos de Espaço (carregado depois de arsenal-ui.js).
 * Um bloco por Espaço de Inventário (4 + FOR + bônus); o "+" abre a lista de itens.
 * Item com 2 ou mais Espaços ocupa blocos lado a lado. Modo Offline: todo o catálogo do livro.
 * Modo Local: só o que o Mestre liberou (mesa.itensLiberados) + itens personalizados publicados (itensPersonalizadosDaMesa).
 */

let invSelecionado = null;   // índice do item aberto nos detalhes
let invSeletorAberto = false;
let invCategoria = '';
let invBusca = '';

// Itens personalizados que o Mestre publicou (Painel do Mestre): [{ id, nome, categoria, descricao, efeito, espacos? }].
// Quem carrega a lista (painel-mestre-conteudo) preenche esta variável; sem Painel, fica vazia.
let itensPersonalizadosMesa = [];
const itensPersonalizadosDaMesa = () => (fichasOffline ? [] : itensPersonalizadosMesa);

// null = todos os itens do livro.
function idsLiberados() {
  if (fichasOffline) return null;
  const m = estado.mesaAtual;
  return m && Array.isArray(m.itensLiberados) ? new Set(m.itensLiberados) : null;
}

function espacosDoCatalogo(id) {
  return REGRAS.espacosDoItem({ nome: '', espacos: 1, nota: '', ref: id, mun: 0, pecas: [], equip: false });
}

// Categorias do seletor: [{ id, nome, entradas: [{ chave, nome, detalhe, espacos, aoEscolher() }] }]
function categoriasDoSeletor(d, livres) {
  const lib = idsLiberados();
  const cats = [];
  for (const c of ARSENAL.CATEGORIAS) {
    const itens = c.itens.filter((i) => !lib || lib.has(i.id));
    if (!itens.length) continue;
    cats.push({
      id: c.id, nome: c.nome,
      entradas: itens.map((i) => {
        const g = ARSENAL.GRAUS.find((x) => x.id === i.grau);
        return {
          chave: i.id, nome: i.nome, detalhe: g ? g.nome : '', espacos: espacosDoCatalogo(i.id),
          aoEscolher: () => d.itens.push({ nome: i.nome, espacos: i.espacos, nota: '', ref: i.id, mun: 0, pecas: [], equip: false }),
        };
      }),
    });
  }
  // Munição: cada toque soma um lote de compra (ou uma pilha cheia de um Espaço).
  const municoes = ARSENAL.MUNICOES.map((m) => {
    const soma = m.lote || m.porEspaco;
    const antes = REGRAS.blocosInventario(d).usados;
    const depois = REGRAS.blocosInventario({ ...d, municoes: { ...d.municoes, [m.id]: (d.municoes[m.id] || 0) + soma } }).usados;
    return {
      chave: 'mun-' + m.id, nome: m.nome, detalhe: `+${soma}`, espacos: depois - antes,
      aoEscolher: () => { d.municoes[m.id] = (d.municoes[m.id] || 0) + soma; },
    };
  });
  const moeda = (n) => {
    const antes = REGRAS.blocosInventario(d).usados;
    const depois = REGRAS.blocosInventario({ ...d, moedas: Math.min(99, d.moedas + n) }).usados;
    return { chave: 'moeda' + n, nome: n === 1 ? 'Moeda Antiga' : `${n} Moedas Antigas`, detalhe: 'até 3 por Espaço', espacos: depois - antes,
      aoEscolher: () => { d.moedas = Math.min(99, d.moedas + n); } };
  };
  cats.push({ id: 'municao', nome: 'Munição', entradas: municoes });
  cats.push({ id: 'moedas', nome: 'Moedas Antigas', entradas: [moeda(1), moeda(3)] });
  const extras = itensPersonalizadosDaMesa();
  if (extras.length) {
    cats.push({ id: 'mestre', nome: 'Do Mestre', entradas: extras.map((i) => ({
      chave: 'mestre-' + i.id, nome: i.nome, detalhe: i.categoria || '', espacos: Math.max(0, Number(i.espacos ?? 1) || 0),
      aoEscolher: () => d.itens.push({ nome: i.nome, espacos: Math.max(0, Number(i.espacos ?? 1) || 0), nota: [i.efeito, i.descricao].filter(Boolean).join(' — ').slice(0, 200), ref: '', mun: 0, pecas: [], equip: false }),
    })) });
  }
  if (fichasOffline) {
    cats.push({ id: 'livre', nome: 'Item livre', entradas: [{
      chave: 'livre', nome: 'Item livre (você define nome e Espaços)', detalhe: '', espacos: 0,
      aoEscolher: () => d.itens.push({ nome: 'Novo item', espacos: 1, nota: '', ref: '', mun: 0, pecas: [], equip: false }),
    }] });
  }
  return cats;
}

function escolherNoSeletor(entrada, d) {
  const antes = d.itens.length;
  entrada.aoEscolher();
  if (d.itens.length > antes) invSelecionado = d.itens.length - 1; // abre os detalhes do item novo
  invSeletorAberto = false;
  invBusca = '';
  limparAtaques();
  mudouArsenal(`${entrada.nome} adicionado.`);
}

function seletorDeItens(d, livres) {
  const cats = categoriasDoSeletor(d, livres);
  if (!cats.some((c) => c.id === invCategoria)) invCategoria = cats[0].id;
  const cat = cats.find((c) => c.id === invCategoria);
  const busca = ARSENAL.semAcento(invBusca);
  const lista = busca ? cats.flatMap((c) => c.entradas).filter((e) => ARSENAL.semAcento(e.nome).includes(busca)) : cat.entradas;
  return h('div', { class: 'seletor-itens', role: 'dialog', 'aria-label': 'Escolher item' },
    h('div', { class: 'seletor-topo' },
      h('strong', {}, `Adicionar ao Inventário (${livres} Espaço${livres === 1 ? '' : 's'} livre${livres === 1 ? '' : 's'})`),
      h('button', { type: 'button', class: 'botao pequeno', onclick: () => { invSeletorAberto = false; invBusca = ''; redesenhar(); } }, 'Fechar')),
    h('input', { type: 'search', class: 'seletor-busca', placeholder: 'Buscar item…', value: invBusca,
      oninput: (e) => { invBusca = e.target.value; const pos = e.target.selectionStart; redesenhar(); const el = document.querySelector('.seletor-busca'); if (el) { el.focus(); el.setSelectionRange(pos, pos); } } }),
    busca ? null : h('div', { class: 'seletor-abas' }, ...cats.map((c) =>
      h('button', { type: 'button', class: 'botao pequeno' + (c.id === invCategoria ? ' ativo' : ''), onclick: () => { invCategoria = c.id; redesenhar(); } }, c.nome))),
    h('ul', { class: 'seletor-lista' }, lista.length ? lista.map((e) => {
      const cabe = e.espacos <= livres;
      return h('li', {}, h('button', { type: 'button', class: 'seletor-item', disabled: !cabe, title: cabe ? '' : 'Não cabe: faltam Espaços no Inventário.',
        onclick: () => escolherNoSeletor(e, d) },
        h('span', { class: 'si-nome' }, e.nome), e.detalhe ? h('span', { class: 'si-detalhe' }, e.detalhe) : null,
        h('span', { class: 'si-esp' }, e.espacos === 0 ? 'sem Espaço' : `${e.espacos} Esp.`)));
    }) : h('li', { class: 'dica' }, idsLiberados() && !busca ? 'O Mestre ainda não liberou itens desta categoria.' : 'Nada encontrado.')));
}

function nomeDoBloco(b, d) {
  if (b.tipo === 'moedas') return { titulo: 'Moedas Antigas', sub: `${b.total}` };
  if (b.tipo === 'municao') return { titulo: ARSENAL.municaoPorId(b.grupo).nome, sub: `${b.total}` + (b.partes.length > 1 ? ' (várias)' : '') };
  const item = d.itens[b.idx];
  const cat = ARSENAL.itemPorId(item.ref);
  let sub = '';
  if (cat && cat.tipo === 'arma' && cat.pente != null) sub = `${item.mun}/${REGRAS.capacidadeDaArma(item)}`;
  else if (cat && cat.tipo === 'protecao' && item.equip) sub = 'equipado';
  return { titulo: item.nome, sub };
}

function painelEspacos(d) {
  const max = calc ? calc.inventarioMax : 4;
  const { blocos, semEspaco, usados } = REGRAS.blocosInventario(d);
  const livres = Math.max(0, max - usados);
  let acumulado = 0;

  const celulas = blocos.map((b) => {
    acumulado += b.espacos;
    const excede = acumulado > max;
    const { titulo, sub } = nomeDoBloco(b, d);
    const cat = b.tipo === 'item' ? ARSENAL.itemPorId(d.itens[b.idx].ref) : null;
    const tipo = b.tipo === 'item' ? (cat ? cat.tipo : 'livre') : b.tipo;
    const sel = b.tipo === 'item' && invSelecionado === b.idx;
    return h('button', {
      type: 'button',
      class: `bloco bloco-${tipo}` + (excede ? ' excede' : '') + (sel ? ' selecionado' : ''),
      style: `grid-column: span ${Math.min(b.espacos, 4)}`,
      title: `${titulo} · ${b.espacos} Espaço${b.espacos === 1 ? '' : 's'}`,
      disabled: b.tipo !== 'item',
      onclick: () => { invSelecionado = sel ? null : b.idx; invSeletorAberto = false; redesenhar(); },
    }, h('span', { class: 'bloco-nome' }, titulo), sub ? h('span', { class: 'bloco-sub' }, sub) : null,
    h('span', { class: 'bloco-esp' }, `${b.espacos} Esp.`));
  });
  const vazias = Array.from({ length: livres }, () => h('button', {
    type: 'button', class: 'bloco bloco-vazio', 'aria-label': 'Adicionar item', title: 'Adicionar item',
    onclick: () => { invSeletorAberto = true; invSelecionado = null; invBusca = ''; redesenhar(); },
  }, '+'));

  const itemAberto = invSelecionado != null ? d.itens[invSelecionado] : null;
  function remover(idx) {
    d.itens.splice(idx, 1);
    invSelecionado = null;
    limparAtaques();
    mudouArsenal();
  }
  const detalhe = itemAberto
    ? (itemAberto.ref
      ? linhaItemArsenal(itemAberto, invSelecionado, () => remover(invSelecionado))
      : h('div', { class: 'item-linha' },
        h('input', { class: 'item-nome', type: 'text', placeholder: 'Nome do item', value: itemAberto.nome, maxlength: '60',
          oninput: (e) => { itemAberto.nome = e.target.value; agendarSalvarFicha(); } }),
        h('input', { class: 'item-espacos', type: 'number', min: '0', max: '20', value: itemAberto.espacos, title: 'Espaços',
          onchange: (e) => { itemAberto.espacos = Math.max(0, Number(e.target.value) || 0); mudouArsenal(); } }),
        h('input', { class: 'item-nota', type: 'text', placeholder: 'Nota', value: itemAberto.nota, maxlength: '200',
          oninput: (e) => { itemAberto.nota = e.target.value; agendarSalvarFicha(); } }),
        h('button', { type: 'button', class: 'botao pequeno perigo', onclick: () => remover(invSelecionado), 'aria-label': 'Remover item' }, '✕')))
    : null;

  return h('div', { class: 'inventario-espacos' },
    h('div', { class: 'grade-espacos' }, ...celulas, ...vazias),
    usados > max ? h('p', { class: 'mensagem erro' }, `Inventário acima do limite: ${usados} Espaços para ${max}. Remova ${usados - max} Espaço(s).`) : null,
    semEspaco.length ? h('div', { class: 'sem-espaco' },
      h('span', { class: 'dica' }, 'Sem Espaço (0 Espaços): '),
      ...semEspaco.map((b) => h('button', { type: 'button', class: 'botao pequeno' + (invSelecionado === b.idx ? ' ativo' : ''),
        onclick: () => { invSelecionado = invSelecionado === b.idx ? null : b.idx; redesenhar(); } }, d.itens[b.idx].nome))) : null,
    invSeletorAberto ? seletorDeItens(d, livres) : null,
    detalhe);
}
