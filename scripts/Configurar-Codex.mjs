import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline/promises';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {config,root} from '../src/config.mjs';
import {readSetup} from '../src/setup.mjs';
import {validateHookCommand} from './validate-hook.mjs';
async function run(args,{capture=false}={}){
 return new Promise((resolve,reject)=>{
  let output='';const child=spawn(process.execPath,[join(root,'scripts/Install-Hooks.mjs'),...args],{cwd:root,env:process.env,windowsHide:true,stdio:['ignore',capture?'pipe':'inherit','inherit']});
  child.stdout?.on('data',value=>output+=value);child.once('error',reject);child.once('close',code=>code===0?resolve(output):reject(new Error('O instalador não concluiu a gravação.')));
 });
}
async function report(code){try{await mkdir(join(root,'.local'),{recursive:true});await writeFile(join(root,'.local/setup-result.json'),JSON.stringify({at:new Date().toISOString(),code}));}catch{}}
try{
 if(Number(process.versions.node.split('.')[0])<24)throw new Error('Instale Node.js 24 ou superior.');
 const plan=JSON.parse(await run([],{capture:true}));
 console.log('\nConfigurar Monitor Codex Local\n');
 console.log('Configuração do Codex: '+plan.destination);
 console.log('Coletor desta cópia: '+join(root,'src/hook.mjs'));
 console.log('Serão adicionados '+plan.events+' eventos. Os existentes serão preservados e haverá backup.');
 console.log('Esta etapa não concede confiança aos hooks nem aprova ferramentas.\n');
 console.log('Testando o comando do coletor com um evento fictício, sem usar seus chats...');
 await validateHookCommand(plan.command);
 console.log('Comando validado'+(process.platform==='win32'?' no CMD e no PowerShell.':'.')+'\n');
 const input=createInterface({input:process.stdin,output:process.stdout});let answer;
 try{answer=await input.question('Confirma a instalação nesta configuração? Digite S para instalar ou N para cancelar: ');}finally{input.close();}
 if(!['s','sim'].includes(answer.trim().toLowerCase())){await report('CANCELLED');console.log('Cancelado. Nenhuma configuração alterada.');}
 else{
  await run(['--apply']);
  const status=await readSetup();
  if(!status.configured)throw new Error('A gravação não foi confirmada. Execute Diagnosticar-Monitor.cmd.');
  await report('INSTALLED');console.log('\nINSTALAÇÃO CONFIRMADA: '+status.events+'/'+status.expected+' eventos desta cópia encontrados.');
  console.log('Agora revise e confie nos novos hooks no Codex. Se não aparecerem, feche e abra o Codex para recarregar a configuração.');
  console.log('Depois retome um chat vinculado. O painel muda ao receber um evento real; cadastrar um link sozinho não produz um evento.');
 }
}catch(error){await report('FAILED');console.error('\nCONFIGURAÇÃO NÃO CONCLUÍDA: '+error.message);process.exitCode=1;}
