#!/usr/bin/env node
/**
 * Migra os dados do MeuFut do documento único (appdata/main) para a nova estrutura
 * multi-tenant: associacoes/{id} -> futs/{id} -> partidas/{id}, mais usuarios/{uid}.
 * Ver firestore-schema.md pra entender o porquê da mudança.
 *
 * NÃO apaga nada do documento antigo — appdata/main continua existindo como backup até você
 * confirmar que o app novo está funcionando 100% em produção.
 *
 * Como usar:
 *   1. npm install firebase-admin
 *   2. Baixe a chave de service account: Firebase Console > Configurações do projeto >
 *      Contas de serviço > Gerar nova chave privada. Salve como serviceAccount.json nesta
 *      mesma pasta (já está protegido no .gitignore, nunca vai pro GitHub).
 *   3. Rode em modo teste primeiro (não grava nada, só mostra o que faria):
 *        node migrar-para-multitenant.js --dry-run
 *   4. Confira os números impressos batem com o que você espera (quantas associações,
 *      quantos Futs, quantas partidas, quantos jogadores).
 *   5. Rode de verdade:
 *        node migrar-para-multitenant.js --write
 */
const fs = require('fs');
const path = require('path');

const CHAVE_PATH = path.join(__dirname, 'serviceAccount.json');
if(!fs.existsSync(CHAVE_PATH)){
  console.error('Não achei serviceAccount.json nesta pasta. Veja as instruções no topo deste arquivo.');
  process.exit(1);
}

const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require(CHAVE_PATH)) });
const db = admin.firestore();

const modoEscrita = process.argv.includes('--write');
const LIMITE_LOTE = 450; // Firestore aceita até 500 operações por batch; deixa folga

// Mesma lógica do app: Firestore não aceita array dentro de array, então m.times
// (Array<Array<id>>) vira Array<{ids:[...]}> só na hora de salvar.
function empacotarTimesMatch(m){
  if(!m.times || !m.times.length) return m;
  return { ...m, times: m.times.map(roster => ({ ids: roster })) };
}

async function commitEmLotes(operacoes){
  for(let i=0; i<operacoes.length; i+=LIMITE_LOTE){
    const fatia = operacoes.slice(i, i+LIMITE_LOTE);
    const batch = db.batch();
    fatia.forEach(op => batch.set(op.ref, op.data));
    if(modoEscrita) await batch.commit();
    console.log(`  lote ${Math.floor(i/LIMITE_LOTE)+1}: ${fatia.length} documento(s)${modoEscrita?' gravados':' (dry-run, nada gravado)'}`);
  }
}

async function main(){
  console.log(modoEscrita ? '=== MODO ESCRITA (vai gravar de verdade) ===' : '=== MODO TESTE (dry-run, nada será gravado) ===');

  const snap = await db.collection('appdata').doc('main').get();
  if(!snap.exists){
    console.error('appdata/main não existe. Nada pra migrar.');
    process.exit(1);
  }
  const d = snap.data();
  const players = d.players || [];
  const groups = d.groups || [];
  const matches = d.matches || [];
  const associacoes = d.associacoes || [];

  console.log(`Encontrado no documento antigo: ${associacoes.length} associação(ões), ${groups.length} Fut(s), ${matches.length} partida(s), ${players.length} jogador(es).`);

  // associações -> associacoes/{id}
  const opsAssoc = associacoes.map(a => ({ ref: db.collection('associacoes').doc(a.id), data: a }));

  // futs -> associacoes/{associacaoId}/futs/{id} — pula Futs órfãos (associacaoId que não existe
  // mais em nenhuma associação) e avisa, em vez de quebrar a migração inteira.
  const idsAssocValidos = new Set(associacoes.map(a=>a.id));
  const gruposOrfaos = groups.filter(g => !idsAssocValidos.has(g.associacaoId));
  if(gruposOrfaos.length){
    console.warn(`Aviso: ${gruposOrfaos.length} Fut(s) com associacaoId que não existe mais — não migrados:`, gruposOrfaos.map(g=>g.id));
  }
  const opsGrupos = groups.filter(g => idsAssocValidos.has(g.associacaoId))
    .map(g => ({ ref: db.collection('associacoes').doc(g.associacaoId).collection('futs').doc(g.id), data: g }));

  // partidas -> associacoes/{associacaoId}/futs/{groupId}/partidas/{id} — mesma lógica de
  // pular partidas órfãs (de um Fut que não existe mais).
  const mapaGrupoParaAssoc = new Map(groups.map(g => [g.id, g.associacaoId]));
  const partidasOrfas = matches.filter(m => !mapaGrupoParaAssoc.has(m.groupId) || !idsAssocValidos.has(mapaGrupoParaAssoc.get(m.groupId)));
  if(partidasOrfas.length){
    console.warn(`Aviso: ${partidasOrfas.length} partida(s) de um Fut que não existe mais — não migradas:`, partidasOrfas.map(m=>m.id));
  }
  const opsPartidas = matches.filter(m => mapaGrupoParaAssoc.has(m.groupId) && idsAssocValidos.has(mapaGrupoParaAssoc.get(m.groupId)))
    .map(m => {
      const associacaoId = mapaGrupoParaAssoc.get(m.groupId);
      return {
        ref: db.collection('associacoes').doc(associacaoId).collection('futs').doc(m.groupId).collection('partidas').doc(m.id),
        data: empacotarTimesMatch(m)
      };
    });

  // jogadores -> usuarios/{id}
  const opsJogadores = players.map(p => ({ ref: db.collection('usuarios').doc(p.id), data: p }));

  console.log(`\nVai gravar: ${opsAssoc.length} associação(ões), ${opsGrupos.length} Fut(s), ${opsPartidas.length} partida(s), ${opsJogadores.length} jogador(es).\n`);

  console.log('Associações:');
  await commitEmLotes(opsAssoc);
  console.log('Futs:');
  await commitEmLotes(opsGrupos);
  console.log('Partidas:');
  await commitEmLotes(opsPartidas);
  console.log('Jogadores:');
  await commitEmLotes(opsJogadores);

  console.log(modoEscrita
    ? '\nMigração concluída. O documento antigo (appdata/main) continua intacto como backup.'
    : '\nDry-run concluído — nada foi gravado. Confira os números acima e rode de novo com --write quando estiver tudo certo.');
}

main().catch(e => { console.error('Migração falhou:', e); process.exit(1); });
