import {combatAction,emptyBattle,projectBattle,type Battle} from './combat';
export function readBattle(row:any):Battle{const v=JSON.parse(row.combat||'{}');return Array.isArray(v.fighters)?v:emptyBattle()}
export function refreshFighters(b:Battle,rows:any[]){for(const f of b.fighters){if(!f.owner)continue;const m=rows.find(r=>r.user.slice(0,12)===f.owner);if(m){f.card=JSON.parse(m.card);if(f.card.resources?.hp!==undefined)f.hp=f.card.resources.hp;if(f.card.resources?.hpMax!==undefined)f.hpMax=f.card.resources.hpMax}}return b}
export async function battleView(db:any,row:any,user:string,kp:boolean){const b=readBattle(row);const rows=await db.prepare('SELECT user,card FROM members WHERE room=?').bind(row.id).all();return {...projectBattle(refreshFighters(b,rows.results),user,kp),revision:row.combat_revision}}
export async function handleCombat(db:any,row:any,input:any,user:string,kp:boolean,random:(n:number)=>number){
 if(input.combatRevision!==row.combat_revision)throw Error('战斗已被其他人更新，请稍后重试');
 const rows=(await db.prepare('SELECT user,card,card_revision FROM members WHERE room=?').bind(row.id).all()).results;
 const b=refreshFighters(readBattle(row),rows);
 if(input.operation==='add'&&input.owner){const m=rows.find((m:any)=>m.user.slice(0,12)===input.owner);if(!m)throw Error('该调查员不在房间中');input.card=JSON.parse(m.card)}
 const next=combatAction(b,String(input.operation),input,user,kp,random),revision=crypto.randomUUID();
 const linked=rows.filter((m:any)=>next.fighters.some(f=>f.owner===m.user.slice(0,12)));
 const guards=linked.map(()=>'(SELECT card_revision FROM members WHERE room=? AND user=?)=?').join(' AND ');
 const update=db.prepare(`UPDATE rooms SET combat=?,combat_revision=? WHERE id=? AND combat_revision=? AND keeper IS ?${guards?' AND '+guards:''}`).bind(JSON.stringify(next),revision,row.id,row.combat_revision,row.keeper,...linked.flatMap((m:any)=>[row.id,m.user,m.card_revision]));
 const statements=[update];
 for(const m of linked){const f=next.fighters.find(f=>f.owner===m.user.slice(0,12))!,card=JSON.parse(m.card);if(card.resources?.hp!==f.hp||card.resources?.hpMax!==f.hpMax){card.resources={...card.resources,hp:f.hp,hpMax:f.hpMax};statements.push(db.prepare('UPDATE members SET card=?,card_revision=? WHERE room=? AND user=? AND EXISTS (SELECT 1 FROM rooms WHERE id=? AND combat_revision=?)').bind(JSON.stringify(card),crypto.randomUUID(),row.id,m.user,row.id,revision))}}
 const results=await db.batch(statements);if(!results[0].meta.changes)throw Error('人物卡或战斗刚被更新，本次未结算，请重试');
 return {...row,combat:JSON.stringify(next),combat_revision:revision};
}
