# MeuFut — novo modelo de dados no Firestore (proposta)

## Por que mudar

Hoje o app inteiro é um documento só: `appdata/main`. Ele guarda `players`, `groups` (Futs),
`matches` (partidas) e `associacoes` como quatro listas dentro do mesmo JSON. Cada gravação
reescreve o documento inteiro (por isso existe uma fila no código pra evitar corrida entre
gravações simultâneas), tem um limite de 1MB que qualquer dia vai ser estourado, e — o mais
grave — não dá pra restringir por regra de segurança quem lê os dados de qual associação,
porque é tudo o mesmo documento.

## Estrutura atual (para referência)

```
appdata/main
  players: [ {id, name, usuario, senha, whatsapp, nascimento, ..., starsByPosition, foto, stats} ]
  groups:  [ {id, associacaoId, name, tipo, diaPadrao, horarioPadrao, local, maxPlayers, valor,
              adminId, memberIds, moderadores, memberSince, diaristas, historico} ]
  matches: [ {id, groupId, date, time, local, valor, ...eventos/confirmações/times...} ]
  associacoes: [ {id, name, campoTipo, categoria, endereco, ..., code, adminId, memberIds,
                   moderadores, diaristas, memberSince} ]
```

`groups[].associacaoId` e `matches[].groupId` já são chaves estrangeiras — a nova estrutura só
espelha esse relacionamento em coleções de verdade, em vez de arrays dentro de um JSON gigante.

## Estrutura nova (proposta)

```
usuarios/{uid}                                   — 1 doc por jogador (id = uid do Firebase Auth
                                                    para usuários reais; ids gerados para convidados)
associacoes/{associacaoId}                       — 1 doc por associação
associacoes/{associacaoId}/futs/{futId}          — subcoleção: os Futs daquela associação
associacoes/{associacaoId}/futs/{futId}/partidas/{partidaId}
                                                  — subcoleção: as partidas daquele Fut
```

Cada documento guarda exatamente os mesmos campos que guarda hoje — a mudança é só *onde* cada
pedaço mora, não o formato dos dados em si. Isso reduz o tamanho do trabalho de reescrever o
app: a maior parte das funções que já leem/escrevem `data.players[...]`, `data.groups[...]`,
`data.matches[...]` continuam existindo, só trocam a fonte de "um objeto local sincronizado
inteiro" para "leituras/escritas pontuais na coleção certa".

## Por que essa divisão

- **`usuarios`** fica fora de `associacoes` porque um jogador pode participar de mais de uma
  associação com o mesmo perfil (mesmo nome, foto, estatísticas agregadas). Continua sendo um
  cadastro só por pessoa.
- **`futs` como subcoleção de `associacoes`** reflete o que já é verdade hoje
  (`groups[].associacaoId`): um Fut sempre pertence a uma associação. Isso também é o que
  permite a regra de segurança isolar tudo por associação de uma vez.
- **`partidas` como subcoleção de `futs`**: cada partida sempre pertence a um Fut específico
  (`matches[].groupId`). Times, eventos, confirmações e chegadas de cada partida continuam
  dentro do próprio documento da partida, exatamente como hoje — isso não muda de tamanho o
  suficiente pra justificar outra subcoleção.

## O que isso resolve

1. **Limite de 1MB**: cada associação, Fut e partida agora é o próprio documento, com seu
   próprio limite — o app para de crescer em direção a um teto único e compartilhado por todo
   mundo que usa o MeuFut.
2. **Gravações concorrentes**: duas associações diferentes gravando ao mesmo tempo não competem
   mais pelo mesmo documento — a fila de escrita deixa de ser necessária como está hoje.
3. **Isolamento de dados**: as regras do Firestore passam a poder negar, por padrão, o acesso a
   qualquer associação da qual o usuário não é membro — hoje isso não é possível porque tudo
   está no mesmo documento.

## Migração

Os dados atuais em `appdata/main` são lidos uma vez e regravados na nova estrutura (script com
Firebase Admin SDK, roda localmente com uma chave de service account — arquivo separado). O
documento antigo é mantido (não apagado) até confirmarmos que o app novo está funcionando
100% em produção, como rede de segurança.
