# Painel do Mestre — módulo inicial

Esta branch mantém o desenvolvimento do Painel do Mestre isolado da `main` e do módulo de Fichas.

## Escopo entregue nesta etapa

- Extensão do Painel do Mestre em `app/js/painel-mestre.js`, carregada depois de `mesas.js` e antes de `app.js`.
- API e persistência separadas em `servidor/painel-mestre.js` e `servidor/dados/painel-mestre.json`.
- Primeiro recurso operacional: preparação de combate, participantes, rolagem de Iniciativa, ordem, rodada e avanço de turno.
- Teste unitário em `testes/teste-painel-mestre.js`, incluído em `npm test`.
- Cache do Service Worker atualizado para `ab-lab-v5`.

## Regras aplicadas

Fonte: Arquivo do Jogador v1.0, capítulo 4 — Regras e Combate, p. 76; Arquivo do Mestre v1.0, Ferramentas do Narrador, p. 14.

- Personagens: Iniciativa = 1d20 + AGI.
- Criaturas: 1d20 + Iniciativa indicada na ficha da Criatura.
- Ordem: maior resultado primeiro; empate é resolvido por AGI, depois pelo resultado natural do d20; persistindo, os empatados rolam novamente. O Painel identifica os empates persistentes e oferece a rerrolagem apenas para os participantes empatados.
- Participante que entra em combate já iniciado vai ao final da ordem.
- Próximo turno percorre a ordem e aumenta a rodada ao retornar ao primeiro participante.

## Limites conhecidos desta etapa

- A Ficha de Personagem ainda está sendo desenvolvida por Claude. Por isso, os participantes são cadastrados manualmente nesta primeira versão; não há leitura de PV/SA/BI nem acesso do Mestre às fichas privadas.
- Para Personagens, o bônus de Iniciativa acompanha a AGI; para Criaturas, o bônus é informado conforme a ficha da Criatura. A AGI fica disponível para desempate.
- A rolagem automática usa o gerador aleatório do navegador; o resultado pode ser corrigido manualmente.
- As alterações são avisadas ao Mestre pelo evento SSE da Mesa; uma consulta periódica de segurança atualiza a tela caso algum evento se perca. O salvamento do combate mantém uma fila de alterações: se novas mudanças ocorrerem enquanto uma gravação estiver em andamento, elas são enviadas em seguida, sem serem descartadas pela resposta anterior.
- Os dados operacionais são apagados quando o Mestre encerra a Mesa.

## API

`GET /api/painel-mestre/:mesaId/combate` — retorna o estado de combate.  
`PUT /api/painel-mestre/:mesaId/combate` — valida e persiste o estado de combate.

A API exige sessão válida e confirma que o usuário é o Mestre daquela Mesa. Jogadores recebem HTTP 403.

## Integração

O módulo visual foi separado de `mesas.js` para reduzir conflitos com a implementação da Ficha. As alterações compartilhadas ficaram limitadas a:

- inclusão do script no `app/index.html`;
- rota autenticada no `servidor/server.js`;
- estilos no final de `app/css/estilo.css`;
- inclusão no cache do `app/sw.js`;
- chamada do teste novo em `package.json`.

Antes do merge, atualizar esta branch com a `main` e revisar principalmente `index.html`, `server.js`, `estilo.css` e `package.json`, que também podem receber alterações do módulo de Fichas.

## Segunda etapa — ferramentas de narrativa e encontros

- Criador de encontros com orçamento por nível (Tenso / Difícil / Brutal), ajustado em aproximadamente 25% por personagem acima ou abaixo de quatro.
- Sorteio de composições com criaturas Comuns, Perigosas e Elite do Arquivo do Mestre. Chefes e Perseguidores ficam fora do sorteio automático; o livro trata Perseguidores como ameaça especial e orienta que não sejam inseridos pela tabela de encontros errantes.
- O encontro sorteado pode ser guardado com cenário e direção tática. O orçamento é uma referência, não garantia matemática: o Mestre ainda deve considerar ferimentos, munição, cura, SA, equipamento, terreno, objetivos e rotas de fuga.
- O criador agora mostra o percentual de aproveitamento do orçamento e uma leitura prática quando a composição fica muito abaixo dele. Essa leitura é heurística da ferramenta, não uma regra adicional do sistema; o livro não define faixas percentuais de aproveitamento.
- Anotações persistentes por Mesa.
- Cadastro e edição de documentos narrativos (relatórios, e-mails, bilhetes, arquivos e pistas). Documentos e itens personalizados podem ser editados e publicados/retirados a qualquer momento. Os membros aprovados recebem somente o conteúdo publicado por uma rota de leitura filtrada; mudanças de publicação avisam os Jogadores conectados em tempo real.
- Cadastro de itens personalizados com categoria, descrição e efeito, com controle individual de publicação/retirada para os Jogadores.
- Conteúdo persistido em arquivo separado (painel-mestre-conteudo.json), com autorização exclusiva do Mestre para criar, editar e excluir. Jogadores recebem somente os documentos publicados; não recebem anotações, encontros privados ou itens em preparação.
- Ao encerrar a Mesa, os dados desse módulo também são apagados.

