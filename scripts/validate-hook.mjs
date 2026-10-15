import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
export async function validateHookCommand(command,{timeoutMs=10000}={}){
 const fixture=await mkdtemp(join(tmpdir(),'monitor-hook-check-')),id='00000000-0000-4000-8000-000000000001',data=join(fixture,'data');
 try{
  await mkdir(data);await writeFile(join(data,'linked.json'),JSON.stringify({ids:[id]}));
  const env={...process.env,CODEX_HOME:fixture,CODEX_MONITOR_CONFIG:join(fixture,'absent-config.json'),CODEX_MONITOR_DATA:data,CODEX_MONITOR_SETTINGS:join(fixture,'absent-settings.json')};
  delete env.CODEX_APP_TOOLS_PIPE_PATH;
  for(const shell of process.platform==='win32'?['cmd','powershell']:['sh']){
   const before=(await readdir(join(data,'events')).catch(()=>[])).length;
   await new Promise((resolve,reject)=>{
    const exe=shell==='cmd'?'cmd.exe':shell==='powershell'?'powershell.exe':'/bin/sh';
    const args=shell==='cmd'?['/d','/s','/c','"'+command+'"']:shell==='powershell'?['-NoProfile','-NonInteractive','-Command',command]:['-c',command];
    const child=spawn(exe,args,{env,windowsHide:true,windowsVerbatimArguments:shell==='cmd',stdio:['pipe','ignore','pipe']});
    let done=false;const finish=error=>{if(done)return;done=true;clearTimeout(timer);error?reject(error):resolve();};
    const timer=setTimeout(()=>{child.kill();finish(Error('O teste do comando excedeu o tempo em '+shell+'.'));},timeoutMs);
    child.stderr.on('data',()=>{});child.stdin.on('error',()=>{});
    child.once('error',()=>finish(Error('Não foi possível testar o comando em '+shell+'.')));
    child.once('close',code=>finish(code===0?null:Error('O comando do coletor falhou em '+shell+'.')));
    child.stdin.end(JSON.stringify({session_id:id,turn_id:'00000000-0000-4000-8000-000000000002',hook_event_name:'UserPromptSubmit'}));
   });
   const after=(await readdir(join(data,'events')).catch(()=>[])).length;
   if(after!==before+1)throw Error('O comando terminou sem registrar o evento fictício em '+shell+'.');
  }
 }finally{await rm(fixture,{recursive:true,force:true});}
}
