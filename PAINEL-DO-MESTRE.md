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
- Participante que entra em combate já iniciado vai ao final da ordem; o servidor determina essa condição com base no estado do combate, sem confiar no indicador enviado pelo navegador.
- Próximo turno percorre a ordem e aumenta a rodada ao retornar ao primeiro participante.

## Limites conhecidos desta etapa

- A integração com as Fichas Ativas depende dos módulos oficiais mantidos na `main` do Claude. Nesta branch, a projeção operacional restrita e a interface para adicionar Fichas à iniciativa estão implementadas; a rota responde HTTP 503 enquanto as dependências oficiais não estiverem disponíveis. Participantes também podem ser cadastrados manualmente.
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

O Painel oferece catálogo das 20 condições oficiais das pp. 81–83 do Arquivo do Jogador, consulta rápida de efeitos e duração/remoção, com indicação da página de referência, cadastro manual e campos diretos para registrar o término específico daquela aplicação e observações. A orientação geral do livro permanece separada do registro de duração da instância, evitando que um texto de regra seja confundido com um prazo já definido para aquela criatura. Cada aplicação mantém sua própria duração e observação. O Mestre pode editar esses dois campos depois da aplicação ou remover a condição. A ferramenta não decrementa automaticamente os prazos, pois os gatilhos dependem da condição e da fonte. Para participantes vinculados a Fichas de Personagem, esse registro permanece no estado de combate e não altera `jogo.condicoes` da Ficha. A projeção operacional do Mestre também não expõe condições da Ficha. A sincronização entre esses dois registros depende de uma decisão de fluxo que preserve a autonomia do Jogador; não será feita por escrita direta do Mestre na Ficha.

## Efeitos de Personagem e funcionamento offline

- Os registros aplicados pelo Mestre passaram a distinguir **condições** de **efeitos de progressão**, mantendo ambos no estado operacional do combate. O primeiro efeito de progressão cadastrado é Nível Negativo por Morte; no Nível 1, há também o registro específico da penalidade de −2 em Testes de Atributo, Perícia e Ataque até subir de Nível, conforme Arquivo do Jogador, p. 101.
- A aplicação é imediata no Painel e não depende de confirmação ou resposta da Ficha. Cada registro possui identificador próprio e metadados de notificação separados do efeito mecânico.
- O estado do combate é guardado localmente no navegador quando o servidor fica indisponível. Ao reconectar, o Painel tenta sincronizar o snapshot usando o controle otimista de versão existente. Se o servidor indicar conflito (409), a cópia local é preservada e o Mestre precisa decidir como recuperar; ela não sobrescreve silenciosamente uma versão mais recente.
- A persistência offline cobre o aparelho do Mestre. Sem rede local ou outro canal de comunicação, não existe entrega instantânea para dispositivos dos Jogadores; a entrega fica pendente até que haja conectividade e integração do destinatário.
- **Integração pendente com a Ficha do Jogador:** esta branch registra e persiste os efeitos e a intenção de notificar, mas não escreve na Ficha nem implementa ainda a caixa de entrada/acknowledgment do Jogador. Essa etapa exige contrato de eventos e consulta de notificações com a main do Claude, preservando a regra de que o Mestre nunca acessa a Ficha completa.

## Referências de regras e limites

- Arquivo do Mestre v1.0, p. 21: categorias de ameaça (Comum 1, Perigosa 2, Elite 4, Chefe 8; Perseguidor especial), orçamento para quatro personagens por faixa de nível e ajuste aproximado de 25% por personagem.
- Arquivo do Mestre v1.0, pp. 62–67: encontros errantes, adaptação à ambientação, estado do grupo e encontros prontos.
- Arquivo do Jogador v1.0, p. 43: Teste Passivo = 10 + valor da Perícia; vantagem +5 e desvantagem -5.
- Arquivo do Mestre v1.0, apêndice, p. 70: resumo das condições e lembrete de que durações de fontes diferentes podem ser acompanhadas separadamente.

## Situação das integrações

