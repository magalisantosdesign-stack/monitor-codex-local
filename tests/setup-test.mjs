import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {readSetup,requiredEvents} from '../src/setup.mjs';
import {hookCommand,mergeHooks} from '../scripts/Install-Hooks.mjs';
const root=dirname(dirname(fileURLToPath(import.meta.url)));
test('Setup distinguishes missing, partial, installed and unreadable without leaking commands',async()=>{
 const home=await mkdtemp(join(tmpdir(),'monitor-setup-state-')),command='example-owned-command';
 try{
  assert.equal((await readSetup({home,command})).status,'missing');
  await writeFile(join(home,'hooks.json'),JSON.stringify({hooks:{Stop:[{hooks:[{type:'command',command}]}]}}));
  assert.equal((await readSetup({home,command})).status,'partial');
  await writeFile(join(home,'hooks.json'),JSON.stringify(mergeHooks({},command)));
  assert.deepEqual(await readSetup({home,command}),{status:'configured',configured:true,events:9,expected:9});
  assert.equal((await readSetup({home,command:'a different copy'})).configured,false);
  await writeFile(join(home,'hooks.json'),'{broken');assert.equal((await readSetup({home,command})).status,'unavailable');
  assert.equal(await readFile(join(home,'hooks.json'),'utf8'),'{broken');
 }finally{await rm(home,{recursive:true,force:true});}
});
test('Actual Windows configuration CMD confirms installation, preserves handlers and supports cancellation',{skip:process.platform!=='win32',timeout:60000},async()=>{
 const home=await mkdtemp(join(tmpdir(),'monitor-setup-cmd-')),file=join(home,'hooks.json');
 const original=JSON.stringify({hooks:{Stop:[{hooks:[{type:'command',command:'echo preserved-fixture-handler'}]}]}});
 await writeFile(file,original);
 async function run(answer){return new Promise((resolve,reject)=>{
  let output='',answered=false;
  const env={...process.env,CODEX_HOME:home,CODEX_MONITOR_DATA:join(home,'data'),CODEX_MONITOR_CONFIG:join(home,'absent-config.json')};
  const child=spawn(process.env.ComSpec||'cmd.exe',['/d','/c','call "'+join(root,'Configurar-Codex.cmd')+'"'],{cwd:root,env,windowsHide:true,windowsVerbatimArguments:true,stdio:['pipe','pipe','pipe']});
  const timer=setTimeout(()=>{child.kill();reject(Error('Configuration CMD timeout: '+output));},20000);
  function consume(chunk){output+=chunk;if(!answered&&output.includes('Digite S')){answered=true;child.stdin.end(answer+'\r\n\r\n');}}
  child.stdout.on('data',consume);child.stderr.on('data',consume);child.once('error',error=>{clearTimeout(timer);reject(error);});child.once('close',code=>{clearTimeout(timer);resolve({code,output});});
 });}
 try{
  const cancel=await run('N');assert.equal(cancel.code,0,cancel.output);assert.equal(await readFile(file,'utf8'),original);
  const first=await run('S');assert.equal(first.code,0,first.output);assert.match(first.output,/9\/9/);
  const command=hookCommand(process.execPath,join(root,'src/hook.mjs'));
  assert.equal((await readSetup({home,command})).configured,true);
  const installed=JSON.parse(await readFile(file,'utf8'));assert.ok(installed.hooks.Stop.some(group=>group.hooks.some(handler=>handler.command==='echo preserved-fixture-handler')));
  const again=await run('S');assert.equal(again.code,0,again.output);
  const updated=JSON.parse(await readFile(file,'utf8'));for(const name of requiredEvents)assert.equal(updated.hooks[name].flatMap(group=>group.hooks).filter(handler=>handler.command===command).length,1);
 }finally{await rm(home,{recursive:true,force:true});}
});
