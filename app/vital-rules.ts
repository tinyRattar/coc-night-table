import {type Card,diceExpression} from './game';
import {expressionBounds} from './encounters';
export function hpFormula(card:Card){return Number.isInteger(card.skills.体质)&&Number.isInteger(card.skills.体型)?Math.floor((card.skills.体质+card.skills.体型)/10):undefined}
export function vitalValues(card:Card){const hpMax=card.resources?.hpMax??hpFormula(card);return {hp:card.resources?.hp??hpMax,hpMax,san:card.skills.理智,sanMax:Math.max(0,99-(card.skills.克苏鲁神话??card.skills['克苏鲁神话知识']??0))}}
export function vitalChange(card:Card,resource:string,direction:string,expression:string,random:(n:number)=>number){
 if(!['hp','san'].includes(resource)||!['loss','heal'].includes(direction))throw Error('请选择体力或理智，以及损伤或治疗');
 const values=vitalValues(card),before=resource==='hp'?values.hp:values.san,max=resource==='hp'?values.hpMax:values.sanMax;
 if(before===undefined||max===undefined)throw Error('请先在编辑人物卡中填写当前值与计算上限所需的属性');
 const bounds=expressionBounds(expression);if(bounds.min<0||bounds.max>9999)throw Error('变化数值须为非负数，最多 9999');
 const dice=diceExpression(expression,random),after=direction==='heal'?Math.max(before,Math.min(max,before+dice.result)):Math.max(0,before-dice.result);
 if(direction==='heal'&&before>max)throw Error('当前值超过上限，请先编辑人物卡校正');
 return {...dice,kind:'vital',resource,direction,before,after,maximum:max,delta:after-before,applied:true,passed:null,skill:resource==='hp'?'体力 HP':'理智 SAN',label:direction==='heal'?'治疗 / 恢复':'损伤 / 损失',detail:`${dice.detail} = ${dice.result}；${before} → ${after}，实际${direction==='heal'?'恢复':'损失'} ${Math.abs(after-before)}；上限 ${max}`,needsInt:resource==='san'&&direction==='loss'&&dice.result>=5};
}