- **Resumo operacional:** a projeção e a rota estão implementadas nesta branch, com acesso restrito ao Mestre e campos permitidos. A execução real depende dos módulos oficiais de Ficha/Regras da `main`; enquanto as branches estiverem separadas, a rota responde 503 de forma explícita.
- **Itens publicados no inventário:** a publicação e o catálogo de leitura estão implementados no Painel. A ação do Jogador para copiar um item à própria Ficha depende da API e da interface da Ficha da `main`; o contrato e os critérios de aceite estão detalhados ao final deste documento.
- **Testes HTTP:** os testes de autenticação, aprovação e filtragem estão na suíte desta branch. A validação multiplayer real continua sendo uma etapa pós-merge, não algo que a suíte unitária substitui.
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


## Concorrência entre sessões no conteúdo do Mestre

- O conteúdo da Mesa possui versão numérica incrementada a cada gravação aceita.
- O navegador envia a versão carregada em cada alteração. Se outra aba ou aparelho gravar primeiro, o servidor responde HTTP 409 e não sobrescreve a versão mais recente.
- A interface preserva a edição local e oferece uma ação explícita, com confirmação, para descartar a cópia local e carregar a versão do servidor.
- Atualizações remotas recebidas enquanto um campo do Painel de conteúdo está em foco não substituem o texto em edição; a interface informa que há uma versão remota e permite decidir como recuperá-la.
- Conteúdos antigos sem versão são lidos como versão 0 e recebem uma versão na primeira gravação feita pelo cliente atualizado.


## Projeção operacional de Fichas (preparação para integração)

O módulo `servidor/painel-mestre-fichas.js` prepara uma projeção restrita para o Painel:
- somente Fichas no estado `ativa`;
- somente fichas de jogadores que continuam aprovados na Mesa;
- somente o Mestre daquela Mesa pode consultar;
- lista explícita de campos permitidos: identificação (jogador e personagem), PV/SA/BI atuais e máximos, Iniciativa, Defesa e Perícias Passivas (Percepção, Fortitude, Reflexos e Vontade);
- não retorna atributos, perícias, habilidades, conceito, história, inventário ou anotações.

A projeção está ligada à rota HTTP e à interface do Painel. O servidor consulta `fichas.json` em leitura e usa `REGRAS.calcular` da implementação oficial; não altera nem duplica o módulo `servidor/fichas.js`. O catálogo de condições do Painel permanece independente e completo, conforme as pp. 81–83 do Arquivo do Jogador. O resumo é atualizado ao entrar na Mesa, ao retornar à aba e junto da atualização periódica do Painel.


## Resumo operacional das Fichas no Painel

- A rota `GET /api/painel-mestre/:mesaId/fichas` exige sessão válida e valida que o solicitante é o Mestre da Mesa.
- A projeção inclui somente Fichas `ativa` de jogadores ainda aprovados na Mesa.
- A interface apresenta identificação, PV/SA/BI atuais e máximos, Iniciativa, Defesa e Perícias Passivas (Fortitude, Reflexos, Vontade e Percepção). Ao adicionar uma Ficha Ativa à iniciativa, o participante mantém apenas o identificador da Ficha como referência; o rastreador exibe PV/SA/BI e Defesa a partir da projeção operacional atualizada, sem copiar nem alterar a Ficha.
- O Mestre não recebe atributos, perícias completas, habilidades, conceito, história, inventário ou anotações da Ficha.
- A integração lê o arquivo persistido de Fichas e injeta o cálculo oficial de `REGRAS`; não modifica os dados da Ficha.
- Até o merge com a implementação de Fichas da `main`, a rota responde HTTP 503 quando as dependências oficiais ainda não estão disponíveis nesta branch isolada.


## Quarta etapa — catálogo de itens e arquivos narrativos

