/* Shared cumulative / weekly sales calculation. No DOM, storage or network. */
(function(root){
'use strict';
const VERSION='tracking-v1', DAY=86400000, WEEK=7*DAY;
const HEADER=Object.freeze('brand,model,category,date,period,metric,value_wan,operator'.split(','));
const norm=v=>String(v??'').normalize('NFKC').toUpperCase().replace(/[\s\u200B-\u200D\u2060\uFEFF]+/g,'');
const brandKey=v=>({APPLE:'苹果',IPHONE:'苹果',XIAOMI:'小米',HUAWEI:'华为',HONOR:'荣耀',ONEPLUS:'一加',红米:'REDMI',REALME:'真我'})[norm(v)]||norm(v);
const key=(brand,model)=>JSON.stringify([brandKey(brand),norm(model)]);
const equal=(a,b)=>a===b||(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-10*Math.max(1,Math.abs(a),Math.abs(b)));
const clean=n=>Number(n.toPrecision(15));
function readCSV(raw){ // Use the existing shared parser when integrated; standalone fallback for preview.
 if(root.SalesSeries?.readCSV)return root.SalesSeries.readCSV(raw);
 const rows=[];let row=[],cell='',q=false,closed=false;const s=String(raw).replace(/^\uFEFF/,'');
 function field(){row.push(cell);cell='';closed=false;}function line(){field();if(row.some(v=>v!==''))rows.push(row);row=[];}
 for(let i=0;i<s.length;i++){const c=s[i];if(q){if(c==='"'){if(s[i+1]==='"'){cell+='"';i++;}else{q=false;closed=true;}}else cell+=c;}else if(c===',')field();else if(c==='\r'||c==='\n'){line();if(c==='\r'&&s[i+1]==='\n')i++;}else if(c==='"'&&!cell&&!closed)q=true;else if(c==='"'||closed)throw Error('CSV 引号格式错误');else cell+=c;}
 if(q)throw Error('CSV 引号未闭合');if(row.length||cell||closed)line();return rows;
}
function objects(raw,required){const rows=readCSV(raw),h=rows.shift()?.map(v=>v.trim());if(!h||new Set(h).size!==h.length||required.some(k=>!h.includes(k)))throw Error('CSV 缺少必要字段或表头重复：'+required.join(', '));return rows.map((r,i)=>{if(r.length!==h.length)throw Error('CSV 第 '+(i+2)+' 行列数不正确');return Object.fromEntries(h.map((k,j)=>[k,r[j].trim()]));});}
function start(y){if(root.IsoSalesWeek)return root.IsoSalesWeek.isoWeek1Monday(y);const d=new Date(0);d.setUTCFullYear(y,0,4);d.setUTCHours(0,0,0,0);return +d-((d.getUTCDay()+6)%7)*DAY;}
function weekTime(p){const m=String(p).match(/^([1-9]\d{3})-W(\d{2})$/);if(!m)throw Error('非法 ISO 周：'+p);const y=+m[1],w=+m[2],t=root.IsoSalesWeek?root.IsoSalesWeek.isoWeekMonday(y,w):start(y)+(w-1)*WEEK;if(w<1||w>53||t==null||t>=start(y+1))throw Error('非法 ISO 周：'+p);return t;}
function period(t){const y=new Date(t+3*DAY).getUTCFullYear();return String(y)+'-W'+String(1+Math.round((t-start(y))/WEEK)).padStart(2,'0');}
function dateText(t){return new Date(t).toISOString().slice(0,10);}
function parse(raw){const records=objects(raw,HEADER),groups=new Map();for(const [i,r] of records.entries()){
 if(!r.brand||!r.model||!['cumulative','weekly'].includes(r.metric)||!['=','<','>=','≈'].includes(r.operator)||!/^\d+(?:\.\d+)?$/.test(r.value_wan)||!Number.isFinite(Number(r.value_wan))||(r.operator==='<'&&Number(r.value_wan)===0))throw Error('第 '+(i+2)+' 行销量字段不合法');
 const t=weekTime(r.period),id=key(r.brand,r.model);if(!groups.has(id))groups.set(id,{id,brand:r.brand,model:r.model,category:r.category,date:r.date,cumulative:new Map(),weekly:new Map()});const g=groups.get(id);if(g.category!==r.category||g.date!==r.date)throw Error('同一产品属性不一致：'+r.brand+' '+r.model);if(g[r.metric].has(t))throw Error('重复销量记录：'+r.model+' '+r.period+' '+r.metric);g[r.metric].set(t,{value:Number(r.value_wan),operator:r.operator,source:'input_'+r.metric});}return groups;}
const exact=r=>r?.operator==='=';
function interval(r){if(!r||r.operator==='≈')return {lo:0,hi:Infinity,open:false};if(r.operator==='=')return {lo:r.value,hi:r.value,open:false};if(r.operator==='>=')return {lo:r.value,hi:Infinity,open:false};return {lo:0,hi:r.value,open:true};}
function contains(b,v){return (v>b.lo||equal(v,b.lo))&&(b.open?v<b.hi&&!equal(v,b.hi):v<b.hi||equal(v,b.hi));}
function solve(g){const c=new Map(g.cumulative),w=new Map(g.weekly),issues=[],bad=new Set(),bounds=new Map(),times=new Set([...c.keys(),...w.keys()]);for(const t of w.keys())times.add(t-WEEK);const ts=[...times].sort((a,b)=>a-b);
 const warn=(t,code,message)=>{issues.push({product:g.model,period:period(t),code,message});};
 // A component has exact consecutive weekly edges; solve from any exact cumulative anchor.
 let run=[];function solveRun(){if(!run.length)return;const offsets=[0];for(let i=1;i<run.length;i++)offsets.push(clean(offsets[i-1]+w.get(run[i]).value));const anchors=run.flatMap((t,i)=>exact(c.get(t))?[clean(c.get(t).value-offsets[i])]:[]);if(!anchors.length)return;const base=anchors[0],vals=offsets.map(o=>clean(base+o));if(anchors.some(v=>!equal(v,base))||vals.some(v=>v<0&&!equal(v,0))||run.some((t,i)=>!contains(interval(c.get(t)),vals[i]))){run.forEach(t=>bad.add(t));warn(run.at(-1),'anchor_conflict','连续周增量与累计锚点或上下界冲突；暂停该区段推导');return;}
 run.forEach((t,i)=>{if(!c.has(t))c.set(t,{value:Math.max(0,vals[i]),operator:'=',source:'derived_cumulative'});});}
 for(const t of ts){if(run.length&&(t-run.at(-1)!==WEEK||!exact(w.get(t)))){solveRun();run=[];}run.push(t);}solveRun();
 // Cumulative values cannot decrease even across missing weeks. Check the available bounds.
 let low=0;for(const t of ts){const r=c.get(t);if(!r)continue;const b=interval(r);if(b.hi<low||b.open&&equal(b.hi,low)){warn(t,'cumulative_conflict','累计销量与先前累计下界冲突');bad.add(t);}low=Math.max(low,b.lo);}
 for(const t of ts){const a=c.get(t-WEEK),b=c.get(t),raw=w.get(t);if(!a||!b)continue;const A=interval(a),B=interval(b);if(a.operator!=='≈'&&b.operator!=='≈'){const lo=Math.max(0,B.lo-A.hi),hi=B.hi-A.lo,lowerOpen=lo>0&&A.open,upperOpen=B.open&&Number.isFinite(hi);if(hi>=lo&&!(equal(hi,lo)&&(lowerOpen||upperOpen))){bounds.set(t,{lower:lo,upper:Number.isFinite(hi)?hi:null,lowerOpen,upperOpen});if(exact(raw)&&((raw.value<lo&&!equal(raw.value,lo))||(raw.value>hi&&!equal(raw.value,hi))||(lowerOpen&&equal(raw.value,lo))||(upperOpen&&equal(raw.value,hi))))warn(t,'weekly_bound_conflict','直接录入周增量超出累计约束');}else warn(t,'invalid_bounds','相邻累计约束无可行周增量');}
 if(exact(a)&&exact(b)){const v=clean(b.value-a.value);if(v<0&&!equal(v,0)){warn(t,'negative_delta','累计差分为负，不生成周增量');continue;}if(raw&&raw.operator!=='≈'&&!contains(interval(raw),v))warn(t,'weekly_conflict','原始周增量与累计差分 '+v+' 不一致');if(!raw&&!bad.has(t)&&!bad.has(t-WEEK))w.set(t,{value:Math.max(0,v),operator:'=',source:'tracked_delta'});}}
 // Original special weekly records remain constraints, not exact sales. An independently valid exact cumulative difference is still usable.
 const exactWeekly=new Map();for(const [t,r] of w){if(exact(r)){exactWeekly.set(t,r);continue;}const a=c.get(t-WEEK),b=c.get(t);if(exact(a)&&exact(b)&&!bad.has(t)&&!bad.has(t-WEEK)){const v=clean(b.value-a.value);if(v>=0&&contains(interval(r),v))exactWeekly.set(t,{value:v,operator:'=',source:'tracked_delta'});}}
 return {...g,cumulative:c,weekly:w,exactWeekly,bounds,issues};}
const api=Object.freeze({VERSION,HEADER,DAY,WEEK,norm,brandKey,key,equal,clean,readCSV,objects,weekTime,period,dateText,parse,solve,calculate:raw=>[...parse(raw).values()].map(solve)});root.SalesTracking=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
