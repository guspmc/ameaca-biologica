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

## Próximas etapas
1. QR Code do servidor (gerado no servidor, sem biblioteca) e tela de conexão.
2. Mesas: criar (vira Mestre), código, entrar, aprovação do Mestre.
3. Painel do Mestre.
4. Ficha de Personagem (a partir do livro).
5. Instalação do PWA no modo local (ver "Limitações" no README).

## Mapa do código
- `servidor/server.js`: HTTP + SSE + JSON. Rotas: `GET /api/status`, `POST /api/entrar`, `GET /api/eventos?token=`.
- `app/js/app.js`: login, estado Offline/Local, conexão, renderização.
- `app/sw.js`: cache offline (aumente `VERSAO` ao mudar a lista de arquivos).
- `ferramentas/gerar-icones.js`: gera `app/icons/*.png`.