- O conteúdo do Mestre agora possui navegação por abas: **Itens personalizados**, **Documentações / Files** e **Encontros e anotações**.
- Itens personalizados aceitam nome, categoria, descrição, efeito/regra e URL de imagem. O Mestre visualiza uma prévia ao preencher a URL; itens publicados exibem a imagem aos Jogadores junto da descrição e do efeito.
- Documentos narrativos aceitam título, tipo, texto e link opcional para um arquivo anexo (PDF, imagem ou outro arquivo hospedado). O Mestre pode manter o documento privado ou publicá-lo para a Mesa; os Jogadores recebem o texto e o link somente quando publicado.
- URLs de imagens e anexos são validadas no servidor para aceitar apenas HTTP/HTTPS. Links externos abrem em nova aba com proteção `noopener noreferrer`.
- O Mestre pode enviar anexos diretamente do dispositivo: PDF, PNG, JPG/JPEG, WEBP e TXT, até 10 MB por arquivo. Os arquivos são armazenados em diretório separado por Mesa, com nome aleatório, validação de extensão/MIME/assinatura, e são apagados quando a Mesa é encerrada.
- O envio está disponível no formulário de documentos narrativos e no formulário de imagem dos itens personalizados. O Mestre pode continuar usando URLs externas HTTP/HTTPS.
- A leitura dos anexos exige sessão válida e participação aprovada na Mesa. Para Jogadores, o servidor só entrega o arquivo se a URL estiver vinculada a um documento ou imagem de item publicado; anexos privados permanecem inacessíveis.
- A aba de Encontros reúne o criador, encontros preparados e anotações; as outras duas abas isolam seus respectivos formulários e listas.
- Testes do módulo verificam a publicação dos campos de mídia e a rejeição de esquemas de URL inseguros.


## Quinta etapa — Bestiário e preparação integrada de combate

- Catálogo de 22 B.O.Ws. transcritas do Arquivo do Mestre v1.0, pp. 28–49: categoria e pontos de ameaça, função, tamanho, PV, Defesa, Movimento, Atributos, Iniciativa, resistências, ataques e traços.
- A aba **Bestiário** permite pesquisar por nome, categoria, função ou tamanho e expandir cada ficha para consulta.
- O sorteador de encontros usa os IDs do catálogo, em vez de guardar apenas nomes em texto. Mantém as categorias e pontuações do livro: Comum 1, Perigosa 2, Elite 4 e Chefe 8. O sorteio automático exclui Chefes e Perseguidores; a montagem manual permite incluí-los conforme as regras específicas.
- Encontros preparados guardam a composição estruturada (ID da criatura e quantidade). O Mestre pode usar **Preparar combate** para enviar a composição diretamente à ordem de iniciativa.
- Ao selecionar uma criatura do Bestiário na preparação de iniciativa, o Painel preenche AGI e o valor de Iniciativa da ficha. Também registra PV atuais/máximos, Defesa e Movimento para acompanhamento durante o combate.
- O PV atual da criatura pode ser atualizado no rastreador sem alterar os valores originais do Bestiário. A ficha-base do catálogo permanece intacta.
- A composição do encontro e os dados operacionais do combate continuam privados do Mestre. O Bestiário é carregado no fluxo do Painel do Mestre e incluído no cache do PWA para consulta local.
- Testes verificam a integridade estrutural das 22 fichas, pontuação por categoria, persistência de PV no combate e validação da composição de encontros.

### Regras de referência

- Arquivo do Mestre v1.0, p. 14: para Criaturas, Iniciativa = 1d20 + Iniciativa indicada na ficha; Fortitude, Reflexos, Vontade e Percepção já são valores totais prontos para uso.
- Arquivo do Mestre v1.0, p. 21: categorias, pontos, orçamento para quatro Personagens e ajuste aproximado de 25% por personagem acima/abaixo de quatro.
- Arquivo do Mestre v1.0, pp. 28–49: catálogo de B.O.Ws. incluído nesta etapa.
- Arquivo do Mestre v1.0, pp. 50–55: regras específicas dos Perseguidores, integradas na sexta etapa abaixo.


## Sexta etapa — Perseguidores e montagem manual de encontros

