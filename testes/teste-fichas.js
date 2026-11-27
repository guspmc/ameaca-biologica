'use strict';
/*
 * Testes das rotas de Fichas de Personagem (servidor/fichas.js + server.js).
 * Sobe um servidor em porta isolada, cria uma Mesa e testa o ciclo completo.
 */

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const PORTA = 3471;
const BASE = `http://localhost:${PORTA}`;
const RAIZ = path.join(__dirname, '..');

let falhas = 0;
function confere(nome, ok, detalhe = '') {
  console.log(`${ok ? 'OK   ' : 'FALHA'} ${nome}${detalhe ? ' -> ' + detalhe : ''}`);
  if (!ok) falhas++;
}

const dorme = (ms) => new Promise((r) => setTimeout(r, ms));

function req(metodo, caminho, corpo, token) {
  return new Promise((resolve, reject) => {
    const opcoes = {
      hostname: 'localhost',
      port: PORTA,
      path: caminho,
      method: metodo,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };
    const pedido = http.request(opcoes, (res) => {
      let texto = '';
      res.on('data', (d) => { texto += d; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, corpo: JSON.parse(texto) }); }
        catch { resolve({ status: res.statusCode, corpo: texto }); }
      });
    });
    pedido.on('error', reject);
    if (corpo != null) pedido.write(JSON.stringify(corpo));
    pedido.end();
  });
}

