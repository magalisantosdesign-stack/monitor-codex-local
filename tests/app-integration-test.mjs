import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import net from 'node:net';
import {DatabaseSync} from 'node:sqlite';
const root=dirname(dirname(fileURLToPath(import.meta.url))),id='00000000-0000-4000-8000-000000000001',turn='00000000-0000-4000-8000-000000000002';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function freePort(){const server=net.createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;await new Promise(resolve=>server.close(resolve));return port;}
test('Standalone HTTP: real tasks, origin/session controls, hooks, restart and owned shutdown',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'monitor-local-app-')),port=await freePort(),origin='http://127.0.0.1:'+port,home=join(dir,'codex'),data=join(dir,'data');await mkdir(home);await mkdir(data);
 const metadata=new DatabaseSync(join(home,'state_5.sqlite'));metadata.exec('CREATE TABLE threads(id TEXT PRIMARY KEY,tokens_used INTEGER,updated_at INTEGER)');metadata.prepare('INSERT INTO threads VALUES(?,?,?)').run(id,1234,Math.floor(Date.now()/1000));metadata.close();
 const env={...process.env,CODEX_MONITOR_PORT:String(port),CODEX_MONITOR_DATA:data,CODEX_HOME:home,CODEX_MONITOR_SETTINGS:join(home,'settings.json'),CODEX_MONITOR_CODEX_EXECUTABLE:join(dir,'missing-codex.exe')};let child,output='';
 const start=async()=>{child=spawn(process.execPath,[join(root,'src/server.mjs')],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});child.stdout.on('data',chunk=>{output+=chunk;});child.stderr.on('data',chunk=>{output+=chunk;});for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error(output);try{const response=await fetch(origin+'/app-info');if(response.ok)return response.json();}catch{}await delay(100);}throw Error('Start timeout '+output);};
 let info;const headers=()=>({Origin:origin,'Content-Type':'application/json','X-Monitor-Session':info.session});
 const send=(path,body,method='POST',override={})=>fetch(origin+path,{method,headers:{...headers(),...override},body:JSON.stringify(body)});
 const stop=async()=>{const done=new Promise(resolve=>child.once('exit',resolve));assert.equal((await send('/shutdown',{instanceId:info.instanceId})).status,200);await Promise.race([done,delay(7000).then(()=>{throw Error('Shutdown timeout');})]);assert.ok(child.exitCode===0,output);};
 try{
  info=await start();assert.equal(info.service,'codex-monitor-local');assert.equal((await fetch(origin+'/')).status,200);assert.match((await fetch(origin+'/')).headers.get('content-security-policy'),/frame-ancestors 'none'/);
  const favicon=await fetch(origin+'/monitor.ico');assert.equal(favicon.status,200);assert.equal(favicon.headers.get('content-type'),'image/x-icon');assert.deepEqual(Buffer.from(await favicon.arrayBuffer()).subarray(0,4),Buffer.from([0,0,1,0]));
  assert.equal((await fetch(origin+'/api/tasks',{headers:{Origin:'https://example.invalid'}})).status,403);assert.equal((await fetch(origin+'/api/tasks',{headers:{'Sec-Fetch-Site':'cross-site'}})).status,403);
  assert.equal((await fetch(origin+'/api/tasks',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{"title":"Forbidden"}'})).status,403);
  assert.equal((await send('/api/tasks',{title:'Forbidden'},'POST',{'X-Monitor-Session':'é'.repeat(64)})).status,403);assert.equal((await fetch(origin+'/app-info')).status,200,'Malformed tokens cannot crash the server');
  assert.equal((await send('/api/tasks',{title:'Exemplo',linkCodex:'https://example.invalid/share/chat'})).status,400);
  let response=await send('/api/tasks',{title:'Tarefa fictícia',project:'Projeto de exemplo'});assert.equal(response.status,201);const task=(await response.json()).data;assert.equal(task.linkCodex,'');
  assert.equal((await fetch(origin+'/api/tasks').then(r=>r.json())).data.length,1);
  response=await send('/api/tasks/'+task.id,{linkCodex:id},'PATCH');assert.equal(response.status,200);assert.deepEqual(JSON.parse(await readFile(join(data,'linked.json'),'utf8')).ids,[id]);
  assert.equal((await send('/linked',{ids:[]})).status,405,'Only the task database owns linked IDs');
  // Exercise the actual hook process with a fictitious home and linked ID.
  const hook=spawn(process.execPath,[join(root,'src/hook.mjs')],{cwd:root,env,windowsHide:true,stdio:['pipe','pipe','pipe']});hook.stdin.end(JSON.stringify({hook_event_name:'UserPromptSubmit',session_id:id,turn_id:turn}));await new Promise(resolve=>hook.once('exit',resolve));
  let state;for(let i=0;i<30;i++){state=await fetch(origin+'/states').then(r=>r.json());if(state.states[id])break;await delay(100);}assert.equal(state.states[id].status,'processando');
  await send('/api/tasks/'+task.id,{status:'concluido'},'PATCH');state=await fetch(origin+'/states').then(r=>r.json());assert.equal(state.states[id].status,'processando','Business status cannot complete a chat');
  const oldSession=info.session;await stop();info=await start();assert.notEqual(info.session,oldSession);assert.equal((await fetch(origin+'/api/tasks').then(r=>r.json())).data[0].status,'concluido');
  assert.equal((await send('/api/tasks',{title:'Old session'},'POST',{'X-Monitor-Session':oldSession})).status,403);
  await send('/api/tasks/'+task.id,{linkCodex:''},'PATCH');assert.deepEqual(JSON.parse(await readFile(join(data,'linked.json'),'utf8')).ids,[]);assert.equal((await fetch(origin+'/api/tasks').then(r=>r.json())).data.length,1);
  const tokens=await fetch(origin+'/tokens').then(r=>r.json());assert.ok(tokens.history.rows.some(row=>row.id===id),'Unlink retains numeric history');
  for(const path of ['/.local/data/tasks.sqlite','/src/config.mjs','/config.local.json','/../package.json'])assert.equal((await fetch(origin+path)).status,404);
  await stop();assert.equal((await readFile(join(data,'token-history.json'),'utf8')).includes('FORBIDDEN_CONTENT'),false);
 }finally{if(child&&child.exitCode===null){child.kill();await new Promise(resolve=>child.once('exit',resolve));}await rm(dir,{recursive:true,force:true});}
});

test('The launcher reuses its own process and the stop script closes it without browser or autostart',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'monitor-local-launcher-')),port=await freePort(),origin='http://127.0.0.1:'+port,home=join(dir,'codex'),data=join(dir,'data');await mkdir(home);await mkdir(data);
 const env={...process.env,CODEX_MONITOR_PORT:String(port),CODEX_MONITOR_DATA:data,CODEX_HOME:home,CODEX_MONITOR_SETTINGS:join(home,'settings.json'),CODEX_MONITOR_CODEX_EXECUTABLE:join(dir,'missing-codex.exe')};
 async function run(script,args=[]){return new Promise((resolve,reject)=>{let output='';const child=spawn(process.execPath,[join(root,'scripts',script),...args],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});child.stdout.on('data',chunk=>{output+=chunk;});child.stderr.on('data',chunk=>{output+=chunk;});child.once('error',reject);child.once('exit',code=>code===0?resolve(output):reject(Error(output)));});}
 try{
  await run('Abrir-Monitor.mjs',['--no-browser']);const first=await readFile(join(data,'service.pid'),'utf8');
  await run('Abrir-Monitor.mjs',['--no-browser']);assert.equal(await readFile(join(data,'service.pid'),'utf8'),first);
  assert.equal((await fetch(origin+'/')).status,200);await run('Encerrar-Monitor.mjs');await assert.rejects(fetch(origin+'/app-info'));
  await assert.rejects(readFile(join(data,'service.pid'),'utf8'),error=>error.code==='ENOENT');
 }finally{
  try{const info=await fetch(origin+'/app-info').then(r=>r.json());await fetch(origin+'/shutdown',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Monitor-Session':info.session},body:JSON.stringify({instanceId:info.instanceId})});await delay(1000);}catch{}
  await rm(dir,{recursive:true,force:true});
 }
});