- O Bestiário agora contém duas fichas especiais de Perseguidor: Tirano (T-103) e Nemesis T-Type, com os valores de PV de Perseguição, Defesa, Movimento, Atributos, Iniciativa, resistências, ataques e traços das pp. 54–55 do Arquivo do Mestre.
- Perseguidores aparecem na aba do Bestiário, mas não recebem pontuação comum e não são incluídos no sorteio automático. Isso preserva a orientação da p. 22: Perseguidores entram pelo sistema próprio de Som e perseguição, não pela tabela de encontros errantes.
- O criador de encontros agora permite montagem manual: adicionar/remover linhas, selecionar qualquer criatura do catálogo e definir quantidade de 1 a 20. Chefes podem ser incluídos manualmente e contam com seus 8 pontos por unidade. Perseguidores podem ser adicionados, mas não consomem pontos do orçamento comum.
- A composição manual apresenta o total de pontos e compara com o orçamento da Mesa, sinalizando quando há Perseguidores fora do orçamento.
- Ao preparar um encontro, os Perseguidores entram na iniciativa com seus PV de Perseguição. O rastreador identifica a fase e mostra as restrições da p. 52: durante a Fase de Perseguição, não podem sofrer Morte Instantânea normalmente nem ficam Vulneráveis; um efeito direto de Morte Instantânea reduz os PV de Perseguição a 0.
- Regra de 0 PV (Arquivo do Jogador, p. 99): ao chegar a 0 PV de Perseguição, o rastreador rola 1d4 rodadas de Atordoamento, bloqueia novos ajustes de PV durante esse período e reduz a contagem ao fechar cada rodada completa posterior. Quando o Perseguidor volta a agir, recupera integralmente os PV de Perseguição. O contador e o estado de retorno são persistidos no servidor.
- O Mestre pode declarar **Forma de Combate** no rastreador quando a decisão narrativa indicar o fim da perseguição ou um confronto destinado a derrotar, destruir ou fazer a criatura avançar de forma. O sistema passa aos PV da ficha normal correspondente presente no catálogo (Tirano T-103 Forma II ou Nemesis T-Type Forma II), exige confirmação, reinicia os PV para o máximo da ficha de combate e encerra o Atordoamento exclusivo da Fase de Perseguição. A transição é manual, conforme a decisão narrativa do Mestre; não é necessário aguardar o fim do Atordoamento.
- As fichas de Perseguidor preservam os dados da fase de perseguição separadamente dos PV da forma de combate. As regras de fases posteriores e eventuais adaptações narrativas continuam sob controle do Mestre; não foram automatizadas.
- Testes cobrem a presença das duas fichas, seus PV de perseguição e a persistência da fase no estado de combate.
- Correção de regressão: o catálogo auxiliar do sorteador agora preserva `categoria` com o mesmo nome usado pelo filtro, garantindo que Chefes e Perseguidores realmente fiquem fora do sorteio automático. O teste do Bestiário inclui uma verificação específica para isso.

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
- O participante mantém somente o identificador da Ficha como referência estável. PV/SA/BI e Defesa são exibidos no rastreador por meio da projeção operacional atualizada, sem copiar esses valores para o estado do combate.
- Se o combate já estiver em andamento, o personagem entra como participante tardio, permanecendo no fim da ordem atual.
- A ação impede nomes duplicados e respeita o limite de 30 participantes. Depois de adicionado, o cartão da Ficha informa que o personagem já está na iniciativa.
- Nenhuma ação do Painel altera a Ficha do Jogador. O resumo continua sendo uma projeção de leitura restrita ao Mestre.


## Limite definitivo de acesso do Mestre às Fichas

O Painel do Mestre é estritamente de leitura em relação às Fichas dos Jogadores. A projeção do servidor contém somente identificação do Jogador e personagem, PV/SA/BI atuais e máximos, Iniciativa, Defesa e Perícias Passivas (Fortitude, Reflexos, Vontade e Percepção). Não são enviados nível, PV temporários, fase de BI, Redução de Dano, Movimento, condições ou quaisquer outros dados da Ficha. Nenhuma ação do Painel grava alterações na Ficha do Jogador. O resumo é consultado periodicamente (a cada quatro segundos), ao entrar na Mesa e ao retornar à aba.


