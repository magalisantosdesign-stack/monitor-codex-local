import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {openBrowser} from '../scripts/browser.mjs';
const root=dirname(dirname(fileURLToPath(import.meta.url)));
test('Browser opener waits for shell completion and reports failures',async()=>{
 let child;
 const opener=source=>(_command,_args,options)=>(child=spawn(process.execPath,['-e',source],options));
 await openBrowser('http://127.0.0.1:13021/#tarefas',{spawnProcess:opener('setTimeout(()=>process.exit(0),150)')});
 assert.equal(child.exitCode,0,'Do not detach the opener before it completes');
 await assert.rejects(openBrowser('http://127.0.0.1:13021/',{spawnProcess:opener('process.exit(7)')}),{code:'BROWSER_OPEN_FAILED'});
 await assert.rejects(openBrowser('http://127.0.0.1:13021/',{spawnProcess:()=>spawn(join(root,'missing-opener.exe'),[])}),{code:'BROWSER_SPAWN_FAILED'});
 await assert.rejects(openBrowser('http://127.0.0.1:13021/',{spawnProcess:opener('setTimeout(()=>{},30000)'),timeoutMs:100}),{code:'BROWSER_TIMEOUT'});
 if(child.exitCode===null&&child.signalCode===null)await new Promise(resolve=>child.once('close',resolve));
 assert.throws(()=>openBrowser('https://example.invalid/'));
});
test('Windows CMD preserves failure messages when Node is another CMD shim',{skip:process.platform!=='win32'},async()=>{
 const fixture=await mkdtemp(join(tmpdir(),'monitor-browser-cmd-'));
 try{
  await writeFile(join(fixture,'node.cmd'),'@echo off\r\necho TEST_NODE_SHIM_FAILURE\r\nexit /b 1\r\n');
  const result=await new Promise((resolve,reject)=>{
   let output='';const child=spawn(process.env.ComSpec||'cmd.exe',['/d','/c','call "'+join(root,'Abrir-Monitor.cmd')+'"'],{env:{...process.env,PATH:fixture+';'+process.env.PATH},windowsHide:true,windowsVerbatimArguments:true,stdio:['pipe','pipe','pipe']});
   child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);child.once('error',reject);child.once('close',code=>resolve({code,output}));child.stdin.end('\r\n');
  });
  assert.equal(result.code,1);assert.match(result.output,/TEST_NODE_SHIM_FAILURE/);assert.match(result.output,/Confira a mensagem acima/);
 }finally{await rm(fixture,{recursive:true,force:true});}
});
