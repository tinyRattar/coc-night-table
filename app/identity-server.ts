export const sessionName=(room:string)=>`coc_login_${room}`;
export const readCookie=(req:Request,name:string)=>req.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1);
export const randomToken=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
export async function digest(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),v=>v.toString(16).padStart(2,'0')).join('')}
export async function passwordHash(password:string,salt:string){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);return Array.from(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},key,256)),v=>v.toString(16).padStart(2,'0')).join('')}
export async function verifyPassword(password:string,member:any){if(!member.password_hash)return password==='';const hash=await passwordHash(password,member.password_salt);let mismatch=hash.length^member.password_hash.length;for(let i=0;i<hash.length;i++)mismatch|=hash.charCodeAt(i)^member.password_hash.charCodeAt(i);return mismatch===0}
export async function resolveIdentity(req:Request,db:any,room:string){
 const token=readCookie(req,sessionName(room));if(token!==undefined){if(!/^[a-f0-9]{64}$/.test(token))return null;const s=await db.prepare('SELECT s.user FROM identity_sessions s JOIN members m ON m.room=s.room AND m.user=s.user WHERE s.token_hash=? AND s.room=? AND s.expires>? AND s.auth_version=m.auth_version').bind(await digest(token),room,Date.now()).first();return s?.user||null}
 // Keep pre-login browser identities usable until their owner sets a password.
 const legacy=readCookie(req,'coc_guest');if(!legacy||!/^[a-f0-9]{64}$/.test(legacy))return null;const user=await digest(legacy);const m=await db.prepare("SELECT user FROM members WHERE room=? AND user=? AND password_hash=''").bind(room,user).first();return m?.user||null;
}
export function sessionCookie(req:Request,room:string,token:string,logout=false){return `${sessionName(room)}=${logout?'out':token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${logout?31536000:604800}${new URL(req.url).protocol==='https:'?'; Secure':''}`}
