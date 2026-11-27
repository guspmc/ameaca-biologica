'use strict';
/*
 * Fichas Offline: Fichas guardadas só neste aparelho (localStorage), sem servidor, Mesa ou aprovação.
 * Reaproveita o mesmo editor da Ficha: `apiFichas` (ficha.js) desvia para cá quando `fichasOffline` é true,
 * e as respostas têm o mesmo formato das rotas do servidor.
 * Carregado depois de ficha.js; usa estado, REGRAS, mostrarTela, $ e h.
 */

const LIMITE_FICHAS_OFFLINE = 30;

const chaveFichasOffline = () => 'ab-fichas-offline-v1:' + String(estado.usuario || '').toLowerCase();

function lerFichasOffline() {
  try {
    const lista = JSON.parse(localStorage.getItem(chaveFichasOffline()) || '[]');
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

function gravarFichasOffline(lista) {
  try {
    localStorage.setItem(chaveFichasOffline(), JSON.stringify(lista));
  } catch {
    throw new Error('Não foi possível guardar neste aparelho (armazenamento cheio ou bloqueado). Exporte a Ficha em arquivo.');
  }
}

function idFichaOffline() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Mesmo contrato de apiFichas: devolve (por Promise) o que o servidor devolveria.
function apiFichasOffline(rota, metodo = 'GET', corpo) {
  return new Promise((resolve, reject) => {
    try {
      resolve(executarFichaOffline(rota, metodo, corpo));
    } catch (e) {
      reject(e);
    }
  });
}

function executarFichaOffline(rota, metodo, corpo) {
  const partes = rota.split('/').filter(Boolean); // ['fichas', id?, acao?]
  const lista = lerFichasOffline();
  const achar = (id) => lista.find((f) => f.id === id);
  const agora = () => new Date().toISOString();
  const nova = (dados) => {
    if (lista.length >= LIMITE_FICHAS_OFFLINE) throw new Error(`Você já tem ${LIMITE_FICHAS_OFFLINE} Fichas Offline. Exclua uma antes.`);
    const f = { id: idFichaOffline(), estado: 'offline', criadaEm: agora(), atualizadaEm: agora(), dados };
    lista.push(f);
    gravarFichasOffline(lista);
    return f;
  };

  if (partes.length === 1) {
    if (metodo === 'GET') {
      return { fichas: lista.map((f) => ({ id: f.id, estado: 'offline', personagem: f.dados.nome, criadaEm: f.criadaEm, atualizadaEm: f.atualizadaEm, evolucao: false, dados: f.dados })) };
    }
    if (metodo === 'POST') {
      const entrada = corpo && corpo.dados && typeof corpo.dados === 'object' ? corpo.dados : null;
      const f = nova(entrada ? REGRAS.normalizar(entrada) : REGRAS.novaFicha());
      return { id: f.id };
    }
  } else {
    const f = achar(decodeURIComponent(partes[1]));
    if (!f) throw new Error('Ficha não encontrada neste aparelho.');
    if (partes.length === 2) {
      if (metodo === 'GET') return { ficha: { id: f.id, estado: 'offline', evolucao: false, dados: f.dados } };
      if (metodo === 'PUT') {
        f.dados = REGRAS.normalizar(corpo);
        f.atualizadaEm = agora();
        gravarFichasOffline(lista);
        return { id: f.id };
      }
      if (metodo === 'DELETE') {
        gravarFichasOffline(lista.filter((x) => x.id !== f.id));
        return { id: f.id };
      }
    } else if (partes[2] === 'duplicar' && metodo === 'POST') {
      const dados = REGRAS.normalizar(JSON.parse(JSON.stringify(f.dados)));
      dados.nome = (dados.nome ? dados.nome + ' ' : '') + '(cópia)';
      return { id: nova(dados).id };
    }
  }
  throw new Error('Ação não disponível nas Fichas Offline.');
}

/* ---------- Cartão no Laboratório ---------- */

function atualizarFichasOffline() {
  const resumo = $('resumo-fichas-offline');
  if (!resumo) return;
  const n = lerFichasOffline().length;
  resumo.textContent = n === 0 ? 'Nenhuma Ficha Offline ainda.' : `${n} Ficha(s) neste aparelho.`;
}

async function abrirFichasOffline() {
  fichasOffline = true;
  fichaAtual = null;
  naListaDeFichas = true;
  mostrarTela('mesa');
  $('titulo-mesa').textContent = 'Fichas Offline';
  $('subtitulo-mesa').textContent = 'Só neste aparelho · sem Mesa e sem aprovação';
  mensagem($('aviso-mesa'), '');
  await carregarFichas();
  renderizarListaFichas();
}

document.addEventListener('DOMContentLoaded', () => {
  const botao = $('btn-fichas-offline');
  if (botao) botao.addEventListener('click', abrirFichasOffline);
});
