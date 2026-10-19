import assert from 'node:assert/strict';
const origin=process.env.COC_TEST_ORIGIN||'http://127.0.0.1:5173';
function guest(){const jar=new Map();return async(action,room,extra={})=>{const r=await fetch(origin+'/api/table',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:[...jar].map(([k,v])=>k+'='+v).join('; ')},body:JSON.stringify({action,room,...extra})});for(const c of r.headers.getSetCookie()){const p=c.split(';')[0],i=p.indexOf('=');jar.set(p.slice(0,i),p.slice(i+1))}return {status:r.status,data:await r.json()}}}
const a=guest(),b=guest(),c=guest(),delay=()=>new Promise(r=>setTimeout(r,760));let x=(await a('create')).data,room=x.room;let y=(await b('join',room)).data;await c('join',room);
const card={name:'状态验证',occupation:'测试',skills:{体质:55,体型:60,理智:60,克苏鲁神话:10,侦查:65}};y=(await b('save',room,{card,cardRevision:y.cardRevision})).data;
let r=await b('roll',room,{kind:'vital',resource:'hp',direction:'loss',expression:'3'});assert.equal(r.status,200);assert.equal(r.data.rolled.before,11);assert.equal(r.data.card.resources.hp,8);assert.equal(r.data.rolled.delta,-3);const oldRevision=y.cardRevision;
assert.equal((await b('save',room,{card,cardRevision:oldRevision})).status,409);await delay();
r=await b('roll',room,{kind:'vital',resource:'hp',direction:'heal',expression:'999'});assert.equal(r.data.card.resources.hp,11);await delay();
r=await b('roll',room,{kind:'vital',resource:'san',direction:'heal',expression:'999'});assert.equal(r.data.card.skills.理智,89);await delay();
r=await b('roll',room,{kind:'vital',resource:'san',direction:'loss',expression:'1D6'});assert.ok(r.data.rolled.result>=1&&r.data.rolled.result<=6);assert.equal(r.data.card.skills.理智,89-r.data.rolled.result);assert.ok(r.data.rolled.detail.includes('['));
assert.equal((await c('roll',room,{kind:'vital',resource:'hp',direction:'loss',expression:'1',target:y.user})).status,403);
assert.equal((await a('roll',room,{kind:'vital',resource:'hp',direction:'loss',expression:'1',target:y.user,visibility:'keeper'})).status,400);
assert.equal((await a('roll',room,{kind:'vital',resource:'hp',direction:'loss',expression:'1D6-2',target:y.user})).status,400);
await delay();let before=(await b('sync',room)).data.card.resources.hp;const both=await Promise.all([a('roll',room,{kind:'vital',resource:'hp',direction:'loss',expression:'1',target:y.user}),b('roll',room,{kind:'vital',resource:'hp',direction:'loss',expression:'1'})]);assert.ok(both.every(r=>[200,409].includes(r.status)));const count=both.filter(r=>r.status===200).length;assert.equal((await b('sync',room)).data.card.resources.hp,before-count);
await delay();r=await a('roll',room,{kind:'vital',resource:'hp',direction:'loss',expression:'999',target:y.user});assert.equal(r.data.members.find(m=>m.user===y.user).card.resources.hp,0);assert.equal(r.data.rolled.actorUser,x.user);assert.equal(r.data.rolled.user,y.user);
const publicRows=(await c('sync',room)).data.rolls;assert.ok(publicRows.some(v=>v.kind==='vital'&&v.resource==='hp'));assert.ok(publicRows.every(v=>v.visibility==='public'));
console.log('PASS vitals: automatic HP, SAN cap, fixed/dice changes, zero/full bounds, permissions, public logs, concurrent updates and stale edit protection');
