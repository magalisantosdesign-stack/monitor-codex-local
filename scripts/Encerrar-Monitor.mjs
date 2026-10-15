import {config} from '../src/config.mjs';
const origin='http://127.0.0.1:'+config.port;
try{
 const response=await fetch(origin+'/app-info',{signal:AbortSignal.timeout(1500)});if(!response.ok)throw Error('Aplicativo não reconhecido.');
 const info=await response.json();if(info.service!=='codex-monitor-local'||info.instanceId!==config.instanceId)throw Error('Essa porta pertence a outra instalação.');
 const result=await fetch(origin+'/shutdown',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Monitor-Session':info.session},body:JSON.stringify({instanceId:config.instanceId}),signal:AbortSignal.timeout(8000)});
 if(!result.ok)throw Error('Encerramento não confirmado.');
 let ended=false;for(let i=0;i<30;i++){await new Promise(resolve=>setTimeout(resolve,200));try{await fetch(origin+'/app-info',{signal:AbortSignal.timeout(500)});}catch{ended=true;break;}}
 if(!ended)throw Error('O processo ainda responde.');console.log('Aplicativo encerrado. Tarefas e histórico preservados.');
}catch(error){if(error.cause?.code==='ECONNREFUSED')console.log('O aplicativo já está encerrado.');else{console.error(error.message);process.exitCode=1;}}
