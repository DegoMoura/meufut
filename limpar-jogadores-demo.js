#!/usr/bin/env node
/**
 * Remove os jogadores de demonstração (criados pelo botão "Gerar Fut de demonstração", que já
 * foi removido da tela, mas os dados que ele criou continuam em appdata/main) antes da
 * migração pra estrutura nova.
 *
 * Só remove jogadores que têm certeza de serem demo — os "mensalistas" gerados sempre têm
 * usuario no formato "demoN" e senha "demo" (nenhum jogador real teria isso). Os "convidados"
 * gerados pelo mesmo botão usam nomes de uma lista fixa (Lucas, Rafael, Bruno...) mas essa
 * mesma lista tem nomes comuns que você pode ter usado de verdade num convidado manual — por
 * segurança, esses só são LISTADOS como candidatos, nunca apagados automaticamente. Revise a
 * lista de candidatos no fim e, se algum for mesmo demo, apague manualmente pelo próprio app
 * (Fut > jogador > remover) ou me avisa quais ids são pra eu tirar numa próxima rodada.
 *
 * Como usar:
 *   node limpar-jogadores-demo.js --dry-run                        (não grava nada)
 *   node limpar-jogadores-demo.js --write                          (remove só os mensalistas-demo,
 *                                                                    sinal inequívoco)
 *   node limpar-jogadores-demo.js --write --incluir-candidatos      (remove também os candidatos
 *                                                                    a convidado-demo — use depois
 *                                                                    de revisar a lista do dry-run)
 */
const fs = require('fs');
const path = require('path');

const CHAVE_PATH = path.join(__dirname, 'serviceAccount.json');
if(!fs.existsSync(CHAVE_PATH)){
  console.error('Não achei serviceAccount.json nesta pasta.');
  process.exit(1);
}

const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require(CHAVE_PATH)) });
const db = admin.firestore();

const modoEscrita = process.argv.includes('--write');
const incluirCandidatos = process.argv.includes('--incluir-candidatos');

// Mesma lista de nomes usada em gerarDemo() no index.html.
const NOMES_DEMO = ['Lucas','Rafael','Bruno','Felipe','André','Marcos','Thiago','Gustavo','Diego','João Pedro','Rodrigo','Vinícius','Matheus','Gabriel','Eduardo',
  'Fernando','Igor','Henrique','Caio','Daniel','Vitor','Renato','Alexandre','Guilherme','Otávio','Leandro','Danilo','Pedro','Wesley','Carlos','Sérgio'];

function ehMensalistaDemo(p){
  return typeof p.usuario === 'string' && /^demo\d+$/.test(p.usuario) && p.senha === 'demo';
}
function ehCandidatoConvidadoDemo(p){
  return p.convidado === true && NOMES_DEMO.includes(p.name);
}

// Tira um conjunto de ids de qualquer lugar que referencie jogadores (memberIds, diaristas,
// confirmados, times, estatísticas de partida etc.) — sem isso, remover o jogador deixaria
// referências penduradas (ex: um id em m.confirmed que não existe mais em data.players).
function removerIdsDeObjeto(obj, idsRemover){
  if(!obj || typeof obj !== 'object') return;
  if(Array.isArray(obj)){
    for(let i=obj.length-1; i>=0; i--){
      if(typeof obj[i]==='string' && idsRemover.has(obj[i])) obj.splice(i,1);
      else if(obj[i] && typeof obj[i]==='object') removerIdsDeObjeto(obj[i], idsRemover);
    }
    return;
  }
  Object.keys(obj).forEach(k=>{
    if(idsRemover.has(k)){ delete obj[k]; return; }
    const v = obj[k];
    if(v && typeof v==='object') removerIdsDeObjeto(v, idsRemover);
  });
}

async function main(){
  console.log(modoEscrita ? '=== MODO ESCRITA (vai gravar de verdade) ===' : '=== MODO TESTE (dry-run, nada será gravado) ===');

  const ref = db.collection('appdata').doc('main');
  const snap = await ref.get();
  if(!snap.exists){ console.error('appdata/main não existe.'); process.exit(1); }
  const d = snap.data();
  const players = d.players || [];

  const mensalistasDemo = players.filter(ehMensalistaDemo);
  const candidatosConvidados = players.filter(p => !ehMensalistaDemo(p) && ehCandidatoConvidadoDemo(p));

  console.log(`\nJogadores no total: ${players.length}`);
  console.log(`Mensalistas-demo (remoção automática, sinal inequívoco): ${mensalistasDemo.length}`);
  console.log(`Candidatos a convidado-demo (NÃO removidos automaticamente, revise a lista): ${candidatosConvidados.length}`);
  if(candidatosConvidados.length){
    console.log('\nCandidatos a convidado-demo (nome bate com a lista fixa do gerador, mas pode ser um convidado real seu):');
    candidatosConvidados.forEach(p => console.log(`  - ${p.name}  (id: ${p.id})`));
  }

  if(!mensalistasDemo.length && !(incluirCandidatos && candidatosConvidados.length)){
    console.log('\nNada pra remover.');
    return;
  }
  if(incluirCandidatos) console.log('\n--incluir-candidatos ativado: os candidatos a convidado-demo também serão removidos.');

  const aRemover = incluirCandidatos ? [...mensalistasDemo, ...candidatosConvidados] : mensalistasDemo;
  const idsRemover = new Set(aRemover.map(p=>p.id));
  const playersRestantes = players.filter(p => !idsRemover.has(p.id));

  const groups = (d.groups || []).map(g => { const g2 = JSON.parse(JSON.stringify(g)); removerIdsDeObjeto(g2, idsRemover); return g2; });
  const matches = (d.matches || []).map(m => { const m2 = JSON.parse(JSON.stringify(m)); removerIdsDeObjeto(m2, idsRemover); return m2; });
  const associacoes = (d.associacoes || []).map(a => { const a2 = JSON.parse(JSON.stringify(a)); removerIdsDeObjeto(a2, idsRemover); return a2; });

  console.log(`\nVai remover ${idsRemover.size} jogador(es) e limpar as referências a eles em Futs, partidas e associações.`);

  if(modoEscrita){
    await ref.set({ players: playersRestantes, groups, matches, associacoes });
    console.log('Pronto — jogadores de demonstração removidos.');
  } else {
    console.log('Dry-run concluído — nada foi gravado. Rode de novo com --write quando confirmar.');
  }
}

main().catch(e => { console.error('Falhou:', e); process.exit(1); });
