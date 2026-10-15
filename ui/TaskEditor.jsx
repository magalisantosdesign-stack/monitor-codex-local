import React,{useEffect,useRef,useState} from 'react';
import {Alert,Button,Drawer,Input,Select,Space,Typography} from 'antd';
import {normalizeTask} from '../src/task-model.mjs';
import {demo,saveTask} from './api.js';
export const situations=[{value:'nao_iniciado',label:'Não iniciado',color:'#8c8c8c'},{value:'em_andamento',label:'Em andamento',color:'#1677ff'},{value:'aguardando',label:'Aguardando',color:'#d4a106'},{value:'pausado',label:'Pausado',color:'#fa8c16'},{value:'concluido',label:'Concluído',color:'#52c41a'}];
export function chatId(value){const match=String(value||'').trim().match(/^(?:codex:\/\/threads\/)?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[?#].*)?$/i);return match?match[1].toLowerCase():null;}
export default function TaskEditor({open,task,onClose,onSaved}){
 const [draft,setDraft]=useState({title:'',project:'',linkCodex:'',status:'nao_iniciado'}),[error,setError]=useState(''),[busy,setBusy]=useState(false),pending=useRef(false),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{if(open){setError('');setDraft(task?{title:task.title,project:task.project,linkCodex:task.linkCodex,status:task.status}:{title:'',project:'',linkCodex:'',status:'nao_iniciado'});}},[open,task]);
 function close(){if(!pending.current)onClose();}
 async function save(){
  if(demo||pending.current)return;let values;
  try{values=normalizeTask(draft);}catch(failure){setError(failure.message);return;}
  pending.current=true;setBusy(true);setError('');
  try{const result=await saveTask(values,task?.id);if(mounted.current){onSaved?.(result);onClose();}}
  catch(failure){if(mounted.current)setError(failure.message+' Se a conexão caiu durante o envio, atualize e procure a tarefa antes de repetir.');}
  finally{pending.current=false;if(mounted.current)setBusy(false);}
 }
 return <Drawer title={task?'Editar tarefa':'Nova tarefa'} open={open} onClose={close} width="min(480px, 100vw)" closable={!busy} maskClosable={!busy} keyboard={!busy}>
  <Space direction="vertical" size={16} style={{width:'100%'}}>
   <label>Nome da tarefa *<Input aria-label="Nome da tarefa" value={draft.title} maxLength={200} disabled={busy} onChange={event=>setDraft({...draft,title:event.target.value})}/></label>
   <label>Projeto (opcional)<Input aria-label="Projeto da tarefa" value={draft.project} maxLength={120} disabled={busy} onChange={event=>setDraft({...draft,project:event.target.value})}/></label>
   <Space direction="vertical" style={{width:'100%'}}><Typography.Text>Situação da tarefa</Typography.Text><Select aria-label="Situação da tarefa" value={draft.status} options={situations} style={{width:'100%'}} disabled={busy} onChange={status=>setDraft({...draft,status})}/></Space>
   <label>Link do chat (opcional)<Input aria-label="Link do chat da tarefa" value={draft.linkCodex} disabled={busy} onChange={event=>setDraft({...draft,linkCodex:event.target.value})} placeholder="codex://threads/… ou ID do chat"/></label>
   <Typography.Text type="secondary">Sem chat, a tarefa continua no Kanban. Com link, aparece também no Monitor Codex. Alterar ou remover o link mantém o histórico de consumo.</Typography.Text>
   {demo&&<Alert type="info" showIcon message="Demonstração: nenhum cadastro será gravado."/>}{error&&<Alert type="error" showIcon message={error}/>}
   <Space><Button type="primary" disabled={demo} loading={busy} onClick={save}>{task?'Salvar alterações':'Cadastrar tarefa'}</Button><Button disabled={busy} onClick={close}>Cancelar</Button></Space>
  </Space>
 </Drawer>;
}
