# Ameaça Biológica · Laboratório

Aplicativo (PWA) para jogar **Ameaça Biológica RPG**: fichas de personagem, Painel do Mestre e Mesas, tudo ligado por um servidor local no computador do Mestre. Gratuito, sem internet e sem bibliotecas externas.

> **Etapa atual (v0.1):** servidor local, login por usuário e senha, tela do Laboratório com status **Offline/Local**, conexão por endereço e presença em tempo real. Mesas, Painel do Mestre e Fichas vêm nas próximas etapas.

## Como iniciar o servidor (Windows, computador do Mestre)

1. Instale o [Node.js](https://nodejs.org) (versão LTS), uma vez só.
2. Baixe este projeto (botão verde **Code → Download ZIP**) e extraia numa pasta.
3. Dê **dois cliques em `iniciar.bat`**.
4. Se o Windows perguntar sobre o Firewall, marque **Redes privadas** e permita.
5. O navegador abre o Laboratório. A janela preta mostra os endereços para os jogadores, como `http://192.168.0.10:3000`.

Para encerrar, feche a janela preta.

## Como os jogadores entram

Com o celular **na mesma rede Wi-Fi** do computador do Mestre, abra no navegador o endereço mostrado na janela preta. Faça login e o Laboratório mostra **Local**. Também funciona digitando o endereço no campo "Servidor local".

## Estrutura

| Pasta | O que tem |
|---|---|
| `app/` | O aplicativo (PWA): telas, estilo, service worker |
| `servidor/` | Servidor Node.js (sem dependências) e a pasta `dados/` com o que ele salva |
| `ferramentas/` | Utilitários (ex.: gerar os ícones) |
| `iniciar.bat` | Inicia o servidor no Windows |

## Para quem desenvolve

- `node servidor/server.js` inicia o servidor (porta 3000, ou a de `PORTA=3001`).
- Os dados ficam em `servidor/dados/*.json` e não vão para o GitHub.
- Veja `CLAUDE.md` para o contexto do projeto e as decisões já tomadas.

## Limitações conhecidas

- O login só identifica jogadores numa rede local. **Não é segurança**: as senhas ficam em texto simples no servidor.
- Navegadores só permitem instalar um PWA e guardar o app para uso offline em endereço seguro (`https://` ou `localhost`). Abrindo pelo IP do Mestre (`http://192.168...`), o app funciona como página normal, mas não fica instalado. Uma versão instalada a partir de um endereço `https://` não consegue falar com um servidor `http://` da rede local: nesse caso, abra o endereço do servidor direto no navegador. Isso será tratado numa etapa própria.
