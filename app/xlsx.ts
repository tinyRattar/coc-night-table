import {cleanCard,type Card} from './game.ts';
export type Cell={value:string|number|null;formula?:string};
export type Cells=Record<string,Cell>;
export function parseCocSheet(cells:Cells):{card:Card;warnings:string[]}{
 const val=(key:string)=>cells[key]?.value;
 if(!String(val('B3')||'').includes('姓名')||!String(val('D15')||'').includes('技能'))throw Error('未识别此 Excel 布局。目前支持双栏 CoC 7 人物卡模板（与参考卡相同），其他布局可使用 JSON 或 CSV。');
 const warnings:string[]=[];const skills:Record<string,number>={};
 const numeric=(key:string):number|undefined=>{const v=val(key);if(v===null||v===undefined||v==='')return undefined;const n=Number(typeof v==='string'?v.replace('%',''):v);return Number.isFinite(n)&&n>=0&&n<=999?Math.floor(n):undefined};
 const put=(name:string,key:string)=>{const n=numeric(key);if(n!==undefined)skills[name]=n;else warnings.push(`${name} 缺少有效数值（${key}），已跳过`)};
 for(const [name,key] of Object.entries({力量:'K3',敏捷:'N3',意志:'Q3',体质:'K5',外貌:'N5',教育:'Q5',体型:'K7',智力:'N7',幸运:'M10'}))put(name,key);
 put('理智',numeric('K12')!==undefined?'K12':'I10');
 for(let row=16;row<=49;row++)for(const [nameCol,subCol,totalCol]of [['D','E','K'],['P','Q','V']]){
  let name=String(val(nameCol+row)||'').replace(/[\r\n]/g,' ').replace(/\s*Ω/g,'').trim();if(!name)continue;
  const branch=String(val(subCol+row)||'').trim();const specialized=/^(技艺|科学|格斗|射击|外语|驾驶|生存|学问)/.test(name);
  if(specialized){if(!branch||branch==='0')continue;name=name.replace(/[①②③④⑤⑥⑦⑧⑨⑩：:]/g,'').trim()+`（${branch}）`;}
  if(name==='自定义技能'){if(!branch)continue;name=branch;}
  put(name,totalCol+row);
 }
 if(Object.keys(skills).length<10)throw Error('识别到的有效数值过少。请先用 Excel 打开人物卡并保存，再重新导入。');
 const weapons=[];for(let row=53;row<=58;row++){const name=String(val('B'+row)||'').trim(),damage=String(val('J'+row)||'').trim();if(!name||!damage||name.startsWith('←'))continue;weapons.push({name:name==='无'?'徒手':name,skill:String(val('E'+row)||''),damage,impale:String(val('N'+row)||'').includes('√')});}
 const card=cleanCard({name:String(val('C3')||'未命名调查员'),occupation:String(val('C5')||'调查员'),skills,weapons,damageBonus:val('W52')??'0',resources:{hp:numeric('D10'),hpMax:numeric('E10'),mp:numeric('Q10'),mpMax:numeric('R10')}});return {card,warnings};
}
// Read only the XML parts needed for the card; pictures, links and macros are never loaded.
export async function readCocXlsx(buffer:ArrayBuffer){
 const bytes=new Uint8Array(buffer),view=new DataView(buffer),decoder=new TextDecoder('utf-8');
 if(bytes.length<22||view.getUint32(0,true)!==0x04034b50)throw Error('这不是有效的 .xlsx 文件。旧版 .xls 请先另存为 .xlsx。');
 let end=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){if(view.getUint32(i,true)===0x06054b50){end=i;break;}}
 if(end<0)throw Error('Excel 文件不完整，请重新选择文件');
 const count=view.getUint16(end+10,true);let offset=view.getUint32(end+16,true);if(count>3000)throw Error('工作簿包含过多文件，请使用简化的人物卡');
 const entries=new Map<string,{method:number;size:number;expanded:number;offset:number;flags:number}>();
 for(let i=0;i<count;i++){
  if(offset+46>bytes.length||view.getUint32(offset,true)!==0x02014b50)throw Error('Excel 压缩目录损坏');
  const length=view.getUint16(offset+28,true),extra=view.getUint16(offset+30,true),comment=view.getUint16(offset+32,true);
  const name=decoder.decode(bytes.subarray(offset+46,offset+46+length));
  entries.set(name,{flags:view.getUint16(offset+8,true),method:view.getUint16(offset+10,true),size:view.getUint32(offset+20,true),expanded:view.getUint32(offset+24,true),offset:view.getUint32(offset+42,true)});offset+=46+length+extra+comment;
 }
 let expandedTotal=0;
 const read=async(name:string,optional=false)=>{
  const entry=entries.get(name);if(!entry){if(optional)return '';throw Error(`Excel 文件缺少 ${name}`)}
  if(entry.flags&1)throw Error('暂不支持加密的人物卡，请另存为无密码 .xlsx');
  if(entry.expanded>12_000_000||(expandedTotal+=entry.expanded)>24_000_000)throw Error('工作表内容过大，请移除无关表格后重试');
  const p=entry.offset;if(p+30>bytes.length||view.getUint32(p,true)!==0x04034b50)throw Error('Excel 文件结构损坏');
  const start=p+30+view.getUint16(p+26,true)+view.getUint16(p+28,true);if(start+entry.size>bytes.length)throw Error('Excel 内容不完整');
  const compressed=bytes.slice(start,start+entry.size);if(entry.method===0)return decoder.decode(compressed);if(entry.method!==8)throw Error('暂不支持此 Excel 压缩格式');
  if(typeof DecompressionStream==='undefined')throw Error('当前浏览器不支持 Excel 解压，请使用新版 Chrome、Edge 或 Firefox');
  const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));const reader=stream.getReader();const parts:Uint8Array[]=[];let size=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>12_000_000)throw Error('解压后的工作表过大');parts.push(value)}}finally{await reader.cancel()}
  if(size!==entry.expanded)throw Error('Excel 解压结果不完整');const output=new Uint8Array(size);let pos=0;for(const part of parts){output.set(part,pos);pos+=part.length}return decoder.decode(output);
 };
 const xml=(text:string)=>{if(/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('不支持含外部实体的 Excel 文件');const doc=new DOMParser().parseFromString(text,'application/xml');if(doc.querySelector('parsererror'))throw Error('Excel XML 无法解析');return doc};
 const tags=(node:Document|Element,name:string)=>Array.from(node.getElementsByTagNameNS('*',name));
 const workbook=xml(await read('xl/workbook.xml'));
 const rels=xml(await read('xl/_rels/workbook.xml.rels'));
 const links=new Map(tags(rels,'Relationship').filter(r=>r.getAttribute('TargetMode')!=='External').map(r=>[r.getAttribute('Id'),r.getAttribute('Target')||'']));
 const sharedXml=await read('xl/sharedStrings.xml',true);const shared=sharedXml?tags(xml(sharedXml),'si').map(si=>tags(si,'t').map(t=>t.textContent||'').join('')):[];
 const sheets=tags(workbook,'sheet');const sheet=sheets.find(s=>s.getAttribute('name')==='人物卡')||sheets[0];if(!sheet)throw Error('工作簿没有工作表');
 const id=sheet.getAttribute('r:id')||sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');const target=links.get(id)||'';
 const path=target.startsWith('/')?target.slice(1):`xl/${target}`;if(!/^xl\/worksheets\/[^/]+\.xml$/.test(path))throw Error('无法识别人物卡工作表路径');
 const doc=xml(await read(path));const cells:Cells={};
 for(const c of tags(doc,'c')){const ref=c.getAttribute('r');if(!ref||!/^([A-X])([1-9]\d?)$/.test(ref))continue;const type=c.getAttribute('t');const raw=tags(c,'v')[0]?.textContent??null;let value:string|number|null=raw;
 if(type==='s')value=shared[Number(raw)]??null;else if(type==='inlineStr')value=tags(c,'t').map(t=>t.textContent||'').join('');else if(type==='e')value=null;else if(raw!==null&&type!=='str')value=Number.isFinite(Number(raw))?Number(raw):raw;
 cells[ref]={value,formula:tags(c,'f')[0]?.textContent||undefined};}
 return {...parseCocSheet(cells),sheetName:sheet.getAttribute('name')};
}

