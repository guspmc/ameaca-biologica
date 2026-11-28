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
let invBalao = null;         // balão aberto: 'i<idx>' (item), 'm<grupo>' (munição) ou 'moedas'
let invExame = null;         // índice do item sendo examinado (Itens especiais)

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
      aoEscolher: () => d.itens.push({ nome: i.nome, espacos: Math.max(0, Number(i.espacos ?? 1) || 0), nota: [i.efeito, i.descricao].filter(Boolean).join(' — ').slice(0, 200), ref: '', mun: 0, pecas: [], equip: false, mestreId: String(i.id) }),
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

/* ---------- Balão com a descrição do item e quantidade de Moedas/Munição ---------- */

const TEXTO_MUNICAO = {
  '9mm': 'Cartuchos leves e comuns, usados pelas Pistolas 9 mm. Variante Alto Impacto: +1d6 de Dano em um acerto.',
  calibre12: 'Cartuchos de escopeta, volumosos e eficientes a curta distância. Variante Incendiária: Queimadura por 1 turno em acerto.',
  submetralhadora: 'Munição das Submetralhadoras, guardada em grande quantidade por Espaço.',
  rifle: 'Usada por Rifles, Rifles de Precisão e Redemption.',
  magnum: 'Cartuchos de alto calibre, raros e poderosos. Economizar é decisão de sobrevivência.',
  cargas: 'Cargas elétricas da Spark Shot. Bateria = pente; Carga = cartucho.',
  gm79: 'Cartuchos da GM 79 (Ácido, Explosivo ou Incendiário). As variantes dividem a mesma pilha de 10 por Espaço.',
  virotes: 'Projéteis reutilizáveis de besta; podem ser recuperados quando a regra da arma permitir.',
  combustivel: 'Combustível do Lança-Chamas Químico; cada ataque consome 10 unidades.',
  foguete: 'Projétil do RPG-7. Cada foguete ocupa um Espaço inteiro.',
};
const TEXTO_MOEDAS = 'Moeda estranha encontrada em áreas afetadas pelos incidentes: tesouro físico usado em mecanismos, Armários e Gaiolas e para comprar equipamento. Até 3 por Espaço.';

// Itens que o Mestre publicou (imagem e texto vêm do Painel); sem Painel, só a nota do item.
const definicaoDoMestre = (item) => (item.mestreId ? itensPersonalizadosMesa.find((x) => String(x.id) === item.mestreId) || null : null);

function descricaoDoItem(item) {
  const cat = ARSENAL.itemPorId(item.ref);
  const linhas = [];
  if (cat) {
    if (cat.tipo === 'arma') {
      const grau = ARSENAL.GRAUS.find((g) => g.id === cat.grau);
      linhas.push([grau ? grau.nome : null, cat.dano ? `Dano ${cat.dano}` : 'Sem dano', `Crítico ${cat.crit < 20 ? cat.crit + '–20' : 20} ×${cat.mult}`, cat.alcance, `${cat.maos} mão(s)`].filter(Boolean).join(' · '));
      if (cat.props) linhas.push(cat.props);
    } else if (cat.tipo === 'protecao') {
      const v = cat.kendo ? ARSENAL.KENDO[fichaAtual.dados.kendo.placas] : cat;
      linhas.push(`Defesa +${v.def} · RD ${v.rd} · ` + (v.capAgi == null ? 'AGI total' : v.capAgi === 0 ? 'sem AGI na Defesa' : `AGI limitada a +${v.capAgi}`));
    } else if (cat.efeito) linhas.push(cat.efeito);
    return linhas;
  }
  const def = definicaoDoMestre(item);
  if (def) return [def.categoria, def.descricao, def.efeito].filter(Boolean);
  return [item.nota || 'Item sem descrição.'];
}

// Cabe no Inventário depois da mudança? (aumentar só vale se sobrar Espaço)
function cabeNoInventario(d, mudanca) {
  return REGRAS.blocosInventario({ ...d, ...mudanca }).usados <= (calc ? calc.inventarioMax : 4);
}

function mudarMoedas(d, novo) {
  let n = Math.min(99, Math.max(0, Math.trunc(Number(novo)) || 0));
  while (n > d.moedas && !cabeNoInventario(d, { moedas: n })) n--;
  d.moedas = n;
  mudouArsenal();
}

function mudarMunicao(d, id, novo) {
  let n = Math.min(9999, Math.max(0, Math.trunc(Number(novo)) || 0));
  const atual = d.municoes[id] || 0;
  const com = (q) => ({ municoes: { ...d.municoes, [id]: q } });
  while (n > atual && !cabeNoInventario(d, com(n))) n--;
  if (n > 0) d.municoes[id] = n; else delete d.municoes[id];
  mudouArsenal();
}

