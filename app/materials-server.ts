import {env} from 'cloudflare:workers';
import {resolveIdentity} from './identity-server';
export class MaterialError extends Error{constructor(message:string,public status=400){super(message)}}
export const materialJson=(value:any,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
export async function materialContext(req:Request,write=false){
 if(write&&req.headers.get('origin')!==new URL(req.url).origin)throw new MaterialError('请求来源不匹配',403);
 const room=new URL(req.url).searchParams.get('room')||'';if(!/^[a-f0-9]{32}$/.test(room))throw new MaterialError('房间码无效');
 const db=env.DB;if(!db)throw new MaterialError('共享数据库未连接',503);
 const user=await resolveIdentity(req,db,room);if(!user)throw new MaterialError('请先登录本房间调查员',403);
 const row=await db.prepare('SELECT r.keeper FROM rooms r JOIN members m ON m.room=r.id WHERE r.id=? AND m.user=?').bind(room,user).first<any>();if(!row)throw new MaterialError('请先加入本房间',403);
 const kp=row.keeper===user;if(write&&!kp)throw new MaterialError('只有 KP 可以管理素材',403);
 return {db,room,user,kp,bucket:env.BUCKET};
}
export async function limitedBody(req:Request,limit:number){if(Number(req.headers.get('content-length')||0)>limit)throw new MaterialError('上传内容过大',413);const reader=req.body?.getReader();if(!reader)return new Uint8Array();let length=0;const chunks:Uint8Array[]=[];while(true){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>limit){await reader.cancel();throw new MaterialError('上传内容过大',413)}chunks.push(value)}const data=new Uint8Array(length);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length}return data}
export function materialFileType(data:Uint8Array){
 const sig=(bytes:number[])=>bytes.every((v,i)=>data[i]===v),text=(a:number,b:number)=>String.fromCharCode(...data.slice(a,b));
 if(sig([137,80,78,71,13,10,26,10]))return 'image/png';if(sig([255,216,255]))return 'image/jpeg';if(['GIF87a','GIF89a'].includes(text(0,6)))return 'image/gif';if(text(0,4)==='RIFF'&&text(8,12)==='WEBP')return 'image/webp';if(text(0,5)==='%PDF-')return 'application/pdf';throw new MaterialError('支持 PNG、JPG、GIF、WebP 图片或 PDF 文件');
}
export const materialFailure=(e:unknown)=>materialJson({error:e instanceof MaterialError?e.message:'素材操作失败，请稍后重试'},e instanceof MaterialError?e.status:500);
