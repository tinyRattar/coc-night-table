export type Weapon={name:string;skill:string;damage:string;impale:boolean};
export type Card={name:string;occupation:string;skills:Record<string,number>;weapons?:Weapon[];damageBonus?:string;resources?:{hp?:number;hpMax?:number;mp?:number;mpMax?:number}};
export const example:Card={name:'伊莱亚斯·沃德',occupation:'古籍修复师',skills:{力量:45,体质:50,体型:60,敏捷:65,外貌:55,智力:80,意志:70,教育:75,理智:70,幸运:55,侦查:65,聆听:50,图书馆使用:75,心理学:45,话术:35,说服:50,潜行:40,闪避:32,斗殴:25,急救:30,神秘学:60,克苏鲁神话:5}};
const aliases:Record<string,string>={STR:'力量',CON:'体质',SIZ:'体型',DEX:'敏捷',APP:'外貌',INT:'智力',POW:'意志',EDU:'教育',SAN:'理智',LUK:'幸运',LUCK:'幸运',理智值:'理智',灵感:'智力',知识:'教育',图书馆:'图书馆使用',侦察:'侦查'};
export function cleanCard(raw:any):Card{
 if(!raw||typeof raw!=='object')throw Error('人物卡需要包含名称和技能数值');
 const skills:Record<string,number>={};
 const add=(key:string,v:any)=>{const n=typeof v==='number'?v:typeof v==='string'&&/^\d+(?:\.\d+)?%?$/.test(v.trim())?Number(v.replace('%','')):NaN;if(Number.isFinite(n)&&n>=0&&n<=999&&Object.keys(skills).length<150){const k=(aliases[key.toUpperCase()]||aliases[key]||key).trim().slice(0,35);if(k&&!['__proto__','constructor','prototype'].includes(k))Object.defineProperty(skills,k,{value:Math.floor(n),enumerable:true,writable:true,configurable:true})}};
 const visit=(obj:any,depth=0)=>{if(depth>5||!obj||typeof obj!=='object')return;if(Array.isArray(obj)){for(const row of obj){if(row?.name&&(row.value!==undefined||row.val!==undefined))add(row.name,row.value??row.val);else visit(row,depth+1)}return;}for(const [key,val]of Object.entries(obj)){if(['name','姓名','名称','occupation','职业','age','年龄','version','weapons','damageBonus','resources'].includes(key))continue;if(val&&typeof val==='object'){const v:any=val;if(v.value!==undefined||v.val!==undefined)add(key,v.value??v.val);else visit(val,depth+1);}else add(key,val)}};
 visit(raw);
 if(!Object.keys(skills).length)throw Error('没有识别到技能。请使用 JSON、技能,数值 CSV 或 .st 力量50侦查60 文本。');
 const weapons:Weapon[]=Array.isArray(raw.weapons)?raw.weapons.slice(0,25).filter((w:any)=>w&&typeof w==='object').map((w:any)=>({name:String(w.name||'未命名武器').slice(0,45),skill:String(w.skill||'').slice(0,35),damage:String(w.damage||'1D3').toUpperCase().replace(/\s/g,'').slice(0,80),impale:w.impale===true})):[];
 const resources:Card['resources']={};for(const key of ['hp','hpMax','mp','mpMax'] as const){const n=raw.resources?.[key];if(Number.isInteger(n)&&n>=0&&n<=999)resources[key]=n;}
 return {name:String(raw.name??raw.姓名??raw.名称??'未命名调查员').slice(0,40),occupation:String(raw.occupation??raw.职业??'调查员').slice(0,60),skills,weapons,damageBonus:String(raw.damageBonus??'0').toUpperCase().replace(/\s/g,'').slice(0,20),resources};
}
export function parseCard(text:string):Card{
 text=text.replace(/^\uFEFF/,'').trim();if(text.startsWith('{')||text.startsWith('[')){const data=JSON.parse(text);return cleanCard(Array.isArray(data)?data[0]:data)}
 const raw:any={skills:{}};const name=text.match(/(?:姓名|name)\s*[:：,=]\s*([^\n,，]+)/i);if(name)raw.name=name[1].trim();const occ=text.match(/(?:职业|occupation)\s*[:：,=]\s*([^\n,，]+)/i);if(occ)raw.occupation=occ[1].trim();
 for(const line of text.split(/\r?\n/)){const p=line.split(/[,，\t]/).map(s=>s.trim().replace(/^"|"$/g,''));if(p.length>=2&&/^\d+%?$/.test(p[1]))raw.skills[p[0]]=Number(p[1].replace('%',''));}
 const normalized=text.replace(/\.st\s*(?:set)?/gi,' ').replace(/(?:姓名|name|职业|occupation)\s*[:：,=][^\n]+/gi,' ');
 for(const match of normalized.matchAll(/([\p{L}][\p{L}（）()·_ /-]*?)\s*[:：=]?\s*(\d{1,3})%?/gu)){raw.skills[match[1].trim()]=Number(match[2]);}return cleanCard(raw);
}
export const threshold=(value:number,difficulty:string)=>Math.floor(value/(difficulty==='困难'?2:difficulty==='极难'?5:1));
export function verdict(result:number,value:number,difficulty='普通'){const target=threshold(value,difficulty);const label=result===1?'大成功':result===100||(target<50&&result>=96)?'大失败':result<=Math.floor(value/5)?'极难成功':result<=Math.floor(value/2)?'困难成功':result<=value?'普通成功':'失败';return {label,passed:label==='大成功'||(label!=='大失败'&&result<=target),target};}
export function percentRoll(bonus:number,random:(n:number)=>number){const unit=random(10);const tens=Array.from({length:1+Math.abs(bonus)},()=>random(10));const candidates=tens.map(t=>t*10+unit||100);return {unit,tens,candidates,result:bonus<0?Math.max(...candidates):Math.min(...candidates)}}
export function diceExpression(expression:string,random:(n:number)=>number){const e=expression.replace(/\s/g,'').toUpperCase();if(!/^(?:\d{0,2}D\d{1,4}|\d{1,4})(?:[+-](?:\d{0,2}D\d{1,4}|\d{1,4})){0,8}$/.test(e))throw Error('支持如 1D6、2D6+1、1D4+1D6，最多 9 项');let total=0;const parts:string[]=[];for(const m of e.matchAll(/([+-]?)(\d*D\d+|\d+)/g)){const sign=m[1]==='-'?-1:1;if(m[2].includes('D')){const [a,b]=m[2].split('D');const count=Number(a||1),faces=Number(b);if(count<1||count>30||faces<2||faces>1000)throw Error('每项限 1–30 个骰子，骰面 2–1000');const values=Array.from({length:count},()=>random(faces)+1);total+=sign*values.reduce((a,b)=>a+b,0);parts.push(`${m[1]}${m[2]}[${values.join(', ')}]`)}else{total+=sign*Number(m[2]);parts.push(m[1]+m[2])}}return {result:total,detail:parts.join(' '),expression:e};}

