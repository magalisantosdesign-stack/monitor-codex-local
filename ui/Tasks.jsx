import React,{useRef,useState} from 'react';
import {Alert,Button,Card,Col,Empty,Input,Row,Select,Space,Tag,Typography,theme} from 'antd';
import TaskEditor,{situations,chatId} from './TaskEditor.jsx';
import {demo,saveTask,useTasks} from './api.js';
const examples=situations.map((value,i)=>({id:i+1,title:['Planejar campanha fictícia','Preparar apresentação de exemplo','Revisar proposta fictícia','Atualizar material de exemplo','Entregar resumo fictício'][i],project:'Projeto de demonstração',status:value.value,linkCodex:i%2?'codex://threads/00000000-0000-4000-8000-'+String(i+1).padStart(12,'0'):''}));
export default function Tasks(){
 const {token}=theme.useToken(),data=useTasks(),rows=demo?examples:data.rows;
 const [search,setSearch]=useState(''),[project,setProject]=useState(),[editor,setEditor]=useState(false),[editing,setEditing]=useState(null),[busy,setBusy]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),pending=useRef(false);
 const visible=rows.filter(row=>(!project||row.project===project)&&row.title.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));
 const projects=[...new Set(rows.map(row=>row.project).filter(Boolean))].sort();
 function open(row=null){if(pending.current)return;setEditing(row);setEditor(true);}
 async function move(row,status){if(demo||pending.current||row.status===status)return;pending.current=true;setBusy(row.id);setError('');try{await saveTask({status},row.id);setNotice('Situação da tarefa atualizada.');}catch(failure){setError(failure.message);}finally{pending.current=false;setBusy(null);}}
 return <Space direction="vertical" size="large" style={{width:'100%'}}>
  <Space wrap><Typography.Title level={3} style={{margin:0}}>Tarefas</Typography.Title>{demo&&<Tag color="green">Demonstração · dados fictícios</Tag>}<Button type="primary" onClick={()=>open()} disabled={busy!==null}>Cadastrar nova tarefa</Button><Button onClick={data.reload} disabled={demo||busy!==null}>Atualizar tarefas</Button></Space>
  <Typography.Text type="secondary">Organize o trabalho aqui. Concluir uma tarefa não muda o estado do chat no monitor.</Typography.Text>
  {(error||data.error)&&<Alert type="error" showIcon message={error||data.error}/>}{notice&&<Alert type="success" showIcon closable message={notice} onClose={()=>setNotice('')}/>}
  <Space wrap><Input aria-label="Buscar tarefa" allowClear value={search} onChange={event=>setSearch(event.target.value)} placeholder="Buscar tarefa" style={{width:260,maxWidth:'100%'}}/><Select aria-label="Filtrar tarefas por projeto" allowClear placeholder="Todos os projetos" value={project} onChange={setProject} options={projects.map(value=>({value,label:value}))} style={{minWidth:220}}/></Space>
  <Row wrap={false} gutter={12} style={{overflowX:'auto',paddingBottom:12}} aria-label="Kanban de tarefas">
   {situations.map(column=><Col key={column.value} flex="0 0 270px"><Card size="small" title={<Space><Typography.Text strong>{column.label}</Typography.Text><Tag>{visible.filter(row=>row.status===column.value).length}</Tag></Space>} style={{minHeight:400,height:'100%',background:token.colorFillAlter,borderTop:'3px solid '+column.color}}>
    <Space direction="vertical" size={12} style={{width:'100%'}}>{!visible.some(row=>row.status===column.value)&&<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhuma tarefa"/>}{visible.filter(row=>row.status===column.value).map(row=><Card key={row.id} size="small" style={{background:token.colorBgContainer}}><Space direction="vertical" size={10} style={{width:'100%'}}><Typography.Text strong style={{overflowWrap:'anywhere'}}>{row.title}</Typography.Text><Typography.Text type="secondary">{row.project||'Sem projeto'}</Typography.Text><Tag color={chatId(row.linkCodex)?'blue':'default'}>{chatId(row.linkCodex)?'Chat vinculado':'Sem chat vinculado'}</Tag><Select aria-label={'Situação de '+row.title} value={row.status} options={situations} onChange={value=>move(row,value)} disabled={demo||busy!==null} loading={busy===row.id} style={{width:'100%'}}/><Button size="small" disabled={busy!==null} onClick={()=>open(row)}>Editar tarefa</Button></Space></Card>)}</Space>
   </Card></Col>)}
  </Row>
  <TaskEditor open={editor} task={editing} onClose={()=>setEditor(false)} onSaved={result=>{setNotice(result.monitorPending?'Tarefa salva. A sincronização do monitor será tentada automaticamente.':'Tarefa salva.');data.reload();}}/>
 </Space>;
}
