import {spawn} from 'node:child_process';
import {access,mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {config,root} from '../src/config.mjs';
import {openBrowser} from './browser.mjs';
if(Number(process.versions.node.split('.')[0])<24){console.error('Instale Node.js 24 ou superior para abrir o Monitor Codex Local.');process.exit(1);}
try{await access(join(root,'public/app.js'));await access(join(root,'public/app.css'));}catch{console.error('A interface compilada não está nesta pasta. Use o pacote completo ou execute npm install e npm run build.');process.exit(1);}
const result=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[join(root,'scripts/Iniciar-Monitor.mjs')],{cwd:root,env:process.env,windowsHide:true,stdio:'inherit'});child.once('error',reject);child.once('exit',resolve);});
if(result!==0){process.exitCode=1;}else{
 const url='http://127.0.0.1:'+config.port+'/#tarefas';
 console.log('Abra '+url);console.log('Ao terminar, use Encerrar aplicativo. Fechar a aba não encerra o processo.');
 if(!process.argv.includes('--no-browser')){
  let code='OPEN_REQUEST_ACCEPTED';
  try{await openBrowser(url);console.log('Abertura enviada ao navegador padrão.');}
  catch(error){code=error.code||'BROWSER_OPEN_FAILED';console.error(error.message);console.error('O monitor está ligado. Copie e abra este endereço no navegador: '+url);process.exitCode=1;}
  try{await mkdir(join(root,'.local'),{recursive:true});await writeFile(join(root,'.local/browser-startup.json'),JSON.stringify({at:new Date().toISOString(),code,port:config.port}));}catch{}
 }
}
