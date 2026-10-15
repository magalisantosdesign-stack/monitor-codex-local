import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Alert,App as AntApp,Button,Card,ConfigProvider,Menu,Modal,Space,Tag,Typography,theme} from 'antd';
import 'antd/dist/reset.css';
import './style.css';
import Tasks from './Tasks.jsx';
import Monitor from './Monitor.jsx';
import Usage from './Usage.jsx';
import {demo,request,setSession} from './api.js';
const entries=[{key:'tarefas',label:'Tarefas'},{key:'monitor',label:'Monitor Codex'},{key:'uso',label:'Uso do Codex'}];
function currentPage(){const value=location.hash.slice(1);return entries.some(row=>row.key===value)?value:'tarefas';}
function Shell(){
 const [page,setPage]=useState(currentPage),[dark,setDark]=useState(()=>localStorage.getItem('monitor-local-theme')!=='light'),[info,setInfo]=useState(null),[online,setOnline]=useState(demo),[closed,setClosed]=useState(false),[closing,setClosing]=useState(false),[confirm,setConfirm]=useState(false),[error,setError]=useState('');
 useEffect(()=>{const change=()=>setPage(currentPage());window.addEventListener('hashchange',change);return()=>window.removeEventListener('hashchange',change);},[]);
 useEffect(()=>{
  if(demo){setInfo({version:'0.1.3'});return;}
  let active=true,running=false;const controller=new AbortController();
  async function poll(){if(running||closed)return;running=true;try{const data=await request('/app-info',{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(3500)])});if(data.service!=='codex-monitor-local')throw Error('Aplicativo não reconhecido.');if(active){setSession(data.session);setInfo(data);setOnline(true);}}catch{if(active)setOnline(false);}finally{running=false;}}
  poll();const timer=setInterval(poll,4000);return()=>{active=false;controller.abort();clearInterval(timer);};
 },[closed]);
 async function shutdown(){
  if(closing||demo||!info)return;setClosing(true);setError('');
  try{await request('/shutdown',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({instanceId:info.instanceId})});
   let ended=false;for(let i=0;i<24;i++){await new Promise(resolve=>setTimeout(resolve,250));try{await request('/app-info',{signal:AbortSignal.timeout(800)});}catch{ended=true;break;}}
   if(!ended)throw Error('O processo ainda responde. Tente encerrar novamente.');setClosed(true);setConfirm(false);setSession('');
  }catch(failure){setError(failure.message);}finally{setClosing(false);}
 }
 return <ConfigProvider theme={{algorithm:dark?theme.darkAlgorithm:theme.defaultAlgorithm,token:{colorPrimary:'#1677ff',borderRadius:10,fontFamily:'Segoe UI, Arial, sans-serif'}}}><AntApp><div className={'application '+(dark?'dark':'light')}>
  <aside className="sidebar"><Typography.Title level={4} style={{margin:'0 0 6px'}}>Monitor Codex</Typography.Title><Typography.Text type="secondary">Local · independente</Typography.Text><Menu mode="inline" selectedKeys={[page]} onClick={({key})=>{location.hash=key;}} items={entries} style={{border:0,background:'transparent',marginTop:24}}/></aside>
  <section className="workspace"><header><Space wrap><Tag color={demo?'gold':closed?'default':online?'green':'default'}>{demo?'Demonstração · dados fictícios':closed?'Encerrado':online?'Aplicativo conectado':'Aplicativo desconectado'}</Tag><Typography.Text type="secondary">{info?'v'+info.version:''}</Typography.Text></Space><Space wrap><Button onClick={()=>{const value=!dark;setDark(value);localStorage.setItem('monitor-local-theme',value?'dark':'light');}}>{dark?'Tema claro':'Tema escuro'}</Button><Button danger disabled={demo||!online||closed} loading={closing} onClick={()=>setConfirm(true)}>Encerrar aplicativo</Button></Space></header>
   <main>{error&&<Alert type="error" showIcon message={error} style={{marginBottom:16}}/>}{closed?<Card><Typography.Title level={3}>Aplicativo encerrado</Typography.Title><Typography.Paragraph>O processo do monitor foi encerrado. Você pode fechar esta aba. Para usar novamente, abra Abrir-Monitor.cmd.</Typography.Paragraph></Card>:<>
    {!online&&!demo&&<Alert type="warning" showIcon message="A conexão local não foi confirmada" description="Se você encerrou o aplicativo, abra Abrir-Monitor.cmd novamente. Os dados salvos permanecem no computador." style={{marginBottom:16}}/>}
    {(info||demo)&&(page==='tarefas'?<Tasks/>:page==='monitor'?<Monitor/>:<Usage online={online}/>)}
    {!info&&!demo&&<Card>Conectando ao aplicativo local…</Card>}
   </>}</main>
  </section>
  <Modal title="Encerrar o aplicativo?" open={confirm} onCancel={()=>{if(!closing)setConfirm(false);}} onOk={shutdown} okText="Encerrar aplicativo" cancelText="Continuar usando" confirmLoading={closing} closable={!closing} maskClosable={!closing}><Typography.Paragraph>Isso encerra somente este monitor. Tarefas, vínculos e histórico ficam salvos para a próxima abertura.</Typography.Paragraph></Modal>
 </div></AntApp></ConfigProvider>;
}
createRoot(document.getElementById('app')).render(<Shell/>);