## Sétima etapa — upload de arquivos do dispositivo

- Novo módulo isolado `servidor/arquivos-mestre.js`, com armazenamento em `servidor/dados/arquivos-mesas/<mesaId>/`.
- Upload binário autenticado, exclusivo do Mestre, com limite de 10 MB por arquivo.
- Formatos permitidos: PDF, PNG, JPG/JPEG, WEBP e TXT. O servidor valida extensão, MIME declarado e assinatura básica do conteúdo; nomes originais são sanitizados e os nomes físicos são UUIDs.
- Anexos de documentos e imagens de itens podem ser enviados pelo formulário correspondente. O formulário preenche automaticamente a URL interna do arquivo.
- A leitura exige sessão e vínculo com a Mesa. Jogadores aprovados só acessam arquivos vinculados a documentos ou imagens de itens publicados; arquivos privados não são expostos. Ao encerrar a Mesa, seu diretório de anexos é removido.
- Testes unitários cobrem upload, leitura, isolamento entre Mesas, rejeição de caminhos inválidos, tipos não permitidos, arquivos vazios/grandes e limpeza.

## Integração com a main do Claude — revisão de 28/11/2026

A main avançou até a versão 0.8.0 (Fichas, Arsenal, tema Dossiê, evolução de nível e Fichas Offline). A branch do Painel permanece independente; não foi feito merge nem rebase. A contagem de commits à frente/atrás deve ser conferida diretamente na comparação do GitHub, pois muda a cada atualização.

1. **Atualização do resumo de Fichas:** a main emite o evento SSE `ficha` com payload `{ mesaId, fichaId }` nas operações que retornam `avisar`, como solicitar/aprovar Ficha. A rotina `salvar()` ainda não retorna `avisar`, então alterações de PV/SA/BI/inventário não disparam SSE até o Claude incluir o Mestre e os Jogadores aprovados no retorno após gravar. O listener desta branch aceita `{ mesaId, fichaId }` e o legado `{ id }`; a consulta periódica de quatro segundos permanece como contingência.
2. **Resumo operacional:** o módulo `servidor/painel-mestre-fichas.js` é compatível com a estrutura `{ mesaId: { fichaId: ficha } }`, com a lista de aprovados de `mesas.info()` e com os campos calculados por `REGRAS.calcular()`. Confirmei que a main atual fornece essa estrutura, que `mesas.info()` retorna `mestre` e `aprovados`, e que `REGRAS.calcular()` fornece PV/SA/BI atuais e máximos, Defesa, Iniciativa e Perícias Passivas. A rota protegida do Painel continua retornando somente a projeção permitida; nunca a Ficha completa. A branch isolada ainda não contém `mesas.info()` nem os módulos oficiais, portanto a rota de resumo permanece indisponível até a integração.
3. **Itens publicados e inventário:** os itens publicados são disponibilizados como catálogo da Mesa. A inclusão no inventário pessoal precisa ser iniciada e confirmada pelo Jogador, por meio da API da Ficha. O Mestre não pode inserir, alterar ou remover itens diretamente na Ficha.
4. **Integração de arquivos compartilhados:** o merge deverá combinar cuidadosamente `servidor/server.js` (rotas de Fichas da main + rotas do Painel e uploads desta branch), `app/index.html` (arquivos da Ficha/tema + scripts do Painel e o stylesheet `tema-dossie.css`), `app/sw.js` (listas de cache das duas frentes e uma versão nova), `app/css/estilo.css` e `package.json` (versão e todos os testes). Preservar também os novos módulos `dados-livro.js`, `dados-arsenal.js`, `regras.js`, `ficha.js`, `arsenal-ui.js` e `fichas-offline.js` da main. Não substituir um lado pelo outro.
5. **Validação final:** depois da integração, testar login, Mesa, aprovação de Ficha, resumo restrito, atualização SSE, iniciativa, conteúdo publicado, upload/leitura de anexos e funcionamento offline. Esta branch não altera os módulos de Ficha pertencentes ao Claude.

