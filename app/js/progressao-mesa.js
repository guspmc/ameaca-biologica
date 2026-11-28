'use strict';
/*
 * Cartões do Mestre para a progressão da Mesa e os itens liberados (usa acaoMesa de mesas.js).
 *  - Progressão (livro, capítulo 6): Marco Narrativo ou contagem opcional de Missões Completadas.
 *    A subida só é aplicada num Descanso Completo em Sala de Descanso (narrativo; o app só libera o Nível).
 *  - Itens liberados: no modo Local, o Jogador só escolhe no Inventário o que o Mestre liberou (padrão: tudo).
 * O Mestre não vê nem altera Fichas: ele só decide o que fica disponível.
 */

let categoriaItensAberta = '';

function cartaoProgressaoMestre(m) {
  const conf = (campos, msg) => acaoMesa(rotaDaMesa('/configurar'), campos, msg);
  const missoes = m.missoes || 0;
  const porMissoes = REGRAS.nivelPorMissoes(missoes);
  const proxima = LIVRO.PROGRESSAO.missoes[porMissoes]; // Missões para o Nível seguinte (undefined no 10)
  return h('div', { class: 'cartao' },
    h('h2', {}, 'Progressão de Nível'),
    h('p', { class: 'dica' }, `Nível liberado para os Jogadores: ${m.nivelLiberado} (limite da Mesa: ${m.limiteNivel}). O Jogador só pede para subir até esse Nível; você aprova a Ficha.`),
    h('label', {}, 'Missões Completadas (opcional)'),
    h('div', { class: 'linha' },
      h('button', { type: 'button', class: 'botao pequeno', disabled: missoes <= 0, onclick: () => conf({ missoes: missoes - 1 }) }, '−'),
      h('strong', {}, String(missoes)),
      h('button', { type: 'button', class: 'botao pequeno', disabled: missoes >= 99, onclick: () => conf({ missoes: missoes + 1 }) }, '+ Missão concluída')),
    h('p', { class: 'dica' }, `Pela tabela do livro: Nível ${porMissoes}` + (proxima != null ? ` (Nível ${porMissoes + 1} com ${proxima} Missões).` : '.')),
    h('label', { for: 'cfg-marco' }, 'Marco Narrativo: liberar até o Nível'),
    h('select', { id: 'cfg-marco', onchange: (e) => conf({ nivelMarco: Number(e.target.value) }) },
      ...Array.from({ length: LIVRO.PROGRESSAO.missoes.length }, (_, i) => i + 1)
        .map((n) => h('option', { value: String(n), selected: n === (m.nivelMarco || 1) }, `Nível ${n}`))));
}

function cartaoItensMestre(m) {
  const conf = (lista) => acaoMesa(rotaDaMesa('/configurar'), { itensLiberados: lista });
  const todos = ARSENAL.CATEGORIAS.flatMap((c) => c.itens.map((i) => i.id));
  const liberados = new Set(Array.isArray(m.itensLiberados) ? m.itensLiberados : todos);
  const alternar = (ids, ligar) => {
    const novo = new Set(liberados);
    for (const id of ids) { if (ligar) novo.add(id); else novo.delete(id); }
    conf(novo.size === todos.length ? null : [...novo]);
  };
  return h('div', { class: 'cartao' },
    h('h2', {}, 'Itens liberados para o Inventário'),
    h('p', { class: 'dica' }, `${liberados.size} de ${todos.length} itens do livro liberados. Os Jogadores escolhem só entre eles (itens personalizados publicados no Painel entram à parte).`),
    h('div', { class: 'linha' },
      h('button', { type: 'button', class: 'botao pequeno', onclick: () => conf(null) }, 'Liberar todos'),
      h('button', { type: 'button', class: 'botao pequeno', onclick: () => conf([]) }, 'Liberar nenhum')),
    ...ARSENAL.CATEGORIAS.map((c) => {
      const ids = c.itens.map((i) => i.id);
      const n = ids.filter((id) => liberados.has(id)).length;
      return h('details', { open: c.id === categoriaItensAberta, ontoggle: (e) => { if (e.target.open) categoriaItensAberta = c.id; else if (categoriaItensAberta === c.id) categoriaItensAberta = ''; } },
        h('summary', {}, `${c.nome} (${n}/${ids.length})`),
        h('div', { class: 'linha' },
          h('button', { type: 'button', class: 'botao pequeno', onclick: () => alternar(ids, true) }, 'Todos'),
          h('button', { type: 'button', class: 'botao pequeno', onclick: () => alternar(ids, false) }, 'Nenhum')),
        ...c.itens.map((i) => h('label', { class: 'cond-label' + (liberados.has(i.id) ? ' ativa' : '') },
          h('input', { type: 'checkbox', checked: liberados.has(i.id), onchange: (e) => alternar([i.id], e.target.checked) }),
          ' ', i.nome)));
    }));
}
