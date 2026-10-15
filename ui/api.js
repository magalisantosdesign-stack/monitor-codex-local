import {useCallback,useEffect,useRef,useState} from 'react';
export const demo=new URLSearchParams(window.location.search).get('demo')==='1';
let session='';
const listeners=new Set();
export function setSession(value){session=value;}
export async function appFetch(url,options={}){
 const method=(options.method||'GET').toUpperCase(),headers=new Headers(options.headers||{});
 if(!['GET','HEAD'].includes(method)){if(demo)throw Error('A demonstração não grava dados.');if(!session)throw Error('Sessão local indisponível. Reabra o aplicativo.');headers.set('X-Monitor-Session',session);}
 return window.fetch(url,{...options,headers,credentials:'omit',signal:options.signal||AbortSignal.timeout(6000)});
}
export async function request(path,options={}){
 const response=await appFetch(path,options);let data;
 try{data=await response.json();}catch{throw Error('O aplicativo não confirmou a resposta.');}
 if(!response.ok)throw Object.assign(Error(data.error||'Não foi possível concluir a operação.'),{status:response.status});return data;
}
export async function fetchTasks(){
 const first=await request('/api/tasks?page=1&pageSize=200'),rows=[...first.data];
 for(let page=2;page<=first.totalPage;page++)rows.push(...(await request('/api/tasks?page='+page+'&pageSize=200&revision='+first.revision)).data);
 return rows;
}
export async function saveTask(values,id){
 const result=await request('/api/tasks'+(id?'/'+id:''),{method:id?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(values)});
 for(const listener of listeners)listener();return result;
}
export function useTasks(){
 const [rows,setRows]=useState([]),[error,setError]=useState(''),epoch=useRef(0),mounted=useRef(true),busy=useRef(false);
 const reload=useCallback(async()=>{const version=++epoch.current;busy.current=true;
  try{const data=await fetchTasks();if(mounted.current&&version===epoch.current){setRows(data);setError('');}}
  catch(failure){if(mounted.current&&version===epoch.current)setError(failure.message);}
  finally{if(version===epoch.current)busy.current=false;}
 },[]);
 useEffect(()=>{mounted.current=true;if(demo)return()=>{mounted.current=false;};reload();listeners.add(reload);const timer=setInterval(()=>{if(!busy.current)reload();},10000);return()=>{mounted.current=false;epoch.current++;listeners.delete(reload);clearInterval(timer);};},[reload]);
 return {rows,error,reload};
}
// Adapter for the reused analytics pagination; this accesses only our local API.
export function makeTaskResource(){
 let page=1,size=200,data=[],total=1,revision;
 return {setResourceName(name){if(name!=='codex_monitor_tasks')throw Error('Fonte local inválida.');},setPageSize(value){size=value;},setAppends(){},setPage(value){page=value;if(page===1)revision=undefined;},async refresh(){const value=await request('/api/tasks?page='+page+'&pageSize='+size+(revision===undefined?'':'&revision='+revision));data=value.data;total=value.totalPage;revision=value.revision;},getData:()=>data,getTotalPage:()=>total};
}
