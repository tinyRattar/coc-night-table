import {env} from 'cloudflare:workers';
import {example} from '../../game';
import {digest,passwordHash,verifyPassword,resolveIdentity,randomToken,sessionCookie,sessionName,readCookie} from '../../identity-server';
export const dynamic='force-dynamic';
const json=(data:any,status=200,cookie?:string)=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...(cookie?{'Set-Cookie':cookie}:{})}});
const validRoom=(r:string)=>/^[a-f0-9]{32}$/.test(r);
export async function GET(req:Request){try{const db=env.DB;if(!db)return json({error:'数据库未连接'},503);const room=new URL(req.url).searchParams.get('room')||'';if(!room)return json({identities:[],current:null});if(!validRoom(room))return json({error:'房间码无效'},400);const row=await db.prepare('SELECT keeper FROM rooms WHERE id=?').bind(room).first<any>();if(!row)return json({error:'房间不存在，请核对邀请链接'},404);const rows=await db.prepare("SELECT substr(user,1,12) AS id,name,user= ? AS isKeeper,password_hash!='' AS hasPassword FROM members WHERE room=? ORDER BY name,user").bind(row.keeper,room).all();const current=await resolveIdentity(req,db,room);return json({identities:rows.results,current:current?.slice(0,12)||null})}catch{return json({error:'读取身份失败，请稍后重试'},500)}}
export async function POST(req:Request){try{
 if(req.headers.get('origin')!==new URL(req.url).origin)return json({error:'请求来源不匹配'},403);const db=env.DB;if(!db)return json({error:'数据库未连接'},503);if(Number(req.headers.get('content-length')||0)>5000)return json({error:'请求过大'},413);const raw=await req.text();if(raw.length>5000)return json({error:'请求过大'},413);const b=JSON.parse(raw);let room=String(b.room||'');const action=String(b.action||'');if(!room&&action!=='new')return json({error:'请先选择房间'},400);if(room&&!validRoom(room))return json({error:'房间码无效'},400);const now=Date.now();let member:any;const password=String(b.password??'');if(password.length>100)return json({error:'密码最多 100 个字符'},400);
 if(action==='new'){
  const name=String(b.name||'').trim();if(!name||name.length>40)return json({error:'请填写 1–40 字的调查员名称'},400);const user=randomToken(),salt=password?randomToken():'',hash=password?await passwordHash(password,salt):'';
  if(!room){room=crypto.randomUUID().replaceAll('-','');await db.batch([db.prepare('INSERT INTO rooms (id,created,keeper) VALUES (?,?,?)').bind(room,now,user),db.prepare('INSERT INTO members (room,user,name,card,seen,last_roll,password_hash,password_salt) VALUES (?,?,?,?,?,0,?,?)').bind(room,user,name,JSON.stringify({...example,name}),now,hash,salt)])}
  else {const row=await db.prepare('SELECT id FROM rooms WHERE id=?').bind(room).first();if(!row)return json({error:'房间不存在'},404);await db.prepare('INSERT INTO members (room,user,name,card,seen,last_roll,password_hash,password_salt) VALUES (?,?,?,?,?,0,?,?)').bind(room,user,name,JSON.stringify({...example,name}),now,hash,salt).run()}
  member={user,auth_version:0};
 }else if(action==='login'){
  member=await db.prepare('SELECT * FROM members WHERE room=? AND substr(user,1,12)=?').bind(room,String(b.identity||'')).first<any>();if(!member)return json({error:'请选择本房间的已有调查员'},400);
  const key=room+':'+member.user;const gate=await db.prepare('INSERT INTO identity_attempts (key,started,count) VALUES (?,?,1) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN started<? THEN 1 ELSE count+1 END,started=CASE WHEN started<? THEN ? ELSE started END RETURNING count').bind(key,now,now-60000,now-60000,now).first<any>();if(gate.count>10)return json({error:'尝试次数较多，请 1 分钟后重试'},429);
  if(!await verifyPassword(password,member))return json({error:'密码不正确；未设置密码的身份请留空'},403);await db.prepare('DELETE FROM identity_attempts WHERE key=?').bind(key).run();
 }else if(action==='password'||action==='logout'){
  const user=await resolveIdentity(req,db,room);if(!user)return json({error:'登录已失效，请重新选择调查员'},401);member=await db.prepare('SELECT * FROM members WHERE room=? AND user=?').bind(room,user).first<any>();
  const oldToken=readCookie(req,sessionName(room)),oldHash=oldToken&&/^[a-f0-9]{64}$/.test(oldToken)?await digest(oldToken):'';
  if(action==='logout'){if(oldHash)await db.prepare('DELETE FROM identity_sessions WHERE token_hash=?').bind(oldHash).run();return json({ok:true},200,sessionCookie(req,room,'',true))}
  if(String(b.currentPassword??'').length>100||!await verifyPassword(String(b.currentPassword??''),member))return json({error:'当前密码不正确'},403);const salt=password?randomToken():'',hash=password?await passwordHash(password,salt):'';
  const result=await db.prepare('UPDATE members SET password_hash=?,password_salt=?,auth_version=auth_version+1 WHERE room=? AND user=? AND auth_version=?').bind(hash,salt,room,user,member.auth_version).run();if(!result.meta.changes)return json({error:'身份刚被更新，请重新登录'},409);member.auth_version++;
 }else return json({error:'未知身份操作'},400);
 const token=randomToken();await db.prepare('INSERT INTO identity_sessions (token_hash,room,user,auth_version,expires) VALUES (?,?,?,?,?)').bind(await digest(token),room,member.user,member.auth_version,now+604800000).run();await db.prepare('DELETE FROM identity_sessions WHERE expires<?').bind(now).run();return json({ok:true,room,user:member.user.slice(0,12)},200,sessionCookie(req,room,token));
 }catch{return json({error:'身份操作失败，请稍后重试'},500)}}
