import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {root,config} from './config.mjs';
const session=randomBytes(32).toString('hex');
const {version}=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
const origin='http://127.0.0.1:'+config.port;
const assets=new Map([['/',['index.html','text/html; charset=utf-8']],['/app.js',['app.js','text/javascript; charset=utf-8']],['/app.css',['app.css','text/css; charset=utf-8']],['/app.js.LEGAL.txt',['app.js.LEGAL.txt','text/plain; charset=utf-8']]]);
export function allowRequest(req,res){
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');
 if(req.headers.host!=='127.0.0.1:'+config.port||req.headers.origin&&req.headers.origin!==origin||req.headers['sec-fetch-site']==='cross-site'){res.writeHead(403);res.end();return false;}
 if(!['GET','HEAD','OPTIONS'].includes(req.method)){
  const supplied=Buffer.from(String(req.headers['x-monitor-session']||'')),expected=Buffer.from(session);
  if(!req.headers.origin||supplied.length!==expected.length||!timingSafeEqual(supplied,expected)){res.writeHead(403);res.end('{"error":"Sessão local não confirmada. Reabra o aplicativo."}');return false;}
 }
 return true;
}
export async function webRequest(req,res){
 const path=new URL(req.url,origin).pathname;
 if(path==='/app-info'&&req.method==='GET'){
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({service:'codex-monitor-local',version,instanceId:config.instanceId,session,origin}));return true;
 }
 const asset=assets.get(path);if(!asset)return false;
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return true;}
 try{
  const data=await readFile(join(root,'public',asset[0]));res.setHeader('Content-Type',asset[1]);
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'; form-action 'none'");
  res.end(req.method==='HEAD'?undefined:data);
 }catch{res.writeHead(503);res.end('Interface indisponível. Execute npm run build nesta pasta.');}
 return true;
}
export async function readJson(req,limit=8192){
 if(!/^application\/json(?:;|$)/i.test(String(req.headers['content-type']||'')))throw Object.assign(Error('Envie JSON.'),{status:415});
 let bytes=0;const parts=[];
 for await(const chunk of req){bytes+=chunk.length;if(bytes>limit)throw Object.assign(Error('Pedido grande demais.'),{status:413});parts.push(chunk);}
 try{return JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{throw Object.assign(Error('JSON inválido.'),{status:400});}
}
