import {build} from 'esbuild';
import {writeFile,mkdir} from 'node:fs/promises';
import {root} from '../src/config.mjs';
import {join} from 'node:path';
await mkdir(join(root,'public'),{recursive:true});
await build({entryPoints:[join(root,'ui/App.jsx')],outfile:join(root,'public/app.js'),bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,legalComments:'external',logLevel:'warning',define:{'process.env.NODE_ENV':'"production"'}});
await writeFile(join(root,'public/index.html'),'<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Monitor Codex Local</title><link rel="icon" type="image/x-icon" href="/monitor.ico"><link rel="stylesheet" href="/app.css"></head><body><div id="app"></div><script type="module" src="/app.js"></script></body></html>');
console.log('Interface compilada para uso local, sem CDN.');
