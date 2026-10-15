import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {config,root} from './config.mjs';
import {hookCommand} from '../scripts/Install-Hooks.mjs';
export const requiredEvents=['UserPromptSubmit','PreToolUse','PermissionRequest','PostToolUse','PreCompact','PostCompact','Stop','Interrupt','SessionEnd'];
export async function readSetup({home=config.codexHome,command=hookCommand(process.execPath,join(root,'src/hook.mjs'))}={}){
 try{
  const source=JSON.parse(await readFile(join(home,'hooks.json'),'utf8'));
  if(!source.hooks||typeof source.hooks!=='object')return {status:'missing',configured:false,events:0,expected:requiredEvents.length};
  const count=requiredEvents.filter(event=>Array.isArray(source.hooks[event])&&source.hooks[event].some(group=>Array.isArray(group.hooks)&&group.hooks.some(handler=>handler.type==='command'&&(handler.commandWindows||handler.command)===command))).length;
  return {status:count===requiredEvents.length?'configured':count?'partial':'missing',configured:count===requiredEvents.length,events:count,expected:requiredEvents.length};
 }catch(error){return {status:error.code==='ENOENT'?'missing':'unavailable',configured:error.code==='ENOENT'?false:null,events:0,expected:requiredEvents.length};}
}
