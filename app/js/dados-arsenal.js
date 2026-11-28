'use strict';
/*
 * Arsenal e Equipamentos (Arquivo do Jogador v1.0, Capítulo 3): dados do livro, sem lógica de tela.
 * Funciona no navegador (variável global ARSENAL) e no Node (require).
 * Valores copiados das tabelas do livro. Texto longo das armas fica resumido em `props`;
 * a descrição completa continua no livro (a regra específica da arma prevalece).
 */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.ARSENAL = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  const FAMILIAS = [
    { id: 'corpo', nome: 'Armas Corpo a Corpo' },
    { id: 'pistola', nome: 'Pistolas 9 mm' },
    { id: 'escopeta', nome: 'Escopetas' },
    { id: 'smg', nome: 'Submetralhadoras' },
    { id: 'rifle', nome: 'Rifles' },
    { id: 'precisao', nome: 'Rifles de Precisão' },
    { id: 'magnum', nome: 'Magnums' },
    { id: 'especial', nome: 'Armas Especiais' },
  ];
  // Ordem dos Graus: Comum, Tática, Militar, Exótica. Magnums e Armas Especiais não têm Grau.
  const GRAUS = [
    { id: 'comum', nome: 'Comum' },
    { id: 'tatica', nome: 'Tática' },
    { id: 'militar', nome: 'Militar' },
    { id: 'exotica', nome: 'Exótica' },
  ];
  // Alcances do livro (distâncias em metros).
  const ALCANCES = { curto: '1,5 a 3 m', medio: '4,5 a 9 m', longo: '10,5 a 18 m', muitoLongo: '19,5 a 27 m' };

  const MUNICAO_DA_FAMILIA = { pistola: '9mm', escopeta: 'calibre12', smg: 'submetralhadora', rifle: 'rifle', precisao: 'rifle', magnum: 'magnum' };

  // preco: Moedas Antigas; null = só por exploração/recompensa.
  // W(id, nome, familia, grau, dano, margemCritica, multiplicador, pente, alcance, maos, espacos, pecas, durabilidade, preco, extras)
  const W = (id, nome, familia, grau, dano, crit, mult, pente, alcance, maos, espacos, pecas, durabilidade, preco, extra = {}) => ({
    tipo: 'arma', id, nome, familia, grau, dano, crit, mult, pente, alcance, maos, espacos, pecas, durabilidade, preco,
    municao: MUNICAO_DA_FAMILIA[familia] || null, ...extra,
  });
  const CM = 'Curto', CMD = 'Curto/Médio';
  const PADRAO = 'Nenhuma propriedade especial além das regras normais da categoria.';

  const ARMAS = [
    // ----- Corpo a Corpo -----
    W('bastao-de-beisebol', 'Bastão de Beisebol', 'corpo', 'comum', '1d8', 20, 2, null, CM, '1/2', 1, 0, 2, 1, { props: PADRAO }),
    W('cutelo', 'Cutelo', 'corpo', 'comum', '1d8', 20, 3, null, CM, '1', 1, 0, 2, 1, { props: 'Arremessável.' }),
    W('faca', 'Faca', 'corpo', 'comum', '1d4', 20, 2, null, CM, '1', 1, 0, 2, 1, { props: 'Arremessável.' }),
    W('machadinha', 'Machadinha', 'corpo', 'comum', '1d6', 20, 3, null, CM, '1', 1, 1, 2, 1, { props: 'Arremessável. Não confundir com Hatchet.' }),
    W('martelo', 'Martelo', 'corpo', 'comum', '1d6', 20, 2, null, CM, '1', 1, 0, 2, 1, { props: PADRAO }),
    W('punhal', 'Punhal', 'corpo', 'comum', '1d4', 20, 3, null, CM, '1', 1, 0, 1, 1, { props: 'Arremessável.' }),
    W('replica-de-espada', 'Réplica de Espada', 'corpo', 'comum', '1d8', 20, 2, null, CM, '1/2', 2, 1, 4, 1, { props: PADRAO }),
    W('replica-de-katana', 'Réplica de Katana', 'corpo', 'comum', '1d10', 20, 2, null, CM, '1/2', 2, 1, 3, 1, { props: PADRAO }),
    W('cassetete', 'Cassetete', 'corpo', 'tatica', '1d6', 20, 2, null, CM, '1', 1, 0, 3, 1, { props: PADRAO }),
    W('faca-de-combate', 'Faca de Combate', 'corpo', 'tatica', '1d6', 20, 2, null, CM, '1', 1, 2, 5, 1, { props: PADRAO }),
    W('hatchet', 'Hatchet', 'corpo', 'tatica', '2d4', 20, 3, null, CM, '1', 1, 3, 'Indestrutível', null,
      { caracteristico: 'agente', props: 'Indestrutível. Arremessável. Pode Aparar e Contra-Atacar. Em Contra-Ataque, se o alvo estiver Vulnerável ou o golpe causar Dano Massivo, o Decepamento é acionado. Item Característico do Agente (Exploração).' }),
    W('machado', 'Machado', 'corpo', 'tatica', '1d8', 20, 3, null, CM, '2', 2, 1, 3, 1, { props: PADRAO }),
    W('machete', 'Machete', 'corpo', 'tatica', '1d6', 20, 2, null, CM, '1', 1, 1, 4, 1, { props: 'Arremessável.' }),
    W('marreta', 'Marreta', 'corpo', 'tatica', '3d4', 20, 2, null, CM, '2', 2, 1, 3, 1, { props: PADRAO }),
    W('motosserra', 'Motosserra', 'corpo', 'tatica', '3d6', 20, 2, null, CM, '2', 2, 0, 4, null,
      { desvantagem: true, explode: true, props: 'Cada 6 no dano gera outro dado, podendo encadear. Ataques com Desvantagem. Ligar exige Movimento. (Exploração)' }),

    // ----- Pistolas 9 mm -----
    W('jmb-hp3', 'JMB Hp3', 'pistola', 'comum', '1d8', 20, 2, 13, CMD, '1', 1, 2, 3, 1, { props: 'Recarga: Ação Bônus.' }),
    W('lemi', 'LEMI', 'pistola', 'comum', '1d8', 20, 2, 10, CMD, '1', 1, 3, 3, 1, { props: 'Recarga: Ação Bônus.' }),
    W('nine-oh-nine', 'Nine-Oh-Nine', 'pistola', 'comum', '1d8', 20, 2, 15, CMD, '1', 1, 1, 3, 1, { props: 'Recarga: Ação Bônus.' }),
    W('sentinel-nine', 'Sentinel Nine', 'pistola', 'comum', '1d8', 20, 2, 19, CMD, '1', 1, 1, 3, 1, { props: 'Recarga: Ação Bônus.' }),
    W('albert-01r', 'Albert-01R', 'pistola', 'tatica', '1d10', 19, 3, 3, CMD, '1', 1, 0, 3, 2, { props: 'Recarga: Ação Bônus.' }),
    W('blacktail', 'Blacktail', 'pistola', 'tatica', '1d8', 19, 2, 9, CMD, '1', 1, 0, 3, 2, { props: 'Recarga: Ação Bônus.' }),
    W('samurai-edge', 'Samurai Edge', 'pistola', 'tatica', '2d4', 20, 2, 15, CMD, '1', 1, 2, 3, 2, { props: 'Vantagem ao Mirar. Recarga: Ação Bônus.' }),
    W('silencer-9', 'Silencer 9', 'pistola', 'tatica', '1d6', 20, 3, 10, CMD, '1', 1, 0, 3, 2, { props: 'Silenciador fixo; favorece furtividade. Recarga: Ação Bônus.' }),
    W('matilda', 'Matilda', 'pistola', 'militar', '1d8', 20, 2, 18, CMD, '1', 1, 2, 3, 3, { props: 'A Coronha específica habilita Disparo Cadenciado (3 cartuchos em vez de 5). Recarga: Ação Bônus.' }),
    W('punisher', 'Punisher', 'pistola', 'militar', '1d8', 20, 3, 12, CMD, '1', 1, 1, 3, 3, { props: 'Perfuração: após acertar, pode testar Ataque contra 1 alvo adicional Médio ou menor na mesma Linha, sem perder Dados de Dano. Recarga: Ação Bônus.' }),

    // ----- Escopetas -----
    W('w-870', 'W-870', 'escopeta', 'comum', '3d6', 20, 3, 3, 'Médio', '2', 2, 2, 4, 2, { props: 'Ação por bombeamento. Bombear: Ação Bônus. Coice: Ação Bônus. Recarga: Movimento.' }),
    W('hydra', 'Hydra', 'escopeta', 'tatica', '4d6', 20, 4, 3, 'Curto', '1', 1, 0, 3, 3, { props: 'Sem coronha; não permite Coronhada. Coice: Ação Bônus. Recarga: Movimento.' }),
    W('riot-gun', 'Riot Gun', 'escopeta', 'tatica', '3d6', 20, 3, 7, 'Médio', '2', 2, 1, 4, 3, { props: 'Semiautomática; não Bombear. Permite Coronhada. Coice: Ação Bônus. Recarga: Movimento.' }),
    W('striker', 'Striker', 'escopeta', 'militar', '3d6', 20, 3, 12, 'Médio', '2', 2, 0, 4, 4, { props: 'Semiautomática; não Bombear. Sem Coronhada. Coice: Ação Bônus. Recarga: Movimento.' }),

    // ----- Submetralhadoras -----
    W('tmp', 'TMP', 'smg', 'tatica', '2d4', 20, 2, 30, CMD, '1/2', 1, 3, 3, 2, { cadenciado: true, props: 'Disparo Cadenciado. Com 2 mãos, Vantagem ao Mirar. Coronha Leve não permite Coronhada nem Aparar. Recarga: Ação Bônus.' }),
    W('gal', 'Gal', 'smg', 'militar', '2d4', 20, 2, 40, CMD, '1/2', 1, 1, 3, 3, { cadenciado: true, rajada: true, semUnico: true, props: 'Disparo Cadenciado e Rajada; sem Disparo Único. Com 2 mãos, Vantagem ao Mirar. Recarga: Ação Bônus.' }),
    W('hk-mp5', 'H&K MP5', 'smg', 'militar', '2d4', 20, 2, 35, CMD, '2', 2, 2, 4, 3, { cadenciado: true, rajada: true, props: 'Disparo Cadenciado e Rajada. Recarga: Ação Bônus.' }),
    W('chicago-sweeper', 'Chicago Sweeper', 'smg', 'exotica', '4d4', 20, 2, 50, CMD, '2', 2, 0, 3, 4, { rajada: true, semUnico: true, soRajada: true, props: 'Rajada Exclusiva: só pode atacar por Rajada. Recarga: Ação Bônus.' }),

    // ----- Rifles -----
    W('clatter-carbine', 'Clatter Carbine', 'rifle', 'militar', '2d10', 20, 2, 40, 'Médio/Longo', '2', 2, 1, 4, 5, { cadenciado: true, rajada: true, semUnico: true, props: 'Disparo Cadenciado e Rajada. Não possui Disparo Único. Recarga: Ação Bônus.' }),
    W('dragoon', 'Dragoon', 'rifle', 'militar', '2d10', 20, 2, 30, 'Médio/Longo', '2', 2, 2, 4, 5, { cadenciado: true, rajada: true, props: 'Disparo Cadenciado e Rajada. Recarga: Ação Bônus.' }),
    W('bear-commander', 'Bear Commander', 'rifle', 'exotica', '1d10', 20, 2, 30, 'Médio/Longo', '2', 2, 0, 4, 6, { rajada: true, props: 'Rajada. Lança-granadas integrado: 1 Cartucho GM 79 (Ácido, Explosivo ou Incendiário), alcance Médio, reserva separada, Recarga do lançador: Ação Bônus.' }),

    // ----- Rifles de Precisão -----
    W('stingray', 'Stingray', 'precisao', 'tatica', '2d12', 20, 3, 7, 'Longo/Muito Longo*', '2', 2, 2, 4, 4, { props: 'Muito Longo exige Mira Telescópica para uso ideal. Coice: Ação Bônus. Recarga: Ação Bônus.' }),
    W('svd', 'SVD', 'precisao', 'militar', '2d12', 20, 3, 5, 'Longo/Muito Longo*', '2', 2, 1, 4, 5, { props: 'Perfuração. Muito Longo exige Mira Telescópica para uso ideal. Manejar Ferrolho: Ação Bônus. Recarga: Ação Bônus.' }),

    // ----- Magnums (sem Grau; todas têm Decepamento e Carnificina) -----
    W('elephant-killer', 'Elephant Killer', 'magnum', null, '4d6', 20, 4, 5, CMD, '2*', 1, 0, 5, 4, { props: 'Coice: Movimento. Recarga Lenta: Ação. Exige 2 mãos. Decepamento. Carnificina.' }),
    W('killer7', 'Killer7', 'magnum', null, '4d6', 20, 3, 6, CMD, '2*', 1, 1, 5, 4, { props: 'Semiautomática. Coice: Movimento. Exige 2 mãos. Recarga: Ação Bônus. Decepamento. Carnificina.' }),
    W('m1851-wolfsbane', 'M1851 Wolfsbane', 'magnum', null, '4d6', 20, 3, 5, CMD, '2*', 2, 2, 5, 4, { props: 'Perfuração. Coice: Movimento. Exige 2 mãos. Peças específicas: Cilindro de Alta Capacidade e Cano Longo. Recarga: Ação Bônus. Decepamento. Carnificina.' }),
    W('requiem', 'Requiem', 'magnum', null, '4d6', 20, 3, 5, CMD, '2*', 1, 3, 5, 4, { modular: true, props: 'Modular: 0–1 Peça instalada = 1 Espaço; 2–3 = 2 Espaços. Coice: Movimento. Exige 2 mãos, salvo redução. Recarga: Ação Bônus. Decepamento. Carnificina.' }),
    W('sw-m29', 'S&W M29', 'magnum', null, '4d6', 20, 3, 6, CMD, '2*', 2, 0, 5, 4, { props: 'Coice: Movimento. Recarga Lenta: Ação. Poder de Parada: em acerto Crítico, Fortitude DT 15 ou Atordoado até o fim do próximo turno. Decepamento. Carnificina.' }),

    // ----- Armas Especiais (sem Grau; adquiridas por exploração) -----
    W('besta', 'Besta', 'especial', null, '1d8', 19, 2, 1, CMD, '2', 1, 1, 1, null, { municao: 'virotes', props: 'Muito silenciosa. Virotes recuperáveis com Investigação DT 10. Recarga: Movimento. Engate Triplo: dispara até 3 virotes, cada um com um Teste de Ataque.' }),
    W('gm-79', 'GM 79', 'especial', null, '4d6', 20, 4, 1, 'Médio', '2', 2, 1, 3, null, { municao: 'gm79', props: 'Tiro único. Cartuchos Incendiário, Ácido e Explosivo (cada um com sua regra). Disparo em Área não tem Teste de Ataque nem Acerto Crítico. Recarga: Movimento.' }),
    W('lanca-chamas-quimico', 'Lança-Chamas Químico', 'especial', null, '3d6', 20, 2, 100, 'Cone 4,5 m', '2', 2, 1, 1, null, { municao: 'combustivel', consumo: 10, props: 'Consome 10 de Combustível por Ataque. Chama Contínua: começa em 3d6; se no turno seguinte não usar Movimento e continuar atacando, +1d6 cumulativo até 6d6. Falha ou mover encerra a acumulação. Reabastecer: Movimento.' }),
    W('redemption', 'Redemption', 'especial', null, '1d12', 20, 4, 1, CMD, '1', 1, 0, 1, null, { municao: 'rifle', props: 'Tiro único. Usa munição de Rifle. Forte Coice narrativo; utilizável com 1 mão. Recarga: Ação Bônus.' }),
    W('rpg-7', 'RPG-7', 'especial', null, null, 20, 1, 1, 'Curto/Médio/Longo', '2', 2, 0, 1, null, { municao: 'foguete', mortal: true, props: 'Morte Instantânea (Perseguidores, Chefes e criaturas com regra própria podem avançar de fase). Após o disparo, a arma fica vazia. Recarga: Movimento.' }),
    W('spark-shot', 'Spark Shot', 'especial', null, '1d4', 20, 2, 7, CMD, '2', 2, 1, 1, null, { municao: 'cargas', carregado: { consumo: 3, dano: '4d4' }, props: 'Bateria padrão 7 Cargas. Normal: 1 Carga, 1d4. Carregado: Ação Completa, 3 Cargas, 4d4. Alvo e criaturas a até 1,5 m: Fortitude DT 15; falha = Atordoado + Imobilizado por 1d4 rodadas. Recarga: Movimento.' }),
  ];

  // Ataques que não são itens: ficam sempre disponíveis.
  const ATAQUES_BASICOS = [
    { id: 'desarmado', nome: 'Ataque Desarmado', dano: '1d4', crit: 20, mult: 3, tipo: 'corpo', desvantagem: true, props: 'Ataque com qualquer parte do corpo: 1d4 + FOR. Por padrão, com Desvantagem. Pode ser usado com as mãos ocupadas.' },
    { id: 'improvisada', nome: 'Arma Improvisada', dano: '1d6', crit: 20, mult: 2, tipo: 'corpo', arremesso: true, props: 'Corpo a Corpo: 1d6 + FOR. Arremesso: 1d6 + AGI. Uso único; não pode Aparar; depois do Ataque quebra ou se perde.' },
  ];

  // ---------- Proteções ----------
  // def = bônus de Defesa; rd = Redução de Dano; capAgi = limite da contribuição de AGI na Defesa (null = sem limite).
  const PROTECOES = [
    { tipo: 'protecao', id: 'colete-acolchoado', nome: 'Colete Acolchoado', def: 1, rd: 0, capAgi: null, preco: 1, props: 'Contribuição total de AGI.' },
    { tipo: 'protecao', id: 'colete-leve', nome: 'Colete Balístico Leve', def: 1, rd: 1, capAgi: null, preco: 2, props: 'Contribuição total de AGI.' },
    { tipo: 'protecao', id: 'colete-medio', nome: 'Colete Balístico Médio', def: 2, rd: 2, capAgi: 2, preco: 3, props: 'A contribuição de AGI na Defesa é limitada a +2.' },
    { tipo: 'protecao', id: 'colete-pesado', nome: 'Colete Balístico Pesado', def: 3, rd: 3, capAgi: 0, preco: 4, props: 'AGI não é somada à Defesa enquanto equipado.' },
    { tipo: 'protecao', id: 'colete-kendo', nome: 'Colete de Placas Kendo', def: 1, rd: 0, capAgi: null, preco: 1, kendo: true, caracteristico: 'operador', props: 'Item Característico do Operador. De 0 a 3 placas (1 Moeda por placa): cada placa muda Defesa, RD e a contribuição de AGI.' },
  ];
  // Colete de Placas Kendo (Item Característico do Operador): 0 a 3 placas, cada placa adicional custa 1 Moeda Antiga.
  const KENDO = [
    { def: 1, rd: 0, capAgi: null },
    { def: 1, rd: 1, capAgi: null },
    { def: 2, rd: 2, capAgi: 2 },
    { def: 3, rd: 3, capAgi: 0 },
  ];

  // ---------- Peças Extras ----------
  // compat: familias / armas / exceto / maosUma / bandoleira / soRajada. mods: crit (reduz margem), danoExtra, danoDados,
  // capacidade (número, ou por família), durabilidade, espacosArma.
  const MAIS_UMA = { maosUma: true };
  const P = (id, nome, tipo, compat, efeito, preco, mods = {}) => ({ id, nome, tipo, compat, efeito, preco, mods });
  const PECAS = [
    // Genéricas, Corpo a Corpo
    P('alca', 'Alça', 'generica', MAIS_UMA, 'Soltar voluntariamente mantém a arma presa; recuperar usa Interação Gratuita com Objeto.', 1),
    P('aprimoramento-ofensivo', 'Aprimoramento Ofensivo', 'generica', { familias: ['corpo'] }, '+1d4 de dano.', 1, { danoExtra: '1d4' }),
    P('cabo-tatico', 'Cabo Tático', 'generica', { familias: ['corpo'] }, 'Contra-Ataques com a arma têm Vantagem.', 1),
    P('contrapeso', 'Contrapeso', 'generica', { familias: ['corpo'] }, 'Reduz em 1 o resultado natural necessário para Crítico.', 1, { crit: 1 }),
    P('reforco', 'Reforço', 'generica', { familias: ['corpo'] }, '+2 Durabilidade Máxima; sem efeito em Indestrutível.', 1, { durabilidade: 2 }),
    // Genéricas, Armas de Fogo
    P('bandoleira', 'Bandoleira', 'generica', { bandoleira: true }, 'Soltar voluntariamente mantém a arma presa; recuperar usa Interação Gratuita com Objeto. Armas de 2 mãos de 2 Espaços.', 2),
    P('compensador-smg', 'Compensador para Submetralhadora', 'generica', { familias: ['smg'], soRajada: true }, 'Rajada passa de Ação Completa para Ação.', 1),
    P('coronha-escopeta', 'Coronha para Escopetas', 'generica', { familias: ['escopeta'] }, 'Estabilidade: ignora Desvantagem por usar a escopeta uma categoria além do alcance. Se não tinha coronha, permite Coronhada.', 2),
    P('coronha-rifle', 'Coronha para Rifles', 'generica', { familias: ['rifle', 'precisao'] }, 'Vantagem ao Mirar. Se não tinha coronha, permite Coronhada.', 2),
    P('coronha-smg', 'Coronha para Submetralhadora', 'generica', { familias: ['smg'] }, 'Vantagem ao Mirar; frágil, não permite Coronhada nem Aparar pela coronha.', 1),
    P('freio-9mm', 'Freio de Boca 9 mm', 'generica', { familias: ['pistola'] }, 'Reduz em 1 o resultado natural necessário para Crítico.', 1, { crit: 1 }),
    P('freio-magnum', 'Freio de Boca Magnum', 'generica', { familias: ['magnum'], exceto: ['requiem'] }, 'Reduz o Coice em 1 categoria de Ação, nunca abaixo de Interação Gratuita com Objeto.', null),
    P('mira-biossensora', 'Mira Biossensora', 'generica', { familias: ['precisao'] }, 'Detecta assinaturas térmicas/anomalias; identifica parasitas/organismos internos quando aplicável.', 2),
    P('mira-laser', 'Mira Laser', 'generica', { familias: ['pistola', 'smg'] }, '1/turno, Mirar com a arma não consome SA.', 1),
    P('mira-telescopica', 'Mira Telescópica', 'generica', { familias: ['precisao'] }, 'Permite usar o alcance Muito Longo sem a penalidade de alcance da arma.', 2),
    P('pente-estendido-9mm', 'Pente Estendido 9 mm', 'generica', { familias: ['pistola'] }, '+5 Capacidade Máxima.', 1, { capacidade: 5 }),
    P('pente-estendido-magnum', 'Pente Estendido Magnum', 'generica', { familias: ['magnum'], exceto: ['requiem', 'm1851-wolfsbane', 'elephant-killer'] }, '+3 Capacidade Máxima.', null, { capacidade: 3 }),
    P('pente-estendido-rifle', 'Pente Estendido Rifle', 'generica', { familias: ['rifle', 'precisao'] }, '+5 de Capacidade Máxima para Rifle; +3 para Rifle de Precisão.', 2, { capacidade: { rifle: 5, precisao: 3 } }),
    P('pente-estendido-smg', 'Pente Estendido Submetralhadora', 'generica', { familias: ['smg'] }, '+10 Capacidade Máxima.', 1, { capacidade: 10 }),
    P('silenciador-9mm', 'Silenciador 9 mm', 'generica', { familias: ['pistola'] }, 'O disparo não revela automaticamente a posição pelo som; Vantagem em testes aplicáveis para permanecer oculto.', 1),
    P('silenciador-smg', 'Silenciador Submetralhadora', 'generica', { familias: ['smg'] }, 'Mesmo efeito do Silenciador 9 mm.', 1),
    // Específicas
    P('bateria-alta-capacidade', 'Bateria de Alta Capacidade', 'especifica', { armas: ['spark-shot'] }, 'Bateria 7 → 10 Cargas.', null, { capacidade: 3 }),
    P('cano-longo', 'Cano Longo', 'especifica', { armas: ['m1851-wolfsbane'] }, '+2 Dados de Dano do mesmo tipo (4d6 → 6d6); a arma ocupa 2 Espaços e o Coice aumenta em 1 categoria de Ação.', null, { danoDados: 2, espacosArma: 2 }),
    P('cano-ventilado', 'Cano Ventilado', 'especifica', { armas: ['requiem'] }, 'Reduz o Coice da Requiem em 1 categoria; permite disparar com 1 mão. A arma ocupa 2 Espaços.', null, { espacosArma: 2 }),
    P('cilindro-alta-capacidade', 'Cilindro de Alta Capacidade', 'especifica', { armas: ['m1851-wolfsbane'] }, 'Capacidade Máxima 5 → 8.', null, { capacidade: 3 }),
    P('coronha-gm79', 'Coronha GM 79', 'especifica', { armas: ['gm-79'] }, 'Adiciona alcance Curto: passa a Curto/Médio.', null),
    P('coronha-matilda', 'Coronha Matilda', 'especifica', { armas: ['matilda'] }, 'Habilita Disparo Cadenciado (3 cartuchos em vez de 5). Utilizável com 1 mão; não permite Coronhada nem Aparar; passa a 2 Espaços.', null, { espacosArma: 2, habilitaCadenciado: true, consumoCadenciado: 3 }),
    P('empunhadura-pesada', 'Empunhadura Pesada', 'especifica', { armas: ['requiem'] }, 'Reduz em 1 o resultado natural necessário para Crítico.', null, { crit: 1 }),
    P('engate-triplo', 'Engate Triplo', 'especifica', { armas: ['besta'] }, 'Consome 3 virotes e permite dispará-los simultaneamente; um Teste de Ataque para cada virote.', null),
    P('protetor-de-cano', 'Protetor de Cano', 'especifica', { armas: ['requiem'] }, '+2 dados do mesmo tipo: 4d6 → 6d6.', null, { danoDados: 2 }),
    P('valvula-acao-rapida', 'Válvula de Ação Rápida', 'especifica', { armas: ['lanca-chamas-quimico'] }, 'Cone 4,5 m → 6 m.', null),
  ];

  // ---------- Munições ----------
  // porEspaco = quantas cabem em 1 Espaço; lote/preco = compra em Moedas Antigas (null = exploração).
  const MUNICOES = [
    { id: '9mm', nome: '9 mm', porEspaco: 30, lote: 15, preco: 1 },
    { id: 'calibre12', nome: 'Calibre 12', porEspaco: 15, lote: 8, preco: 2 },
    { id: 'submetralhadora', nome: 'Submetralhadora', porEspaco: 70, lote: 35, preco: 1 },
    { id: 'rifle', nome: 'Rifle', porEspaco: 50, lote: 25, preco: 3 },
    { id: 'magnum', nome: 'Magnum', porEspaco: 10, lote: 5, preco: 4 },
    { id: 'cargas', nome: 'Cargas (Spark Shot)', porEspaco: 10, lote: null, preco: null },
    { id: 'gm79', nome: 'Cartuchos GM 79', porEspaco: 10, lote: null, preco: null },
    // Variantes: o livro as trata como munição própria. Os Cartuchos GM 79 especiais dividem a mesma pilha (10 por Espaço).
    { id: 'gm79-acido', nome: 'Cartucho GM 79 — Ácido', porEspaco: 10, lote: null, preco: null, grupo: 'gm79' },
    { id: 'gm79-explosivo', nome: 'Cartucho GM 79 — Explosivo', porEspaco: 10, lote: null, preco: null, grupo: 'gm79' },
    { id: 'gm79-incendiario', nome: 'Cartucho GM 79 — Incendiário', porEspaco: 10, lote: null, preco: null, grupo: 'gm79' },
    { id: '9mm-alto-impacto', nome: '9 mm Alto Impacto (+1d6 de Dano em acerto)', porEspaco: 30, lote: null, preco: null, grupo: '9mm' },
    { id: 'calibre12-incendiaria', nome: 'Calibre 12 Incendiária (Queimadura 1 turno)', porEspaco: 15, lote: null, preco: null, grupo: 'calibre12' },
    { id: 'virotes', nome: 'Virotes', porEspaco: 10, lote: null, preco: null },
    { id: 'combustivel', nome: 'Combustível', porEspaco: 100, lote: null, preco: null },
    { id: 'foguete', nome: 'Foguete', porEspaco: 1, lote: null, preco: null },
  ];

  // ---------- Consumíveis, ferramentas e expansões ----------
  // Efeitos de "Usar": cura (dados de PV), curaTotal, pvTemp (dados), bi (dados, reduz BI), semIntoxicacao.
  const C = (id, nome, preco, efeito, extra = {}) => ({ tipo: 'consumivel', id, nome, espacos: 1, preco, efeito, ...extra });
  const CONSUMIVEIS = [
    C('lanterna-simples', 'Lanterna Simples', 1, 'Cone 12 m; Durabilidade 0. Sacar, ligar ou desligar usa Interação Gratuita com Objeto. Não pode ser usada junto de arma de 2 mãos.', { uso: false }),
    C('lanterna-grande', 'Lanterna Grande', 1, 'Cone 18 m; Durabilidade 0. Não pode ser usada com arma de 2 mãos e não permite Mirar em uso.', { uso: false }),
    C('lanterna-policial', 'Lanterna Policial', 2, 'Cone 12 m; Durabilidade 1. Pode ser usada como Cassetete e não pode ser usada com arma de 2 mãos.', { uso: false }),
    C('lanterna-de-bolso', 'Lanterna de Bolso', 3, 'Cone 9 m; 0 Espaços. Sempre equipada.', { espacos: 0, uso: false }),
    C('lanterna-de-cabeca', 'Lanterna de Cabeça', 4, 'Cone 9 m; 0 Espaços. Equipar e ligar são interações separadas. Concede Vantagem ao Mirar.', { espacos: 0, uso: false }),
    C('erva-verde', 'Erva Verde', null, 'Ação Bônus. Recupera 1d8 PV. Pode ser combinada em Misturas.', { cura: '1d8' }),
    C('erva-vermelha', 'Erva Vermelha', null, 'Sem efeito isolado. Em Misturas com Erva Verde, potencializa a recuperação.', { uso: false }),
    C('erva-amarela', 'Erva Amarela', null, 'Sem efeito isolado. Com Erva Verde, reduz BI em 1d6.', { uso: false }),
    C('erva-azul', 'Erva Azul', null, 'Sem efeito isolado. Com Erva Verde, remove Intoxicação.', { uso: false }),
    C('mistura-verde-amarela', 'Mistura Verde + Amarela', null, 'Ação Bônus. Recupera 1d8 PV e reduz BI em 1d6.', { cura: '1d8', bi: '1d6' }),
    C('mistura-verde-azul', 'Mistura Verde + Azul', null, 'Ação Bônus. Recupera 1d8 PV e remove Intoxicação.', { cura: '1d8', semIntoxicacao: true }),
    C('mistura-verde-verde', 'Mistura Verde + Verde', null, 'Ação Bônus. Recupera 2d8 PV.', { cura: '2d8' }),
    C('mistura-verde-verde-verde', 'Mistura Verde + Verde + Verde', null, 'Ação Bônus. Recupera 3d8 PV.', { cura: '3d8' }),
    C('mistura-verde-vermelha', 'Mistura Verde + Vermelha', null, 'Ação Bônus. Recupera 3d8 PV.', { cura: '3d8' }),
    C('mistura-verde-vermelha-amarela', 'Mistura Verde + Vermelha + Amarela', null, 'Ação Bônus. Recupera 3d8 PV e reduz BI em 1d6.', { cura: '3d8', bi: '1d6' }),
    C('mistura-verde-vermelha-azul', 'Mistura Verde + Vermelha + Azul', null, 'Ação Bônus. Recupera 3d8 PV e remove Intoxicação.', { cura: '3d8', semIntoxicacao: true }),
    C('spray-primeiros-socorros', 'Spray de Primeiros Socorros', 2, 'Ação Bônus. Recupera 3d8 Pontos de Vida.', { cura: '3d8' }),
    C('estabilizador', 'Estabilizador', 3, 'Ação Bônus (preparado em Injetor, consumido no uso). Recupera 1d8 PV e concede Vantagem no primeiro Ataque de cada turno por 3 turnos.', { cura: '1d8' }),
    C('esteroide', 'Esteroide', 3, 'Ação Bônus (preparado em Injetor, consumido no uso). Recupera todos os PV perdidos e concede 2d8 PV Temporários até serem consumidos ou até o fim de um Descanso.', { curaTotal: true, pvTemp: '2d8' }),
    C('agente-reestruturante', 'Agente Reestruturante', null, 'Recupera 2d8 PV. Alternativamente, reimplanta automaticamente um membro Decepado disponível, sem Teste (a BI recebida depende do tempo; ver Reimplante).', { cura: '2d8' }),
    C('bomba-de-fumaca', 'Bomba de Fumaça', null, 'Ação: arremesse em um ponto até Alcance Médio. Esfera de 4,5 m de fumaça por 1d4 + 1 rodadas; Ataques que dependam de visão têm Desvantagem.', { uso: false }),
    C('granada', 'Granada', null, 'Ação: arremesse em um ponto até Alcance Médio. Esfera de 3 m, Reflexos DT 12: sucesso sofre metade de 4d6, falha sofre 4d6. Sem Acerto Crítico.', { uso: false }),
    C('mina', 'Mina', null, 'Ação Completa para instalar em espaço adjacente. Raio de 1,5 m, Reflexos DT 12: sucesso sofre metade de 4d6, falha sofre 4d6. Não distingue aliados de inimigos.', { uso: false }),
    C('neurotoxina', 'Neurotoxina', null, 'Ação: aplique a uma arma Corpo a Corpo, virote ou alvo adjacente. No primeiro contato efetivo, Fortitude DT 12; em falha, o alvo não soma AGI à Defesa por 1d4 rodadas.', { uso: false }),
    C('composto-necrotico', 'Composto Necrótico', null, 'Carregado em Injetor; Ação, contato Corpo a Corpo. 1d6 de Dano por ponto de Medicina de quem o criou (máx. 10d6); Fortitude DT 15 reduz à metade.', { uso: false }),
    C('composto-balistico', 'Composto Balístico', null, 'Sem efeito isolado. Ingrediente de Receitas de munição e dispositivos.', { uso: false }),
    C('fluido-esteril', 'Fluido Estéril', null, 'Sem efeito isolado. Ingrediente de Agente Reestruturante, Composto Necrótico e outros.', { uso: false }),
    C('sangue-contaminado', 'Sangue Contaminado', null, 'Sem efeito isolado. Ingrediente do Composto Necrótico; obtido com um Coletor.', { uso: false }),
    C('injetor', 'Injetor', null, 'Carrega uma única dose compatível; descartado após a aplicação.', { uso: false }),
    C('coletor', 'Coletor', null, 'Coleta Sangue Contaminado e outros fluidos. Reutilizável.', { uso: false }),
    C('gazua', 'Gazua', null, 'Teste de AGI para abrir fechadura ou cadeado compatível. Frágil: descartada após a tentativa.', { uso: false }),
  ];
  // Expansões de Inventário não acumulam entre si: vale só o maior benefício.
  const EXPANSOES = [
    { tipo: 'expansao', id: 'bolsa', nome: 'Bolsa', espacos: 1, preco: 4, bonus: 3, efeito: '+3 Espaços de Inventário.' },
    { tipo: 'expansao', id: 'pochete', nome: 'Pochete', espacos: 1, preco: 3, bonus: 2, efeito: '+2 Espaços de Inventário.' },
  ];

  /* ---------- Consultas ---------- */

  const semAcento = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const TODOS = [...ARMAS, ...PROTECOES, ...CONSUMIVEIS, ...EXPANSOES];
  const porId = new Map(TODOS.map((i) => [i.id, i]));
  const porNomeMapa = new Map(TODOS.map((i) => [semAcento(i.nome), i]));

  const itemPorId = (id) => porId.get(id) || null;
  const armaPorId = (id) => { const i = porId.get(id); return i && i.tipo === 'arma' ? i : null; };
  const pecaPorId = (id) => PECAS.find((p) => p.id === id) || null;
  const municaoPorId = (id) => MUNICOES.find((m) => m.id === id) || null;
  const itemPorNome = (nome) => porNomeMapa.get(semAcento(nome)) || null;

  // Peça compatível com a arma? (não verifica se há espaço de Peça livre)
  function pecaServe(peca, arma) {
    const c = peca.compat || {};
    if (c.exceto && c.exceto.includes(arma.id)) return false;
    if (c.armas) return c.armas.includes(arma.id);
    if (c.maosUma) return arma.maos === '1' || arma.maos === '1/2';
    if (c.bandoleira) return arma.maos === '2' && arma.espacos === 2 && arma.pecas > 0;
    if (c.soRajada && !arma.rajada) return false;
    if (c.familias) return c.familias.includes(arma.familia);
    return false;
  }
  const pecasDaArma = (arma) => PECAS.filter((p) => pecaServe(p, arma));

  // Lista para o seletor do Inventário (não inclui itens exclusivos de Classe).
  const CATEGORIAS = [
    ...FAMILIAS.map((f) => ({ id: f.id, nome: f.nome, itens: ARMAS.filter((a) => a.familia === f.id && !a.caracteristico) })),
    { id: 'protecao', nome: 'Proteções', itens: PROTECOES.filter((p) => !p.caracteristico) },
    { id: 'consumivel', nome: 'Consumíveis e ferramentas', itens: CONSUMIVEIS },
    { id: 'expansao', nome: 'Expansões de Inventário', itens: EXPANSOES },
  ];

  return {
    FAMILIAS, GRAUS, ALCANCES, ARMAS, ATAQUES_BASICOS, PROTECOES, KENDO, PECAS, MUNICOES, CONSUMIVEIS, EXPANSOES, CATEGORIAS,
    itemPorId, armaPorId, pecaPorId, municaoPorId, itemPorNome, pecaServe, pecasDaArma, semAcento,
  };
});
