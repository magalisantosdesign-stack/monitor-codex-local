import {createTasksStore} from './tasks-store.mjs';
import {readSetup} from './setup.mjs';
import {allowRequest,webRequest,readJson} from './web.mjs';
import {config} from './config.mjs';
import {createUsageReader} from './usage.mjs';
import {createTokenReader} from './tokens.mjs';
import {createTokenHistory} from './token-history.mjs';
import http from 'node:http';
import {mkdir,readFile,writeFile,readdir,rename,unlink} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {UUID,reduceState} from './state.mjs';
import {canStandby,resumesStandby,visibleStates} from './standby.mjs';
import {readReviewerSettings,reviewerFromSnapshot,reconcileApprovalReviewer} from './permissions.mjs';
import {queryRuntime,reconcileRuntime,runtimeCandidates} from './runtime.mjs';
import {hookConfirmation,runtimeConfirmation,displayState} from './health.mjs';
const base=config.dataDir;
const port=config.port;
const origins=new Set(config.origins);
await mkdir(join(base,'events'),{recursive:true});
async function load(name,fallback){try{return JSON.parse(await readFile(join(base,name),'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}}
const taskStore=createTasksStore(join(base,'tasks.sqlite'));
let registry={ids:taskStore.links().ids},states=await load('states.json',{}),standby=await load('standby.json',{});
await save('linked.json',registry);
states=Object.fromEntries(Object.entries(states).filter(([id])=>registry.ids.includes(id)));
standby=Object.fromEntries(Object.entries(standby).filter(([id])=>registry.ids.includes(id)));
const diagnostics={startedAt:Date.now(),events:[],browserPolls:0,lastBrowserPoll:null,lastConsumeError:false};
const health={},retryRequested=new Set();
async function save(name,value){const tmp=join(base,name+'.tmp');await writeFile(tmp,JSON.stringify(value));await rename(tmp,join(base,name));}
const startupSettings=await readReviewerSettings();
let reconciled=false;
for(const id of registry.ids){const old=states[id];states[id]=reconcileApprovalReviewer(old,reviewerFromSnapshot(startupSettings,id));if(states[id]!==old)reconciled=true;}
if(reconciled)await save('states.json',states);
const readUsage=createUsageReader({bridges:async()=>{
 const values=[];
 for(const id of [...registry.ids]){const value=await load(join('desktop-bridges',id+'.json'),null);if(value&&value.threadId===id)values.push(value);}
 return values;
}});
let tokenHistory;
try{tokenHistory=await createTokenHistory({dataDir:base});await tokenHistory.sync([]);await tokenHistory.sync(registry.ids);}catch{/* Preserve an unreadable history file; status monitoring remains available. */}
const readTokens=createTokenReader({codexHome:config.codexHome,executable:config.codexExecutable,ids:()=>registry.ids,history:tokenHistory});
// Only linked numeric metadata is sampled in the background, while this collector runs.
async function sampleTokens(){await readTokens.sample();await tokenHistory?.labels(taskStore.links().labels,registry.ids);}
const tokenTimer=setInterval(()=>void sampleTokens().catch(()=>{}),60000);
void sampleTokens().catch(()=>{});
let linksDirty=true;
async function syncTasks(){
 const values=taskStore.links(),changed=registry.ids.join('|')!==values.ids.join('|');
 registry={ids:values.ids};await save('linked.json',registry);
 states=Object.fromEntries(Object.entries(states).filter(([id])=>registry.ids.includes(id)));
 standby=Object.fromEntries(Object.entries(standby).filter(([id])=>registry.ids.includes(id)));
 for(const id of Object.keys(health))if(!registry.ids.includes(id)){delete health[id];retryRequested.delete(id);}
 diagnostics.events=diagnostics.events.filter(event=>registry.ids.includes(event.sessionId));
 await save('states.json',states);await save('standby.json',standby);if(changed)readTokens.invalidate();
 await tokenHistory?.sync(registry.ids);await sampleTokens();linksDirty=false;
}
let tail=Promise.resolve();
function serial(fn){const result=tail.then(fn);tail=result.catch(()=>{});return result;}
async function consume(){
 if(linksDirty)try{await syncTasks();}catch{/* A confirmed task save is retried independently of collector storage. */}
 const names=(await readdir(join(base,'events'))).filter(n=>/^\d+-[0-9a-f-]+\.json$/.test(n)).sort();
 let changed=false;const done=[];
 for(const name of names){const e=JSON.parse(await readFile(join(base,'events',name),'utf8'));
  if(registry.ids.includes(e.sessionId)){
   if(e.event==='PermissionRequest')e.approvalReviewer=reviewerFromSnapshot(await readReviewerSettings(),e.sessionId);
   const previous=states[e.sessionId],next=reduceState(previous,e);states[e.sessionId]=next;changed=true;
   const confirmed=hookConfirmation(previous,next,e);if(confirmed)health[e.sessionId]=confirmed;
   if(resumesStandby(standby[e.sessionId],previous,next,e))delete standby[e.sessionId];
   diagnostics.events.push({sessionId:e.sessionId,turnId:e.turnId,event:e.event,at:e.at,tool:e.tool,toolId:e.toolId,subagent:e.subagent,approvalReviewer:e.approvalReviewer,accepted:next!==previous,status:next?.status});
   if(diagnostics.events.length>100)diagnostics.events.shift();
  }done.push(name);}
 if(changed){await save('states.json',states);await save('standby.json',standby);}
 for(const name of done)await unlink(join(base,'events',name));
 diagnostics.lastConsumeError=false;
}
const timer=setInterval(()=>serial(consume).catch(()=>{diagnostics.lastConsumeError=true;}),500);
let runtimeBusy=false;
async function refreshRuntime(){
 if(runtimeBusy||stopping||!registry.ids.length)return;runtimeBusy=true;
 try{
  const ids=[...registry.ids].sort((a,b)=>Number(retryRequested.has(b))-Number(retryRequested.has(a))),bridges=[];
  for(const id of ids){const value=await load(join('desktop-bridges',id+'.json'),null);if(value)bridges.push(value);}
  let cursor=0;
  async function worker(){while(cursor<ids.length&&!stopping){
   const id=ids[cursor++];retryRequested.delete(id);
   const pending=states[id],candidates=runtimeCandidates(id,bridges,states);
   health[id]={...health[id],retrying:true};
   let observations=[];
   for(const bridge of candidates){
    if(stopping)break;
    observations=await queryRuntime(bridge,[id],{timeoutMs:1500,metadata:true,questionToolId:pending?.questionPending?pending.questionToolId:undefined});
    if(observations.some(row=>row.type!=='notLoaded'))break;
   }
   await serial(async()=>{
    await consume();let changed=false;
    if(!registry.ids.includes(id)){delete health[id];return;}
    health[id]={...health[id],retrying:false,attemptAt:Date.now()};
    if(!observations.length){health[id].reason=candidates.length?'read_failed':'no_bridge';return;}
    for(const observation of observations){
     if(!registry.ids.includes(observation.sessionId))continue;
     if(observation.at<(states[id]?.at||0)||states[id]?.retiredTurns?.includes(observation.turnId))continue;
     if(observation.flags.includes('waitingOnApproval'))observation.approvalReviewer=reviewerFromSnapshot(await readReviewerSettings(),observation.sessionId);
     const old=states[observation.sessionId],next=reconcileRuntime(old,observation);
     if(next!==old){states[observation.sessionId]=next;changed=true;
      if(standby[observation.sessionId]&&observation.at>standby[observation.sessionId].at&&(next.status==='processando'||next.turnId!==standby[observation.sessionId].turnId))delete standby[observation.sessionId];
     }
     const confirmed=runtimeConfirmation(next,observation);
     health[id]=confirmed?{...health[id],...confirmed,retrying:false}:{...health[id],reason:observation.type==='notLoaded'?'not_loaded':'turn_mismatch',retrying:false};
    }
    if(changed){await save('states.json',states);await save('standby.json',standby);}
   });
  }}
  await Promise.all(Array.from({length:Math.min(4,ids.length)},()=>worker()));
 }catch{/* Missing/changed desktop bridge never manufactures a status. */}
 finally{runtimeBusy=false;}
}
const runtimeTimer=setInterval(()=>void refreshRuntime(),3000);
let stopping=false;
const server=http.createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');if(!allowRequest(req,res))return;const origin=req.headers.origin||config.origins[0];
 res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');
 res.setHeader('Access-Control-Allow-Methods','GET,POST,PATCH,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type,X-Monitor-Session');res.setHeader('Access-Control-Allow-Private-Network','true');
 if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
 try{
  if(stopping){res.writeHead(503);res.end('{"error":"stopping"}');return;}

  if(await webRequest(req,res))return;
  const taskUrl=new URL(req.url,config.origins[0]);
  if(taskUrl.pathname==='/api/tasks'&&req.method==='GET'){
   const value=taskStore.list({page:Number(taskUrl.searchParams.get('page')||1),pageSize:Number(taskUrl.searchParams.get('pageSize')||200),expectedRevision:taskUrl.searchParams.has('revision')?taskUrl.searchParams.get('revision'):undefined});
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));return;
  }
  if(taskUrl.pathname==='/api/tasks'&&req.method==='POST'||/^\/api\/tasks\/[1-9]\d*$/.test(taskUrl.pathname)&&req.method==='PATCH'){
   const input=await readJson(req);let saved;
   await serial(async()=>{saved=req.method==='POST'?taskStore.create(input):taskStore.update(Number(taskUrl.pathname.split('/').at(-1)),input);linksDirty=true;try{await syncTasks();}catch{/* Persisted in SQLite; the collector retries the link mirror. */}});
   res.setHeader('Content-Type','application/json');res.writeHead(req.method==='POST'?201:200);res.end(JSON.stringify({data:saved,monitorPending:linksDirty}));return;
  }
  if(req.url==='/shutdown'&&req.method==='POST'){
   if(!String(req.headers['content-type']||'').startsWith('application/json')){res.writeHead(415);res.end();return;}
   let body='';for await(const chunk of req){body+=chunk;if(body.length>2048)throw new Error('too large');}
   const input=JSON.parse(body);
   if(input.instanceId!==config.instanceId){res.writeHead(409);res.end('{"error":"instance mismatch"}');return;}
   // Persist queued events before acknowledging; only this server exits.
   await serial(consume);
   res.setHeader('Content-Type','application/json');
   res.once('finish',()=>{void stop();});
   res.end('{"ok":true}');return;
  }
  if(req.url==='/linked'){res.writeHead(405);res.end();return;}
  if(req.url==='/recheck'&&req.method==='POST'){
   if(!String(req.headers['content-type']||'').startsWith('application/json')){res.writeHead(415);res.end();return;}
   let body='';for await(const chunk of req){body+=chunk;if(body.length>2048)throw new Error('too large');}
   const input=JSON.parse(body);
   if(input.instanceId!==config.instanceId){res.writeHead(409);res.end('{"error":"instance mismatch"}');return;}
   if(typeof input.id!=='string'||!UUID.test(input.id))throw new Error('invalid id');
   const id=input.id.toLowerCase();
   if(!registry.ids.includes(id)){res.writeHead(404);res.end();return;}
   retryRequested.add(id);void refreshRuntime();
   res.setHeader('Content-Type','application/json');res.writeHead(202);res.end('{"ok":true}');return;
  }
  if(req.url==='/standby'&&req.method==='POST'){
   if(!String(req.headers['content-type']||'').startsWith('application/json')){res.writeHead(415);res.end();return;}
   let body='';for await(const chunk of req){body+=chunk;if(body.length>4096)throw new Error('too large');}
   const input=JSON.parse(body);
   if(typeof input.id!=='string'||!UUID.test(input.id)||typeof input.enabled!=='boolean')throw new Error('invalid standby');
   const id=input.id.toLowerCase();
   const code=await serial(async()=>{
    await consume();
    if(!registry.ids.includes(id))return 404;
    if(input.enabled&&(!canStandby(states[id])||states[id]&&displayState(states[id],health[id]).displayStatus==='nao_confirmado'))return 409;
    const updated={...standby};
    if(input.enabled)updated[id]={at:Date.now(),turnId:states[id]?.turnId||''};else delete updated[id];
    await save('standby.json',updated);standby=updated;return 200;
   });
   res.setHeader('Content-Type','application/json');res.writeHead(code);res.end(code===200?'{"ok":true}':'{"error":"standby unavailable"}');return;
  }
  if(req.url==='/tokens'&&req.method==='GET'){
   const result=await readTokens();res.setHeader('Content-Type','application/json');res.end(JSON.stringify({...result,instanceId:config.instanceId}));return;
  }
  if(req.url==='/token-labels'&&req.method==='POST'){
   if(!String(req.headers['content-type']||'').startsWith('application/json')){res.writeHead(415);res.end();return;}
   let body='';for await(const chunk of req){body+=chunk;if(body.length>2000000)throw new Error('too large');}
   const input=JSON.parse(body);
   if(!Array.isArray(input.labels)||input.labels.length>2000||input.labels.some(row=>!row||typeof row.id!=='string'||!UUID.test(row.id)||typeof row.title!=='string'||row.title.length>512))throw new Error('invalid labels');
   if(!tokenHistory){res.writeHead(503);res.end('{"error":"history unavailable"}');return;}
   await tokenHistory.labels(taskStore.links().labels,registry.ids);
   res.setHeader('Content-Type','application/json');res.end('{"ok":true}');return;
  }
  if(req.url==='/token-preferences'&&req.method==='POST'){
   if(!String(req.headers['content-type']||'').startsWith('application/json')){res.writeHead(415);res.end();return;}
   let body='';for await(const chunk of req){body+=chunk;if(body.length>2048)throw new Error('too large');}
   const input=JSON.parse(body);
   if(!input||Object.keys(input).some(key=>!['instanceId','id','changes'].includes(key)))throw new Error('invalid preferences');
   if(input.instanceId!==config.instanceId){res.writeHead(409);res.end('{"error":"instance mismatch"}');return;}
   if(!tokenHistory){res.writeHead(503);res.end('{"error":"history unavailable"}');return;}
   const found=await tokenHistory.preferences(input.id,input.changes);
   res.setHeader('Content-Type','application/json');res.writeHead(found?200:404);res.end(found?'{"ok":true}':'{"error":"history not found"}');return;
  }
  if(req.url==='/usage'&&req.method==='GET'){
   const result=await readUsage();res.setHeader('Content-Type','application/json');res.end(JSON.stringify({...result,instanceId:config.instanceId}));return;
  }
  if(req.url==='/states'&&req.method==='GET'){
   await serial(consume);const at=Date.now(),view=Object.fromEntries(Object.entries(visibleStates(registry.ids,states,standby)).map(([id,state])=>[id,displayState(state,health[id],at)]));
   if(/Mozilla\//.test(String(req.headers['user-agent']||''))){diagnostics.browserPolls++;
    diagnostics.lastBrowserPoll={at,states:Object.fromEntries(Object.entries(view).map(([id,s])=>[id,{status:s.status,at:s.at,standby:s.standby}]))};}
   const setup=await readSetup();
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify({service:'codex-monitor',version:1,instanceId:config.instanceId,at,states:view,setup}));return;
  }
  if(req.url==='/diagnostics'&&req.method==='GET'){
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify(diagnostics));return;
  }
  res.writeHead(404);res.end();
 }catch(error){res.setHeader('Content-Type','application/json');res.writeHead(error.status||400);res.end(JSON.stringify({error:error.status?error.message:'Pedido inválido.'}));}
});
server.on('error',error=>{process.exitCode=1;process.stderr.write('Não foi possível abrir a porta local: '+error.code+'\n');void stop();});
server.listen(port,'127.0.0.1',()=>process.stdout.write(`Codex monitor: http://127.0.0.1:${port}\n`));
async function stop(){
 if(stopping)return;stopping=true;clearInterval(timer);clearInterval(runtimeTimer);clearInterval(tokenTimer);
 await readTokens.stop();
 try{await tokenHistory?.sync([]);}catch{process.exitCode=1;}
 try{await serial(consume);}catch{process.exitCode=1;}
 const deadline=setTimeout(()=>{server.closeAllConnections();process.exit(process.exitCode||0);},5000);deadline.unref();
 server.close(async()=>{
  try{const pid=await readFile(join(base,'service.pid'),'utf8');if(Number(pid.trim())===process.pid)await unlink(join(base,'service.pid'));}catch{}
  taskStore.close();clearTimeout(deadline);process.exit(process.exitCode||0);
 });
 server.closeIdleConnections();
}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
