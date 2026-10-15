export const TASK_STATUSES=['nao_iniciado','em_andamento','aguardando','pausado','concluido'];
const fields=new Set(['title','project','linkCodex','status']);
export function taskError(message,status=400){return Object.assign(new Error(message),{status});}
export function normalizeTask(input,{partial=false}={}){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!fields.has(key))||!Object.keys(input).length)throw taskError('Campos de tarefa inválidos.');
 const value=partial?{}:{project:'',linkCodex:'',status:'nao_iniciado'};
 for(const [key,raw] of Object.entries(input)){
  if(typeof raw!=='string')throw taskError('Os campos devem ser texto.');
  const text=raw.trim();
  if(key==='title'&&(!text||text.length>200))throw taskError('Informe um nome com até 200 caracteres.');
  if(key==='project'&&text.length>120)throw taskError('O projeto deve ter até 120 caracteres.');
  if(key==='status'&&!TASK_STATUSES.includes(text))throw taskError('Situação da tarefa inválida.');
  if(key==='linkCodex'&&text){
   const match=text.match(/^(?:codex:\/\/threads\/)?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[?#].*)?$/i);
   if(!match)throw taskError('Informe o ID local do chat ou codex://threads/ID.');
   value[key]='codex://threads/'+match[1].toLowerCase();
  }else value[key]=text;
 }
 if(!partial&&!value.title)throw taskError('Informe o nome da tarefa.');
 return value;
}
