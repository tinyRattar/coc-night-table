import assert from 'node:assert/strict';
import {emptyBattle,makeFighter,combatAction,projectBattle,level,order} from '../app/combat.ts';
const card=(name,dex=60)=>({name,occupation:'test',skills:{敏捷:dex,体质:60,体型:60,斗殴:60,闪避:60},resources:{hp:12,hpMax:12},damageBonus:'0',weapons:[{name:'拳',skill:'斗殴',damage:'2',impale:false}]});
function setup(){const b=emptyBattle();b.fighters=[makeFighter(card('A'),'a','u'),makeFighter(card('B',50),'b','v')];combatAction(b,'start',{},'kp',true,()=>0);return b}
function fight(response,seq){const b=setup();combatAction(b,'declare',{actor:'a',target:'b',weapon:0,skill:'斗殴'},'u',false,()=>0);const vals=[...seq];combatAction(b,'respond',{pendingId:b.pending.id,response,weapon:0,skill:'斗殴'},'v',false,()=>vals.shift()??0);return b}
// Defender and attacker both roll 30: dodge wins ties, fight-back loses ties.
assert.equal(fight('dodge',[0,3,0,3]).fighters[1].hp,12);
assert.equal(fight('back',[0,3,0,3]).fighters[1].hp,10);
// Both fail: no damage; superior counterattack damages only attacker.
assert.equal(fight('back',[0,8,0,8]).fighters[0].hp,12);
assert.equal(fight('back',[0,3,0,8]).fighters[0].hp,10);
let b=setup();assert.throws(()=>combatAction(b,'declare',{actor:'a',target:'b',weapon:0,skill:'斗殴'},'v',false,()=>0));
assert.throws(()=>combatAction(b,'next',{},'u',false,()=>0));
combatAction(b,'declare',{actor:'a',target:'b',weapon:0,type:'firearm',skill:'斗殴'},'u',false,()=>0);let pid=b.pending.id;
assert.throws(()=>combatAction(b,'respond',{pendingId:pid,response:'back'},'v',false,()=>0));
combatAction(b,'respond',{pendingId:pid,response:'cover'},'v',false,()=>0);assert.equal(b.fighters[1].skip,1);assert.throws(()=>combatAction(b,'respond',{pendingId:pid,response:'cover'},'v',false,()=>0));
combatAction(b,'next',{},'kp',true,()=>0);assert.equal(b.turn,'a');assert.equal(b.round,2);assert.equal(b.fighters[1].skip,0);
b=setup();b.fighters[0].card.weapons[0].damage='6';combatAction(b,'declare',{actor:'a',target:'b',weapon:0,skill:'斗殴'},'u',false,()=>0);combatAction(b,'respond',{pendingId:b.pending.id,response:'none'},'v',false,(()=>{const q=[1,0];return ()=>q.shift()??0})());assert.equal(b.fighters[1].major,true);assert.equal(b.fighters[1].hp,6);
b=setup();b.fighters[1].owner=undefined;const view=projectBattle(b,'u',false);assert.equal(view.fighters[1].card,undefined);assert.equal(view.fighters[1].hp,undefined);assert.ok(view.fighters[0].card);assert.ok(projectBattle(b,'kp',true).fighters[1].card);
b.fighters[1].ready=true;assert.equal(order(b)[0].id,'b');assert.equal(level(100,999),0);assert.equal(level(96,30),0);assert.equal(level(1,0),4);
console.log('PASS combat: opposed ties, double failure, counterattack, permissions, cover forfeiture, duplicate response, major wound, NPC privacy and initiative');