## Terceira etapa — gerenciamento de condições

- Catálogo de 20 condições oficiais conforme o Arquivo do Jogador v1.0, pp. 81–83, com consulta rápida do efeito e das orientações de duração/remoção.
- Aplicação por participante com registro individual de duração/término e observações. Condições personalizadas continuam permitidas. A suíte de testes confere os 20 nomes oficiais e garante que avançar o turno não altera automaticamente duração nem observações.
- A interface usa campos no próprio painel (sem caixas de diálogo do navegador), com nome manual exibido somente quando essa opção é selecionada.
- Instâncias repetidas da mesma condição podem ter suas durações acompanhadas separadamente, mas seus efeitos mecânicos não se acumulam, conforme a regra de Acúmulo de Condições na p. 81.
- A duração não é decrementada automaticamente ao avançar turnos. Corrosão e Queimadura, por exemplo, exigem testes no início do turno e dano ao final; outras condições dependem da fonte que as aplicou. O Mestre registra manualmente o término para evitar automações que contrariem esses gatilhos.

## Encontros preparados

Os encontros salvos podem ser editados individualmente: nome, nível, quantidade de personagens, intensidade, pontos, orçamento, composição, cenário e direção/comportamento. A edição preserva o identificador do encontro e valida os campos numéricos antes de salvar. A exclusão exige confirmação. Também podem ser duplicados: a cópia recebe um novo identificador, o sufixo “(cópia)” no nome e mantém seus próprios dados, sem alterar o encontro original.

## Gerenciamento de condições

O Painel oferece catálogo das 20 condições oficiais das pp. 81–83 do Arquivo do Jogador, consulta rápida de efeitos e duração/remoção, cadastro manual e campos diretos para duração/momento de término e observações. Cada aplicação mantém sua própria duração e observação. O Mestre pode editar esses dois campos depois da aplicação ou remover a condição. A ferramenta não decrementa automaticamente os prazos, pois os gatilhos dependem da condição e da fonte.

## Referências de regras e limites

- Arquivo do Mestre v1.0, p. 21: categorias de ameaça (Comum 1, Perigosa 2, Elite 4, Chefe 8; Perseguidor especial), orçamento para quatro personagens por faixa de nível e ajuste aproximado de 25% por personagem.
- Arquivo do Mestre v1.0, pp. 62–67: encontros errantes, adaptação à ambientação, estado do grupo e encontros prontos.
- Arquivo do Jogador v1.0, p. 43: Teste Passivo = 10 + valor da Perícia; vantagem +5 e desvantagem -5.
- Arquivo do Mestre v1.0, apêndice, p. 70: resumo das condições e lembrete de que durações de fontes diferentes podem ser acompanhadas separadamente.

Ainda pendente:
- Concluída a projeção e a primeira integração do resumo operacional: a rota `GET /api/painel-mestre/:mesaId/fichas` entrega somente Fichas Ativas de jogadores aprovados, e o Painel exibe identificação, PV/SA/BI atuais e máximos, Iniciativa, Defesa e as quatro Perícias Passivas autorizadas. A rota depende dos módulos oficiais de Ficha/Regras da `main`; enquanto as branches estiverem separadas, responde 503 de forma explícita.

- Transformar itens criados em objetos distribuíveis às Fichas, respeitando as permissões da Mesa.
- Testes HTTP de integração para autenticação, aprovação de Jogadores e filtragem das publicações adicionados à suíte; acompanhar o resultado do CI antes de considerar a etapa validada.
### Contrato planejado para o resumo das Fichas

