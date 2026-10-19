import assert from 'node:assert/strict';
const origin='http://127.0.0.1:5173';
function guest(){let cookie='';return async(action,room,extra={})=>{const r=await fetch(origin+'/api/table',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...(cookie?{Cookie:cookie}:{})},body:JSON.stringify({action,room,...extra})});const c=r.headers.getSetCookie()[0];if(c)cookie=c.split(';')[0];return {status:r.status,data:await r.json()}}}
const kp=guest(),a=guest(),b=guest();let k=(await kp('create')).data;const room=k.room;let x=(await a('join',room)).data,y=(await b('join',room)).data;
const card=name=>({name,occupation:'combat integration',skills:{敏捷:80,体质:60,体型:60,斗殴:999,闪避:40,'射击（手枪）':999},resources:{hp:12,hpMax:12},weapons:[{name:'测试武器',skill:'斗殴',damage:'2',impale:false}],damageBonus:'0'});
x=(await a('save',room,{card:card('A')})).data;y=(await b('save',room,{card:{...card('B'),skills:{...card('B').skills,敏捷:50}}})).data;
async function op(operation,extra={}){k=(await kp('sync',room)).data;const r=await kp('combat',room,{operation,combatRevision:k.combat.revision,...extra});assert.equal(r.status,200,JSON.stringify(r.data));k=r.data;return k}
await op('add',{owner:x.user});await op('add',{owner:y.user});await op('add',{card:{...card('Secret monster'),skills:{...card('Secret monster').skills,敏捷:30},resources:{hp:67,hpMax:67}}});
let view=(await a('sync',room)).data;const monster=view.combat.fighters.find(f=>f.name==='Secret monster');assert.ok(monster);assert.equal(monster.card,undefined);assert.equal(monster.hp,undefined);assert.equal(view.members.find(m=>m.user===y.user).card,undefined);
await op('start');const af=k.combat.fighters.find(f=>f.owner===x.user),bf=k.combat.fighters.find(f=>f.owner===y.user);
const rev=k.combat.revision;
assert.equal((await b('combat',room,{operation:'declare',actor:af.id,target:bf.id,weapon:0,skill:'斗殴',combatRevision:rev})).status,400);
let declaration=await a('combat',room,{operation:'declare',actor:af.id,target:bf.id,weapon:0,skill:'斗殴',combatRevision:rev});assert.equal(declaration.status,200);const pending=declaration.data.combat.pending;assert.equal(pending.skill,undefined);
assert.equal((await a('combat',room,{operation:'respond',pendingId:pending.id,response:'none',combatRevision:declaration.data.combat.revision})).status,400);
const args={operation:'respond',pendingId:pending.id,response:'none',combatRevision:declaration.data.combat.revision};const both=await Promise.all([b('combat',room,args),kp('combat',room,args)]);assert.equal(both.filter(r=>r.status===200).length,1);assert.equal(both.filter(r=>r.status===400).length,1);
y=(await b('sync',room)).data;const expected=y.combat.fighters.find(f=>f.owner===y.user).hp;assert.equal(y.card.resources.hp,expected);assert.ok([10,12].includes(expected));assert.equal(y.combat.pending,undefined);assert.equal(y.combat.fighters.find(f=>f.owner===x.user).used,1);
// A stale card edit cannot overwrite combat damage; NPC correction remains private.
if(expected===10)assert.equal((await b('save',room,{card:card('B'),cardRevision:x.cardRevision})).status,409);
await op('edit',{id:bf.id,hp:7,armor:2});y=(await b('sync',room)).data;assert.equal(y.card.resources.hp,7);
assert.equal((await a('combat',room,{operation:'next',combatRevision:y.combat.revision})).status,400);
await op('next');assert.equal(k.combat.turn,bf.id);await op('end');assert.equal(k.combat.active,false);
await op('start');await op('next');await op('next');const npc=k.combat.fighters.find(f=>!f.owner);assert.equal(k.combat.turn,npc.id);await op('declare',{actor:npc.id,target:bf.id,weapon:-1,temporaryWeapon:{name:'临时木棍',damage:'1D3',impale:false},skill:'斗殴'});await op('respond',{pendingId:k.combat.pending.id,response:'none'});const publicCombat=(await b('sync',room)).data.combat;assert.ok(k.combat.log.some(r=>r.audience==='keeper'));assert.ok(publicCombat.log.every(r=>r.audience==='public'));assert.ok(!publicCombat.log.some(r=>/Secret monster 攻击 \d/.test(r.text)));assert.equal(publicCombat.fighters.find(f=>f.id===npc.id).card,undefined);await op('end');
await op('start');await op('declare',{actor:af.id,target:bf.id,weapon:-1,temporaryWeapon:{name:'临时手枪',damage:'2',impale:true},skill:'射击（手枪）',type:'handgun',shots:3});assert.equal(k.combat.pending.shots,3);await op('respond',{pendingId:k.combat.pending.id,response:'none'});const volley=(await b('sync',room)).data;assert.equal(volley.card.resources.hp,volley.combat.fighters.find(f=>f.id===bf.id).hp);assert.equal(volley.combat.log.filter(r=>/^A 第 [123]\/3 枪：/.test(r.text)).length,3);await op('end');
console.log('PASS shared combat: independent players, KP delegation, hidden NPC stats and secret dice, temporary weapons, target permissions, concurrent response exactly once, card HP sync, stale writes and round control');
