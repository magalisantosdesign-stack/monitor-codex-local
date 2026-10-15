import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createTasksStore} from '../src/tasks-store.mjs';
import {normalizeTask} from '../src/task-model.mjs';
const chat='00000000-0000-4000-8000-000000000001';
test('SQLite persists unlinked tasks, edits, business status and shared chat bindings',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'monitor-local-db-'));let db;
 try{db=createTasksStore(join(dir,'tasks.sqlite'));const a=db.create({title:' Exemplo ',project:' Projeto fictício '});assert.equal(a.title,'Exemplo');assert.equal(a.status,'nao_iniciado');assert.equal(db.links().ids.length,0);db.close();db=createTasksStore(join(dir,'tasks.sqlite'));assert.equal(db.list().data.length,1);
  db.update(a.id,{linkCodex:chat});const b=db.create({title:'Outro exemplo',linkCodex:'codex://threads/'+chat});assert.equal(db.links().ids.length,1);assert.match(db.links().labels[0].title,/Outro exemplo/);
  db.update(a.id,{status:'concluido'});assert.equal(db.get(a.id).linkCodex,'codex://threads/'+chat);db.update(a.id,{linkCodex:''});assert.equal(db.links().ids.length,1);db.update(b.id,{linkCodex:''});assert.equal(db.links().ids.length,0);assert.equal(db.list().total,2);
 }finally{db?.close();await rm(dir,{recursive:true,force:true});}
});
test('Server validation blocks unknown fields, invalid IDs, oversized and empty names',()=>{
 for(const value of [{title:''},{title:'x'.repeat(201)},{title:'Exemplo',project:'x'.repeat(121)},{title:'Exemplo',linkCodex:'https://example.invalid/share/chat'},{title:'Exemplo',status:'respondido'},{title:'Exemplo',command:'bad'},{title:4},[]])assert.throws(()=>normalizeTask(value));
 assert.equal(normalizeTask({title:'Exemplo',linkCodex:chat+'?view=review'}).linkCodex,'codex://threads/'+chat);
});
test('Pagination rejects a stale snapshot instead of duplicating/skipping records',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'monitor-local-pages-'));let db;
 try{db=createTasksStore(join(dir,'tasks.sqlite'));db.create({title:'Primeiro exemplo'});const first=db.list({pageSize:1});db.create({title:'Segundo exemplo'});assert.throws(()=>db.list({page:2,pageSize:1,expectedRevision:first.revision}),error=>error.status===409);assert.throws(()=>db.update(999,{title:'Ausente'}),error=>error.status===404);assert.equal(db.list().total,2);}
 finally{db?.close();await rm(dir,{recursive:true,force:true});}
});
test('A damaged database is preserved and cannot be silently reset',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'monitor-local-bad-db-'));const file=join(dir,'tasks.sqlite');
 try{await writeFile(file,'not a database');assert.throws(()=>createTasksStore(file));assert.equal(await readFile(file,'utf8'),'not a database');}finally{await rm(dir,{recursive:true,force:true});}
});