A integração com a Ficha deve fornecer ao Painel uma projeção de sessão, nunca o objeto completo da Ficha. Campos previstos:
- Identificador da Ficha Ativa aprovada e nome do personagem;
- PV atual/máximo, SA atual/máximo e BI atual/máxima;
- Percepção, Fortitude, Reflexos e Vontade passivas, calculadas pelo módulo oficial de regras da Ficha;
- Identificação do Jogador e do personagem, para associar os valores à pessoa correta.

Essa projeção é limitada aos personagens aprovados na Mesa e consultada periodicamente pelo Painel (a cada quatro segundos), ao entrar na Mesa e ao retornar à aba. O Mestre recebe somente os campos expressamente autorizados; a rota é de leitura e não possui operação para alterar a Ficha.

## Testes de fluxo de combate

- A suíte também executa testes diretamente sobre as funções de turno do módulo visual, em ambiente isolado do navegador.
- São verificados: avanço dentro da ordem, fechamento da rodada ao passar pelo último participante, remoção do participante atual no meio/fim da ordem, remoção de participante fora do turno, remoção do último participante e avanço com lista vazia.
- Os testes validam o comportamento já implementado; não acrescentam regras novas ao sistema.


## Concorrência entre sessões do Mestre

- O estado de combate possui um número de versão incrementado a cada gravação aceita.
- O navegador envia a versão que carregou junto com cada alteração. Se outra aba ou aparelho gravar primeiro, o servidor rejeita a gravação antiga com HTTP 409, em vez de sobrescrever silenciosamente o estado mais recente.
- O navegador mantém a alteração local e apresenta o erro retornado; o Mestre deve atualizar a Mesa antes de continuar. Não há mesclagem automática de alterações conflitantes.
- Estados antigos, ainda sem campo de versão, são lidos como versão 0 e passam a receber versão na primeira gravação feita pelo cliente atualizado.
- A notificação SSE do combate continua direcionada às sessões do próprio Mestre. A visualização dos Jogadores não recebe nem consulta o estado privado do combate nesta etapa.


## Proteção de edição entre atualizações remotas

- A consulta periódica e a atualização ao retornar para a aba não redesenham o combate enquanto um campo de edição do Painel estiver em foco, evitando apagar texto ainda não confirmado.
- Se uma gravação receber HTTP 409 por versão desatualizada, o Painel preserva o estado local e bloqueia novas atualizações automáticas vindas do servidor.
- A interface informa o conflito e oferece uma ação explícita para descartar as alterações locais e carregar a versão do servidor, sempre mediante confirmação. Não há descarte silencioso nem mesclagem automática.
- O teste de fluxo também verifica que campos de texto/seleção em foco suspendem a atualização visual periódica.

- A proteção também cobre o evento SSE da Mesa: o redesenho geral é adiado enquanto o foco estiver em INPUT, TEXTAREA ou SELECT dentro do conteúdo da Mesa. Ao sair do campo, o redesenho pendente é executado.
- Ao iniciar um novo combate, a versão recebida do servidor é preservada; assim, a gravação continua sujeita à verificação de concorrência (não cai no modo de compatibilidade de clientes antigos).


## Projeção operacional de Fichas (preparação para integração)

O módulo `servidor/painel-mestre-fichas.js` prepara uma projeção restrita para o Painel:
- somente Fichas no estado `ativa`;
- somente fichas de jogadores que continuam aprovados na Mesa;
- somente o Mestre daquela Mesa pode consultar;
- lista explícita de campos permitidos: identificação (jogador e personagem), PV/SA/BI atuais e máximos, Iniciativa, Defesa e Perícias Passivas (Percepção, Fortitude, Reflexos e Vontade);
- não retorna atributos, perícias, habilidades, conceito, história, inventário ou anotações.

A projeção está ligada à rota HTTP e à interface do Painel. O servidor consulta `fichas.json` em leitura e usa `REGRAS.calcular` e `LIVRO.CONDICOES` da implementação oficial; não altera nem duplica o módulo `servidor/fichas.js`. O resumo é atualizado ao entrar na Mesa, ao retornar à aba e junto da atualização periódica do Painel.


## Resumo operacional das Fichas no Painel

- A rota `GET /api/painel-mestre/:mesaId/fichas` exige sessão válida e valida que o solicitante é o Mestre da Mesa.
- A projeção inclui somente Fichas `ativa` de jogadores ainda aprovados na Mesa.
- A interface apresenta identificação, PV/SA/BI atuais e máximos, Iniciativa, Defesa e Perícias Passivas (Fortitude, Reflexos, Vontade e Percepção).
- O Mestre não recebe atributos, perícias completas, habilidades, conceito, história, inventário ou anotações da Ficha.
- A integração lê o arquivo persistido de Fichas e injeta o cálculo oficial de `REGRAS`; não modifica os dados da Ficha.
- Até o merge com a implementação de Fichas da `main`, a rota responde HTTP 503 quando as dependências oficiais ainda não estão disponíveis nesta branch isolada.


