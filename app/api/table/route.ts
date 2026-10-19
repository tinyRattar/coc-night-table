import {vitalChange} from '../../vital-rules';
import {env} from 'cloudflare:workers';
import {cleanCard,percentRoll,verdict,diceExpression,example} from '../../game';
import {sanityRoll,sanityLoss,weaponDamage} from '../../encounters';
import {resolveIdentity,readCookie,sessionName} from '../../identity-server';
import {handleCombat,battleView} from '../../combat-server';
export const dynamic='force-dynamic';
function random(n:number){const limit=Math.floor(4294967296/n)*n;let a;do{a=crypto.getRandomValues(new Uint32Array(1))[0]}while(a>=limit);return a%n}
const json=(body:any,status=200,cookie?:string)=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...(cookie?{'Set-Cookie':cookie}:{})}});
export async function POST(req:Request){try{
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return json({error:'请求来源不匹配'},403);
 if(Number(req.headers.get('content-length')||0)>50000)return json({error:'请求过大'},413);const text=await req.text();if(text.length>50000)return json({error:'请求过大'},413);const b=JSON.parse(text);
 const db=env.DB;if(!db)throw Error('共享数据库未连接');
 let token=req.headers.get('cookie')?.match(/(?:^|;\s*)coc_guest=([a-f0-9]{64})(?:;|$)/)?.[1];const fresh=!token;if(!token)token=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
 let user=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),x=>x.toString(16).padStart(2,'0')).join('');const cookie=fresh?`coc_guest=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000${new URL(req.url).protocol==='https:'?'; Secure':''}`:undefined;
 const now=Date.now();let room=String(b.room||'');
 if(b.action==='create'){room=crypto.randomUUID().replaceAll('-','');await db.prepare('INSERT INTO rooms (id,created,keeper) VALUES (?,?,?)').bind(room,now,user).run();}
 if(!/^[a-f0-9]{32}$/.test(room))return json({error:'房间码无效，请粘贴完整邀请链接或房间码'},400,cookie);
 let roomRow:any=await db.prepare('SELECT * FROM rooms WHERE id=?').bind(room).first();if(!roomRow)return json({error:'房间不存在，请核对邀请链接'},404,cookie);
 const selectedUser=await resolveIdentity(req,db,room);if(selectedUser)user=selectedUser;else {const legacy=await db.prepare('SELECT password_hash FROM members WHERE room=? AND user=?').bind(room,user).first<any>();if(readCookie(req,sessionName(room))!==undefined||legacy?.password_hash)return json({error:'登录已失效，请重新选择调查员'},401,cookie);}
 let member:any=await db.prepare('SELECT * FROM members WHERE room=? AND user=?').bind(room,user).first();
 if(!member){if(!['join','create'].includes(b.action))return json({error:'请先加入房间'},403,cookie);const name=`调查员 ${user.slice(0,4).toUpperCase()}`;await db.prepare('INSERT OR IGNORE INTO members (room,user,name,card,seen,last_roll) VALUES (?,?,?,?,?,0)').bind(room,user,name,JSON.stringify({...example,name}),now).run();member=await db.prepare('SELECT * FROM members WHERE room=? AND user=?').bind(room,user).first();}
 if(b.action==='claimKeeper'){
  await db.prepare('UPDATE rooms SET keeper=? WHERE id=? AND keeper IS NULL').bind(user,room).run();roomRow=await db.prepare('SELECT * FROM rooms WHERE id=?').bind(room).first();
  if(roomRow.keeper!==user)return json({error:'房间已有 KP，请由当前 KP 移交主持权'},403,cookie);
 }
 let isKeeper=roomRow.keeper===user;
 if(b.action==='transferKeeper'){
  if(!isKeeper)return json({error:'只有 KP 可以移交主持权'},403,cookie);
  const next:any=await db.prepare('SELECT user FROM members WHERE room=? AND substr(user,1,12)=?').bind(room,String(b.target||'')).first();if(!next)return json({error:'请选择本房间成员'},400,cookie);
  await db.prepare('UPDATE rooms SET keeper=? WHERE id=? AND keeper=?').bind(next.user,room,user).run();roomRow=await db.prepare('SELECT * FROM rooms WHERE id=?').bind(room).first();isKeeper=roomRow.keeper===user;
 }
 if(b.action==='save'){
  const card=cleanCard(b.card),revision=crypto.randomUUID();const changed=await db.prepare('UPDATE members SET name=?,card=?,card_revision=?,seen=? WHERE room=? AND user=? AND card_revision=?').bind(card.name,JSON.stringify(card),revision,now,room,user,b.cardRevision??member.card_revision).run();
  if(!changed.meta.changes)return json({error:'人物卡已变化（可能刚扣除 SAN），请刷新后重新编辑'},409,cookie);
 }
 if(b.action==='combat')roomRow=await handleCombat(db,roomRow,b,user.slice(0,12),isKeeper,random);
 let rolled:any=null;
 if(b.action==='roll'){
  const hidden=b.visibility==='keeper';if(hidden&&!isKeeper)return json({error:'只有 KP 可以暗骰'},403,cookie);
  const targetId=String(b.target||user.slice(0,12));if(targetId!==user.slice(0,12)&&!isKeeper)return json({error:'只有 KP 可以代其他角色检定'},403,cookie);
  const targetMember:any=targetId===user.slice(0,12)?member:await db.prepare('SELECT * FROM members WHERE room=? AND substr(user,1,12)=?').bind(room,targetId).first();if(!targetMember)return json({error:'目标不在本房间'},400,cookie);
  const card=JSON.parse(targetMember.card);const difficulty=['普通','困难','极难'].includes(b.difficulty)?b.difficulty:'普通';const bonus=Number(b.bonus||0);if(!Number.isInteger(bonus)||Math.abs(bonus)>2)return json({error:'奖惩骰数量无效'},400,cookie);
  if(b.kind==='vital'){if(hidden)return json({error:'体力理智变化须公开记录'},400,cookie);rolled=vitalChange(card,String(b.resource),String(b.direction),String(b.expression??'1'),random);}
  else if(b.kind==='dice')rolled={...diceExpression(String(b.expression||'1D100'),random),kind:'dice',label:'自由掷骰',passed:null};
  else if(b.kind==='sanity'){
   if(hidden&&b.apply)return json({error:'暗骰只计算理智损失，不修改玩家 SAN；公开检定才能自动扣除'},400,cookie);
   rolled={...(b.mode==='direct'?sanityLoss(card.skills.理智,String(b.loss??'1D6'),random):sanityRoll(card.skills.理智,String(b.successLoss??'0'),String(b.failureLoss??'1D6'),random)),applied:b.apply===true};
  }else if(b.kind==='damage'){
   const weapon=Number.isInteger(b.weaponIndex)?card.weapons?.[b.weaponIndex]:null;
   rolled={...weaponDamage(String(weapon?.damage??b.damage??'1D3+DB'),String(b.damageBonus??card.damageBonus??'0'),b.mode==='extreme'?'extreme':'normal',weapon?weapon.impale===true:b.impale===true,random),skill:String(weapon?.name??b.weaponName??'自定义武器').slice(0,45)};
  }else if(b.kind==='check'||!b.kind){
   const skill=String(b.skill||'');const value=card.skills[skill];if(!Number.isInteger(value))return json({error:'人物卡中没有这个技能，请先保存'},400,cookie);const dice=percentRoll(bonus,random);rolled={...dice,...verdict(dice.result,value,difficulty),kind:'check',skill,value,difficulty,bonus};
  }else return json({error:'不支持此检定类型'},400,cookie);
  const gated=await db.prepare('UPDATE members SET last_roll=? WHERE room=? AND user=? AND last_roll<?').bind(now,room,user,now-700).run();if(!gated.meta.changes)return json({error:'骰子还在转动，请稍后再试'},429,cookie);
  rolled={...rolled,id:crypto.randomUUID(),name:targetMember.name,user:targetId,actor:member.name,actorUser:user.slice(0,12),visibility:hidden?'keeper':'public',created:now};const data=JSON.stringify(rolled);
  if((rolled.kind==='sanity'||rolled.kind==='vital')&&rolled.applied){
   const revision=crypto.randomUUID(),updated=JSON.stringify(rolled.resource==='hp'?{...card,resources:{...card.resources,hp:rolled.after}}:{...card,skills:{...card.skills,理智:rolled.after}});
   const results=await db.batch([
    db.prepare('UPDATE members SET card=?,card_revision=? WHERE room=? AND user=? AND card_revision=?').bind(updated,revision,room,targetMember.user,targetMember.card_revision),
    db.prepare('INSERT INTO rolls (id,room,user,data,created,visibility) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM members WHERE room=? AND user=? AND card_revision=?)').bind(rolled.id,room,user,data,now,rolled.visibility,room,targetMember.user,revision)
   ]);
   if(!results[0].meta.changes)return json({error:'目标人物卡刚被修改，本次未扣除、未记录，请重新检定'},409,cookie);
  }else await db.prepare('INSERT INTO rolls (id,room,user,data,created,visibility) VALUES (?,?,?,?,?,?)').bind(rolled.id,room,user,data,now,rolled.visibility).run();
 }
 await db.prepare('UPDATE members SET seen=? WHERE room=? AND user=?').bind(now,room,user).run();
 const [people,history,own]=await Promise.all([
  db.prepare('SELECT user,name,seen,card FROM members WHERE room=? ORDER BY seen DESC LIMIT 100').bind(room).all(),
  db.prepare("SELECT data FROM rolls WHERE room=? AND (visibility='public' OR ?=1) ORDER BY created DESC,id DESC LIMIT 100").bind(room,isKeeper?1:0).all(),
  db.prepare('SELECT card,card_revision FROM members WHERE room=? AND user=?').bind(room,user).first<any>()
 ]);
 return json({hasPassword:!!member.password_hash,combat:await battleView(db,roomRow,user.slice(0,12),isKeeper),room,user:user.slice(0,12),isKeeper,keeperUser:roomRow.keeper?.slice(0,12)??null,canClaim:!roomRow.keeper,card:JSON.parse(own.card),cardRevision:own.card_revision,members:people.results.map((p:any)=>({user:p.user.slice(0,12),name:p.name,online:now-p.seen<45000,isKeeper:p.user===roomRow.keeper,...(isKeeper?{card:JSON.parse(p.card)}:{})})),rolls:history.results.map((r:any)=>JSON.parse(r.data)),rolled},200,cookie);
 }catch(e){console.error(e instanceof Error?e.message:'request failed');return json({error:e instanceof Error?e.message:'请求失败，请重试'},400)}}
