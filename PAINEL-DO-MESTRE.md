# Painel do Mestre — módulo inicial

Esta branch mantém o desenvolvimento do Painel do Mestre isolado da `main` e do módulo de Fichas.

## Escopo entregue nesta etapa

- Extensão do Painel do Mestre em `app/js/painel-mestre.js`, carregada depois de `mesas.js` e antes de `app.js`.
- API e persistência separadas em `servidor/painel-mestre.js` e `servidor/dados/painel-mestre.json`.
- Primeiro recurso operacional: preparação de combate, participantes, rolagem de Iniciativa, ordem, rodada e avanço de turno.
- Teste unitário em `testes/teste-painel-mestre.js`, incluído em `npm test`.
- Cache do Service Worker atualizado para `ab-lab-v3`.

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
- O painel consulta o estado salvo periodicamente para refletir mudanças entre aparelhos. A integração por evento em tempo real pode ser refinada depois.
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