function controleQuantidade(rotulo, valor, aoMudar, passos = [1]) {
  const botao = (delta) => h('button', { type: 'button', class: 'botao pequeno', 'aria-label': `${delta > 0 ? 'Somar' : 'Tirar'} ${Math.abs(delta)} em ${rotulo}`,
    disabled: delta < 0 && valor <= 0, onclick: () => aoMudar(valor + delta) }, (delta > 0 ? '+' : '−') + Math.abs(delta));
  return h('div', { class: 'quantidade' },
    h('span', { class: 'quantidade-nome' }, rotulo),
    h('div', { class: 'stepper' },
      ...passos.slice().reverse().map((p) => botao(-p)),
      h('input', { type: 'number', class: 'stepper-entrada', min: '0', value: valor, 'aria-label': 'Quantidade de ' + rotulo, onchange: (e) => aoMudar(e.target.value) }),
      ...passos.map((p) => botao(p))));
}

function chaveDoBloco(b) { return b.tipo === 'item' ? 'i' + b.idx : b.tipo === 'municao' ? 'm' + b.grupo : 'moedas'; }

function balaoDoInventario(d, blocos) {
  const b = [...blocos.blocos, ...blocos.semEspaco].find((x) => chaveDoBloco(x) === invBalao);
  if (!b) return null;
  const fechar = () => { invBalao = null; redesenhar(); };
  let titulo; let corpo;
  if (b.tipo === 'moedas') {
    titulo = 'Moedas Antigas';
    corpo = [h('p', {}, TEXTO_MOEDAS), controleQuantidade('Moedas', d.moedas, (n) => mudarMoedas(d, n), [1])];
  } else if (b.tipo === 'municao') {
    titulo = ARSENAL.municaoPorId(b.grupo).nome;
    corpo = [h('p', {}, TEXTO_MUNICAO[b.grupo] || 'Munição guardada na reserva.'),
      ...b.partes.map((pt) => controleQuantidade(b.partes.length > 1 || pt.id !== b.grupo ? ARSENAL.municaoPorId(pt.id).nome : 'Munição', pt.q, (n) => mudarMunicao(d, pt.id, n), [1, 5]))];
  } else {
    const item = d.itens[b.idx];
    titulo = item.nome;
    corpo = [...descricaoDoItem(item).map((t) => h('p', {}, t)),
      h('div', { class: 'balao-acoes' },
        h('button', { type: 'button', class: 'botao pequeno', onclick: () => { invSelecionado = b.idx; invBalao = null; redesenhar(); } }, 'Opções do item'))];
  }
  return h('div', { class: 'balao', role: 'dialog', 'aria-label': titulo },
    h('div', { class: 'balao-topo' }, h('strong', {}, titulo), h('button', { type: 'button', class: 'botao pequeno', 'aria-label': 'Fechar', onclick: fechar }, '✕')),
    ...corpo);
}

