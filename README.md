# Ameaça Biológica · Laboratório

Aplicativo (PWA) para jogar **Ameaça Biológica RPG**: fichas de personagem, Painel do Mestre e Mesas, tudo ligado por um servidor local no computador do Mestre. Gratuito, sem internet e sem bibliotecas externas.

> **Etapa atual (v0.3):** servidor local que escolhe uma porta livre sozinho, login por usuário e senha, Laboratório com status **Offline/Local**, presença em tempo real e **Mesas**: criar (quem cria vira Mestre), código aleatório, entrar por código ou QR Code, aprovação do Mestre e limites de jogadores e de Nível. O Painel do Mestre completo e as Fichas vêm nas próximas etapas.

## Como iniciar o servidor (Windows, computador do Mestre)

1. Instale o [Node.js](https://nodejs.org) (versão LTS), uma vez só.
2. Baixe este projeto (botão verde **Code → Download ZIP**) e extraia numa pasta.
3. Dê **dois cliques em `iniciar.bat`**.
4. Se o Windows perguntar sobre o Firewall, marque **Redes privadas** e permita.
5. O navegador abre o Laboratório. A janela preta mostra os endereços para os jogadores, como `http://192.168.0.10:3000`.

Para encerrar, feche a janela preta.

**Porta:** o servidor usa a 3000. Se ela estiver ocupada por outro programa, usa a 3001, e assim por diante até a 3010, e avisa na janela preta qual ficou valendo. Se você abrir o `iniciar.bat` duas vezes, a segunda janela avisa que o servidor já está ligado e fecha.

## Como os jogadores entram

Com o celular **na mesma rede Wi-Fi** do computador do Mestre, há dois caminhos:

- **QR Code:** no Laboratório do Mestre (conectado ao servidor), aparece o QR Code em "Convidar jogadores". É só escanear com a câmera do celular. Se o computador tiver mais de um endereço de rede, toque em outro endereço da lista quando o celular não abrir.
- **Endereço:** abra no navegador o endereço mostrado na janela preta, ou digite no campo "Servidor local" do Laboratório. Se não digitar a porta, o app procura o servidor entre as portas 3000 e 3010.

Depois de fazer login, o Laboratório mostra **Local**.

## Mesas

1. O Mestre conecta ao servidor, toca em **Criar Mesa** e escolhe nome, máximo de jogadores (2 a 9) e Nível máximo de personagem (1 a 10). Ele cai no **Painel do Mestre**, com o código da Mesa (ex.: `ABC-123`) e um QR Code.
2. O jogador escaneia o QR Code da Mesa (abre o servidor e já pede entrada) ou digita o código em **Entrar em uma Mesa**.
3. O Mestre vê o pedido no Painel e toca em **Aprovar** ou **Recusar**. Quem foi aprovado vê a Mesa em tempo real.
4. O Mestre pode gerar um novo código, mudar os limites, remover jogadores e encerrar a Mesa. O Mestre **não acessa as Fichas** dos jogadores.

## Estrutura

| Pasta | O que tem |
|---|---|
| `app/` | O aplicativo (PWA): telas, estilo, service worker |
| `servidor/` | Servidor Node.js (sem dependências), gerador de QR Code e a pasta `dados/` com o que ele salva |
| `testes/` | Testes automáticos do servidor (`npm test`) |
| `ferramentas/` | Utilitários (ex.: gerar os ícones) |
| `iniciar.bat` | Inicia o servidor no Windows |

## Para quem desenvolve

- `node servidor/server.js` inicia o servidor (porta 3000, ou a de `PORTA=4000`; se ocupada, tenta as 10 seguintes).
- `npm test` roda os testes do servidor.
- Os dados ficam em `servidor/dados/*.json` e não vão para o GitHub.
- Veja `CLAUDE.md` para o contexto do projeto e as decisões já tomadas.

## Limitações conhecidas

- O login só identifica jogadores numa rede local. **Não é segurança**: as senhas ficam em texto simples no servidor.
- Navegadores só permitem instalar um PWA e guardar o app para uso offline em endereço seguro (`https://` ou `localhost`). Abrindo pelo IP do Mestre (`http://192.168...`), o app funciona como página normal, mas não fica instalado. Uma versão instalada a partir de um endereço `https://` não consegue falar com um servidor `http://` da rede local: nesse caso, abra o endereço do servidor direto no navegador. Isso será tratado numa etapa própria.
