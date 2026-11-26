# Painel do Mestre — módulo inicial

Esta branch mantém o desenvolvimento do Painel do Mestre isolado da `main` e do módulo de Fichas.

## Escopo entregue nesta etapa

- Extensão do Painel do Mestre em `app/js/painel-mestre.js`, carregada depois de `mesas.js` e antes de `app.js`.
- API e persistência separadas em `servidor/painel-mestre.js` e `servidor/dados/painel-mestre.json`.
- Primeiro recurso operacional: preparação de combate, participantes, rolagem de Iniciativa, ordem, rodada e avanço de turno.
- Teste unitário em `testes/teste-painel-mestre.js`, incluído em `npm test`.
- Cache do Service Worker atualizado para `ab-lab-v4`.

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
- Anotações persistentes por Mesa.
- Cadastro de documentos narrativos (relatórios, e-mails, bilhetes, arquivos e pistas). Documentos marcados para compartilhar ficam disponíveis aos membros aprovados daquela Mesa por uma rota de leitura que retorna somente os documentos publicados; a publicação avisa os Jogadores conectados em tempo real.
- Cadastro de itens personalizados com categoria, descrição e efeito.
- Conteúdo persistido em arquivo separado (painel-mestre-conteudo.json), com autorização exclusiva do Mestre para criar, editar e excluir. Jogadores recebem somente os documentos publicados; não recebem anotações, encontros privados ou itens em preparação.
- Ao encerrar a Mesa, os dados desse módulo também são apagados.

## Referências de regras e limites

- Arquivo do Mestre v1.0, p. 21: categorias de ameaça (Comum 1, Perigosa 2, Elite 4, Chefe 8; Perseguidor especial), orçamento para quatro personagens por faixa de nível e ajuste aproximado de 25% por personagem.
- Arquivo do Mestre v1.0, pp. 62–67: encontros errantes, adaptação à ambientação, estado do grupo e encontros prontos.
- Arquivo do Jogador v1.0, p. 43: Teste Passivo = 10 + valor da Perícia; vantagem +5 e desvantagem -5.
- Arquivo do Mestre v1.0, apêndice, p. 70: resumo das condições e lembrete de que durações de fontes diferentes podem ser acompanhadas separadamente.

Ainda pendente:
- Integrar PV, SA, BI e perícias passivas aos dados autorizados da Ficha Ativa, assim que o modelo de dados da Ficha estiver estável na main. Até lá, o Painel não lê fichas privadas nem inventa uma segunda fonte de verdade.
- Evoluir o acompanhamento de condições: já é possível aplicar/remover condições por participante e registrar duração/observação; o painel impede duplicar a mesma condição no mesmo participante, mas a redução automática de duração ao avançar turnos ainda não foi implementada.
- Transformar itens criados em objetos distribuíveis às Fichas, respeitando as permissões da Mesa.
- Testes de integração ponta a ponta no servidor e navegador. Os testes unitários estão adicionados à suíte, mas ainda precisam ser executados em um checkout funcional.