# MeuFut

App pra organizar peladas de futebol: montagem de times, controle de jogadores, placar,
confirmação de presença e financeiro. Uso exclusivo pelo app nativo (Android/iOS) — o site
é só uma página de apresentação, sem versão utilizável pelo navegador.

Site oficial: [meufut.app](https://meufut.app) · Contato: contato@meufut.app

## Estrutura

```
index.html          # site de apresentação (raiz de meufut.app)
app/                 # o aplicativo em si (HTML/CSS/JS em arquivo único)
  index.html         #   ...empacotado pelo Capacitor pra virar o app nativo
  style.css
  manifest.json
  service-worker.js
  icons/
www/                 # gerado por sync-www.js a partir de app/ — não editar direto
android/, ios/        # projetos nativos gerados pelo Capacitor (npx cap add)
CNAME                # domínio customizado do GitHub Pages (meufut.app)
firestore.rules       # regras de segurança do Firestore (aplicar manualmente no console)
firestore-schema.md   # documentação do modelo de dados
migrar-para-multitenant.js, limpar-jogadores-demo.js   # scripts únicos de migração do banco
```

## Como rodar

Site de apresentação: abre `index.html` direto no navegador.

App (pra desenvolvimento): abre `app/index.html`, ou serve localmente a partir de `app/`:

```bash
cd app && python3 -m http.server 8000
# acesse http://localhost:8000/
```

## Empacotar pra Android/iOS

```bash
npm install
npm run cap:sync   # copia app/ pra www/ e sincroniza os projetos nativos
npx cap open android
npx cap open ios
```

## Deploy

Publicado via GitHub Pages a partir da raiz da branch `main`. O domínio meufut.app aponta pra
cá através do arquivo `CNAME`. Só o `index.html` da raiz (o site) fica público por essa via —
o app de dentro de `app/` também fica acessível em meufut.app/app/ pra fins de teste, mas não
é linkado nem divulgado: o uso pretendido é só pelos apps nativos.

## Status

Em desenvolvimento.
