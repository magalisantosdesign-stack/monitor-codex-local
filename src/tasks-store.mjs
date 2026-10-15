import {DatabaseSync} from 'node:sqlite';
import {normalizeTask,taskError} from './task-model.mjs';
export function createTasksStore(path){
 const db=new DatabaseSync(path);
 try{
  const version=db.prepare('PRAGMA user_version').get().user_version;
  if(version===0){
   if(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().length)throw Error('Banco de tarefas não reconhecido; arquivo preservado.');
   db.exec("BEGIN; CREATE TABLE tasks(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,project TEXT NOT NULL DEFAULT '',linkCodex TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'nao_iniciado',createdAt TEXT NOT NULL,updatedAt TEXT NOT NULL); CREATE TABLE metadata(revision INTEGER NOT NULL); INSERT INTO metadata VALUES(0); PRAGMA user_version=1; COMMIT;");
  }else if(version!==1)throw Error('Versão do banco incompatível; arquivo preservado.');
  const names=db.prepare('PRAGMA table_info(tasks)').all().map(row=>row.name);
  if(names.join('|')!=='id|title|project|linkCodex|status|createdAt|updatedAt')throw Error('Esquema de tarefas incompatível; arquivo preservado.');
 }catch(error){db.close();throw error;}
 const revision=()=>db.prepare('SELECT revision FROM metadata').get().revision;
 function links(){
  const groups=new Map();
  for(const row of db.prepare("SELECT title,linkCodex FROM tasks WHERE linkCodex!='' ORDER BY id").all()){
   const id=row.linkCodex.slice('codex://threads/'.length);if(!groups.has(id))groups.set(id,[]);groups.get(id).push(row.title);
  }
  return {ids:[...groups.keys()],labels:[...groups].map(([id,titles])=>({id,title:[...new Set(titles)].join(' · ').slice(0,512)}))};
 }
 function mutate(operation){
  db.exec('BEGIN IMMEDIATE');
  try{const result=operation();if(links().ids.length>2000)throw taskError('O limite desta versão é 2.000 chats vinculados.',409);db.exec('UPDATE metadata SET revision=revision+1; COMMIT;');return result;}
  catch(error){db.exec('ROLLBACK');throw error;}
 }
 return {
  list({page=1,pageSize=200,expectedRevision}={}){
   if(!Number.isInteger(page)||page<1||!Number.isInteger(pageSize)||pageSize<1||pageSize>200)throw taskError('Paginação inválida.');
   const current=revision();if(expectedRevision!==undefined&&Number(expectedRevision)!==current)throw taskError('As tarefas mudaram durante a consulta. Atualize para obter a lista atual.',409);
   const total=db.prepare('SELECT COUNT(*) AS count FROM tasks').get().count;
   return {data:db.prepare('SELECT * FROM tasks ORDER BY id DESC LIMIT ? OFFSET ?').all(pageSize,(page-1)*pageSize),total,totalPage:Math.max(1,Math.ceil(total/pageSize)),revision:current};
  },
  get(id){return db.prepare('SELECT * FROM tasks WHERE id=?').get(id)||null;},
  create(input){const value=normalizeTask(input);return mutate(()=>{const now=new Date().toISOString();const result=db.prepare('INSERT INTO tasks(title,project,linkCodex,status,createdAt,updatedAt) VALUES(?,?,?,?,?,?)').run(value.title,value.project,value.linkCodex,value.status,now,now);return db.prepare('SELECT * FROM tasks WHERE id=?').get(result.lastInsertRowid);});},
  update(id,input){
   const value=normalizeTask(input,{partial:true});if(!Number.isSafeInteger(id)||id<1)throw taskError('Tarefa não encontrada.',404);
   return mutate(()=>{const old=db.prepare('SELECT * FROM tasks WHERE id=?').get(id);if(!old)throw taskError('Tarefa não encontrada.',404);const next={...old,...value};db.prepare('UPDATE tasks SET title=?,project=?,linkCodex=?,status=?,updatedAt=? WHERE id=?').run(next.title,next.project,next.linkCodex,next.status,new Date().toISOString(),id);return db.prepare('SELECT * FROM tasks WHERE id=?').get(id);});
  },links,close(){db.close();},
 };
}