## Quarta etapa — catálogo de itens e arquivos narrativos

- O conteúdo do Mestre agora possui navegação por abas: **Itens personalizados**, **Documentações / Files** e **Encontros e anotações**.
- Itens personalizados aceitam nome, categoria, descrição, efeito/regra e URL de imagem. O Mestre visualiza uma prévia ao preencher a URL; itens publicados exibem a imagem aos Jogadores junto da descrição e do efeito.
- Documentos narrativos aceitam título, tipo, texto e link opcional para um arquivo anexo (PDF, imagem ou outro arquivo hospedado). O Mestre pode manter o documento privado ou publicá-lo para a Mesa; os Jogadores recebem o texto e o link somente quando publicado.
- URLs de imagens e anexos são validadas no servidor para aceitar apenas HTTP/HTTPS. Links externos abrem em nova aba com proteção `noopener noreferrer`.
- As imagens e os anexos são referenciados por URL; o Painel ainda não hospeda arquivos enviados do dispositivo. Para a primeira versão, o Mestre pode usar imagens/arquivos hospedados em um serviço acessível aos Jogadores.
- A aba de Encontros reúne o criador, encontros preparados e anotações; as outras duas abas isolam seus respectivos formulários e listas.
- Testes do módulo verificam a publicação dos campos de mídia e a rejeição de esquemas de URL inseguros.


## Quinta etapa — Bestiário e preparação integrada de combate

- Catálogo de 22 B.O.Ws. transcritas do Arquivo do Mestre v1.0, pp. 28–49: categoria e pontos de ameaça, função, tamanho, PV, Defesa, Movimento, Atributos, Iniciativa, resistências, ataques e traços.
- A aba **Bestiário** permite pesquisar por nome, categoria, função ou tamanho e expandir cada ficha para consulta.
- O sorteador de encontros usa os IDs do catálogo, em vez de guardar apenas nomes em texto. Mantém as categorias e pontuações do livro: Comum 1, Perigosa 2, Elite 4 e Chefe 8. O sorteio automático continua excluindo Chefes; Perseguidores permanecem fora do orçamento comum conforme a p. 21 e serão tratados em módulo próprio.
- Encontros preparados guardam a composição estruturada (ID da criatura e quantidade). O Mestre pode usar **Preparar combate** para enviar a composição diretamente à ordem de iniciativa.
- Ao selecionar uma criatura do Bestiário na preparação de iniciativa, o Painel preenche AGI e o valor de Iniciativa da ficha. Também registra PV atuais/máximos, Defesa e Movimento para acompanhamento durante o combate.
- O PV atual da criatura pode ser atualizado no rastreador sem alterar os valores originais do Bestiário. A ficha-base do catálogo permanece intacta.
- A composição do encontro e os dados operacionais do combate continuam privados do Mestre. O Bestiário é carregado no fluxo do Painel do Mestre e incluído no cache do PWA para consulta local.
- Testes verificam a integridade estrutural das 22 fichas, pontuação por categoria, persistência de PV no combate e validação da composição de encontros.

### Regras de referência

- Arquivo do Mestre v1.0, p. 14: para Criaturas, Iniciativa = 1d20 + Iniciativa indicada na ficha; Fortitude, Reflexos, Vontade e Percepção já são valores totais prontos para uso.
- Arquivo do Mestre v1.0, p. 21: categorias, pontos, orçamento para quatro Personagens e ajuste aproximado de 25% por personagem acima/abaixo de quatro.
- Arquivo do Mestre v1.0, pp. 28–49: catálogo de B.O.Ws. incluído nesta etapa.
- Arquivo do Mestre v1.0, pp. 50–55: Perseguidores e suas regras específicas ainda não foram integrados ao Bestiário comum.


## Sexta etapa — Perseguidores e montagem manual de encontros