## Plano de fechamento — resumo de Fichas, itens e testes multiplayer

### 1. Resumo operacional das Fichas — integração pendente na main

A projeção do Painel já foi testada com mais de um Jogador e filtra Fichas por estado Ativa e vínculo aprovado à Mesa. A resposta permanece limitada a identificação, PV/SA/BI atuais e máximos, Defesa, Iniciativa e quatro perícias passivas.

**Ajuste necessário no módulo do Claude (servidor/fichas.js):**
- Em salvar(mesaId, usuario, fichaId, dadosEntrada), depois de gravar com sucesso, retornar também avisar com o Mestre e os Jogadores aprovados da Mesa.
- A lista deve ser construída como [info.mestre, ...info.aprovados] (ou equivalente), e não usar indiscriminadamente todos os membros se houver Jogadores pendentes.
- O servidor já transforma avisar em evento SSE ficha com payload { mesaId, fichaId }; o listener do Painel já aceita esse formato.
- Emitir o evento somente depois de a gravação ter sido concluída. Falhas de validação, autorização ou persistência não devem disparar atualização.
- Manter a consulta periódica de quatro segundos como recuperação caso um cliente perca o evento.

**Critério de aceite:** ao alterar PV, SA, BI ou inventário em uma Ficha Ativa, o Mestre vê o resumo atualizado sem recarregar a página; outro Jogador aprovado não recebe conteúdo de Ficha alheia; Jogador pendente e usuário externo não recebem a projeção.

### 2. Fluxo proposto para itens publicados

O catálogo público já entrega apenas itens marcados como visíveis. Hoje o Jogador consegue consultar os itens, mas não existe uma ação para incorporá-los ao inventário.

**Fluxo recomendado:**
1. O Mestre cria o item e o publica. Publicar significa disponibilizá-lo no catálogo da Mesa, não inseri-lo automaticamente em nenhuma Ficha.
2. O Jogador abre o catálogo e escolhe **Adicionar à minha Ficha**.
3. O Jogador escolhe uma de suas Fichas Ativas. A ação é iniciada pelo próprio Jogador e nunca pelo Mestre.
4. O servidor valida sessão, aprovação na Mesa, propriedade da Ficha, estado Ativa e publicação atual do item naquela Mesa.
5. O servidor copia um retrato dos dados do item para o inventário da Ficha escolhida. Alterações futuras no catálogo não devem sobrescrever silenciosamente o item já recebido.
6. A inclusão respeita o limite de itens da Ficha e os espaços de inventário. Se não houver espaço ou capacidade, a operação é recusada com mensagem clara; não descartar nem substituir outro item.
7. A Ficha é salva pelo fluxo normal do Jogador; o Mestre recebe somente a atualização da projeção permitida.

**Contrato técnico a combinar com o Claude:**
- Criar uma ação autenticada de Jogador, por exemplo POST /api/mesas/:mesaId/fichas/:fichaId/itens-publicados/:itemId.
- A API deve localizar o item na lista atualmente publicada daquela Mesa; não aceitar do cliente nome, efeito, espaços ou outros dados livres como fonte confiável.
- O inventário atual normaliza os campos nome, espacos, nota, ref, mun, pecas e equip. Para preservar a origem e os detalhes de itens personalizados sem truncar informação, avaliar com o Claude a inclusão de metadados próprios, como origemMesaItemId, descricao e efeito, no normalizador e na interface da Ficha.
- Definir o custo em espaços do item no cadastro do Mestre (sugestão inicial: 1 espaço por padrão, editável pelo Mestre antes de publicar).
- Permitir cópias adicionais quando desejado, mas impedir que uma repetição acidental da mesma requisição gere duplicação involuntária.
- Ao retirar a publicação, impedir novas inclusões; não apagar itens que Jogadores já receberam.
- O Mestre não pode consultar nem alterar o inventário completo dos Jogadores. O resumo operacional não deve ganhar novos campos por causa desta função.

