'use strict';
/*
 * Fichas de Personagem no app.
 * Carregado DEPOIS de dados-livro.js, regras.js e mesas.js (que definem LIVRO, REGRAS e h).
 * Usa `estado`, `$`, `buscar`, `mensagem` de app.js.
 *
 * Fluxo do Jogador:
 *   Mesa (visaoDoJogador) → lista de fichas → editor (4 seções)
 *   barra superior: PV / SA / BI (atualizados em tempo real)
 *   barra inferior: Identificação | Atributos | Combate | Inventário
 *
 * Fluxo do Mestre:
 *   painelDoMestre → cartão "Fichas" → solicitações → aprovar / recusar
 */

/* ---------- API ---------- */

function apiFichas(rota, metodo = 'GET', corpo) {
  if (!estado.base || !estado.token || estado.modo !== 'local') {
    throw new Error('Conecte-se a um servidor local primeiro.');
  }
  const mesaId = encodeURIComponent(estado.mesaId);
  return buscar(estado.base + '/api/mesas/' + mesaId + rota, {
    method: metodo,
    headers: {
      Authorization: 'Bearer ' + estado.token,
      ...(corpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
  });
}

/* ---------- Estado das Fichas ---------- */

// Fichas do Jogador (array) ou solicitações do Mestre (array) — carregadas ao entrar na Mesa.
let fichasDoJogador = [];
// Ficha sendo editada agora.
let fichaAtual = null; // { id, estado, dados }
let secaoAtual = 'identificacao';
// Resultado de REGRAS.calcular(fichaAtual.dados) — recomputado após cada mudança.
let calc = null;
// Modo de rolagem: 'manual' (mostra modificador) | 'automatico' (rola 1d20)
let modoRolagem = (() => {
  try { return localStorage.getItem('ab-modo-rolagem') || 'manual'; } catch { return 'manual'; }
})();
// Timer de debounce para salvar jogo automaticamente.
let timerSalvarJogo = null;

/* ---------- Helpers de DOM ---------- */

const botaoFicha = (texto, classe, onclick) =>
  h('button', { type: 'button', class: 'botao pequeno ' + (classe || ''), onclick }, texto);

function barraIndicador(id, label, valor, max, classe) {
  return h('div', { class: 'indicador ' + (classe || '') },
    h('span', { class: 'ind-label' }, label),
    h('span', { id, class: 'ind-valor' }, `${valor}/${max}`));
}

/* ---------- Barra Superior: PV / SA / BI ---------- */

function atualizarBarraSuperior() {
  if (!fichaAtual || !calc) return;
  const pv = fichaAtual.dados.jogo.pv == null ? calc.pvMax : Math.min(fichaAtual.dados.jogo.pv, calc.pvMax);
  const sa = fichaAtual.dados.jogo.sa == null ? calc.saMax : Math.min(fichaAtual.dados.jogo.sa, calc.saMax);
  const bi = fichaAtual.dados.jogo.bi;

  const eBarra = $('ficha-barra-superior');
  if (!eBarra) return;

  // PV
  const pvEl = $('ficha-pv');
  if (pvEl) pvEl.textContent = pv + '/' + calc.pvMax;
  const pvPai = pvEl && pvEl.closest('.indicador');
  if (pvPai) {
    pvPai.classList.toggle('vulneravel', calc.vulneravel);
    pvPai.classList.toggle('desacordado', calc.desacordado);
    pvPai.title = calc.desacordado ? 'Desacordado' : (calc.vulneravel ? 'Vulnerável' : '');
  }

  // SA
  const saEl = $('ficha-sa');
  if (saEl) saEl.textContent = sa + '/' + calc.saMax;

  // BI
  const biEl = $('ficha-bi');
  if (biEl) {
    const fase = calc.faseBI;
    biEl.textContent = bi + '/' + calc.biMax;
    const rot = $('ficha-bi-rotulo');
    if (rot) rot.textContent = fase.colapso ? 'BI · Colapso' : `BI · Fase ${fase.fase}`;
    biEl.closest && biEl.closest('.indicador') && biEl.closest('.indicador').classList.toggle('colapso', fase.colapso);
  }
}

function criarBarraSuperior() {
  if (!fichaAtual || !calc) return h('div', { id: 'ficha-barra-superior', class: 'barra-superior', hidden: true });
  const pv = fichaAtual.dados.jogo.pv == null ? calc.pvMax : fichaAtual.dados.jogo.pv;
  const sa = fichaAtual.dados.jogo.sa == null ? calc.saMax : fichaAtual.dados.jogo.sa;
  const bi = fichaAtual.dados.jogo.bi;
  const fase = calc.faseBI;

  function ajuste(campo, delta) {
    const d = fichaAtual.dados;
    const atual = d.jogo[campo] == null ? calc[campo + 'Max'] : d.jogo[campo];
    const max = calc[campo + 'Max'];
    const novo = Math.min(max, Math.max(0, atual + delta));
    fichaAtual.dados.jogo[campo] = novo;
    calc = REGRAS.calcular(fichaAtual.dados);
    atualizarBarraSuperior();
    agendarSalvarJogo();
  }

  function ajusteBi(delta) {
    const d = fichaAtual.dados;
    const atual = d.jogo.bi;
    const novo = Math.min(Math.max(calc.biMax, 0), Math.max(0, atual + delta));
    fichaAtual.dados.jogo.bi = novo;
    calc = REGRAS.calcular(fichaAtual.dados);
    atualizarBarraSuperior();
    agendarSalvarJogo();
  }

  const btn = (texto, onclick, titulo) =>
    h('button', { type: 'button', class: 'ajuste', onclick, title: titulo || texto }, texto);

  const grupo = (id, label, rotulo, val, max, classeExtra, menos, mais) =>
    h('div', { class: 'indicador ' + (classeExtra || '') },
      btn('-', menos, 'Diminuir ' + label),
      h('span', { class: 'ind-centro' },
        h('span', { id: id + '-rotulo', class: 'ind-label' }, rotulo),
        h('span', { id, class: 'ind-valor' }, val + '/' + max)),
      btn('+', mais, 'Aumentar ' + label));

  return h('div', { id: 'ficha-barra-superior', class: 'barra-superior' },
    grupo('ficha-pv', 'PV', 'PV', pv, calc.pvMax,
      (calc.desacordado ? 'desacordado' : (calc.vulneravel ? 'vulneravel' : '')),
      () => ajuste('pv', -1), () => ajuste('pv', 1)),
    grupo('ficha-sa', 'SA', 'SA', sa, calc.saMax, '',
      () => ajuste('sa', -1), () => ajuste('sa', 1)),
    grupo('ficha-bi', 'BI', fase.colapso ? 'BI · Colapso' : `BI · Fase ${fase.fase}`, bi, calc.biMax,
      (fase.colapso ? 'colapso' : ''),
      () => ajusteBi(-1), () => ajusteBi(1)));
}

/* ---------- Barra Inferior: atalhos de seção ---------- */

function criarBarraInferior() {
  const secoes = [
    { id: 'identificacao', label: 'Identificação' },
    { id: 'atributos', label: 'Atributos' },
    { id: 'combate', label: 'Combate' },
    { id: 'inventario', label: 'Inventário' },
  ];
  return h('div', { id: 'ficha-barra-inferior', class: 'barra-inferior' },
    secoes.map((s) =>
      h('button', {
        type: 'button',
        class: 'atalho' + (secaoAtual === s.id ? ' ativo' : ''),
        id: 'atalho-' + s.id,
        onclick: () => irParaSecao(s.id),
      }, s.label)));
}

function irParaSecao(id) {
  secaoAtual = id;
  // Atualiza estado visual dos atalhos.
  document.querySelectorAll('#ficha-barra-inferior .atalho').forEach((b) => {
    b.classList.toggle('ativo', b.id === 'atalho-' + id);
  });
  // Scroll suave até a seção.
  const el = document.getElementById('secao-' + id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ---------- Rolador de Dados ---------- */

function painelRolagem(pericias) {
  const modo = h('div', { class: 'linha' },
    h('label', {},
      h('input', {
        type: 'checkbox',
        id: 'chk-rolagem-auto',
        checked: modoRolagem === 'automatico',
        onchange: (e) => {
          modoRolagem = e.target.checked ? 'automatico' : 'manual';
          try { localStorage.setItem('ab-modo-rolagem', modoRolagem); } catch {}
        },
      }),
      ' Rolar automaticamente'));

  const resultado = h('div', { id: 'resultado-rolagem', class: 'resultado-rolagem', hidden: true });

  const linhas = LIVRO.PERICIAS.map((p) => {
    const val = pericias[p.id];
    return h('div', { class: 'linha-pericia' },
      h('span', { class: 'per-nome' }, p.nome),
      h('span', { class: 'per-val' }, (val >= 0 ? '+' : '') + val),
      h('button', { type: 'button', class: 'botao pequeno', onclick: () => rolar(p.nome, val, resultado) }, 'Rolar'));
  });

  return h('div', { class: 'painel-rolagem' }, modo, resultado, ...linhas);
}

function rolar(nome, modificador, saida) {
  if (modoRolagem === 'automatico') {
    const dado = Math.ceil(Math.random() * 20);
    const total = dado + modificador;
    saida.hidden = false;
    saida.textContent = `${nome}: d20(${dado}) + ${modificador} = ${total}`;
  } else {
    saida.hidden = false;
    saida.textContent = `${nome}: modificador ${modificador >= 0 ? '+' : ''}${modificador}`;
  }
}

/* ---------- Seção: Identificação ---------- */

function secaoIdentificacao(d) {
  const origem = REGRAS.origemPorId(d.origem);
  const classe = REGRAS.classePorId(d.classe);
  const origens = LIVRO.ORIGENS.map((o) => h('option', { value: o.id, selected: o.id === d.origem }, o.nome));
  const classes = LIVRO.CLASSES.map((c) => h('option', { value: c.id, selected: c.id === d.classe }, c.nome));

  // Perícias das origens não-amnésicas.
  function opcoesOrigemTreino(origemId) {
    const o = REGRAS.origemPorId(origemId);
    if (!o) return [];
    const pericias = o.pericias || d.origemPericias;
    return pericias.filter(Boolean).map((pid) => {
      const p = LIVRO.PERICIAS.find((x) => x.id === pid);
      return p ? h('option', { value: p.id, selected: p.id === d.origemTreino }, p.nome) : null;
    }).filter(Boolean);
  }

  function mudou(campo, valor) {
    fichaAtual.dados[campo] = valor;
    if (campo === 'origem') {
      // Resetar escolhas de perícia da origem quando a origem muda.
      fichaAtual.dados.origemTreino = '';
      fichaAtual.dados.origemPericias = ['', ''];
    }
    agendarSalvarFicha();
    if (['origem', 'classe', 'nivel', 'origemTreino'].includes(campo)) redesenhar();
  }

  const isAmnesia = origem && !origem.pericias;
  const periciaIds = LIVRO.PERICIAS.map((p) => ({ value: p.id, label: p.nome }));

  return h('div', { id: 'secao-identificacao', class: 'secao' },
    h('h3', {}, 'Identificação'),
    h('label', { for: 'fi-nome' }, 'Nome do personagem'),
    h('input', { id: 'fi-nome', type: 'text', maxlength: '40', value: d.nome, oninput: (e) => mudou('nome', e.target.value) }),
    h('label', { for: 'fi-conceito' }, 'Conceito'),
    h('input', { id: 'fi-conceito', type: 'text', maxlength: '120', value: d.conceito, oninput: (e) => mudou('conceito', e.target.value) }),
    h('label', { for: 'fi-origem' }, 'Origem'),
    h('select', { id: 'fi-origem', onchange: (e) => mudou('origem', e.target.value) },
      h('option', { value: '' }, '— escolha —'), ...origens),

    // Amnésico escolhe duas Perícias.
    isAmnesia ? h('div', { id: 'fi-amnesia' },
      h('label', { for: 'fi-amnesia-p1' }, 'Perícia amnésica 1'),
      h('select', { id: 'fi-amnesia-p1', onchange: (e) => { fichaAtual.dados.origemPericias[0] = e.target.value; agendarSalvarFicha(); redesenhar(); } },
        h('option', { value: '' }, '— escolha —'),
        ...periciaIds.map((p) => h('option', { value: p.value, selected: p.value === d.origemPericias[0] }, p.label))),
      h('label', { for: 'fi-amnesia-p2' }, 'Perícia amnésica 2'),
      h('select', { id: 'fi-amnesia-p2', onchange: (e) => { fichaAtual.dados.origemPericias[1] = e.target.value; agendarSalvarFicha(); redesenhar(); } },
        h('option', { value: '' }, '— escolha —'),
        ...periciaIds.map((p) => h('option', { value: p.value, selected: p.value === d.origemPericias[1] }, p.label))),
    ) : null,

    origem ? h('div', {},
      h('label', { for: 'fi-origem-treino' }, 'Treinamento gratuito da Origem'),
      h('select', { id: 'fi-origem-treino', onchange: (e) => mudou('origemTreino', e.target.value) },
        h('option', { value: '' }, '— escolha —'),
        ...opcoesOrigemTreino(d.origem))) : null,

    h('label', { for: 'fi-classe' }, 'Classe'),
    h('select', { id: 'fi-classe', onchange: (e) => mudou('classe', e.target.value) },
      h('option', { value: '' }, '— escolha —'), ...classes),

    h('label', { for: 'fi-nivel' }, 'Nível'),
    h('input', { id: 'fi-nivel', type: 'number', min: '1', max: '10', value: d.nivel,
      onchange: (e) => mudou('nivel', Number(e.target.value)) }),

    h('label', { for: 'fi-historia' }, 'História e anotações gerais'),
    h('textarea', { id: 'fi-historia', rows: '5', maxlength: '3000',
      oninput: (e) => mudou('historia', e.target.value) }, d.historia));
}

/* ---------- Seção: Atributos e Perícias ---------- */

function secaoAtributos(d) {
  function mudouAtributo(id, valor) {
    fichaAtual.dados.atributos[id] = Math.min(5, Math.max(0, Number(valor) || 0));
    agendarSalvarFicha();
    redesenhar();
  }

  function mudouPericia(id, grau) {
    fichaAtual.dados.pericias[id] = grau;
    agendarSalvarFicha();
    redesenhar();
  }

  const totalAtributos = LIVRO.ATRIBUTOS.reduce((s, a) => s + d.atributos[a.id], 0);
  const nivelBonusAtrib = LIVRO.PROGRESSAO.atributo.filter((n) => n <= d.nivel).length;
  const maxAtrib = 4 + 3 + nivelBonusAtrib;

  const atributoEl = (a) => h('div', { class: 'atributo-linha' },
    h('label', { for: 'at-' + a.id }, a.nome),
    h('input', { id: 'at-' + a.id, type: 'number', min: '0', max: '5', value: d.atributos[a.id],
      onchange: (e) => mudouAtributo(a.id, e.target.value) }),
    h('span', { class: 'atributo-dica' }, LIVRO.PERICIAS.filter((p) => p.atributo === a.id).map((p) => p.nome).join(', ')));

  const pericias = calc ? calc.pericias : {};
  const graus = calc ? calc.graus : {};
  const livres = REGRAS.periciasGratuitas(d);

  const periciaEl = (p) => {
    const val = pericias[p.id] ?? 0;
    const grau = graus[p.id] ?? 0;
    const livre = livres.has(p.id);
    return h('div', { class: 'pericia-linha' },
      h('span', { class: 'per-nome' }, p.nome, livre ? h('span', { class: 'etiqueta' }, 'Gratuita') : null),
      h('span', { class: 'per-val' }, (val >= 0 ? '+' : '') + val),
      h('div', { class: 'grau-opcoes', role: 'group', 'aria-label': 'Grau de ' + p.nome },
        LIVRO.GRAUS.map((g, i) => h('label', { class: 'grau-label' + (grau === i ? ' ativo' : '') },
          h('input', {
            type: 'radio',
            name: 'grau-' + p.id,
            value: String(i),
            checked: grau === i,
            onchange: () => mudouPericia(p.id, i),
          }),
          g.nome))));
  };

  const pontosTotal = calc ? calc.pontosPericia.total : 0;
  const pontosGastos = calc ? calc.pontosPericia.gastos : 0;

  // Habilidades disponíveis para a classe.
  const classe = REGRAS.classePorId(d.classe);
  const habilidadesClasse = classe
    ? LIVRO.HABILIDADES.filter((hab) => hab.classe === classe.id)
    : [];
  const vagas = REGRAS.vagasDeHabilidade(d.nivel);

  function toggleHabilidade(id) {
    const idx = fichaAtual.dados.habilidades.indexOf(id);
    if (idx >= 0) fichaAtual.dados.habilidades.splice(idx, 1);
    else fichaAtual.dados.habilidades.push(id);
    agendarSalvarFicha();
    redesenhar();
  }

  const habilidadeEl = (h2) => {
    const temela = d.habilidades.includes(h2.id);
    return h('label', { class: 'hab-label' + (temela ? ' ativo' : '') },
      h('input', { type: 'checkbox', checked: temela, onchange: () => toggleHabilidade(h2.id) }),
      h('span', { class: 'hab-nome' }, h2.nome),
      h('span', { class: 'etiqueta' }, h2.tier),
      h2.descricao ? h('span', { class: 'hab-desc' }, h2.descricao) : null);
  };

  // Treinamento extra (Tentativa e Erro).
  const temTentativaErro = d.habilidades.includes('tentativa-e-erro');
  const periciasPorId = Object.fromEntries(LIVRO.PERICIAS.map((p) => [p.id, p.nome]));
  const permiteExtra = classe
    ? h('select', {
        id: 'fi-treino-extra',
        onchange: (e) => { fichaAtual.dados.treinoExtra = e.target.value; agendarSalvarFicha(); redesenhar(); },
      },
        h('option', { value: '' }, '— escolha —'),
        ...(classe.permitidas || []).map((pid) =>
          h('option', { value: pid, selected: pid === d.treinoExtra }, periciasPorId[pid] || pid)))
    : null;

  return h('div', { id: 'secao-atributos', class: 'secao' },
    h('h3', {}, 'Atributos'),
    h('p', { class: 'dica' }, `Pontos de Atributo: ${totalAtributos}/${maxAtrib}`),
    ...LIVRO.ATRIBUTOS.map(atributoEl),

    h('h3', {}, `Perícias (${pontosGastos}/${pontosTotal} pontos usados)`),
    ...LIVRO.PERICIAS.map(periciaEl),

    h('h3', {}, `Habilidades (Básica: ${d.habilidades.filter((id) => { const hb = REGRAS.habilidadePorId(id); return hb && hb.tier === 'basica'; }).length}/${vagas.basica})`),
    habilidadesClasse.length
      ? h('div', { class: 'lista-habilidades' }, habilidadesClasse.map(habilidadeEl))
      : h('p', { class: 'dica' }, 'Escolha uma Classe para ver as Habilidades disponíveis.'),

    temTentativaErro && permiteExtra
      ? h('div', {},
          h('label', { for: 'fi-treino-extra' }, 'Tentativa e Erro: Perícia extra'),
          permiteExtra)
      : null);
}

/* ---------- Seção: Combate ---------- */

function secaoCombate(d) {
  if (!calc) return h('div', { id: 'secao-combate', class: 'secao' }, h('p', { class: 'dica' }, 'Preencha Atributos e Classe para ver os valores de combate.'));

  // Condições
  function toggleCondicao(id) {
    const condicoes = fichaAtual.dados.jogo.condicoes;
    const idx = condicoes.indexOf(id);
    if (idx >= 0) condicoes.splice(idx, 1);
    else condicoes.push(id);
    agendarSalvarJogo();
    redesenhar();
  }

  const condicoesEl = LIVRO.CONDICOES.map((c) => {
    const ativa = fichaAtual.dados.jogo.condicoes.includes(c.id);
    return h('label', { class: 'cond-label' + (ativa ? ' ativa' : '') },
      h('input', { type: 'checkbox', checked: ativa, onchange: () => toggleCondicao(c.id) }),
      ' ', c.nome);
  });

  const pvTemp = fichaAtual.dados.jogo.pvTemp;

  return h('div', { id: 'secao-combate', class: 'secao' },
    h('h3', {}, 'Dados de Combate'),
    h('div', { class: 'combate-stats' },
      h('div', { class: 'stat-linha' }, h('span', {}, 'Defesa'), h('strong', {}, String(calc.defesa))),
      h('div', { class: 'stat-linha' }, h('span', {}, 'RD'), h('strong', {}, String(calc.rd))),
      h('div', { class: 'stat-linha' }, h('span', {}, 'Iniciativa'), h('strong', {}, String(calc.iniciativa))),
      h('div', { class: 'stat-linha' }, h('span', {}, 'Movimento'), h('strong', {}, calc.movimento + ' m'))),

    h('h3', {}, 'Ataques'),
    painelAtaques(d),

    h('h3', {}, 'Passivos'),
    h('div', { class: 'combate-stats' },
      ...Object.entries(calc.passivos).map(([id, val]) => {
        const p = LIVRO.PERICIAS.find((x) => x.id === id);
        return h('div', { class: 'stat-linha' }, h('span', {}, p ? p.nome : id), h('strong', {}, String(val)));
      })),

    h('h3', {}, 'PV Temporário'),
    h('input', { type: 'number', min: '0', max: '999', value: pvTemp,
      oninput: (e) => { fichaAtual.dados.jogo.pvTemp = Number(e.target.value); agendarSalvarJogo(); } }),

    h('h3', {}, 'Condições'),
    h('div', { class: 'condicoes' }, condicoesEl),

    h('h3', {}, 'Rolador de Perícias'),
    painelRolagem(calc.pericias));
}

/* ---------- Seção: Inventário ---------- */

function secaoInventario(d) {
  const usado = calc ? calc.inventarioUsado : 0;
  const maximo = calc ? calc.inventarioMax : 4;

  function adicionarItem() {
    fichaAtual.dados.itens.push({ nome: 'Novo item', espacos: 1, nota: '', ref: '', mun: 0, pecas: [], equip: false });
    agendarSalvarFicha();
    renderizarEditor();
    // Foca no nome do último item.
    setTimeout(() => {
      const campos = document.querySelectorAll('#lista-itens .item-nome');
      if (campos.length) campos[campos.length - 1].focus();
    }, 50);
  }

  function removerItem(idx) {
    fichaAtual.dados.itens.splice(idx, 1);
    limparAtaques();
    agendarSalvarFicha();
    renderizarEditor();
  }

  function mudouItem(idx, campo, valor) {
    fichaAtual.dados.itens[idx][campo] = campo === 'espacos' ? Math.max(0, Number(valor) || 0) : String(valor);
    agendarSalvarFicha();
    if (campo === 'espacos') redesenhar();
  }

  function mudouMoedas(valor) {
    fichaAtual.dados.moedas = Math.min(99, Math.max(0, Number(valor) || 0));
    agendarSalvarFicha();
    redesenhar();
  }

  const listaItens = h('div', { id: 'lista-itens' },
    d.itens.map((item, idx) => item.ref ? linhaItemArsenal(item, idx, () => removerItem(idx)) :
      h('div', { class: 'item-linha' },
        h('input', { class: 'item-nome', type: 'text', placeholder: 'Nome do item', value: item.nome, maxlength: '60',
          oninput: (e) => mudouItem(idx, 'nome', e.target.value) }),
        h('input', { class: 'item-espacos', type: 'number', min: '0', max: '20', value: item.espacos, title: 'Espaços',
          onchange: (e) => mudouItem(idx, 'espacos', e.target.value) }),
        h('input', { class: 'item-nota', type: 'text', placeholder: 'Nota', value: item.nota, maxlength: '200',
          oninput: (e) => mudouItem(idx, 'nota', e.target.value) }),
        h('button', { type: 'button', class: 'botao pequeno perigo', onclick: () => removerItem(idx), 'aria-label': 'Remover item' }, '✕'))));

  // Equipamento inicial (só no rascunho, sem itens ainda).
  const mostraEq = fichaAtual.estado === 'rascunho' && d.itens.length === 0 && REGRAS.classePorId(d.classe);
  const classe = REGRAS.classePorId(d.classe);

  function aplicarEquipamento(opcao) {
    const eq = REGRAS.equipamentoInicial(d.classe, opcao);
    if (!eq) return;
    fichaAtual.dados.itens = eq.itens;
    fichaAtual.dados.moedas = eq.moedas;
    fichaAtual.dados.equipamentoInicial = opcao;
    calc = REGRAS.calcular(fichaAtual.dados);
    agendarSalvarFicha();
    renderizarEditor();
  }

  return h('div', { id: 'secao-inventario', class: 'secao' },
    h('h3', {}, `Inventário (${usado}/${maximo} Espaços usados)`),

    mostraEq && classe
      ? h('div', { class: 'equipamento-inicial' },
          h('p', { class: 'dica' }, 'Escolha o equipamento inicial:'),
          ...['A', 'B', 'C'].map((op) => {
            const eq = classe.equipamento && classe.equipamento[op];
            if (!eq) return null;
            const descricao = eq.itens.map((i) => i.nome).join(', ') + (eq.moedas ? ` + ${eq.moedas} Moedas` : '');
            return h('button', { type: 'button', class: 'botao pequeno', onclick: () => aplicarEquipamento(op) },
              `Opção ${op}: ${descricao}`);
          }).filter(Boolean))
      : null,

    avisoDoArsenal(),
    listaItens,

    seletorArsenal(d),
    h('button', { type: 'button', class: 'botao pequeno', onclick: adicionarItem }, '+ Item livre'),

    h('h3', {}, 'Munição (reserva)'),
    painelMunicao(d),

    h('label', { for: 'fi-moedas' }, 'Moedas Antigas (até 3 por Espaço)'),
    h('input', { id: 'fi-moedas', type: 'number', min: '0', max: '99', value: d.moedas,
      onchange: (e) => mudouMoedas(e.target.value) }),

    h('label', { for: 'fi-anotacoes' }, 'Anotações'),
    h('textarea', { id: 'fi-anotacoes', rows: '4', maxlength: '3000',
      oninput: (e) => { fichaAtual.dados.anotacoes = e.target.value; agendarSalvarFicha(); } }, d.anotacoes));
}

/* ---------- Salvamento ---------- */

// Redesenha o editor mantendo a posição da rolagem (usado quando uma escolha muda valores de outras seções).
function redesenhar() {
  const y = window.scrollY;
  renderizarEditor();
  window.scrollTo(0, y);
}


// Salva dados completos (rascunho) ou só jogo (ativa).
async function salvarFichaAgora() {
  if (!fichaAtual || !estado.mesaId) return;
  const dd = fichaAtual.dados;
  const corpo = fichaAtual.estado === 'ativa'
    ? { jogo: dd.jogo, itens: dd.itens, municoes: dd.municoes, kendo: dd.kendo, moedas: dd.moedas, anotacoes: dd.anotacoes }
    : fichaAtual.dados;
  try {
    await apiFichas('/fichas/' + encodeURIComponent(fichaAtual.id), 'PUT', corpo);
  } catch (e) {
    // Silencioso: o campo já mostra o valor; um erro de rede não deve interromper a digitação.
    console.error('Erro ao salvar ficha:', e.message);
  }
}

function agendarSalvarFicha() {
  calc = REGRAS.calcular(fichaAtual.dados);
  atualizarBarraSuperior();
  clearTimeout(timerSalvarJogo);
  timerSalvarJogo = setTimeout(salvarFichaAgora, 800);
}

function agendarSalvarJogo() {
  clearTimeout(timerSalvarJogo);
  timerSalvarJogo = setTimeout(salvarFichaAgora, 600);
}

/* ---------- Editor de Ficha ---------- */

// Em Ficha Ativa, Identificação e Atributos não mudam (só os valores de jogo e o inventário).
function travar(el) {
  if (fichaAtual.estado === 'ativa') el.setAttribute('inert', '');
  return el;
}

// Enquanto a Ficha está aberta, a Mesa não redesenha por cima dela.
function emFicha() { return fichaAtual !== null || naListaDeFichas; }
let naListaDeFichas = false;


function renderizarEditor() {
  const raiz = $('conteudo-mesa');
  if (!fichaAtual || !raiz) return;

  const d = fichaAtual.dados;
  calc = REGRAS.calcular(d);

  const v = fichaAtual.estado !== 'ativa'
    ? REGRAS.validar(d, { limiteNivel: estado.mesaAtual && estado.mesaAtual.limiteNivel })
    : { erros: [], pendencias: [] };

  const avisosEl = [];
  if (v.erros.length) {
    avisosEl.push(h('div', { class: 'mensagem erro' },
      h('strong', {}, 'Problemas a corrigir: '),
      v.erros.join(' | ')));
  }
  if (v.pendencias.length && fichaAtual.estado !== 'ativa') {
    avisosEl.push(h('div', { class: 'mensagem aviso' },
      h('strong', {}, 'Falta completar: '),
      v.pendencias.join(' | ')));
  }

  const podeEnviar = fichaAtual.estado === 'rascunho' && v.erros.length === 0 && v.pendencias.length === 0;

  const botoesEstado = [];
  if (fichaAtual.estado === 'rascunho') {
    botoesEstado.push(botaoFicha('Enviar para aprovação', podeEnviar ? 'primario' : '', podeEnviar ? enviarParaAprovacao : null));
  }
  if (fichaAtual.estado === 'pendente') {
    botoesEstado.push(botaoFicha('Retirar pedido de aprovação', '', retirarPedido));
  }
  if (fichaAtual.estado === 'ativa') {
    botoesEstado.push(botaoFicha('Desativar ficha', 'perigo', desativarFicha));
  }
  if (fichaAtual.estado !== 'ativa') {
    botoesEstado.push(botaoFicha('Excluir rascunho', 'perigo', excluirFicha));
  }

  const estadoLabel = { rascunho: 'Rascunho', pendente: 'Aguardando aprovação', ativa: 'Ficha Ativa' };
  const bloqueado = fichaAtual.estado === 'pendente';

  raiz.replaceChildren(
    // Barra superior (PV/SA/BI).
    criarBarraSuperior(),

    h('div', { class: 'editor-ficha' + (bloqueado ? ' bloqueado' : '') },
      h('div', { class: 'editor-topo' },
        h('button', { type: 'button', class: 'botao pequeno', onclick: voltarParaListaFichas }, '← Fichas'),
        h('span', { class: 'etiqueta' }, estadoLabel[fichaAtual.estado] || fichaAtual.estado)),

      ...avisosEl,
      ...botoesEstado,

      bloqueado ? h('p', { class: 'mensagem aviso' }, 'Esta ficha está aguardando aprovação do Mestre. Retire o pedido para editá-la.') : null,

      travar(secaoIdentificacao(d)),
      travar(secaoAtributos(d)),
      secaoCombate(d),
      secaoInventario(d)),

    // Barra inferior (atalhos de seção).
    criarBarraInferior());
}

/* ---------- Lista de Fichas ---------- */

async function carregarFichas() {
  try {
    const r = await apiFichas('/fichas');
    fichasDoJogador = r.fichas;
  } catch (e) {
    fichasDoJogador = [];
    mensagem($('aviso-mesa'), e.message, 'erro');
  }
}

async function abrirEditorFicha(id) {
  try {
    const r = await apiFichas('/fichas/' + encodeURIComponent(id));
    fichaAtual = r.ficha;
    secaoAtual = 'identificacao';
    renderizarEditor();
  } catch (e) {
    mensagem($('aviso-mesa'), e.message, 'erro');
  }
}

function voltarParaListaFichas() {
  fichaAtual = null;
  calc = null;
  naListaDeFichas = true;
  renderizarListaFichas();
}

async function criarNovaFicha() {
  try {
    const r = await apiFichas('/fichas', 'POST');
    await carregarFichas();
    await abrirEditorFicha(r.id);
  } catch (e) {
    mensagem($('aviso-mesa'), e.message, 'erro');
  }
}

async function enviarParaAprovacao() {
  try {
    // Salva já o que ainda esperava o salvamento automático; senão a última edição se perderia.
    clearTimeout(timerSalvarJogo);
    await apiFichas('/fichas/' + encodeURIComponent(fichaAtual.id), 'PUT', fichaAtual.dados);
    await apiFichas('/fichas/' + encodeURIComponent(fichaAtual.id) + '/solicitar', 'POST');
    fichaAtual.estado = 'pendente';
    renderizarEditor();
    await carregarFichas();
  } catch (e) {
    mensagem($('aviso-mesa'), e.message, 'erro');
  }
}

async function retirarPedido() {
  try {
    await apiFichas('/fichas/' + encodeURIComponent(fichaAtual.id) + '/retirar', 'POST');
    fichaAtual.estado = 'rascunho';
    renderizarEditor();
    await carregarFichas();
  } catch (e) {
    mensagem($('aviso-mesa'), e.message, 'erro');
  }
}

async function desativarFicha() {
  if (!confirm('Desativar esta ficha? Ela volta para rascunho e os valores de jogo são mantidos.')) return;
  try {
    await apiFichas('/fichas/' + encodeURIComponent(fichaAtual.id) + '/desativar', 'POST');
    fichaAtual.estado = 'rascunho';
    renderizarEditor();
    await carregarFichas();
  } catch (e) {
    mensagem($('aviso-mesa'), e.message, 'erro');
  }
}

async function excluirFicha() {
  if (!confirm('Excluir este rascunho? Esta ação não pode ser desfeita.')) return;
  try {
    await apiFichas('/fichas/' + encodeURIComponent(fichaAtual.id), 'DELETE');
    voltarParaListaFichas();
    await carregarFichas();
  } catch (e) {
    mensagem($('aviso-mesa'), e.message, 'erro');
  }
}

function renderizarListaFichas() {
  const raiz = $('conteudo-mesa');
  if (!raiz) return;

  const mesa = estado.mesaAtual;
  const limNivel = mesa ? mesa.limiteNivel : 1;
  const rascunhos = fichasDoJogador.filter((f) => f.estado === 'rascunho').length;
  const podeNova = rascunhos < 5;

  raiz.replaceChildren(
    h('div', { class: 'lista-fichas' },
      h('div', { class: 'linha' },
        h('h2', {}, 'Fichas de Personagem'),
        h('button', { type: 'button', class: 'botao pequeno' + (podeNova ? ' primario' : ''), onclick: podeNova ? criarNovaFicha : null, disabled: !podeNova }, '+ Nova ficha')),
      h('p', { class: 'dica' }, `Rascunhos: ${rascunhos}/5 · Fichas ativas: ${fichasDoJogador.filter((f) => f.estado === 'ativa').length}/3 · Nível máximo: ${limNivel}`),

      fichasDoJogador.length === 0
        ? h('p', { class: 'dica' }, 'Você ainda não tem fichas. Crie uma nova acima.')
        : h('ul', { class: 'lista' }, fichasDoJogador.map((f) => {
            const estadoLabel = { rascunho: 'Rascunho', pendente: 'Aguardando aprovação', ativa: 'Ativa' };
            return h('li', {},
              h('button', { type: 'button', class: 'botao mesa-item', onclick: () => abrirEditorFicha(f.id) },
                h('span', { class: 'mesa-nome' }, f.personagem || '(sem nome)'),
                h('span', { class: 'mesa-info' }, estadoLabel[f.estado] || f.estado)));
          })),

      h('button', { type: 'button', class: 'botao pequeno', onclick: voltarParaMesa }, '← Voltar para a Mesa')));
}

function voltarParaMesa() {
  fichaAtual = null;
  calc = null;
  naListaDeFichas = false;
  // Recarrega a visão da Mesa (que inclui mesas.js).
  if (typeof carregarMesaAtual === 'function') carregarMesaAtual();
}

/* ---------- Visão do Jogador (injeta na Mesa) ---------- */

// Substituição do cartão "Em breve" em mesas.js.
// Chamada por `visaoDoJogador` em mesas.js quando o estado for 'aprovado'.
function cartaoFichas(mesa) {
  return h('div', { class: 'cartao' },
    h('h2', {}, 'Fichas de Personagem'),
    h('p', { class: 'dica' }, `Até 5 rascunhos e 3 fichas ativas. Nível máximo: ${mesa.limiteNivel}.`),
    h('button', { type: 'button', class: 'botao primario', onclick: abrirListaFichasDaMesa }, 'Ver Fichas'));
}

async function abrirListaFichasDaMesa() {
  naListaDeFichas = true;
  await carregarFichas();
  renderizarListaFichas();
}

/* ---------- Painel do Mestre: solicitações ---------- */

async function carregarSolicitacoesFichas() {
  try {
    const r = await apiFichas('/solicitacoes-fichas');
    return r.solicitacoes;
  } catch {
    return [];
  }
}

async function decidirFicha(fichaId, acao) {
  try {
    await apiFichas('/solicitacoes-fichas/' + encodeURIComponent(fichaId) + '/' + acao, 'POST');
  } catch (e) {
    mensagem($('aviso-mesa'), e.message, 'erro');
  }
  if (typeof carregarMesaAtual === 'function') carregarMesaAtual();
}

// Cartão de fichas para o Painel do Mestre: solicitações pendentes.
async function cartaoFichasMestre() {
  const solic = await carregarSolicitacoesFichas();
  if (solic.length === 0) {
    return h('div', { class: 'cartao' },
      h('h2', {}, 'Fichas de Personagem'),
      h('p', { class: 'dica' }, 'Nenhuma solicitação de aprovação pendente.'));
  }
  return h('div', { class: 'cartao' },
    h('h2', {}, `Fichas aguardando aprovação (${solic.length})`),
    h('ul', { class: 'lista' }, solic.map((s) =>
      h('li', { class: 'linha-jogador' },
        h('div', {},
          h('span', { class: 'nome' }, s.personagem || '(sem nome)'),
          h('span', { class: 'mesa-info' }, ' — ' + s.usuario)),
        h('span', { class: 'acoes' },
          botaoFicha('Aprovar', 'primario', () => decidirFicha(s.id, 'aprovar')),
          botaoFicha('Recusar', '', () => decidirFicha(s.id, 'recusar')))))));
}

/* ---------- Evento SSE de ficha ---------- */

// Chamado por app.js quando chega um evento 'ficha' do servidor.
function aoEventoDeFicha(dados) {
  if (dados.mesaId !== estado.mesaId) return;
  // Ficha aberta: se o Mestre aprovou ou recusou, o editor acompanha o novo estado.
  if (fichaAtual) {
    const id = fichaAtual.id;
    apiFichas('/fichas/' + encodeURIComponent(id)).then((r) => {
      if (!fichaAtual || fichaAtual.id !== id || r.ficha.estado === fichaAtual.estado) return;
      fichaAtual = r.ficha;
      redesenhar();
    }).catch(() => {});
  }
  // Se o jogador está na lista de fichas, atualiza.
  if (!fichaAtual) {
    carregarFichas().then(() => {
      if (!fichaAtual && naListaDeFichas) renderizarListaFichas();
    });
  }
  // Recarrega a Mesa (para atualizar solicitações no Painel do Mestre).
  if (typeof carregarMesaAtual === 'function') carregarMesaAtual();
}

/* ---------- Exportar para mesas.js e app.js ---------- */

// Substituição do cartão "Em breve" em mesas.js:
// visaoDoJogador usa cartaoFichas(m) em vez do placeholder.
// painelDoMestre usa cartaoFichasMestre() em vez do placeholder.
// Ambas funções estão disponíveis como globais aqui.