- O Bestiário agora contém duas fichas especiais de Perseguidor: Tirano (T-103) e Nemesis T-Type, com os valores de PV de Perseguição, Defesa, Movimento, Atributos, Iniciativa, resistências, ataques e traços das pp. 54–55 do Arquivo do Mestre.
- Perseguidores aparecem na aba do Bestiário, mas não recebem pontuação comum e não são incluídos no sorteio automático. Isso preserva a orientação da p. 22: Perseguidores entram pelo sistema próprio de Som e perseguição, não pela tabela de encontros errantes.
- O criador de encontros agora permite montagem manual: adicionar/remover linhas, selecionar qualquer criatura do catálogo e definir quantidade de 1 a 20. Chefes podem ser incluídos manualmente e contam com seus 8 pontos por unidade. Perseguidores podem ser adicionados, mas não consomem pontos do orçamento comum.
- A composição manual apresenta o total de pontos e compara com o orçamento da Mesa, sinalizando quando há Perseguidores fora do orçamento.
- Ao preparar um encontro, os Perseguidores entram na iniciativa com seus PV de Perseguição. O rastreador identifica a fase e mostra as restrições da p. 52: durante a Fase de Perseguição, não podem sofrer Morte Instantânea normalmente nem ficam Vulneráveis; um efeito direto de Morte Instantânea reduz os PV de Perseguição a 0.
- O Mestre pode declarar **Forma de Combate** no rastreador. O sistema então passa aos PV da ficha normal correspondente presente no catálogo (Tirano T-103 Forma II ou Nemesis T-Type Forma II). A transição exige confirmação e reinicia os PV para o máximo da ficha de combate. Essa ação é manual, conforme a decisão narrativa do Mestre.
- As fichas de Perseguidor preservam os dados da fase de perseguição separadamente dos PV da forma de combate. As regras de fases posteriores e eventuais adaptações narrativas continuam sob controle do Mestre; não foram automatizadas.
- Testes cobrem a presença das duas fichas, seus PV de perseguição e a persistência da fase no estado de combate.

### Referências

- Arquivo do Mestre v1.0, p. 22: Perseguidores não entram pela tabela de encontros errantes; usam o sistema próprio de Som e Perseguição.
- Arquivo do Mestre v1.0, p. 52: regras da Fase de Perseguição e transição para Forma de Combate.
- Arquivo do Mestre v1.0, pp. 54–55: fichas do Tirano (T-103) e Nemesis T-Type.


## Régua de proximidade do Perseguidor

- Cada Perseguidor em Fase de Perseguição possui uma régua visual de proximidade, independente dos PV de Perseguição.
- A escala vai de 0 a 10: 0 indica que o Perseguidor alcançou o grupo; 10 indica que o grupo abriu a maior distância representada pela régua. O valor inicial é 5, como posição neutra de acompanhamento.
- Os controles **− Aproximar** e **+ Afastar** movem o marcador em uma unidade por vez. A interface apresenta uma leitura textual do risco e impede ultrapassar os limites.
- A escala é um recurso de acompanhamento narrativo do Painel, não uma medida mecânica nem uma regra adicional do livro. O Mestre decide quando e quanto a posição muda.
- O valor fica salvo no estado do combate e sincronizado entre as sessões do Mestre.


## Integração inicial entre Fichas Ativas e iniciativa

- O resumo operacional de cada Ficha Ativa aprovada oferece a ação **Adicionar à iniciativa**.
- A ação cria um participante do tipo Personagem e utiliza o nome e a AGI calculada pela Ficha; para Personagens, o bônus de Iniciativa permanece igual à AGI, conforme a regra já aplicada pelo rastreador.
- Se o combate já estiver em andamento, o personagem entra como participante tardio, permanecendo no fim da ordem atual.
- A ação impede nomes duplicados e respeita o limite de 30 participantes. Depois de adicionado, o cartão da Ficha informa que o personagem já está na iniciativa.
- Esta integração apenas copia nome e AGI para o rastreador. Não altera PV, SA, BI, condições ou qualquer dado da Ficha do Jogador. O resumo continua sendo uma projeção de leitura restrita ao Mestre.


## Limite definitivo de acesso do Mestre às Fichas

O Painel do Mestre é estritamente de leitura em relação às Fichas dos Jogadores. A projeção do servidor contém somente identificação do Jogador e personagem, PV/SA/BI atuais e máximos, Iniciativa, Defesa e Perícias Passivas (Fortitude, Reflexos, Vontade e Percepção). Não são enviados nível, PV temporários, fase de BI, Redução de Dano, Movimento, condições ou quaisquer outros dados da Ficha. Nenhuma ação do Painel grava alterações na Ficha do Jogador. O resumo é consultado periodicamente (a cada quatro segundos), ao entrar na Mesa e ao retornar à aba.
