import assert from 'node:assert/strict';
const origin=process.env.COC_TEST_ORIGIN||'http://127.0.0.1:5173';
function guest(){const jar=new Map();return async(action,room,extra={})=>{const r=await fetch(origin+'/api/table',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...(jar.size?{Cookie:[...jar].map(([k,v])=>k+'='+v).join('; ')}:{})},body:JSON.stringify({action,room,...extra})});for(const c of r.headers.getSetCookie()){const p=c.split(';')[0],i=p.indexOf('=');jar.set(p.slice(0,i),p.slice(i+1))}return {status:r.status,data:await r.json()}}}
const delay=()=>new Promise(r=>setTimeout(r,760));
const a=guest(),b=guest(),c=guest();let x=await a('create');assert.equal(x.status,200);const room=x.data.room;assert.equal(x.data.isKeeper,true);
let joined=await b('join',room);assert.equal(joined.data.isKeeper,false);const player=joined.data.user;const keeper=x.data.user;
assert.ok(joined.data.members.every(m=>!('card'in m)));assert.equal((await b('claimKeeper',room)).status,403);
assert.equal((await b('roll',room,{kind:'dice',visibility:'keeper'})).status,403);
assert.equal((await b('roll',room,{kind:'check',target:keeper,skill:'侦查'})).status,403);
const card={name:'隐私测试角色',occupation:'记者',skills:{理智:60,侦查:65,力量:50},damageBonus:'1D4',weapons:[{name:'短刀',skill:'斗殴',damage:'1D4+DB',impale:true}]};
joined=await b('save',room,{card});assert.equal(joined.status,200);const oldRevision=joined.data.cardRevision;
const roster=await a('sync',room);assert.equal(roster.data.members.find(m=>m.user===player).card.skills.侦查,65);
const secret=await a('roll',room,{kind:'check',skill:'侦查',target:player,visibility:'keeper'});assert.equal(secret.status,200);assert.equal(secret.data.rolled.visibility,'keeper');
const publicView=await b('sync',room);assert.ok(!publicView.data.rolls.some(r=>r.id===secret.data.rolled.id));assert.equal(publicView.data.rolled,null);
assert.equal((await a('roll',room,{kind:'sanity',target:player,visibility:'keeper',apply:true})).status,400);
await delay();const hiddenSan=await a('roll',room,{kind:'sanity',target:player,visibility:'keeper',apply:false,successLoss:'5',failureLoss:'5'});assert.equal(hiddenSan.status,200);assert.equal((await b('sync',room)).data.card.skills.理智,60);
await delay();const san=await a('roll',room,{kind:'sanity',target:player,apply:true,successLoss:'5',failureLoss:'5'});assert.equal(san.status,200);assert.equal(san.data.rolled.loss,5);assert.equal(san.data.rolled.applied,true);
const after=await b('sync',room);assert.equal(after.data.card.skills.理智,55);assert.ok(after.data.rolls.some(r=>r.id===san.data.rolled.id));assert.equal(after.data.card.weapons[0].name,'短刀');
assert.equal((await b('save',room,{card,cardRevision:oldRevision})).status,409);
const damage=await b('roll',room,{kind:'damage',weaponIndex:0,mode:'extreme'});assert.equal(damage.status,200);assert.ok(damage.data.rolled.result>=9&&damage.data.rolled.result<=12);
const other=await c('create');assert.equal(other.data.members.length,1);assert.equal(other.data.rolls.length,0);assert.equal((await c('roll',room,{kind:'dice'})).status,403);
assert.equal((await b('transferKeeper',room,{target:keeper})).status,403);
const transfer=await a('transferKeeper',room,{target:player});assert.equal(transfer.status,200);assert.equal(transfer.data.isKeeper,false);assert.ok(transfer.data.members.every(m=>!('card'in m)));assert.ok(transfer.data.rolls.every(r=>r.visibility!=='keeper'));
const newKeeper=await b('sync',room);assert.equal(newKeeper.data.isKeeper,true);assert.ok(newKeeper.data.rolls.some(r=>r.id===secret.data.rolled.id));assert.equal((await a('roll',room,{kind:'dice',visibility:'keeper'})).status,403);
await delay();const direct=await b('roll',room,{kind:'sanity',mode:'direct',loss:'3',apply:true});assert.equal(direct.status,200);assert.equal(direct.data.card.skills.理智,52);assert.equal(direct.data.rolled.result,3);assert.equal(direct.data.rolled.mode,'direct');assert.equal(direct.data.rolled.passed,null);
assert.equal((await b('roll',room,{kind:'sanity',mode:'direct',loss:'3',visibility:'keeper',apply:true})).status,400);
console.log('PASS: server roles, no player card/secret leakage, SAN private preview/public deduction, direct SAN deduction, stale-card protection, imported weapon damage, room isolation, KP handover');

