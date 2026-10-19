import assert from 'node:assert/strict';
const origin='http://127.0.0.1:5173';
function guest(){let cookie='';return async(action,room,extra={})=>{const r=await fetch(origin+'/api/table',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...(cookie?{Cookie:cookie}:{})},body:JSON.stringify({action,room,...extra})});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,data:await r.json()}}}
const a=guest(),b=guest(),c=guest();
const created=await a('create');assert.equal(created.status,200);const room=created.data.room;
assert.equal((await b('join',room)).status,200);
const card={name:'测试调查员 A',occupation:'记者',skills:{侦查:65,力量:50}};
assert.equal((await a('save',room,{card})).data.card.name,card.name);
const roll=await a('roll',room,{skill:'侦查',difficulty:'困难',bonus:1});assert.equal(roll.status,200);assert.ok(roll.data.rolled.result>=1&&roll.data.rolled.result<=100);
const sync=await b('sync',room);assert.equal(sync.data.rolls[0].id,roll.data.rolled.id);assert.equal(sync.data.members.length,2);assert.notEqual(sync.data.card.name,card.name);
assert.equal((await c('sync',room)).status,403);
assert.equal((await b('roll',room,{skill:'不存在',result:1})).status,400);
assert.equal((await a('roll',room,{skill:'侦查'})).status,429);
const other=await c('create');assert.equal(other.data.rolls.length,0);assert.equal(other.data.members.length,1);
const restored=await a('join',room);assert.equal(restored.data.card.name,card.name);
console.log('PASS: two guest sessions, shared rolls, card isolation, room isolation, server validation, rate limit, identity persistence');
