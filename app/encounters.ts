import {diceExpression,percentRoll,type Card} from './game.ts';
export const weaponPresets=[
 {name:'徒手',skill:'格斗（斗殴）',damage:'1D3+DB',impale:false},
 {name:'小刀',skill:'格斗（斗殴）',damage:'1D4+DB',impale:true},
 {name:'短棍',skill:'格斗（斗殴）',damage:'1D6+DB',impale:false},
 {name:'手枪',skill:'射击（手枪）',damage:'1D10',impale:true},
 {name:'步枪',skill:'射击（步枪/霰弹枪）',damage:'2D6+4',impale:true},
 {name:'霰弹枪（近距离）',skill:'射击（步枪/霰弹枪）',damage:'4D6',impale:false},
];
export function expressionBounds(expression:string){
 let min=0,max=0;diceExpression(expression,()=>0);
 for(const m of expression.replace(/\s/g,'').toUpperCase().matchAll(/([+-]?)(\d*D\d+|\d+)/g)){
 const sign=m[1]==='-'?-1:1;let low,high;if(m[2].includes('D')){const [a,b]=m[2].split('D');low=Number(a||1);high=low*Number(b)}else low=high=Number(m[2]);min+=sign*(sign<0?high:low);max+=sign*(sign<0?low:high);
 }return {min,max};
}
export function sanityLoss(san:number,expression:string,random:(n:number)=>number){
 if(!Number.isInteger(san)||san<0||san>999)throw Error('人物卡缺少有效理智值');
 const bounds=expressionBounds(expression);if(bounds.min<0||bounds.max>9999)throw Error('理智损失须为非负数，最大不超过 9999');
 const dice=diceExpression(expression,random),loss=dice.result;
 return {kind:'sanity',mode:'direct',skill:'理智损失',result:loss,passed:null,label:'直接理智损失',expression,loss,before:san,after:Math.max(0,san-loss),needsInt:loss>=5,detail:`直接损失 ${dice.detail} = ${loss}；未进行理智检定。${loss>=5?'单次损失 ≥ 5，请进行智力检定，由 KP 判定临时疯狂。':''}`};
}
export function sanityRoll(san:number,successLoss:string,failureLoss:string,random:(n:number)=>number){
 if(!Number.isInteger(san)||san<0||san>999)throw Error('人物卡缺少有效理智值');
 for(const e of [successLoss,failureLoss]){const bounds=expressionBounds(e);if(bounds.min<0||bounds.max>9999)throw Error('理智损失须为非负数，最大不超过 9999');}
 const dice=percentRoll(0,random),passed=dice.result<=san&&dice.result!==100;
 const expression=passed?successLoss:failureLoss;
 const lossRoll=diceExpression(expression,random);const fumble=dice.result===100||(san<50&&dice.result>=96);
 const loss=passed?lossRoll.result:fumble?expressionBounds(failureLoss).max:lossRoll.result;
 return {...dice,kind:'sanity',skill:'理智检定',value:san,target:san,passed,label:passed?'理智检定成功':fumble?'理智检定大失败':'理智检定失败',expression:`${successLoss} / ${failureLoss}`,loss,before:san,after:Math.max(0,san-loss),needsInt:loss>=5,detail:`SAN ${dice.result} / ${san}；${passed?'成功':'失败'}损失 ${expression}：${fumble&&!passed?'大失败取最大值 '+loss:lossRoll.detail+' = '+loss}；${loss>=5?'单次损失 ≥ 5，请进行智力检定，由 KP 判定临时疯狂。':''}`};
}
export function weaponDamage(damage:string,damageBonus:string,mode:string,impale:boolean,random:(n:number)=>number){
 const db=damageBonus.toUpperCase().replace(/\s/g,'');if(!/^(?:-\d{1,3}|\d{1,3}|(?:\d{1,2})?D\d{1,3})$/.test(db))throw Error('伤害加值支持 0、-1、-2、1D4、1D6 等格式');
 const bonus=db.startsWith('-')?db:'+'+db;
 const original=damage.toUpperCase().replace(/\s/g,'');
 if((original.match(/DB/g)||[]).length>1)throw Error('伤害表达式中最多使用一次 DB');
 const resolved=original.replace(/\+DB/g,bonus).replace(/^DB$/,db.startsWith('-')?'0'+db:db);
 if(resolved.includes('DB'))throw Error('请使用 1D4+DB 这样的伤害格式');
 const bounds=expressionBounds(resolved);const standard=diceExpression(resolved,random);let result=standard.result,detail=standard.detail;
 if(mode==='extreme'){
  result=bounds.max;detail=`最大伤害 ${resolved} = ${result}`;
  if(impale){const base=original.replace(/\+DB/g,'');const extra=diceExpression(base,random);result+=extra.result;detail+=`；穿刺追加 ${extra.detail} = ${extra.result}`;}
 }
 return {kind:'damage',expression:resolved,result:Math.max(0,result),label:mode==='extreme'?(impale?'极难成功 · 穿刺伤害':'极难成功 · 最大伤害'):'武器伤害',passed:null,mode,impale,detail:detail+'；结果 '+Math.max(0,result)+'（不自动扣除目标 HP）'};
}
