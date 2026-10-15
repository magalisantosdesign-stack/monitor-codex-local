import {config,root} from '../src/config.mjs';
import {access,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {readSetup} from '../src/setup.mjs';
console.log('Monitor Codex Local');console.log('Node: '+process.versions.node);console.log('Endereço: http://127.0.0.1:'+config.port);
const setup=await readSetup();console.log('Eventos desta cópia no Codex: '+setup.events+'/'+setup.expected+' · '+setup.status);console.log('Configuração consultada: '+join(config.codexHome,'hooks.json'));
if(setup.configured===false)console.log('Abra Configurar-Codex.cmd e confirme a instalação com S.');
if(setup.configured)console.log('Instalação encontrada. Confiança no Codex e recebimento de evento real ainda precisam ser verificados.');
try{await access(join(root,'public/app.js'));console.log('Interface compilada: presente');}catch{console.log('Interface ausente: use o pacote completo ou npm install e npm run build.');}
try{const response=await fetch('http://127.0.0.1:'+config.port+'/app-info',{signal:AbortSignal.timeout(1500)});const info=await response.json();console.log(info.service==='codex-monitor-local'&&info.instanceId===config.instanceId?'Processo desta cópia: conectado':'A porta está sendo usada por outra aplicação.');}
catch{console.log('Processo não confirmado: abra Abrir-Monitor.cmd.');}
try{const report=JSON.parse(await readFile(join(root,'.local/startup-result.json'),'utf8'));console.log('Última abertura: '+report.status+' · '+report.code);}catch{}
try{const report=JSON.parse(await readFile(join(root,'.local/browser-startup.json'),'utf8'));console.log('Última chamada ao navegador: '+report.code);console.log('Se a aba não apareceu, abra o endereço acima manualmente.');}catch{}
console.log('Dados privados: '+config.dataDir);console.log('Em falha de abertura, consulte service-error.log nessa pasta. Não publique dados ou logs pessoais.');