(async () => {
  // Copia o projeto em diretório temporário para não poluir os dados de desenvolvimento.
  const copia = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-fichas-'));
  fs.cpSync(RAIZ, copia, { recursive: true, filter: (o) => !o.includes('.git') });
  fs.rmSync(path.join(copia, 'servidor', 'dados'), { recursive: true, force: true });
  fs.mkdirSync(path.join(copia, 'servidor', 'dados'));

  const filho = spawn('node', ['servidor/server.js'], {
    cwd: copia,
    env: { ...process.env, PORTA: String(PORTA) },
    stdio: 'ignore',
  });
  await dorme(1000);

  try {
    // --- Login de Mestre e dois Jogadores ---
    const rMestre = await req('POST', '/api/entrar', { usuario: 'Mestre', senha: '1234' });
    const tokMestre = rMestre.corpo.token;
    confere('Login do Mestre', !!tokMestre);

    const rAna = await req('POST', '/api/entrar', { usuario: 'Ana', senha: '1234' });
    const tokAna = rAna.corpo.token;
    confere('Login de Ana', !!tokAna);

    const rBia = await req('POST', '/api/entrar', { usuario: 'Bia', senha: '1234' });
    const tokBia = rBia.corpo.token;
    confere('Login de Bia', !!tokBia);

    // --- Criar Mesa ---
    const rCria = await req('POST', '/api/mesas', { nome: 'Mesa Teste', limiteJogadores: 3, limiteNivel: 1 }, tokMestre);
    confere('Criar Mesa (201)', rCria.status === 201);
    const mesaId = rCria.corpo.id;

    // Ana entra na Mesa.
    const rEntrar = await req('POST', '/api/mesas/entrar', { codigo: (await req('GET', `/api/mesas/${mesaId}`, null, tokMestre)).corpo.mesa.codigoFormatado }, tokAna);
    confere('Ana entra na Mesa (200)', rEntrar.status === 200);

    // Mestre aprova Ana.
    const rAprova = await req('POST', `/api/mesas/${mesaId}/jogadores/Ana/aprovar`, {}, tokMestre);
    confere('Mestre aprova Ana (200)', rAprova.status === 200);

    // Bia entra mas fica pendente (não será aprovada neste teste).
    const codigoMesa = (await req('GET', `/api/mesas/${mesaId}`, null, tokMestre)).corpo.mesa.codigoFormatado;
    await req('POST', '/api/mesas/entrar', { codigo: codigoMesa }, tokBia);
    // Bia não aprovada → não pode criar ficha.
    const rBiaFicha = await req('POST', `/api/mesas/${mesaId}/fichas`, {}, tokBia);
    confere('Não aprovado não cria Ficha (403)', rBiaFicha.status === 403);

    // Mestre não cria Ficha.
    const rMestreFicha = await req('POST', `/api/mesas/${mesaId}/fichas`, {}, tokMestre);
    confere('Mestre não cria Ficha (403)', rMestreFicha.status === 403);

    // --- Ciclo completo de Ana ---
    // Criar rascunho.
    const rNovaFicha = await req('POST', `/api/mesas/${mesaId}/fichas`, {}, tokAna);
    confere('Ana cria rascunho (201)', rNovaFicha.status === 201);
    const fichaId = rNovaFicha.corpo.id;
    confere('ID da Ficha é string não vazia', typeof fichaId === 'string' && fichaId.length > 0);

    // Listar fichas de Ana.
    const rLista = await req('GET', `/api/mesas/${mesaId}/fichas`, null, tokAna);
    confere('Listar fichas de Ana (200)', rLista.status === 200 && rLista.corpo.fichas.length === 1);

    // Mestre lista fichas → só vê id+usuario+personagem (sem dados completos).
    const rListaMestre = await req('GET', `/api/mesas/${mesaId}/fichas`, null, tokMestre);
    confere('Mestre lista fichas (200)', rListaMestre.status === 200);
    const fichaDoMestre = rListaMestre.corpo.fichas[0];
    confere('Mestre não vê atributos', !fichaDoMestre.dados);
    confere('Mestre vê usuario e personagem', fichaDoMestre.usuario === 'Ana' && fichaDoMestre.personagem !== undefined);

    // Salvar dados da Ficha (rascunho).
    // Ficha válida para Nível 1 com 4 pontos de perícia.
    const dadosValidos = {
      nome: 'Claire',
      conceito: 'Sobrevivente',
      origem: 'policial',
      origemTreino: 'pontaria',
      classe: 'agente',
      nivel: 1,
      atributos: { FOR: 1, AGI: 3, VIG: 2, AST: 1 },
      pericias: { furtividade: 1, reflexos: 1, percepcao: 1, luta: 1 },
      habilidades: ['rolamento'],
      equipamentoInicial: 'A',
    };
    const rSalvar = await req('PUT', `/api/mesas/${mesaId}/fichas/${fichaId}`, dadosValidos, tokAna);
    confere('Salvar rascunho (200)', rSalvar.status === 200, JSON.stringify(rSalvar.corpo));

    // Obter ficha.
    const rObter = await req('GET', `/api/mesas/${mesaId}/fichas/${fichaId}`, null, tokAna);
    confere('Obter ficha (200)', rObter.status === 200 && rObter.corpo.ficha.dados.nome === 'Claire');

    // Solicitar aprovação com ficha válida.
    const rSolicitar = await req('POST', `/api/mesas/${mesaId}/fichas/${fichaId}/solicitar`, {}, tokAna);
    confere('Solicitar aprovação (200)', rSolicitar.status === 200, JSON.stringify(rSolicitar.corpo));

    // Rascunho pendente não pode ser editado.
    const rEditarPendente = await req('PUT', `/api/mesas/${mesaId}/fichas/${fichaId}`, { nome: 'Outro' }, tokAna);
    confere('Pendente bloqueada para edição (409)', rEditarPendente.status === 409);

    // Listar solicitações (Mestre).
    const rSolic = await req('GET', `/api/mesas/${mesaId}/solicitacoes-fichas`, null, tokMestre);
    confere('Mestre vê 1 solicitação', rSolic.status === 200 && rSolic.corpo.solicitacoes.length === 1);
    confere('Mestre não vê atributos na solicitação', !rSolic.corpo.solicitacoes[0].dados);

    // Mestre aprova.
    const rAprovar = await req('POST', `/api/mesas/${mesaId}/solicitacoes-fichas/${fichaId}/aprovar`, {}, tokMestre);
    confere('Mestre aprova Ficha (200)', rAprovar.status === 200, JSON.stringify(rAprovar.corpo));

    // Ficha agora está ativa. Verificar.
    const rAtiva = await req('GET', `/api/mesas/${mesaId}/fichas/${fichaId}`, null, tokAna);
    confere('Ficha está ativa', rAtiva.corpo.ficha.estado === 'ativa');

    // Ativa: só campos de jogo podem mudar.
    const rEditarJogo = await req('PUT', `/api/mesas/${mesaId}/fichas/${fichaId}`, { jogo: { pv: 5, sa: 2, bi: 1, condicoes: ['cego'] } }, tokAna);
    confere('Editar jogo na ficha ativa (200)', rEditarJogo.status === 200);
    const rVerJogo = await req('GET', `/api/mesas/${mesaId}/fichas/${fichaId}`, null, tokAna);
    confere('Valores de jogo foram salvos', rVerJogo.corpo.ficha.dados.jogo.pv === 5 && rVerJogo.corpo.ficha.dados.jogo.sa === 2);

    // Não pode excluir ficha ativa.
    const rExcluirAtiva = await req('DELETE', `/api/mesas/${mesaId}/fichas/${fichaId}`, null, tokAna);
    confere('Não excluir ficha ativa (409)', rExcluirAtiva.status === 409);

    // Desativar.
    const rDesativar = await req('POST', `/api/mesas/${mesaId}/fichas/${fichaId}/desativar`, {}, tokAna);
    confere('Desativar ficha (200)', rDesativar.status === 200);
    const rPosDesativar = await req('GET', `/api/mesas/${mesaId}/fichas/${fichaId}`, null, tokAna);
    confere('Ficha voltou para rascunho', rPosDesativar.corpo.ficha.estado === 'rascunho');

    // Excluir rascunho.
    const rExcluir = await req('DELETE', `/api/mesas/${mesaId}/fichas/${fichaId}`, null, tokAna);
    confere('Excluir rascunho (200)', rExcluir.status === 200);
    const rAposExcluir = await req('GET', `/api/mesas/${mesaId}/fichas/${fichaId}`, null, tokAna);
    confere('Ficha excluída (404)', rAposExcluir.status === 404);

    // --- Validações de limite ---
    // Ficha com nível acima do limite da Mesa (nível 1) deve ser recusada ao solicitar.
    const rFichaN2 = await req('POST', `/api/mesas/${mesaId}/fichas`, {}, tokAna);
    const idN2 = rFichaN2.corpo.id;
    await req('PUT', `/api/mesas/${mesaId}/fichas/${idN2}`, { ...dadosValidos, nivel: 2, atributos: { FOR: 1, AGI: 3, VIG: 2, AST: 2 }, habilidades: ['rolamento', 'anatomia-de-combate'] }, tokAna);
    const rSolN2 = await req('POST', `/api/mesas/${mesaId}/fichas/${idN2}/solicitar`, {}, tokAna);
    confere('Ficha de nível 2 em Mesa de nível 1: erro ao solicitar (422)', rSolN2.status === 422, rSolN2.corpo.erro);

    // Ficha incompleta não pode ser solicitada.
    const rIncompleta = await req('POST', `/api/mesas/${mesaId}/fichas`, {}, tokAna);
    const idIncompleta = rIncompleta.corpo.id;
    const rSolInc = await req('POST', `/api/mesas/${mesaId}/fichas/${idIncompleta}/solicitar`, {}, tokAna);
    confere('Ficha incompleta não pode ser solicitada (422)', rSolInc.status === 422);

    // Retirar pedido de ficha pendente.
    // Cria, salva válida, solicita, retira.
    const rFichaR = await req('POST', `/api/mesas/${mesaId}/fichas`, {}, tokAna);
    const idR = rFichaR.corpo.id;
    await req('PUT', `/api/mesas/${mesaId}/fichas/${idR}`, dadosValidos, tokAna);
    await req('POST', `/api/mesas/${mesaId}/fichas/${idR}/solicitar`, {}, tokAna);
    const rRetirar = await req('POST', `/api/mesas/${mesaId}/fichas/${idR}/retirar`, {}, tokAna);
    confere('Retirar pedido de aprovação (200)', rRetirar.status === 200);
    const rPosRetirar = await req('GET', `/api/mesas/${mesaId}/fichas/${idR}`, null, tokAna);
    confere('Ficha voltou para rascunho após retirar', rPosRetirar.corpo.ficha.estado === 'rascunho');

    // --- Purga ao encerrar Mesa ---
    // Ana precisa de fichas listadas antes.
    const rAntesEnc = await req('GET', `/api/mesas/${mesaId}/fichas`, null, tokAna);
    confere('Fichas existem antes de encerrar', rAntesEnc.corpo.fichas.length > 0);
    // Encerrar Mesa.
    await req('POST', `/api/mesas/${mesaId}/encerrar`, {}, tokMestre);
    // Fichas do arquivo devem ter sido purgadas.
    const fichasArquivo = JSON.parse(fs.readFileSync(path.join(copia, 'servidor', 'dados', 'fichas.json'), 'utf8'));
    confere('Fichas purgadas ao encerrar Mesa', !fichasArquivo[mesaId]);

  } catch (e) {
    console.error('ERRO:', e.message);
    falhas++;
  } finally {
    filho.kill();
    fs.rmSync(copia, { recursive: true, force: true });
  }

  console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO OK');
  process.exit(falhas ? 1 : 0);
})();
