import {spawn} from 'node:child_process';

// Wait for the OS opener to finish before the launching console can close.
export function openBrowser(url,{platform=process.platform,spawnProcess=spawn,timeoutMs=15000}={}){
 const target=new URL(url);
 if(target.protocol!=='http:'||target.hostname!=='127.0.0.1')throw new Error('Endereço local inválido.');
 let command,args;
 if(platform==='win32'){
  command='powershell.exe';
  args=['-NoProfile','-NonInteractive','-WindowStyle','Hidden','-Command',"$ErrorActionPreference = 'Stop'; Start-Process -FilePath '"+target.href.replaceAll("'","''")+"' -ErrorAction Stop"];
 }else if(platform==='darwin'){command='open';args=[target.href];}
 else{command='xdg-open';args=[target.href];}
 return new Promise((resolve,reject)=>{
  const child=spawnProcess(command,args,{windowsHide:true,stdio:['ignore','ignore','pipe']});
  let done=false;
  const finish=(error)=>{if(done)return;done=true;clearTimeout(timer);error?reject(error):resolve();};
  const timer=setTimeout(()=>{child.kill();finish(Object.assign(new Error('O navegador não confirmou a abertura a tempo.'),{code:'BROWSER_TIMEOUT'}));},timeoutMs);
  // Consume output, but never store system messages or command lines in diagnostics.
  child.stderr?.on('data',()=>{});
  child.once('error',()=>finish(Object.assign(new Error('Não foi possível chamar o navegador padrão.'),{code:'BROWSER_SPAWN_FAILED'})));
  child.once('close',code=>finish(code===0?null:Object.assign(new Error('O Windows ou navegador recusou a abertura automática.'),{code:'BROWSER_OPEN_FAILED'})));
 });
}
