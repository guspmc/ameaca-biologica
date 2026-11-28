'use strict';
/*
 * Dados do livro "Arquivo do Jogador" v1.0 usados na Ficha de Personagem.
 * Os textos seguem o livro (capítulos 1, 2, 4 e 5). Nada aqui é regra nova: se o livro mudar, mude aqui.
 * Funciona no navegador (variável global LIVRO) e no Node (require).
 */
(function (raiz, fabrica) {
  const dados = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = dados;
  else raiz.LIVRO = dados;
})(typeof self !== 'undefined' ? self : this, function () {
  const ATRIBUTOS = [
    { id: 'FOR', nome: 'Força', texto: 'Potência muscular, capacidade atlética, impacto e domínio físico.' },
    { id: 'AGI', nome: 'Agilidade', texto: 'Coordenação, velocidade de reação, precisão manual e movimentação.' },
    { id: 'VIG', nome: 'Vigor', texto: 'Saúde, resistência física e capacidade de suportar trauma.' },
    { id: 'AST', nome: 'Astúcia', texto: 'Raciocínio, memória, atenção, formação e leitura de situações.' },
  ];

  const PERICIAS = [
    { id: 'acrobacia', nome: 'Acrobacia', atributo: 'AGI' },
    { id: 'furtividade', nome: 'Furtividade', atributo: 'AGI' },
    { id: 'pontaria', nome: 'Pontaria', atributo: 'AGI' },
    { id: 'reflexos', nome: 'Reflexos', atributo: 'AGI' },
    { id: 'atletismo', nome: 'Atletismo', atributo: 'FOR' },
    { id: 'luta', nome: 'Luta', atributo: 'FOR' },
    { id: 'fortitude', nome: 'Fortitude', atributo: 'VIG' },
    { id: 'investigacao', nome: 'Investigação', atributo: 'AST' },
    { id: 'medicina', nome: 'Medicina', atributo: 'AST' },
    { id: 'percepcao', nome: 'Percepção', atributo: 'AST' },
    { id: 'sobrevivencia', nome: 'Sobrevivência', atributo: 'AST' },
    { id: 'vontade', nome: 'Vontade', atributo: 'AST' },
  ];

  // Grau de treinamento: 0 Não Treinada (+0), 1 Treinada (+2), 2 Mestre (+3).
  const GRAUS = [
    { nome: 'Não Treinada', bonus: 0 },
    { nome: 'Treinada', bonus: 2 },
    { nome: 'Mestre', bonus: 3 },
  ];

  // bonus: valores somados aos derivados (só os que o livro cita expressamente).
  const ORIGENS = [
    { id: 'academico', nome: 'Acadêmico', pericias: ['investigacao', 'medicina'], beneficio: 'Saber é Poder. 1/Descanso Completo, ao realizar um Teste baseado em AST — seja um Teste puro de AST ou um Teste de Perícia associada a AST — faça-o com Vantagem.' },
    { id: 'agente-saude', nome: 'Agente de Saúde', pericias: ['medicina', 'sobrevivencia'], beneficio: 'Ao curar um aliado com item/efeito, +1d4 aos Dados de Cura. Não se aplica a si.' },
    { id: 'amnesico', nome: 'Amnésico', pericias: null, beneficio: 'Vislumbres do Passado: 1/sessão, em local conhecido antes da amnésia, AST DT 10; informação útil + Vantagem no próximo teste relacionado de Sobrevivência. Ao escolher esta Origem, escolha duas Perícias distintas; entre elas, uma é Treinada gratuitamente e a outra entra na lista de Perícias permitidas pela Classe na criação.' },
    { id: 'atleta', nome: 'Atleta', pericias: ['acrobacia', 'atletismo'], beneficio: 'Ao realizar um Teste de Perícia baseado em FOR ou AGI, exceto Luta ou Pontaria, você pode gastar 1 SA para receber +5 nesse Teste. O bônus não altera o valor permanente da Perícia nem seus valores derivados.' },
    { id: 'chef', nome: 'Chef', pericias: ['fortitude', 'sobrevivencia'], beneficio: 'Em Sala de Descanso, ao criar item, pode escolher 10 no d20.' },
    { id: 'cobaia', nome: 'Cobaia', pericias: ['reflexos', 'vontade'], bonus: { bi: 2 }, beneficio: '+2 BI Máxima. Durante Colapso Viral, cada Teste de Reanimação é feito com Vantagem: role 2d20 e use o melhor resultado.' },
    { id: 'criminoso', nome: 'Criminoso', pericias: ['investigacao', 'furtividade'], beneficio: '1/Descanso Completo: Vantagem em Investigação ao procurar itens/recursos.' },
    { id: 'desgarrado', nome: 'Desgarrado', pericias: ['fortitude', 'sobrevivencia'], beneficio: 'Ao aumentar BI, recebe PV Temporários = metade da BI atual, arredondada para baixo.' },
    { id: 'investigador', nome: 'Investigador', pericias: ['investigacao', 'percepcao'], beneficio: 'Ao realizar um Teste de Investigação para procurar uma pista, você pode gastar 1 SA para receber +5 nesse Teste. O bônus não altera o valor permanente da Perícia nem seus valores derivados.' },
    { id: 'lutador', nome: 'Lutador', pericias: ['luta', 'reflexos'], beneficio: 'Ataque Desarmado e Arma Improvisada sobem uma categoria de dado; acumula com Casca-Grossa. Não afeta Coronhada.' },
    { id: 'mercenario', nome: 'Mercenário', pericias: ['pontaria', 'fortitude'], beneficio: '1/Descanso Completo, quando um hostil oculto fosse Surpreendê-lo, você pode usar uma Reação para sacar uma arma de fogo carregada e realizar um Ataque contra esse hostil. Ao fazer isso, você percebe a ameaça a tempo e NÃO fica Surpreendido.' },
    { id: 'militar', nome: 'Militar', pericias: ['pontaria', 'percepcao'], beneficio: 'Após matar inimigo com arma de fogo, Vantagem no primeiro Ataque com arma de fogo no próximo turno.' },
    { id: 'mochileiro', nome: 'Mochileiro', pericias: ['sobrevivencia', 'atletismo'], bonus: { inventario: 1 }, beneficio: '+1 Inventário.' },
    { id: 'operario', nome: 'Operário', pericias: ['fortitude', 'atletismo'], beneficio: 'Escolha uma Arma Corpo a Corpo semelhante a uma ferramenta. Ao atacar com a arma escolhida, recebe +1 no Teste de Ataque. O Dano dessa arma adiciona 2 × FOR em vez de FOR. O FOR adicional não é multiplicado em um Acerto Crítico.' },
    { id: 'policial', nome: 'Policial', pericias: ['percepcao', 'pontaria'], bonus: { defesa: 2 }, beneficio: '+2 Defesa.' },
    { id: 'servidor-publico', nome: 'Servidor Público', pericias: ['investigacao', 'vontade'], beneficio: 'Ao usar Ajudar em um Teste de Perícia na qual você seja Treinado ou Mestre, o aliado recebe a Vantagem normal de Ajudar e +2 no Teste.' },
    { id: 'universitaria', nome: 'Universitária', pericias: ['medicina', 'investigacao'], bonus: { sa: 1 }, beneficio: '+1 SA Máxima.' },
  ];

  const toquesFinais = 'Defesa = 10 + AGI; Inventário = 4 + FOR; BI Máxima = BI Base da Classe + AST; SA Máxima = AGI + AST; Movimento = 9 m. Some os bônus de Origem, Habilidade e equipamento depois desses valores.';

  const CLASSES = [
    {
      id: 'agente', nome: 'Agente', pvPorNivel: 10, biBase: 8, pontos: 4, dadoVida: 'd10',
      identidade: 'Táticas reativas, Ataques de Oportunidade, Contra-Ataques e Finalizações.',
      permitidas: ['acrobacia', 'furtividade', 'investigacao', 'luta', 'percepcao', 'pontaria', 'reflexos', 'sobrevivencia'],
      caracteristicos: ['Gazua Profissional', 'Hatchet'],
      ramos: ['Impiedoso', 'Oportunista', 'Rapina'],
      proficiencias: 'Armas Corpo a Corpo Comuns e Táticas; Pistolas 9 mm até o Grau Militar; Escopetas até o Grau Tática; Submetralhadoras até o Grau Militar; GM 79 e Killer7 especificamente.',
      equipamento: {
        A: { rotulo: 'Sentinel Nine + Colete Acolchoado', itens: [{ nome: 'Sentinel Nine', espacos: 1 }, { nome: 'Colete Acolchoado', espacos: 1 }], moedas: 0 },
        B: { rotulo: 'JMB Hp3 + 1 Moeda Antiga', itens: [{ nome: 'JMB Hp3', espacos: 1 }], moedas: 1 },
        C: { rotulo: 'Personalizado: 3 Moedas Antigas', itens: [], moedas: 3 },
      },
    },
    {
      id: 'autodidata', nome: 'Autodidata', pvPorNivel: 8, biBase: 10, pontos: 5, dadoVida: 'd8',
      identidade: 'Versatilidade, improvisação, sobrevivência e suporte.',
      permitidas: ['furtividade', 'investigacao', 'luta', 'medicina', 'percepcao', 'pontaria', 'reflexos', 'sobrevivencia', 'vontade'],
      caracteristicos: ['Kit de Primeiros Socorros', 'Pente Estendido 9 mm'],
      ramos: ['Combatente', 'Pau para Toda Obra', 'Socorrista'],
      proficiencias: 'Armas Corpo a Corpo Comuns e Táticas; Pistolas 9 mm Comuns e Táticas; Escopetas Comuns; Submetralhadoras até o Grau Tática.',
      equipamento: {
        A: { rotulo: 'Bastão de Beisebol + Colete Acolchoado + 1 Moeda Antiga', itens: [{ nome: 'Bastão de Beisebol', espacos: 1 }, { nome: 'Colete Acolchoado', espacos: 1 }], moedas: 1 },
        B: { rotulo: 'LEMI + 1 Moeda Antiga', itens: [{ nome: 'LEMI', espacos: 1 }], moedas: 1 },
        C: { rotulo: 'Personalizado: 3 Moedas Antigas', itens: [], moedas: 3 },
      },
    },
    {
      id: 'operador', nome: 'Operador', pvPorNivel: 12, biBase: 6, pontos: 3, dadoVida: 'd12',
      identidade: 'Linha de frente, domínio de arsenal, força bruta e permanência sob pressão.',
      permitidas: ['atletismo', 'fortitude', 'investigacao', 'luta', 'percepcao', 'pontaria'],
      caracteristicos: ['Colete de Placas Kendo', 'Kit de Ferramentas'],
      ramos: ['Brigão', 'Especialista em Armamento', 'Tanque'],
      proficiencias: 'Armas Corpo a Corpo Comuns e Táticas; todas as Armas de Fogo convencionais, dos Graus Comum a Exótica.',
      equipamento: {
        A: { rotulo: 'Bastão de Beisebol + Colete Acolchoado + 1 Moeda Antiga', itens: [{ nome: 'Bastão de Beisebol', espacos: 1 }, { nome: 'Colete Acolchoado', espacos: 1 }], moedas: 1 },
        B: { rotulo: 'LEMI + 1 Moeda Antiga', itens: [{ nome: 'LEMI', espacos: 1 }], moedas: 1 },
        C: { rotulo: 'Personalizado: 3 Moedas Antigas', itens: [], moedas: 3 },
      },
    },
  ];

  // Todo personagem recebe isto, além dos Itens Característicos e de uma opção da Classe.
  const EQUIPAMENTO_COMUM = [{ nome: 'Erva Verde', espacos: 1 }, { nome: 'Lanterna Simples', espacos: 1 }];

  const TIERS = [
    { id: 'basica', nome: 'Básica' },
    { id: 'avancada', nome: 'Avançada' },
    { id: 'superior', nome: 'Superior' },
    { id: 'avassaladora', nome: 'Avassaladora' },
  ];

  const H = (id, classe, ramo, nome, tier, texto, bonus) => ({ id, classe, ramo, nome, tier, texto, ...(bonus ? { bonus } : {}) });

  const HABILIDADES = [
    // ---- Agente ----
    H('anatomia-de-combate', 'agente', 'Impiedoso', 'Anatomia de Combate', 'basica', 'Você treinou para reconhecer as fraquezas dos seus inimigos. Como Ação Bônus, faça um Teste de Medicina DT 15. Em sucesso, descobre se o alvo está Vulnerável e recebe Vantagem no próximo Ataque contra ele; o benefício pode ser usado até o fim do próximo turno do Agente.'),
    H('finalizacao-a-distancia', 'agente', 'Impiedoso', 'Finalização à Distância', 'avancada', 'Você pode realizar a Manobra Finalizar com uma arma de fogo contra um alvo dentro do alcance da arma e, no máximo, até Alcance Médio, pagando o custo normal de SA. Se o alvo não puder sofrer Morte Instantânea, aplicam-se normalmente o Dano e o Teste de Fortitude da Finalização e ele fica Atordoado até o final do próximo turno dele. A Habilidade não amplia o alcance da arma nem remove suas penalidades normais.'),
    H('luta-livre', 'agente', 'Impiedoso', 'Luta Livre', 'superior', 'Seu corpo é sua arma. E sua arma é letal! Contra alvo Atordoado, pode executar uma Manobra de Finalização e mover-se até 12 m em linha reta até ele sem provocar Ataques de Oportunidade. Se o alvo não estiver Vulnerável, adiciona +1d8 de Dano por Nível de Agente, até 10d8. Se o alvo for derrotado pela Manobra, não há custo de SA.'),
    H('nao-vai-escapar', 'agente', 'Oportunista', 'Não Vai Escapar', 'basica', 'Quando uma criatura provocar Ataque de Oportunidade para você ou para um aliado em combate Corpo a Corpo, você pode usar sua Reação para realizar um Ataque de Oportunidade contra essa criatura. Imediatamente antes do Ataque, você pode se deslocar até 3 m, desde que termine adjacente ao alvo. Esse deslocamento não provoca Ataques de Oportunidade.'),
    H('na-minha-mira', 'agente', 'Oportunista', 'Na Minha Mira', 'avancada', 'Uma vez por rodada, quando um inimigo que você possa perceber e que esteja a até Alcance Médio adquirir uma Condição que lhe imponha uma penalidade ou restrição, você pode usar sua Reação para realizar um Ataque de Oportunidade à distância contra ele com uma arma de fogo. O Ataque deve respeitar o alcance e as demais regras da arma. A Condição precisa ter sido adquirida naquele momento; reaplicar uma Condição que o alvo já possui não ativa esta Habilidade.'),
    H('brecha-tatica', 'agente', 'Oportunista', 'Brecha Tática', 'superior', 'Amplia os gatilhos de Ataque de Oportunidade para ações vulneráveis durante Movimento/Ação, como Sacar arma, Usar um Objeto, interagir ou atacar outro alvo. Se o Ataque de Oportunidade causar Dano, interrompe a ação que o provocou. Você tem Vantagem em Ataques de Oportunidade.'),
    H('rolamento', 'agente', 'Rapina', 'Rolamento', 'basica', 'Você é ágil e oportunista. Esta Habilidade permite Esquivar. Após Esquivar com sucesso, pode reposicionar-se até 3 m sem provocar Ataques de Oportunidade.'),
    H('contra-ataque-instintivo', 'agente', 'Rapina', 'Contra-Ataque Instintivo', 'avancada', 'Após Aparar ou Esquivar com sucesso, você pode realizar o Contra-Ataque como parte da mesma Reação utilizada na defesa. O Contra-Ataque continua consumindo 1 SA normalmente.'),
    H('retaliacao', 'agente', 'Rapina', 'Retaliação', 'superior', 'Após uma Manobra de Aparar ou Esquivar bem-sucedida, o inimigo fica Atordoado até o início do próximo turno dele. Seu Contra-Ataque tem Vantagem e, se acertar, causa +1 Dado de Dano da arma.'),
    H('voce-aparou-um-missil', 'agente', null, 'VOCÊ APAROU UM MÍSSIL!?', 'avassaladora', 'Você pode Aparar qualquer Ataque quando a narrativa permitir a interceptação. Com Faca de Combate ou Hatchet, uma vez durante seu próprio turno, quando houver um gatilho válido para Aparar, você pode realizar a Manobra Aparar como Ação Livre em vez de Reação. Em um Aparar Corpo a Corpo bem-sucedido com uma dessas armas, causa 2d4 de Dano. Pode usar Finalizar sem custo de SA durante uma Reação declarada de Contra-Ataque. Contra-Ataques causam +2d4.'),
    // ---- Autodidata ----
    H('ambidestria', 'autodidata', 'Combatente', 'Ambidestria', 'basica', 'Quando estiver empunhando uma Pistola 9 mm em cada mão, ao usar a Ação Atacar com uma delas, você pode, 1 vez por turno, realizar um Ataque adicional com a outra como Ação Bônus. Esse Ataque adiciona AGI ao Dano normalmente, ao contrário da regra geral de Combate com Duas Armas. Ambidestria não exige que as Pistolas sejam de Grau Comum. Sacar simultaneamente as duas armas usa uma única Interação Gratuita com Objeto.'),
    H('armeira-autodidata', 'autodidata', 'Combatente', 'Armeira Autodidata', 'avancada', 'Você é iniciada na arte de modificar armas. Armas de Fogo modificadas causam +1d4 de Dano para cada Peça Extra instalada. Esse Dano adicional não se aplica a Armas Corpo a Corpo. Você pode usar uma Pistola em cada mão para Aparar Ataques Corpo a Corpo.'),
    H('arsenal-improvavel', 'autodidata', 'Combatente', 'Arsenal Improvável', 'superior', 'Você recebe Proficiência com Magnums e passa a utilizar os benefícios de Armeira Autodidata e Ambidestria com elas, podendo empunhá-las com uma mão. Reduz o Coice em uma categoria, nunca abaixo de Interação Gratuita com Objeto.'),
    H('curiosa', 'autodidata', 'Pau para Toda Obra', 'Curiosa', 'basica', 'Quando dispõe de tempo para observar ou investigar uma situação sem estar sob Pressão Imediata, você possui Vantagem em Testes de Percepção e Investigação, mesmo que não seja Treinada na Perícia. Esse benefício não se aplica durante Combate, perseguições, fugas ou situações em que o Narrador determine que não há tempo para análise cuidadosa. Uma vez por Descanso Completo, você pode realizar um Teste de AST DT 12 para pedir ao Narrador uma indicação simples sobre a direção a seguir ou uma pista curta para a resolução de um quebra-cabeça, desde que exista informação que sua personagem possa razoavelmente deduzir.'),
    H('tentativa-e-erro', 'autodidata', 'Pau para Toda Obra', 'Tentativa e Erro', 'avancada', 'Você pode realizar Testes com Perícias não Treinadas, inclusive aplicações normalmente restritas a Treinamento, salvo requisito adicional expresso. Recebe +1 nesses Testes e escolhe uma Perícia adicional para Treinar.', { treinoExtra: 1 }),
    H('reflexos-de-sobrevivente', 'autodidata', 'Pau para Toda Obra', 'Reflexos de Sobrevivente', 'superior', 'Uma vez por rodada, você pode Esquivar sem gastar Reação; sua próxima Ação Bônus fica comprometida. Pode passar por espaços ocupados por jogadores ou inimigos Médios e menores sem provocar Ataque de Oportunidade. Ataques contra você podem usar sua Defesa ou 10 + Acrobacia, o que for maior.'),
    H('herbalista', 'autodidata', 'Socorrista', 'Herbalista', 'basica', 'Misturas de Ervas que você produz curam sempre o valor máximo possível. Sempre que usar uma Mistura de Ervas em si, recebe +1 de cura por Nível de Autodidata.'),
    H('farmacia-de-campo', 'autodidata', 'Socorrista', 'Farmácia de Campo', 'avancada', 'Você pode criar Misturas de Ervas como Ação fora de uma Sala de Descanso e até durante deslocamento, desde que possua a Receita e os ingredientes.'),
    H('primeiros-socorros', 'autodidata', 'Socorrista', 'Primeiros Socorros', 'superior', 'Itens de cura usados por você concedem PV Temporários, por 1 hora, iguais à sua Medicina. Aliados até 3 m que recebam sua cura também recebem o efeito; quando você cura um aliado, recebe para si metade da Cura, sem os PV Temporários. Você também pode fabricar Neurotoxinas, Bombas de Fumaça, Esteroides e Estabilizadores quando conhecer a Receita e possuir os ingredientes e ferramentas exigidos.'),
    H('code-veronica', 'autodidata', null, 'CODE VERONICA', 'avassaladora', 'Conhece automaticamente senhas, códigos e combinações, sem substituir chaves, cartões ou itens físicos. Seus Testes de Perícia têm Vantagem; resultados naturais de 2 a 9 contam como 10. Um 1 natural continua sendo Falha Crítica. Ao Combinar Ervas, tem 50% de chance de produzir em dobro. Pode usar Submetralhadoras sem coronha com Ambidestria.'),
    // ---- Operador ----
    H('golpe-sujo', 'operador', 'Brigão', 'GOLPE SUJO', 'basica', 'Durante um combate, você pode utilizar as opções abaixo quando cumprir seus respectivos requisitos. Derrubar: após causar Dano com um Ataque Corpo a Corpo, você pode gastar seu Movimento para tentar Derrubar esse alvo (Manobra Empurrar/Derrubar). Pisão: contra um alvo Caído, seu Ataque Desarmado recebe +1 Dado de Dano. Se o alvo for Menor que você, recebe Vantagem e é tratado como Caído para esse ataque. Se estiver Vulnerável e puder sofrer Finalização, o Pisão provoca Morte Instantânea sem custo de SA. Cabeçada: faça um Ataque Desarmado. Em acerto, além do Dano normal, o alvo realiza Fortitude DT 10 + FOR. Em falha, fica Atordoado até o final do próximo turno dele.'),
    H('casca-grossa', 'operador', 'Brigão', 'Casca-Grossa', 'avancada', 'Seu Dano Desarmado ou de Coronhada sobe uma categoria de Dado. Uma vez por turno, pode executar Cabeçada ou Pisão com Desvantagem após um Ataque bem-sucedido.'),
    H('briga-de-gente-grande', 'operador', 'Brigão', 'Briga de Gente Grande', 'superior', 'Manobras de GOLPE SUJO passam a funcionar contra criaturas maiores, desde que tenham anatomia física compatível/humanoide. Recebe Vantagem ao usar Derrubar ou Cabeçada contra criatura maior.'),
    H('armeiro', 'operador', 'Especialista em Armamento', 'Armeiro', 'basica', 'Como Ação, pode acoplar, desacoplar ou trocar Peças Extras da arma empunhada. Ao atacar com uma arma modificada, recebe +1 no Teste de Ataque para cada Peça Extra instalada nela.'),
    H('armamento-especial', 'operador', 'Especialista em Armamento', 'Armamento Especial', 'avancada', 'Recebe Proficiência com Magnums e Armas Especiais. Reduz em uma categoria de Ação os custos de Recarga, Bombear/Manejar e Coice, nunca abaixo de Interação Gratuita com Objeto.'),
    H('controle-de-fogo', 'operador', 'Especialista em Armamento', 'Controle de Fogo', 'superior', 'Ao usar Rajada, pode substituir o Cone por até 6 espaços conectados entre si e dentro do alcance permitido pela Rajada. Cada espaço escolhido deve possuir linha de efeito a partir de você. Mantém consumo de munição, Dano, DT e demais restrições.'),
    H('parrudo', 'operador', 'Tanque', 'Parrudo', 'basica', 'Você é um brutamontes. Recebe imediatamente +5 PV Máximos, +3 BI Máxima e Vantagem em Testes de Fortitude.', { pv: 5, bi: 3 }),
    H('quanto-mais-melhor', 'operador', 'Tanque', 'Quanto Mais Melhor', 'avancada', 'Quando estiver na Área de Ameaça de 3 ou mais inimigos, recebe Vantagem em seus Ataques.'),
    H('parede-humana', 'operador', 'Tanque', 'Parede Humana', 'superior', 'Ao final de seu turno, se você não tiver gasto seu Movimento durante ele, adiciona VIG à sua Defesa e recebe Redução de Dano igual a 1 + metade de seu Nível de Operador, arredondada para baixo, até o máximo de 6. Esses benefícios duram até o início de seu próximo turno. "Não gastar Movimento" refere-se ao recurso Movimento, não apenas a deslocar 0 metros.'),
    H('socador-de-pedras', 'operador', null, 'SOCADOR DE PEDRAS', 'avassaladora', 'Se algo existe, pode ser socado! O Dano base de seus Ataques Desarmados passa a ser 3d10, antes de aumentos de categoria. Seus punhos são tratados como Indestrutíveis para Aparar Ataques Corpo a Corpo aparáveis, inclusive golpes extremamente destrutivos. Pode Contra-Atacar desarmado sem largar uma arma de 2 mãos. O alvo principal sofre o Ataque normal; as demais criaturas adjacentes sofrem 1d10 da onda de choque. Ao acertar, o resultado do Ataque pode ser usado como DT de Fortitude para Derrubar.'),
  ];

  // O que a personagem ganha em cada Nível (capítulo 1, "Progressão de Personagem").
  const PROGRESSAO = {
    basica: [1, 2], // níveis em que recebe uma Habilidade Básica
    avancada: [4, 6],
    superior: [8],
    avassaladora: [10],
    atributo: [3, 5, 7, 9], // +1 Atributo (máximo absoluto 5)
    pontoPericia: [4, 8], // +1 Ponto de Perícia
    missoes: [0, 1, 3, 6, 10, 15, 21, 28, 35, 42], // Missões Completadas exigidas para o Nível 1 a 10 (capítulo 6, opcional)
  };

  const CONDICOES = [
    { id: 'agarrado', nome: 'Agarrado', texto: 'Movimento passa a 0 e não pode receber bônus de Movimento.' },
    { id: 'amedrontado', nome: 'Amedrontado', texto: 'Desvantagem em testes aplicáveis enquanto perceber a fonte do medo; tenta fugir dela e não pode se aproximar voluntariamente.' },
    { id: 'atordoado', nome: 'Atordoado', texto: 'Não pode realizar Ações, Reações ou Movimento. Ataques e Manobras ofensivas resistidas contra o alvo recebem Vantagem.' },
    { id: 'caido', nome: 'Caído', texto: 'Só pode se deslocar Rastejando. Seus Ataques têm Desvantagem; Corpo a Corpo contra você têm Vantagem e à distância têm Desvantagem.' },
    { id: 'cego', nome: 'Cego', texto: 'Desvantagem em seus Ataques; Ataques contra ele têm Vantagem; falha automaticamente em testes que dependam exclusivamente de visão.' },
    { id: 'corrosao', nome: 'Corrosão', texto: 'Causa 1d4 de Dano ao final de cada turno. No início do turno, Fortitude DT 12 encerra a Corrosão.' },
    { id: 'desorientado', nome: 'Desorientado', texto: 'Não pode usar Atacar, tem Desvantagem em Testes de Perícia e perde a contribuição de AGI na Defesa.' },
    { id: 'enfraquecido', nome: 'Enfraquecido', texto: 'Desvantagem em Testes baseados em FOR e em Fortitude.' },
    { id: 'exposto', nome: 'Exposto', texto: 'Sofre -2 na Defesa.' },
    { id: 'imobilizado', nome: 'Imobilizado', texto: 'Movimento 0; Desvantagem nos próprios Ataques; Ataques contra o alvo têm Vantagem; Desvantagem em Reflexos.' },
    { id: 'incapacitado', nome: 'Incapacitado', texto: 'Não pode realizar Ações nem Reações.' },
    { id: 'intoxicado', nome: 'Intoxicado', texto: 'Movimento reduzido em 3 m. Desvantagem em Testes de Ataque e Testes de Perícia. Testes de Atributo permanecem normais.' },
    { id: 'queimadura', nome: 'Queimadura', texto: 'Sofre 1d6 de Dano ao final de cada turno. No início de cada turno, Reflexos DT 12 apaga as chamas.' },
    { id: 'surdo', nome: 'Surdo', texto: 'Falha automaticamente em testes que dependam exclusivamente de audição.' },
    { id: 'infectado-especial', nome: 'Infectado Especial', texto: 'Transformação por Colapso Viral (3 falhas na Reanimação). Perde Habilidades de Classe, mas mantém Atributos, Perícias e uso de armas; Ataques com armas de fogo têm Desvantagem. Ataca a criatura consciente mais próxima.' },
    { id: 'cabeca-carmesim', nome: 'Cabeça Carmesim', texto: 'Transformação posterior de um Infectado Especial a 0 PV. Não usa Armas nem Habilidades; todo Ataque que causa Dano também causa +2 BI. Revertida se a BI chegar a 0.' },
    { id: 'surpreendido', nome: 'Surpreendido', texto: 'No primeiro turno, não pode se mover nem realizar Ações. Não pode usar Reações nem gastar SA.' },
  ];

  // Fases da Bio-Infecção (capítulo 5).
  const FASES_BI = [
    { fase: 1, faixa: '0% a <20%', efeito: 'Nenhum efeito.' },
    { fase: 2, faixa: '20% a <40%', efeito: 'Movimento +3 m.' },
    { fase: 3, faixa: '40% a <60%', efeito: 'Mantém efeitos anteriores e recebe +2 em Testes de Ataque.' },
    { fase: 4, faixa: '60% a <80%', efeito: 'Mantém efeitos anteriores, recebe +1 adicional em Testes de Ataque e +1d4 de Dano Corpo a Corpo.' },
    { fase: 5, faixa: '80% a <BI Máxima', efeito: 'Perde todos os benefícios anteriores; Movimento -6 m; Desvantagem em Ataques e Testes de Perícia e Atributo.' },
  ];

  return { ATRIBUTOS, PERICIAS, GRAUS, ORIGENS, CLASSES, EQUIPAMENTO_COMUM, TIERS, HABILIDADES, PROGRESSAO, CONDICOES, FASES_BI, toquesFinais };
});
