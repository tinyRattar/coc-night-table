import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const token=process.env.SUPABASE_ACCESS_TOKEN,ref=process.env.SUPABASE_PROJECT_ID;
if(!token||!ref)throw Error('SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_ID are required');
const endpoint=`https://api.supabase.com/v1/projects/${encodeURIComponent(ref)}/database/migrations`;
async function api(method,body){
  const response=await fetch(endpoint,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(180000)});
  if(!response.ok)throw Error(`Supabase migration API ${response.status}: ${(await response.text()).replaceAll(token,'[redacted]')}`);
  return response.json();
}
let history=await api('GET');
for(const file of (await readdir('supabase/migrations')).filter(f=>/^\d+_[a-z0-9_]+\.sql$/.test(f)).sort()){
  const query=await readFile('supabase/migrations/'+file,'utf8');
  const prefix='coc_'+file.replace(/\.sql$/,'')+'_';
  const name=prefix+createHash('sha256').update(query).digest('hex').slice(0,16);
  if(history.some(m=>m.name===name)){console.log('Already applied:',file);continue}
  if(history.some(m=>m.name?.startsWith(prefix)))throw Error(`Applied migration changed: ${file}. Add a new migration instead.`);
  await api('POST',{name,query});
  history=await api('GET');
  if(!history.some(m=>m.name===name))throw Error(`Migration completion not confirmed: ${file}`);
  console.log('Applied:',file);
}
