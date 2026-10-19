import {cleanCard,percentRoll,type Card,type Weapon} from './game.ts';
import {weaponDamage,weaponPresets} from './encounters.ts';
export type Fighter={id:string;owner?:string;card:Card;dex:number;hp:number;hpMax:number;armor:number;attacks:number;ready:boolean;major:boolean;status:string;used:number;responses:number;skip:number};
export type Battle={active:boolean;round:number;turn:string;fighters:Fighter[];pending?:{id:string;actor:string;target:string;weapon:number;temporaryWeapon?:Weapon;skill:string;type:string;shots?:number;bonus:number;note:string};log:{id:string;text:string;audience?:string}[]};
export const emptyBattle=():Battle=>({active:false,round:1,turn:'',fighters:[],log:[]});
export const combatTemplates:Card[]=[
 {name:'持刀歹徒',occupation:'示例 NPC · 可修改',skills:{敏捷:55,力量:60,体型:60,体质:55,斗殴:45,闪避:27},resources:{hp:11,hpMax:11},damageBonus:'0',weapons:[{name:'小刀',skill:'斗殴',damage:'1D4+DB',impale:true}]},
 {name:'持枪守卫',occupation:'示例 NPC · 可修改',skills:{敏捷:60,力量:55,体型:60,体质:60,斗殴:35,闪避:30,'射击（手枪）':50},resources:{hp:12,hpMax:12},damageBonus:'0',weapons:[{name:'手枪',skill:'射击（手枪）',damage:'1D10',impale:true},{name:'徒手',skill:'斗殴',damage:'1D3+DB',impale:false}]},
 {name:'异形猎手',occupation:'自定义怪物示例 · 非官方数值',skills:{敏捷:70,力量:90,体型:85,体质:80,格斗:55,闪避:35},resources:{hp:16,hpMax:16},damageBonus:'1D4',weapons:[{name:'利爪',skill:'格斗',damage:'1D6+DB',impale:false}]}
];
export function weapons(card:Card):Weapon[]{return card.weapons?.length?card.weapons:[{name:'徒手',skill:Object.keys(card.skills).find(k=>/斗殴/.test(k))||'斗殴',damage:'1D3+DB',impale:false}]}
export function combatWeapons(card:Card):Weapon[]{return [...weapons(card),...weaponPresets,{name:'酒瓶（示例）',skill:'斗殴',damage:'1D3+DB',impale:false},{name:'椅子（示例）',skill:'斗殴',damage:'1D6+DB',impale:false}]}
export function selectedWeapon(card:Card,index:number,custom?:any){const w=index===-1?{name:String(custom?.name||'临时武器').trim().slice(0,45),skill:String(custom?.skill||'').slice(0,35),damage:String(custom?.damage||'').slice(0,80),impale:custom?.impale===true}:combatWeapons(card)[index];if(!w)throw Error('请选择有效武器');weaponDamage(w.damage,card.damageBonus||'0','normal',w.impale,()=>0);return w}
export function health(f:{hp?:number;hpMax?:number;status?:string;major?:boolean}){if(f.status==='死亡')return {tone:'dead',label:'死亡'};if(f.status==='濒死')return {tone:'critical',label:'濒死'};if(f.status==='昏迷'||f.hp===0)return {tone:'critical',label:'昏迷'};if(f.major)return {tone:'critical',label:'重伤'};if(f.hp===undefined||!f.hpMax)return {tone:'unknown',label:'状态未知'};if(f.hp>=f.hpMax)return {tone:'full',label:'满血'};if(f.hp<=f.hpMax/2)return {tone:'low',label:'血量危险'};return {tone:'hurt',label:'受伤'}}
export function skillFor(card:Card,w:Weapon){return w.skill in card.skills?w.skill:Object.keys(card.skills).find(k=>k.replace(/[（）()\s]/g,'')===w.skill.replace(/[（）()\s]/g,''))||(/徒手|刀|棍/.test(w.name)?Object.keys(card.skills).find(k=>/斗殴/.test(k)):undefined)||''}
export function order(b:Battle){return [...b.fighters].sort((a,c)=>(c.dex+(c.ready?50:0))-(a.dex+(a.ready?50:0))||a.id.localeCompare(c.id))}
export function makeFighter(card:Card,id:string,owner?:string):Fighter{
 const hpMax=card.resources?.hpMax??(Number.isFinite(card.skills.体质)&&Number.isFinite(card.skills.体型)?Math.floor((card.skills.体质+card.skills.体型)/10):undefined);
 if(hpMax===undefined||!Number.isInteger(hpMax)||hpMax<=0)throw Error('请先填写最大 HP，或填写体质与体型');
 if((card.resources?.hp??hpMax)>hpMax)throw Error('当前 HP 不能大于最大 HP');
 for(const w of weapons(card))weaponDamage(w.damage,card.damageBonus||'0','normal',w.impale,()=>0);
 return {id,owner,card,dex:card.skills.敏捷??0,hp:card.resources?.hp??hpMax,hpMax:hpMax,armor:0,attacks:1,ready:false,major:false,status:'正常',used:0,responses:0,skip:0};
}
export function level(result:number,value:number){return result===1?4:result===100||(value<50&&result>=96)?0:result<=Math.floor(value/5)?3:result<=Math.floor(value/2)?2:result<=value?1:0}
const labels=['失败','普通成功','困难成功','极难成功','大成功'];
function roll(value:number,bonus:number,random:(n:number)=>number){const d=percentRoll(bonus,random);const l=level(d.result,value);return {...d,level:l,text:`${d.result}（${labels[l]}）`}}
function log(b:Battle,text:string,audience='public'){b.log.unshift({id:crypto.randomUUID(),text,audience});b.log=b.log.slice(0,80)}
function hurt(b:Battle,f:Fighter,raw:number,random:(n:number)=>number){const damage=Math.max(0,raw-f.armor),before=f.hp;f.hp=Math.max(0,f.hp-damage);let note='';
 if(damage>=f.hpMax){f.status='死亡';note='单次伤害达到最大 HP，死亡'}
 else {if(damage>=f.hpMax/2){f.major=true;const con=roll(f.card.skills.体质??0,0,random);note=`重伤；体质 ${f.owner?con.text:'暗骰（仅 KP 可见）'}`;if(!f.owner)log(b,`${f.card.name} 重伤体质暗骰：${con.text}`,'keeper');if(!con.level)f.status='昏迷'}if(f.hp===0){f.status=f.major?'濒死':'昏迷';note+=`；${f.status}`}}
 log(b,`${f.card.name} 承受 ${raw} 点伤害，护甲 ${f.armor}，实际损失 ${damage} HP${note?' · '+note:''}`);return {damage,before,after:f.hp};
}
export function projectBattle(b:Battle,user:string,kp:boolean){return {...b,log:b.log.filter(r=>kp||r.audience==='public'),fighters:order(b).map(f=>kp||f.owner===user?f:{id:f.id,owner:f.owner,name:f.card.name,dex:f.dex,ready:f.ready,used:f.used,attacks:f.attacks,status:f.status,major:f.major,health:health(f),...(f.owner?{hp:f.hp,hpMax:f.hpMax}:{})}),pending:b.pending?{id:b.pending.id,actor:b.pending.actor,target:b.pending.target,type:b.pending.type,shots:b.pending.shots||1,note:b.pending.note,weaponName:(b.pending.temporaryWeapon||combatWeapons(b.fighters.find(f=>f.id===b.pending!.actor)!.card)[b.pending.weapon])?.name}:undefined};}
export function combatAction(b:Battle,action:string,input:any,user:string,kp:boolean,random:(n:number)=>number){
 const requireKp=()=>{if(!kp)throw Error('此操作需要 KP 身份')};const fighter=(id:string)=>{const f=b.fighters.find(f=>f.id===id);if(!f)throw Error('角色不在战斗中');return f};const control=(f:Fighter)=>{if(!kp&&f.owner!==user)throw Error('只能操作自己的调查员')};
 if(action==='add'){requireKp();if(b.active||b.pending)throw Error('请先结束战斗再调整参战名单');if(b.fighters.length>=30)throw Error('最多 30 位参战者');const f=makeFighter(cleanCard(input.card),crypto.randomUUID(),input.owner||undefined);if(f.owner&&b.fighters.some(x=>x.owner===f.owner))throw Error('该调查员已经参战');b.fighters.push(f);log(b,`${f.card.name} 加入战斗`)}
 else if(action==='remove'){requireKp();if(b.active)throw Error('请先结束战斗');b.fighters=b.fighters.filter(f=>f.id!==input.id)}
 else if(action==='edit'){requireKp();if(b.pending)throw Error('请先处理当前攻击');const f=fighter(input.id);for(const [key,max]of [['hp',999],['hpMax',999],['dex',999],['armor',999],['attacks',10]] as const){if(input[key]!==undefined){const n=Number(input[key]);if(!Number.isInteger(n)||n<(key==='hpMax'||key==='attacks'?1:0)||n>max)throw Error('状态数值无效');f[key]=n}}if(f.hp>f.hpMax)throw Error('当前 HP 不能大于最大 HP');if(input.ready!==undefined)f.ready=input.ready===true;if(['正常','昏迷','濒死','死亡'].includes(input.status))f.status=input.status;if(input.major!==undefined)f.major=input.major===true;log(b,`KP 调整了 ${f.card.name} 的战斗状态`)}
 else if(action==='start'){requireKp();if(b.active)throw Error('战斗已开始');if(b.fighters.length<2)throw Error('至少需要两名参战者');b.active=true;b.round=1;for(const f of b.fighters){f.used=0;f.responses=0;f.skip=0}b.turn=order(b).find(f=>f.status==='正常'&&f.hp>0)?.id||'';if(!b.turn)throw Error('没有能够行动的角色');log(b,'战斗开始 · 第 1 轮')}
 else if(action==='end'){requireKp();b.active=false;delete b.pending;log(b,'KP 结束了本场战斗；保留记录与当前 HP')}
 else if(action==='next'){requireKp();if(!b.active||b.pending)throw Error('请先处理当前攻击');const list=order(b);let i=list.findIndex(f=>f.id===b.turn);for(let n=0;n<list.length*2;n++){i++;if(i>=list.length){i=0;b.round++;for(const f of list){f.used=0;f.responses=0}log(b,`第 ${b.round} 轮`)}const f=list[i];if(f.skip>0){f.skip--;log(b,`${f.card.name} 因卧倒躲避失去本次行动`);continue}if(f.hp>0&&f.status==='正常'){b.turn=f.id;return b}}b.active=false;b.turn='';log(b,'没有能够行动的角色，战斗暂停')}
 else if(action==='declare'){
  if(!b.active||b.pending)throw Error('当前不能声明攻击');const a=fighter(input.actor);control(a);if(a.id!==b.turn)throw Error('尚未轮到该角色');if(a.status!=='正常'||a.hp<=0)throw Error('该角色无法行动');if(a.skip>0)throw Error('卧倒躲避失去了本次行动，请 KP 推进回合');if(a.used>=a.attacks)throw Error('本轮攻击次数已用完');const t=fighter(input.target);if(t.id===a.id||t.hp<=0||t.status==='死亡')throw Error('请选择有效的其他目标');const w=selectedWeapon(a.card,Number(input.weapon),input.temporaryWeapon);const skill=String(input.skill||skillFor(a.card,w));if(!Number.isInteger(a.card.skills[skill]))throw Error('请选择人物卡中的攻击技能');const bonus=Number(input.bonus||0);if(!Number.isInteger(bonus)||Math.abs(bonus)>2)throw Error('奖惩骰无效');
  const shots=input.type==='handgun'?Number(input.shots??3):1;if(!Number.isInteger(shots)||shots<1||shots>3||(input.type==='handgun'&&shots<2))throw Error('手枪连射请选择 2 或 3 枪');if(shots>1){if(!/手枪|左轮|handgun|pistol|revolver/i.test(w.name+' '+skill))throw Error('连射仅适用于手枪，请选择手枪武器或技能');if(a.used>0)throw Error('手枪连射须在本轮首次攻击时声明');}
  b.pending={id:crypto.randomUUID(),actor:a.id,target:t.id,weapon:Number(input.weapon),temporaryWeapon:w,skill,type:input.type==='firearm'||input.type==='handgun'?'firearm':'melee',shots,bonus,note:String(input.note||'').slice(0,100)};log(b,`${a.card.name} 用 ${w.name} 向 ${t.card.name} 声明${b.pending.type==='firearm'?(shots>1?`手枪连射（${shots} 枪，每枪一颗惩罚骰）`:'射击'):'近战攻击'}${b.pending.note?' · '+b.pending.note:''}，等待目标应对`);
 }else if(action==='cancel'){requireKp();if(!b.pending)throw Error('没有待处理攻击');delete b.pending;log(b,'KP 取消了待处理攻击')}
 else if(action==='respond'){
  const p=b.pending;if(!p||p.id!==input.pendingId)throw Error('攻击已经处理，请刷新');const a=fighter(p.actor),t=fighter(p.target);control(t);const response=String(input.response);if(!(p.type==='firearm'?['none','cover']:['none','dodge','back']).includes(response))throw Error('应对方式无效');if(t.status!=='正常'&&response!=='none')throw Error('无法行动的目标只能承受攻击');
  let bonus=p.bonus;let defense:any=null;let dw:Weapon|undefined;let ds='';
  if(response==='back'){dw=selectedWeapon(t.card,Number(input.weapon),input.temporaryWeapon);ds=String(input.skill||skillFor(t.card,dw));if(!Number.isInteger(t.card.skills[ds])||/射击/.test(ds))throw Error('反击须选择近战技能');defense=roll(t.card.skills[ds],0,random)}
  if(response==='dodge'||response==='cover'){const dodge=Object.keys(t.card.skills).find(k=>/闪避/.test(k));if(!dodge)throw Error('目标卡中缺少闪避技能');defense=roll(t.card.skills[dodge],0,random)}
  if(p.type==='melee'&&t.responses>=t.attacks)bonus++;if(response==='cover'){t.skip++;if(defense.level)bonus--}bonus=Math.max(-2,Math.min(2,bonus));
  if(p.type==='firearm'&&(p.shots||1)>1){
   const count=p.shots!,w=p.temporaryWeapon||combatWeapons(a.card)[p.weapon];bonus=Math.max(-2,Math.min(2,bonus-1));a.used=a.attacks;
   if(defense){log(b,`${t.card.name} 卧倒躲避 ${t.owner?defense.text:'暗骰（仅 KP 可见）'} · 本次连射统一适用，失去下一次行动`);if(!t.owner)log(b,`${t.card.name} 卧倒躲避暗骰：${defense.text}`,'keeper')}
   for(let shot=1;shot<=count;shot++){
    if(t.status==='死亡'){log(b,'目标已经死亡，停止剩余射击');break}
    const attack=roll(a.card.skills[p.skill],bonus,random),prefix=`${a.card.name} 第 ${shot}/${count} 枪`;
    const detail=`${prefix}：${attack.text} · ${bonus<0?'惩罚':bonus>0?'奖励':'无奖惩'}${bonus?Math.abs(bonus):''}骰`;
    log(b,detail,a.owner?'public':'keeper');if(!a.owner)log(b,`${prefix}：暗骰（仅 KP 可见）`);
    if(attack.level){const damage=weaponDamage(w.damage,a.card.damageBonus||'0',attack.level>=3?'extreme':'normal',w.impale,random);log(b,`第 ${shot} 枪命中 · ${damage.detail.replace(/（不自动扣除目标 HP）/g,'')}`,a.owner?'public':'keeper');if(!a.owner)log(b,`第 ${shot} 枪命中 · NPC 伤害已暗骰结算`);hurt(b,t,damage.result,random)}else log(b,`第 ${shot} 枪未命中`);
   }
   delete b.pending;return b;
  }
  const attack=roll(a.card.skills[p.skill],bonus,random);const wins=attack.level>0&&(response==='dodge'?attack.level>(defense?.level||0):response==='back'?attack.level>=(defense?.level||0):true);a.used++;if(response==='dodge'||response==='back')t.responses++;
  const summary=(secret:boolean)=>`${a.card.name} 攻击 ${!secret&&!a.owner?'暗骰（仅 KP 可见）':attack.text}${bonus&&(secret||a.owner)?` · ${bonus>0?'奖励':'惩罚'} ${Math.abs(bonus)} 骰`:''}；${t.card.name} ${response==='none'?'不抵抗':(response==='cover'?'卧倒躲避 ':response==='dodge'?'闪避 ':'反击 ')+(!secret&&!t.owner?'暗骰（仅 KP 可见）':defense.text)}`;
  log(b,summary(false));if(!a.owner||(!t.owner&&defense))log(b,summary(true),'keeper');
  if(wins){const w=p.temporaryWeapon||combatWeapons(a.card)[p.weapon],damage=weaponDamage(w.damage,a.card.damageBonus||'0',attack.level>=3?'extreme':'normal',w.impale,random);log(b,`命中 · ${damage.detail.replace(/（不自动扣除目标 HP）/g,'')}`,a.owner?'public':'keeper');if(!a.owner)log(b,'NPC 攻击命中 · 伤害已暗骰结算');hurt(b,t,damage.result,random)}
  else if(response==='back'&&defense.level>attack.level){const damage=weaponDamage(dw!.damage,t.card.damageBonus||'0','normal',dw!.impale,random);log(b,`反击命中 · ${damage.detail.replace(/（不自动扣除目标 HP）/g,'')}`,t.owner?'public':'keeper');if(!t.owner)log(b,'NPC 反击命中 · 伤害已暗骰结算');hurt(b,a,damage.result,random)}else log(b,'攻击未造成伤害');delete b.pending;
 }else throw Error('未知战斗操作');return b;
}