// Põe o balão logo abaixo do bloco tocado, sem sair da largura da grade.
function posicionarBalao() {
  requestAnimationFrame(() => {
    const raiz = document.querySelector('.inventario-espacos');
    const balao = raiz && raiz.querySelector('.balao');
    const ancora = raiz && raiz.querySelector('[data-ancora]');
    if (!balao || !ancora) return;
    const r = raiz.getBoundingClientRect();
    const a = ancora.getBoundingClientRect();
    const largura = balao.offsetWidth;
    const esquerda = Math.max(0, Math.min(a.left - r.left, r.width - largura));
    balao.style.top = (a.bottom - r.top + 6) + 'px';
    balao.style.left = esquerda + 'px';
    balao.style.setProperty('--seta', Math.max(8, Math.min(largura - 24, a.left - r.left + a.width / 2 - esquerda - 6)) + 'px');
  });
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
    const sel = (b.tipo === 'item' && invSelecionado === b.idx) || invBalao === chaveDoBloco(b);
    return h('button', {
      type: 'button',
      class: `bloco bloco-${tipo}` + (excede ? ' excede' : '') + (sel ? ' selecionado' : ''),
      style: `grid-column: span ${Math.min(b.espacos, 4)}`,
      title: `${titulo} · ${b.espacos} Espaço${b.espacos === 1 ? '' : 's'}`,
      'data-ancora': invBalao === chaveDoBloco(b) ? '1' : null,
      onclick: () => { invBalao = invBalao === chaveDoBloco(b) ? null : chaveDoBloco(b); invSelecionado = null; invSeletorAberto = false; redesenhar(); },
    }, h('span', { class: 'bloco-nome' }, titulo), sub ? h('span', { class: 'bloco-sub' }, sub) : null,
    h('span', { class: 'bloco-esp' }, `${b.espacos} Esp.`));
  });
  const vazias = Array.from({ length: livres }, () => h('button', {
    type: 'button', class: 'bloco bloco-vazio', 'aria-label': 'Adicionar item', title: 'Adicionar item',
    onclick: () => { invSeletorAberto = true; invSelecionado = null; invBalao = null; invBusca = ''; redesenhar(); },
  }, '+'));

  const itemAberto = invSelecionado != null ? d.itens[invSelecionado] : null;
  function remover(idx) {
    d.itens.splice(idx, 1);
    invSelecionado = null;
    invBalao = null;
    limparAtaques();
    mudouArsenal();
  }
  const detalhe = itemAberto
    ? (itemAberto.ref
      ? linhaItemArsenal(itemAberto, invSelecionado, () => remover(invSelecionado))
      : itemAberto.mestreId
      ? h('div', { class: 'item-linha' }, h('strong', {}, itemAberto.nome), h('span', { class: 'dica' }, 'Item do Mestre'),
        h('button', { type: 'button', class: 'botao pequeno perigo', onclick: () => remover(invSelecionado), 'aria-label': 'Remover item' }, '✕'))
      : h('div', { class: 'item-linha' },
        h('input', { class: 'item-nome', type: 'text', placeholder: 'Nome do item', value: itemAberto.nome, maxlength: '60',
          oninput: (e) => { itemAberto.nome = e.target.value; agendarSalvarFicha(); } }),
        h('input', { class: 'item-espacos', type: 'number', min: '0', max: '20', value: itemAberto.espacos, title: 'Espaços',
          onchange: (e) => { itemAberto.espacos = Math.max(0, Number(e.target.value) || 0); mudouArsenal(); } }),
        h('input', { class: 'item-nota', type: 'text', placeholder: 'Nota', value: itemAberto.nota, maxlength: '200',
          oninput: (e) => { itemAberto.nota = e.target.value; agendarSalvarFicha(); } }),
        h('button', { type: 'button', class: 'botao pequeno perigo', onclick: () => remover(invSelecionado), 'aria-label': 'Remover item' }, '✕')))
    : null;

  if (invBalao) posicionarBalao();
  return h('div', { class: 'inventario-espacos' },
    h('div', { class: 'grade-espacos' }, ...celulas, ...vazias),
    usados > max ? h('p', { class: 'mensagem erro' }, `Inventário acima do limite: ${usados} Espaços para ${max}. Remova ${usados - max} Espaço(s).`) : null,
    semEspaco.length ? h('div', { class: 'sem-espaco' },
      h('span', { class: 'dica' }, 'Sem Espaço (0 Espaços): '),
      ...semEspaco.map((b) => h('button', { type: 'button', class: 'botao pequeno' + (invBalao === chaveDoBloco(b) ? ' ativo' : ''),
        'data-ancora': invBalao === chaveDoBloco(b) ? '1' : null,
        onclick: () => { invBalao = invBalao === chaveDoBloco(b) ? null : chaveDoBloco(b); invSelecionado = null; redesenhar(); } }, d.itens[b.idx].nome))) : null,
    balaoDoInventario(d, { blocos, semEspaco }),
    invSeletorAberto ? seletorDeItens(d, livres) : null,
    detalhe);
}

/* ---------- Itens especiais: itens do Mestre e itens livres, com "Examinar" ---------- */

function painelItensEspeciais(d) {
  const lista = d.itens.map((item, idx) => ({ item, idx })).filter((x) => !x.item.ref);
  const aberto = invExame != null ? d.itens[invExame] : null;
  return h('div', { class: 'itens-especiais' },
    lista.length
      ? h('ul', { class: 'lista-especiais' }, ...lista.map(({ item, idx }) => h('li', {},
          h('span', {}, item.nome || 'Item sem nome'),
          h('button', { type: 'button', class: 'botao pequeno', onclick: () => { invExame = idx; redesenhar(); } }, 'Examinar'))))
      : h('p', { class: 'dica' }, 'Nenhum item especial. Os itens que o Mestre publicar (e itens livres) aparecem aqui.'),
    aberto ? janelaDeExame(aberto) : null);
}

function janelaDeExame(item) {
  const def = definicaoDoMestre(item);
  const fechar = () => { invExame = null; redesenhar(); };
  let url = def && def.imagemUrl ? String(def.imagemUrl) : '';
  if (url.startsWith('/') && estado.base) url = estado.base + url;
  return h('div', { class: 'exame-fundo', onclick: (e) => { if (e.target === e.currentTarget) fechar(); } },
    h('div', { class: 'exame', role: 'dialog', 'aria-label': 'Examinar ' + item.nome },
      h('div', { class: 'balao-topo' }, h('strong', {}, item.nome), h('button', { type: 'button', class: 'botao pequeno', onclick: fechar }, 'Fechar')),
      url ? h('img', { class: 'exame-imagem', src: url, alt: item.nome }) : null,
      ...descricaoDoItem(item).map((t) => h('p', {}, t)),));
}
