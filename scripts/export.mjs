import {mkdir,copyFile,writeFile,readFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {checkDistribution,distributionRoot} from './check-distribution.mjs';
const files=await checkDistribution(),destination=join(distributionRoot,'release','monitor-codex-local-'+new Date().toISOString().replace(/[:.]/g,'-'));
await mkdir(destination,{recursive:true});const sums=[];
for(const name of files){const target=join(destination,name);await mkdir(dirname(target),{recursive:true});await copyFile(join(distributionRoot,name),target);sums.push(createHash('sha256').update(await readFile(target)).digest('hex')+'  '+name);}
await writeFile(join(destination,'SHA256SUMS.txt'),sums.join('\n')+'\n');console.log(destination);
