import {readFile,stat} from 'node:fs/promises';
import {dirname,join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
export const distributionRoot=dirname(dirname(fileURLToPath(import.meta.url)));
export async function checkDistribution(){
 const pkg=JSON.parse(await readFile(join(distributionRoot,'package.json'),'utf8')),files=['package.json',...pkg.files];
 assert.ok(pkg.files.length>20,'Manifesto público não preparado.');assert.equal(new Set(files).size,files.length);
 for(const name of files){
  assert.ok(!name.includes('..')&&!/^(?:[a-z]:|[\\/])/i.test(name));assert.ok(!/(?:\.local|config\.local|node_modules|\.git\/|\.sqlite|\.log$|session\.private)/i.test(name),'Arquivo privado: '+name);
  assert.ok((await stat(join(distributionRoot,name))).isFile());const bytes=await readFile(join(distributionRoot,name));
  if(name.endsWith('.png')){
   assert.ok(name.startsWith('docs/images/')&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'Imagem fora da galeria pública ou PNG inválido: '+name);
   continue; // Gallery pixels are reviewed in demo mode, not interpreted as text.
  }
  const text=bytes.toString('utf8');
  assert.ok(!/[a-z]:[\\/]Users[\\/][^\s"'\\/]+/i.test(text),'Caminho pessoal em '+name);assert.ok(!/[a-z]:[\\/]CodexHome\b/i.test(text),'Pasta pessoal em '+name);
  assert.ok(!/[a-z]:[\\/]IA[\\/]Work Memory\b/i.test(text),'Caminho do ambiente pessoal em '+name);
  assert.ok(!/\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|sk-(?:proj-)?[A-Za-z0-9_-]{32,})\b/.test(text),'Possível credencial em '+name);
  if(!name.startsWith('public/')){const ids=text.match(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi)||[];assert.ok(ids.every(id=>/^00000000-0000-4000-8000-\d{12}$/.test(id)),'ID real em '+name);}
  if(name.endsWith('.md'))for(const link of text.matchAll(/\]\(([^)]+)\)/g)){
   const target=link[1];if(/^(?:https?:|#)/.test(target))continue;
   assert.ok((await stat(join(dirname(join(distributionRoot,name)),target.split('#')[0]))).isFile(),'Link local ausente em '+name+': '+target);
  }
 }
 for(const name of ['public/app.js','public/app.css','public/index.html','public/app.js.LEGAL.txt','LICENSE'])assert.ok(files.includes(name),'Arquivo necessário ausente: '+name);
 for(const name of ['ui/App.jsx','ui/Tasks.jsx','ui/Monitor.jsx','ui/Usage.jsx'])assert.ok(!/ctx\.|@nocobase/.test(await readFile(join(distributionRoot,name),'utf8')),'Dependência NocoBase em '+name);
 return files;
}
if(process.argv[1]&&relative(distributionRoot,process.argv[1]).replaceAll('\\','/')==='scripts/check-distribution.mjs')console.log('PASS: '+(await checkDistribution()).length+' arquivos públicos; dados privados excluídos.');
