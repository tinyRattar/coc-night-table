'use client';
export function sortSkills(skills:Record<string,number>,order:string,recent:string[]=[]){
 const entries=Object.entries(skills);
 const rank=(s:string)=>recent.includes(s)?recent.indexOf(s):Number.MAX_SAFE_INTEGER;
 return order==='recent'?entries.sort((a,b)=>rank(a[0])-rank(b[0])):order==='high'?entries.sort((a,b)=>b[1]-a[1]):order==='low'?entries.sort((a,b)=>a[1]-b[1]):entries;
}
export function SkillSort({value,onChange,label}:{value:string;onChange:(value:string)=>void;label:string}){
 return <select className="skill-sort" aria-label={label} value={value} onChange={e=>onChange(e.target.value)}><option value="original">原始顺序</option><option value="recent">最近使用</option><option value="high">成功率：高到低</option><option value="low">成功率：低到高</option></select>;
}
