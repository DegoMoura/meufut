#!/usr/bin/env node
// Copia os arquivos do app (app/index.html, app/style.css, app/manifest.json,
// app/service-worker.js, app/icons/ — que continuam sendo a fonte da verdade dentro da pasta
// app/) pra dentro de www/, que é o que o Capacitor empacota dentro do app Android/iOS.
// A raiz do projeto (index.html) agora é só o site de apresentação (meufut.app), não faz
// parte do app nativo. Roda em Node puro (sem bash) pra funcionar igual no Windows, Mac e
// Linux. Roda isso sempre que mudar os arquivos de app/, antes de "npx cap sync" — senão o
// app nativo fica com a versão antiga.
const fs = require('fs');
const path = require('path');

const raiz = __dirname;
const origem = path.join(raiz, 'app');
const destino = path.join(raiz, 'www');
fs.mkdirSync(destino, { recursive: true });

const arquivos = ['index.html', 'style.css', 'manifest.json', 'service-worker.js'];
for (const nome of arquivos) {
  fs.copyFileSync(path.join(origem, nome), path.join(destino, nome));
}

function copiarPasta(origemDir, destinoDir) {
  fs.mkdirSync(destinoDir, { recursive: true });
  for (const item of fs.readdirSync(origemDir, { withFileTypes: true })) {
    const origemItem = path.join(origemDir, item.name);
    const destinoItem = path.join(destinoDir, item.name);
    if (item.isDirectory()) copiarPasta(origemItem, destinoItem);
    else fs.copyFileSync(origemItem, destinoItem);
  }
}
const iconsOrigem = path.join(origem, 'icons');
if (fs.existsSync(iconsOrigem)) copiarPasta(iconsOrigem, path.join(destino, 'icons'));

console.log('www/ atualizado a partir de app/.');
