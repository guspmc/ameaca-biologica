# Ameaça Biológica · contexto do projeto

PWA para jogar o RPG próprio "Ameaça Biológica". Dono do projeto não programa: o código é escrito aqui e ele testa (PC Windows do Mestre + celulares).

## Regras de trabalho
- **Simples e barato em tokens.** Uma etapa por sessão. Mudanças pequenas e pontuais, sem reescrever arquivos inteiros.
- **Sem dependências** (nem npm, nem CDN). Node.js puro no servidor; JavaScript/HTML/CSS puros no app. Tudo gratuito e funcionando sem internet.
- Textos de tela, comentários e mensagens em **português do Brasil**.
- Regras do jogo: livro **Arquivo do Jogador** (Projeto no claude.ai). Nunca inventar regra: consultar o livro. Modelo de ficha nas duas últimas páginas.
- Teste de verdade o que for possível (servidor, rotas, tela no Chromium). Aqui não há Windows: `iniciar.bat` só o dono testa.

## Decisões já tomadas
- Offline e Local são **o mesmo app**: a pessoa instala, faz login, entra no Laboratório (offline) e, de lá, conecta ao servidor local por endereço/QR Code.
- Servidor local = PC do Mestre. Guarda tudo em JSON (`servidor/dados/`). Tempo real por **SSE** (`/api/eventos`).
- Login: usuário + senha (mínimo 4 caracteres), só para identificar jogadores. Sem segurança real.
- Mesa: 1 Mestre + até 9 Jogadores (o Mestre define o limite ao criar). Quem cria a Mesa é o Mestre. Código aleatório por sessão; QR Code que conecta ao servidor e à Mesa. O Mestre aprova a entrada de jogadores e as fichas, mas **não acessa as fichas**.
- Fichas: até 5 rascunhos e 3 fichas ativas por jogador. Barra superior fixa com PV, SA e BI; barra inferior com atalhos (Identificação, Atributos e Perícias, Combate, Inventário). Modo Manual/Automático para roladores de dados.
- "Online" fica reservado (desativado) para o futuro.

## Estado
- v0.1: servidor, login, Laboratório (status Offline/Local), conexão por endereço, presença em tempo real, manifesto + service worker.
- v0.2: servidor testa portas (3000 a 3010) e avisa a porta real; detecta servidor já aberto; `iniciar.bat` abre o navegador na porta real (`ABRIR_NAVEGADOR=1`); QR Code gerado no servidor (`/api/qr`, sem biblioteca, validado com leitor OpenCV); app acha a porta sozinho quando o jogador não digita; escolha do endereço do QR quando há várias redes.
- v0.3: Mesas. `servidor/mesas.js` (regras) + rotas `/api/mesas*` (auth `Authorization: Bearer <token>`; evento SSE `mesa` só para membros). Cliente em `app/js/mesas.js` (carregado antes de `app.js`; DOM por `h()`, sem innerHTML). Código de 6 caracteres (`ABC-123`), QR da Mesa = `endereço/?mesa=CODIGO` (o app entra sozinho após conectar). Limites: jogadores 2–9, Nível 1–10 (o livro tem 10 Níveis), 5 Mesas por Mestre, 30 por servidor. Painel do Mestre por enquanto: convite/QR, aprovações, jogadores, configurações, encerrar; visão do Jogador: status e lista da Mesa. Testes: `testes/teste-mesas.js` + UI no Chromium (fora do repositório).
- Ainda **não testado pelo dono no Windows**: abertura do navegador pelo `iniciar.bat` na porta real, QR lido por celular de verdade, troca de porta com a 3000 ocupada.

- v0.4: Ficha de Personagem. Regras do livro em `app/js/dados-livro.js` (Origens, Classes, Habilidades, Condições) e `app/js/regras.js` (`normalizar`, `calcular`, `validar`; UMD: o app calcula e o servidor valida com o mesmo código). `servidor/fichas.js` + rotas `/api/mesas/:id/fichas*` e `/api/mesas/:id/solicitacoes-fichas*` (SSE `ficha`). Fichas por Mesa em `dados/fichas.json`, estados rascunho → pendente → ativa; ≤5 rascunhos, ≤3 ativas+pendentes; Nível ≤ limite da Mesa. Ficha Ativa só muda valores de jogo (PV/SA/BI/condições) e inventário. O Mestre só vê nome do jogador e do personagem nos pedidos, nunca o conteúdo. Tela em `app/js/ficha.js` (barra superior PV/SA/BI com +/-, barra inferior de atalhos, rolador Manual/Automático, equipamento inicial A/B/C). Testes: `teste-regras.js`, `teste-fichas.js` + UI no Chromium (fora do repositório).
- O layout da Ficha é desenho próprio (as páginas-modelo do livro são imagens e não puderam ser lidas); ajustar se o dono mandar capturas.
- O **Painel do Mestre** será feito em branch separado (pelo ChatGPT) e conferido antes do merge. Nesta etapa só entrou em `painelDoMestre` (mesas.js) o cartão de aprovação de Fichas; manter isso mínimo.

## Próximas etapas
1. Arsenal: catálogo de armas/itens do livro (hoje o inventário é livre, com Espaços) e cálculo de ataque/dano.
2. Painel do Mestre (branch separado): resumo das Fichas, iniciativa/turnos, documentos, anotações, itens personalizados.
3. Instalação do PWA no modo local (ver "Limitações" no README).

## Como testar (aqui)
- `npm test`: servidor, rotas, presença em tempo real, portas e QR (só Node).
- Tela no Chromium (Playwright) e leitura do QR com OpenCV foram feitas à parte; não ficam no repositório.
- Armadilha já vista: `server.listen(porta, host, callback)` deixa o callback registrado se a porta falhar; use `once('listening')` por tentativa (ver `ouvir` em `server.js`).

## Mapa do código
- `servidor/server.js`: HTTP + SSE + JSON. Rotas: `GET /api/status`, `POST /api/entrar`, `GET /api/eventos?token=`, `GET /api/qr?texto=`, `/api/mesas*` (ver `servidor/mesas.js`). Escolha de porta em `ouvir`.
- `servidor/mesas.js`: regras das Mesas (código, limites, aprovação), guarda em `mesas.json`.
- `app/js/mesas.js`: telas de Mesas (lista, criar, Painel do Mestre, visão do Jogador).
- `app/js/ficha.js`, `app/js/regras.js`, `app/js/dados-livro.js`: Ficha de Personagem (tela, regras, dados do livro). `servidor/fichas.js`: regras e guarda das Fichas.
- `servidor/qr.js`: gerador de QR (byte, correção M, versões 1 a 9).
- `app/js/app.js`: login, estado Offline/Local, conexão, descoberta de porta, QR, renderização.
- `app/sw.js`: cache offline (aumente `VERSAO` ao mudar a lista de arquivos).
- `testes/`: testes do servidor. `ferramentas/gerar-icones.js`: gera `app/icons/*.png`.
