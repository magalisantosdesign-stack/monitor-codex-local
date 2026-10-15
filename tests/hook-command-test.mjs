import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,copyFile,rm,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {hookCommand} from '../scripts/Install-Hooks.mjs';
import {validateHookCommand} from '../scripts/validate-hook.mjs';
const root=dirname(dirname(fileURLToPath(import.meta.url)));
test('The generated Windows command records real synthetic events in CMD and PowerShell, including spaced Node paths',{skip:process.platform!=='win32',timeout:30000},async()=>{
 await validateHookCommand(hookCommand(process.execPath,join(root,'src/hook.mjs')));
 const fixture=await mkdtemp(join(tmpdir(),'monitor-spaced-node-'));
 try{
  const folder=join(fixture,'Node with spaces');await mkdir(folder);const node=join(folder,'node.exe');await copyFile(process.execPath,node);
  await validateHookCommand(hookCommand(node,join(root,'src/hook.mjs')));
 }finally{await rm(fixture,{recursive:true,force:true});}
});
test('Hook command rejects shell interpolation in Windows paths',()=>{
 for(const value of ['unsafe$path','unsafe`path','unsafe%path','unsafe&path'])assert.throws(()=>hookCommand('node.exe',value,'win32'));
});
test('Installer replaces only its own old quoted command and preserves other handlers',async()=>{
 const fixture=await mkdtemp(join(tmpdir(),'monitor-hook-upgrade-')),old='"'+process.execPath+'" "'+join(root,'src/hook.mjs')+'"';
 try{
  await writeFile(join(fixture,'hooks.json'),JSON.stringify({hooks:{Stop:[{hooks:[{type:'command',command:old},{type:'command',command:'echo preserved-example'}]}]}}));
  const code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[join(root,'scripts/Install-Hooks.mjs'),'--apply'],{env:{...process.env,CODEX_HOME:fixture,CODEX_MONITOR_CONFIG:join(fixture,'missing.json')},windowsHide:true,stdio:'ignore'});child.once('error',reject);child.once('close',resolve);});
  assert.equal(code,0);const hooks=JSON.parse(await readFile(join(fixture,'hooks.json'),'utf8')).hooks.Stop.flatMap(group=>group.hooks);
  assert.ok(hooks.some(row=>row.command==='echo preserved-example'));
  assert.equal(hooks.filter(row=>row.command===hookCommand(process.execPath,join(root,'src/hook.mjs'))).length,1);
  if(process.platform==='win32')assert.equal(hooks.some(row=>row.command===old),false);
 }finally{await rm(fixture,{recursive:true,force:true});}
});
