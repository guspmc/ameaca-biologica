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
- Ordem: maior resultado primeiro; empate é resolvido por AGI, depois pelo resultado natural do d20; persistindo, os empatados rolam novamente.
- Participante que entra em combate já iniciado vai ao final da ordem.
- Próximo turno percorre a ordem e aumenta a rodada ao retornar ao primeiro participante.

## Limites conhecidos desta etapa

- A Ficha de Personagem ainda está sendo desenvolvida por Claude. Por isso, os participantes são cadastrados manualmente nesta primeira versão; não há leitura de PV/SA/BI nem acesso do Mestre às fichas privadas.
- Para Personagens, o bônus de Iniciativa acompanha a AGI; para Criaturas, o bônus é informado conforme a ficha da Criatura. A AGI fica disponível para desempate.
- A rolagem automática usa o gerador aleatório do navegador; o resultado pode ser corrigido manualmente.
- As alterações são avisadas ao Mestre pelo evento SSE da Mesa; uma consulta periódica de segurança atualiza a tela caso algum evento se perca.
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
- Aplicação por participante com registro individual de duração/término e observações. Condições personalizadas continuam permitidas.
- A interface usa campos no próprio painel (sem caixas de diálogo do navegador), com nome manual exibido somente quando essa opção é selecionada.
- Instâncias repetidas da mesma condição podem ter suas durações acompanhadas separadamente, mas seus efeitos mecânicos não se acumulam, conforme a regra de Acúmulo de Condições na p. 81.
- A duração não é decrementada automaticamente ao avançar turnos. Corrosão e Queimadura, por exemplo, exigem testes no início do turno e dano ao final; outras condições dependem da fonte que as aplicou. O Mestre registra manualmente o término para evitar automações que contrariem esses gatilhos.

## Encontros preparados

Os encontros salvos podem ser editados individualmente: nome, nível, quantidade de personagens, intensidade, pontos, orçamento, composição, cenário e direção/comportamento. A edição preserva o identificador do encontro e valida os campos numéricos antes de salvar. A exclusão exige confirmação.

## Gerenciamento de condições

O Painel oferece catálogo das 20 condições oficiais das pp. 81–83 do Arquivo do Jogador, consulta rápida de efeitos e duração/remoção, cadastro manual e campos diretos para duração/momento de término e observações. Cada aplicação mantém sua própria duração e observação. O Mestre pode editar esses dois campos depois da aplicação ou remover a condição. A ferramenta não decrementa automaticamente os prazos, pois os gatilhos dependem da condição e da fonte.

## Referências de regras e limites

- Arquivo do Mestre v1.0, p. 21: categorias de ameaça (Comum 1, Perigosa 2, Elite 4, Chefe 8; Perseguidor especial), orçamento para quatro personagens por faixa de nível e ajuste aproximado de 25% por personagem.
- Arquivo do Mestre v1.0, pp. 62–67: encontros errantes, adaptação à ambientação, estado do grupo e encontros prontos.
- Arquivo do Jogador v1.0, p. 43: Teste Passivo = 10 + valor da Perícia; vantagem +5 e desvantagem -5.
- Arquivo do Mestre v1.0, apêndice, p. 70: resumo das condições e lembrete de que durações de fontes diferentes podem ser acompanhadas separadamente.

Ainda pendente:
- Integrar PV, SA, BI e perícias passivas aos dados autorizados da Ficha Ativa, assim que o modelo de dados da Ficha estiver estável na main. Até lá, o Painel não lê fichas privadas nem inventa uma segunda fonte de verdade.

- Transformar itens criados em objetos distribuíveis às Fichas, respeitando as permissões da Mesa.
- Testes HTTP de integração para autenticação, aprovação de Jogadores e filtragem das publicações adicionados à suíte; acompanhar o resultado do CI antes de considerar a etapa validada.
### Contrato planejado para o resumo das Fichas

A integração com a Ficha deve fornecer ao Painel uma projeção de sessão, nunca o objeto completo da Ficha. Campos previstos:
- Identificador da Ficha Ativa aprovada e nome do personagem;
- PV atual/máximo, SA atual/máximo e BI atual/máxima;
- Nível do personagem;
- Percepção, Fortitude, Reflexos e Vontade passivas, calculadas pelas regras do livro (10 + valor da Perícia, com ajuste de +5/-5 quando houver Vantagem/Desvantagem aplicável);
- estado de condições que o Jogador e o Mestre precisam acompanhar durante a cena.

Essa projeção deve ser atualizada quando a Ficha mudar e ser limitada aos personagens aprovados na Mesa. O Painel não deve receber atributos completos, inventário, histórico, anotações privadas ou campos que não sejam necessários à condução da sessão. O formato definitivo será ajustado após a revisão da implementação de Fichas na main, para não criar um contrato incompatível com o trabalho paralelo.