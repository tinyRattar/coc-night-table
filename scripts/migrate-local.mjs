import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));
const dir=new URL('../.sites-runtime/',import.meta.url);await mkdir(dir,{recursive:true});
const config=new URL('local-migrations.json',dir);
await writeFile(config,JSON.stringify({name:'coc-local-migrations',compatibility_date:'2026-05-15',d1_databases:[{binding:'DB',database_name:'site-creator-d1',database_id:'00000000-0000-4000-8000-000000000000',migrations_dir:fileURLToPath(new URL('../drizzle/',import.meta.url))}]},null,2));
const result=spawnSync(process.execPath,['--import',new URL('./sites-env.mjs',import.meta.url).href,fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js',import.meta.url)),'d1','migrations','apply','DB','--local','--config',fileURLToPath(config),'--persist-to',fileURLToPath(new URL('../.wrangler/state',import.meta.url))],{cwd:root,stdio:'inherit'});
if(result.error)throw result.error;process.exit(result.status??1);
