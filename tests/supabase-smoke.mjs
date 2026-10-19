import assert from 'node:assert/strict';
const endpoint = process.env.COC_API_URL;
if (!endpoint) throw Error('Set COC_API_URL to the deployed Edge Function URL');
const origin = process.env.COC_WEB_ORIGIN || 'https://tinyrattar.github.io';
const wait = () => new Promise(resolve => setTimeout(resolve, 800));
function client() {
  const sessions = new Map();
  return {
    sessions,
    async raw(path, method='GET', body) {
      const room = (body instanceof FormData ? '' : body?.room) || new URL(path, 'https://test.invalid').searchParams.get('room') || '';
      const response = await fetch(endpoint + path, {method, headers:{Origin:origin, ...(sessions.has(room)?{'x-coc-session':sessions.get(room)}:{}),...(body && !(body instanceof FormData)?{'Content-Type':'application/json'}:{})},body:body?(body instanceof FormData?body:JSON.stringify(body)):undefined});
      if(path==='/identity' && method==='POST' && response.ok){const d=await response.clone().json();if(body.action==='logout')sessions.delete(room);else if(d.session)sessions.set(d.room||room,d.session)}
      return response;
    },
    async json(path,method='GET',body,status=200){const r=await this.raw(path,method,body);const text=await r.text();assert.equal(r.status,status,`${path}: ${text}`);return JSON.parse(text)},
    table(action,room,extra={},status=200){return this.json('/table','POST',{action,room,...extra},status)},
    identity(action,room,extra={},status=200){return this.json('/identity','POST',{action,room,...extra},status)},
  };
}
const kp=client(), player=client(), visitor=client();
assert.equal((await fetch(endpoint+'/health')).status,200);
assert.equal((await fetch(endpoint+'/health',{headers:{Origin:'https://untrusted.invalid'}})).status,403);
const preflight=await fetch(endpoint+'/table',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Headers':'x-coc-session,content-type'}});
assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),origin);
const identity=await kp.identity('new','',{name:'迁移验证 KP',password:'migration-check'});const room=identity.room;
const pc=await player.identity('new',room,{name:'迁移验证调查员'});
let k=await kp.table('join',room),p=await player.table('join',room);
assert.equal(k.isKeeper,true);assert.equal(p.isKeeper,false);
await visitor.table('sync',room,{},401);
await visitor.identity('login',room,{identity:identity.user,password:'wrong'},403);
const directory=await visitor.json('/identity?room='+room);assert.equal(directory.identities.length,2);assert.ok(directory.identities.every(i=>!('password_hash' in i)));
await visitor.identity('login',room,{identity:pc.user,password:''});assert.equal((await visitor.table('sync',room)).user,pc.user);
const card={name:'迁移验证调查员',occupation:'验证',skills:{敏捷:80,体质:60,体型:60,理智:65,侦查:70,斗殴:999,'射击（手枪）':999},resources:{hp:12,hpMax:12},weapons:[{name:'拳',skill:'斗殴',damage:'2',impale:false}],damageBonus:'0'};
p=await player.table('save',room,{card,cardRevision:p.cardRevision});
const old=p.cardRevision;
p=await player.table('roll',room,{kind:'vital',resource:'hp',direction:'loss',expression:'3'});assert.equal(p.card.resources.hp,9);
await player.table('save',room,{card,cardRevision:old},409);
await wait();p=await player.table('roll',room,{kind:'vital',resource:'san',direction:'loss',expression:'2'});assert.equal(p.card.skills.理智,63);
await wait();p=await player.table('roll',room,{kind:'vital',resource:'hp',direction:'heal',expression:'999'});assert.equal(p.card.resources.hp,12);
const secret=await kp.table('roll',room,{kind:'check',skill:'侦查',visibility:'keeper'});
const publicView=await player.table('sync',room);assert.ok(!publicView.rolls.some(r=>r.id===secret.rolled.id));assert.ok(publicView.members.every(m=>!m.card));
await player.table('roll',room,{kind:'check',skill:'侦查',visibility:'keeper'},403);
async function op(operation,extra={}){k=await kp.table('sync',room);k=await kp.table('combat',room,{operation,combatRevision:k.combat.revision,...extra});return k}
await op('add',{owner:pc.user});await op('add',{card:{...card,name:'测试 NPC',skills:{...card.skills,敏捷:30},resources:{hp:40,hpMax:40}}});
await op('start');const a=k.combat.fighters.find(f=>f.owner),n=k.combat.fighters.find(f=>!f.owner);
await op('declare',{actor:a.id,target:n.id,weapon:-1,temporaryWeapon:{name:'临时手枪',damage:'2',impale:true},skill:'射击（手枪）',type:'handgun',shots:3});
await op('respond',{pendingId:k.combat.pending.id,response:'none'});
await op('next');await op('declare',{actor:n.id,target:a.id,weapon:0,skill:'斗殴'});
const args={operation:'respond',pendingId:k.combat.pending.id,response:'none',combatRevision:k.combat.revision};
const responses=await Promise.all([kp.raw('/table','POST',{action:'combat',room,...args}),player.raw('/table','POST',{action:'combat',room,...args})]);
assert.deepEqual(responses.map(r=>r.status).sort(),[200,400]);
p=await player.table('sync',room);k=await kp.table('sync',room);
assert.ok(k.combat.log.some(r=>r.audience==='keeper'));assert.ok(p.combat.log.every(r=>r.audience==='public'));assert.equal(p.combat.fighters.find(f=>!f.owner).card,undefined);assert.equal(p.card.resources.hp,p.combat.fighters.find(f=>f.owner===p.user).hp);
await op('end');
const path='/materials?room='+room;
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=','base64');
function form(){const f=new FormData();f.set('title','迁移验证图片');f.set('body','权限与文件存储验证');f.set('file',new File([png],'test.png',{type:'image/png'}));return f}
assert.equal((await player.raw(path,'POST',form())).status,403);
const {id}=await kp.json(path,'POST',form(),201),filePath=`/materials/file?room=${room}&id=${id}`;
assert.equal((await player.json(path)).materials.length,0);assert.equal((await player.raw(filePath)).status,404);
assert.deepEqual(Buffer.from(await (await kp.raw(filePath)).arrayBuffer()),png);
let material=(await kp.json(path)).materials[0];await kp.json(path,'PATCH',{id,revision:material.revision,operation:'release'});
assert.equal((await player.json(path)).materials.length,1);assert.equal((await player.raw(filePath)).status,200);
material=(await kp.json(path)).materials[0];await kp.json(path,'PATCH',{id,revision:material.revision,operation:'hide'});
assert.equal((await player.raw(filePath)).status,404);
material=(await kp.json(path)).materials[0];await kp.json(path,'DELETE',{id,revision:material.revision});assert.equal((await kp.raw(filePath)).status,404);
await player.identity('password',room,{currentPassword:'',password:'changed'});await visitor.table('sync',room,{},401);
await player.identity('logout',room);await player.table('sync',room,{},401);
await player.identity('login',room,{identity:pc.user,password:'changed'});
await kp.table('transferKeeper',room,{target:pc.user});assert.equal((await player.table('sync',room)).isKeeper,true);assert.equal((await kp.table('sync',room)).isKeeper,false);
console.log('PASS Supabase: CORS, room login, password revocation, shared state, HP/SAN, stale edits, private dice, combat/handgun/NPC privacy, concurrent settlement, private image upload/release/revocation/delete and KP transfer');
console.log('Isolated test room:',room);