**Critérios de aceite:** Jogador A consegue adicionar um item à própria Ficha; Jogador B não consegue adicionar à Ficha de A; Mestre recebe 403 ao tentar executar a ação; item privado ou despublicado não pode ser adicionado; tentativa acima do limite de inventário não altera a Ficha; o item já recebido permanece mesmo se o Mestre retirar a publicação.

### 3. Roteiro de teste multiplayer — Mestre + dois Jogadores

Executar após a integração da main, em três sessões distintas (idealmente três aparelhos ou dois aparelhos e um navegador separado):

- [ ] Mestre cria uma Mesa com limite para dois Jogadores.
- [ ] Jogador A e Jogador B entram usando o código/QR; ambos aparecem como pendentes.
- [ ] Mestre aprova A e B; ambos passam a acessar as publicações.
- [ ] Jogador C solicita entrada e permanece pendente; não acessa documentos, itens nem resumo operacional.
- [ ] A e B criam, submetem e têm suas Fichas aprovadas; Mestre vê apenas a projeção permitida das duas Fichas Ativas.
- [ ] Conferir que rascunhos, Fichas pendentes e Fichas de usuários não aprovados não aparecem no resumo.
- [ ] A altera PV; Mestre recebe a atualização SSE. Repetir com SA, BI e inventário.
- [ ] A e B abrem o Painel ao mesmo tempo; ambos recebem as atualizações sem precisar recarregar.
- [ ] Mestre adiciona A e B à iniciativa; a ordem, turnos e rodada são sincronizados entre as sessões do Mestre (em outro aparelho do mesmo usuário, se aplicável).
- [ ] Mestre publica um documento e um item; A e B recebem o catálogo atualizado. C continua sem acesso.
- [ ] A adiciona o item à própria Ficha; verificar que B não recebeu cópia e que o Mestre não editou a Ficha.
- [ ] Tentar acesso cruzado por API: A tenta ler/salvar Ficha de B; Mestre tenta ler conteúdo completo ou salvar Ficha; C tenta ler publicação. Todas as operações indevidas devem ser recusadas.
- [ ] Testar upload privado e publicado: Jogadores aprovados só abrem anexos efetivamente publicados; C não abre anexos.
- [ ] Desconectar e reconectar um Jogador; confirmar recuperação de estado e atualização do resumo.
- [ ] Encerrar a Mesa; confirmar limpeza dos dados operacionais e dos anexos da Mesa.

Registrar para cada teste: aparelho/navegador, usuário, ação, resultado esperado, resultado observado e eventual evidência. Os testes automatizados existentes não substituem esta validação real com múltiplas sessões.

### 4. Novos recursos — backlog sugerido

Prioridade sugerida, sem alterar as regras do livro nem ampliar o acesso do Mestre às Fichas:

**Prioridade alta**
- **Registro da sessão:** linha do tempo privada do Mestre com eventos, decisões e acontecimentos importantes.
- **Objetivos e pistas:** cartões com título, descrição, status (não descoberto, descoberto, resolvido) e visibilidade privada/compartilhada.
- **Controle de cenas:** cena atual, local, objetivo e notas rápidas para conduzir a narrativa.

**Prioridade média**
- **Biblioteca de NPCs:** personagens não jogadores com descrição, papel narrativo, imagem e notas privadas.
- **Diário de combate:** histórico de rodadas, participantes, mudanças de turno e condições administradas no rastreador.
- **Modelos de documentos:** duplicar documentos e encontros preparados entre sessões da mesma Mesa.

**Prioridade futura**
- **Resumo de encerramento:** montar um relatório da sessão a partir das anotações e eventos registrados.
- **Exportação/importação dos dados do Mestre:** backup separado das Fichas dos Jogadores, com restauração por Mesa.

Qualquer recurso futuro que envolva recursos ou dados das Fichas deve continuar estritamente de leitura e limitado à projeção operacional já aprovada pelo usuário.
