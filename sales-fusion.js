/* Extended sample: exact tracked weekly > exact cumulative difference > original TOP30 estimates.
   Coverage is a set of canonical model IDs. No product-specific conditions. */
(function(root){'use strict';
const T=root.SalesTracking||(typeof require==='function'?require('./sales-tracking.js'):null);if(!T)throw Error('请先加载 sales-tracking.js');
const VERSION='fusion-v1', {norm,brandKey,weekTime,period,clean}=T;
const names=m=>[m.model_name,...(Array.isArray(m.aliases)?m.aliases:String(m.aliases||'').split(';').map(s=>s.trim()).filter(Boolean))];
const strip=(v,b)=>{let n=norm(v);const aliases=[norm(b),brandKey(b),...({苹果:['APPLE'],小米:['XIAOMI'],华为:['HUAWEI'],荣耀:['HONOR'],一加:['ONEPLUS'],REDMI:['红米']}[brandKey(b)]||[])].filter(Boolean).sort((a,b)=>b.length-a.length);for(const a of aliases)if(n.startsWith(a)&&n.length>a.length)return n.slice(a.length);return n;};
const sorted=xs=>[...new Set(xs)].sort(), same=(a,b)=>a.length===b.length&&a.every(x=>b.includes(x)), subset=(a,b)=>a.every(x=>b.includes(x)), overlap=(a,b)=>a.some(x=>b.includes(x));
function catalog(raw){const models=T.objects(raw,['model_id','model_name','brand','brand_group','aliases','series','generation','variant','tracking_group']),byId=new Map();for(const m of models){if(!m.model_id||!m.model_name||!m.brand||byId.has(m.model_id))throw Error('主数据ID或名称无效：'+m.model_id);byId.set(m.model_id,m);}return {models,byId};}
function modelHits(cat,name,brand,standardOnly=false){return cat.models.filter(m=>(!brand||brandKey(m.brand)===brandKey(brand))&&(standardOnly?[m.model_name]:names(m)).some(n=>brand?strip(n,m.brand)===strip(name,brand):norm(n)===norm(name)));}
function trackedMatch(cat,g){const ms=cat.models.filter(m=>brandKey(m.brand)===brandKey(g.brand)),n=strip(g.model,g.brand);const explicit=ms.filter(m=>m.tracking_group&&strip(m.tracking_group,m.brand)===n);if(explicit.length)return {ids:sorted(explicit.map(m=>m.model_id)),kind:'tracking_group'};
 const hits=modelHits(cat,g.model,g.brand);if(hits.length===1)return {ids:[hits[0].model_id],kind:'model'};return {ids:[],kind:hits.length?'ambiguous':'unmatched'};}
function rankMatch(cat,name){
 // A slash label can express multiple versions: split and extend the first full name by suffix.
 // Resolve only when the first token and each subsequent token uniquely identify distinct models.
 const parts=String(name).normalize('NFKC').split('/').map(s=>s.trim());if(parts.length>1){const first=modelHits(cat,parts[0],null,true);if(first.length===1){const m=first[0],ids=[m.model_id];let ok=true;for(const p of parts.slice(1)){const hits=cat.models.filter(x=>brandKey(x.brand)===brandKey(m.brand)&&x.series===m.series&&x.generation===m.generation&&[x.model_name,...names(x)].some(n=>norm(n)===norm(p)||norm(n)===norm(parts[0]+p)||norm(n)===norm(parts[0]+' '+p)||strip(n,x.brand)===norm(p)));if(hits.length!==1){ok=false;break;}ids.push(hits[0].model_id);}if(ok&&sorted(ids).length===parts.length)return {ids:sorted(ids),kind:'combined'};}}
 const hits=modelHits(cat,name,null);if(hits.length===1)return {ids:[hits[0].model_id],kind:'model'};return {ids:[],kind:hits.length?'ambiguous':'unmatched'};}
function parseBoards(raw){let rows;if(root.SalesSeries?.parseCSV){rows=root.SalesSeries.parseCSV(raw).map(r=>Object.fromEntries(root.SalesSeries.HEADER.map((k,i)=>[k,r[i]])));}else rows=T.objects(raw,['dataset_id','source','series','period_type','period','period_start','period_end','rank','actual_count','model','brand_group','estimated_wan']);
 const scopes=new Map();for(const r of rows){if(r.period_type!=='weekly')continue;const t=weekTime(r.period);if(r.period_start!==T.dateText(t)||r.period_end!==T.dateText(t+6*T.DAY)||!r.model||!r.estimated_wan||!/^\d+(?:\.\d+)?$/.test(r.estimated_wan)||!Number.isFinite(+r.estimated_wan)||!Number.isSafeInteger(+r.rank)||+r.rank<1)throw Error('榜单记录无效：'+r.period+' '+r.model);const id=JSON.stringify([r.source,r.series]);if(!scopes.has(id))scopes.set(id,new Map());const weeks=scopes.get(id);if(!weeks.has(t))weeks.set(t,[]);weeks.get(t).push(r);}return scopes;}
function top30(rows){if(!rows)return null;const top=rows.filter(r=>+r.rank<=30);if(new Set(rows.map(r=>r.dataset_id)).size!==1||rows.some(r=>+r.actual_count!==rows.length)||new Set(rows.map(r=>+r.rank)).size!==rows.length||top.length!==30||new Set(top.map(r=>+r.rank)).size!==30)return null;return [...top].sort((a,b)=>+a.rank-+b.rank);}
function fuse({tracking,master,rankCSV,scopeId}){const cat=typeof master==='string'?catalog(master):master,groups=typeof tracking==='string'?T.calculate(tracking):tracking,scopes=typeof rankCSV==='string'?parseBoards(rankCSV):rankCSV;if(!scopeId&&scopes.size>1)throw Error('有多个榜单来源，请明确指定 scopeId');const boards=scopeId?scopes.get(scopeId):scopes.values().next().value;if(scopeId&&!boards)throw Error('不存在指定榜单来源');const weeks=new Map(),issues=groups.flatMap(g=>g.issues),allTimes=new Set(boards?.keys()||[]);
 const ensure=t=>{if(!weeks.has(t))weeks.set(t,{period:period(t),original:[],tracked:[],expanded:[],details:[],boardComplete:false});return weeks.get(t);};
 function note(t,code,label,message){issues.push({period:t==null?'':period(t),code,product:label,message});}
 function entry(label,ids,value,source,extra={}){return {label,member_ids:ids,value_wan:value,source,...extra};}
 for(const g of groups){const match=trackedMatch(cat,g);if(!match.ids.length)note(null,'tracked_mapping',g.brand+' '+g.model,'累计跟踪名称未唯一匹配；不参与去重合计');for(const t of [...g.cumulative.keys(),...g.weekly.keys()])allTimes.add(t);for(const [t,r] of g.exactWeekly){ensure(t).tracked.push(entry(g.brand+' '+g.model,match.ids,r.value,r.source,{mapping:match.kind}));} }
 for(const t of [...allTimes].sort((a,b)=>a-b)){const week=ensure(t),rows=top30(boards?.get(t));week.boardComplete=!!rows;if(boards?.has(t)&&!rows)note(t,'incomplete_top30','TOP30','前30名不完整；不使用该周榜单补充');
 if(rows)for(const r of rows){const m=rankMatch(cat,r.model);const e=entry(r.model,m.ids,+r.estimated_wan,'rank_estimate',{original_rank:+r.rank,mapping:m.kind,brand_group:r.brand_group});week.original.push(e);if(!m.ids.length)note(t,'rank_mapping',r.model,'榜单机型未唯一匹配；保留原始榜单，扩展合计暂排除');}
 const selected=[],details=[];const ordered=[...week.tracked].sort((a,b)=>b.member_ids.length-a.member_ids.length||(a.source==='input_weekly'?-1:1)-(b.source==='input_weekly'?-1:1)||a.label.localeCompare(b.label));
 const skip=(e,reason)=>details.push({...e,selected:false,reason});
 for(const e of ordered){if(!e.member_ids.length){skip(e,'未匹配');continue;}const prior=selected.filter(p=>overlap(p.member_ids,e.member_ids));if(!prior.length){selected.push(e);continue;}if(prior.some(p=>same(p.member_ids,e.member_ids)&&!T.equal(p.value_wan,e.value_wan)))note(t,'tracked_duplicate_conflict',e.label,'相同覆盖范围的跟踪记录数值冲突；采用优先记录');else if(!subset(e.member_ids,sorted(prior.flatMap(p=>p.member_ids))))note(t,'tracked_overlap',e.label,'跟踪统计范围交叉，无法无损拆分');skip(e,'已有重叠的跟踪统计范围');}
 // Compare original rank rows with tracked coverage. Incomplete tracked coverage never replaces an entire combined rank entry.
 for(const e of week.original){if(!e.member_ids.length){skip(e,'未匹配榜单');continue;}const prior=selected.filter(p=>overlap(p.member_ids,e.member_ids)),covered=sorted(prior.flatMap(p=>p.member_ids));if(!prior.length){selected.push(e);continue;}
 if(subset(e.member_ids,covered)){if(same(e.member_ids,covered)){const v=clean(prior.reduce((s,p)=>s+p.value_wan,0));if(!T.equal(v,e.value_wan))note(t,'dual_source_difference',e.label,'跟踪 '+v+' / 榜单 '+e.value_wan+' 万台');}skip(e,'覆盖范围已有跟踪或优先记录');continue;}
 if(prior.every(p=>p.source!=='rank_estimate'&&subset(p.member_ids,e.member_ids))){for(const p of prior){selected.splice(selected.indexOf(p),1);skip(p,'仅覆盖合并榜单的部分成员，保留单机详情但不重复计入合计');}selected.push(e);note(t,'partial_coverage',e.label,'跟踪只覆盖部分成员，合计使用完整榜单条目');continue;}
 skip(e,'统计范围交叉，无法无损去重');note(t,'rank_overlap',e.label,'统计范围交叉，保留原始数据，扩展合计不重复计入');}
 week.expanded=selected.map(e=>({...e,selected:true}));week.details=[...week.expanded,...details];week.total_wan=selected.length?clean(selected.reduce((s,e)=>s+e.value_wan,0)):null;week.original_total_wan=rows?clean(week.original.reduce((s,e)=>s+e.value_wan,0)):null;
 // Compare original weekly constraints to equal-coverage rank observations without treating bounds as point estimates.
 for(const g of groups){const match=trackedMatch(cat,g),raw=g.weekly.get(t),bound=g.bounds.get(t);if(!match.ids.length)continue;const matched=week.original.filter(e=>same(e.member_ids,match.ids));for(const e of matched){const v=e.value_wan;if(raw&&(raw.operator==='<'&&v>=raw.value||raw.operator==='>='&&v<raw.value)||bound&&(v<bound.lower||bound.upper!=null&&v>bound.upper||bound.lowerOpen&&T.equal(v,bound.lower)||bound.upperOpen&&T.equal(v,bound.upper)))note(t,'rank_constraint_conflict',e.label,'榜单估算与跟踪上下界不一致');}}
 }
 return {version:VERSION,scopeId:scopeId||scopes.keys().next().value||'',weeks:[...weeks.values()].sort((a,b)=>a.period.localeCompare(b.period)),issues,master:cat};}
// A group is assigned only when all its members share the chosen attribute. Never split a combined record.
function aggregate(week,cat,field='series'){const map=new Map();for(const e of week.expanded){const members=e.member_ids.map(id=>cat.byId.get(id));const keys=sorted(members.map(m=>m?JSON.stringify(field==='series'?[brandKey(m.brand),m.series]:field==='generation'?[brandKey(m.brand),m.series,m.generation]:[m[field]||'']):''));const k=keys.length===1&&keys[0]?keys[0]:'未分配（跨组或未知）';map.set(k,clean((map.get(k)||0)+e.value_wan));}return [...map].map(([key,value_wan])=>({key,value_wan}));}
// Adapt fusion output to the existing research time-series interface. Original ranks
// remain sourced from the unmodified board; a combined scope is never split into SKU values.
const coverageKey=ids=>ids.length===1?ids[0]:'coverage:'+JSON.stringify(ids);
function buildPanel(rawPanel,history,tracking,master,options={}){
 const Series=root.SalesSeries,Brand=root.BrandUtils,p=Series.salesPanelOptions(options),header=[...rawPanel.header,'sales_source','member_ids','fusion_algorithm_version'],rows=[],scopes=[];
 const col=Series.col,cat={models:master.models,byId:new Map(master.models.map(m=>[m.model_id,m]))};
 const boardScopes=new Map();
 for(const r of history){if(r[col.period_type]!=='weekly')continue;const id=JSON.stringify([r[col.source],r[col.series]]);if(!boardScopes.has(id))boardScopes.set(id,new Map());const weeks=boardScopes.get(id),t=weekTime(r[col.period]);if(!weeks.has(t))weeks.set(t,[]);weeks.get(t).push(Object.fromEntries(Series.HEADER.map((k,i)=>[k,r[i]])));}
 for(const originalScope of rawPanel.scopes){
  const result=fuse({tracking,master:cat,rankCSV:boardScopes,scopeId:originalScope.id}),byPeriod=new Map(result.weeks.map(w=>[w.period,w])),originalWeeks=new Map(originalScope.fullWeeks.map(w=>[w.period,w])),models=new Map();
  const fullWeeks=[],dates=result.weeks.map(w=>weekTime(w.period));
  if(!dates.length)continue;
  const common=(members,field)=>members.length&&members.every(m=>m[field]===members[0][field])?members[0][field]:null;
  function ensure(e){
   const id=coverageKey(e.member_ids);if(models.has(id))return models.get(id);
   const members=e.member_ids.map(x=>cat.byId.get(x)).filter(Boolean),single=members.length===1?members[0]:null;
   const fields=['brand','brand_group','series','generation','form_factor','sale_start_date','launch_price','chip_vendor','chip_model','base_ram','base_rom'];
   const info=single||Object.fromEntries(fields.map(k=>[k,common(members,k)]));
   const name=single?.model_name||e.label;
   const m={key:id,name,master:single||{...info,model_name:name,model_id:null,aliases:[]},brand:info.brand_group||'其他',count:0,first:'',member_ids:e.member_ids};
   models.set(id,m);return m;
  }
  for(let t=dates[0];t<=dates.at(-1);t+=T.WEEK){
   const per=period(t),orig=originalWeeks.get(per),f=byPeriod.get(per),rankMap=new Map(),salesMap=new Map();
   // Original ranks are matched by exactly the same coverage, not by alias alone.
   for(const r of orig?.map.values()||[]){const m=rankMatch(cat,r[col.model]);if(m.ids.length){const k=coverageKey(m.ids);if(!rankMap.has(k))rankMap.set(k,r);else rankMap.set(k,null);}}
   for(const e of f?.expanded||[]){const m=ensure(e);salesMap.set(m.key,e);if(!m.first)m.first=per;}
   fullWeeks.push({period:per,start:T.dateText(t),end:T.dateText(t+6*T.DAY),map:new Map([...rankMap].filter(([,r])=>r)),salesMap,hasBoard:!!orig?.hasBoard,top:orig?.top||'',count:orig?.count||0,cutoff:orig?.cutoff??null,boardComplete:!!f?.boardComplete,fusion:f||null});
  }
  const weeks=fullWeeks.filter(w=>(!p.start||w.period>=p.start)&&(!p.end||w.period<=p.end));
  if(!weeks.length)continue;
  const selected=[...models.values()].filter(m=>weeks.some(w=>w.salesMap.has(m.key))).sort((a,b)=>a.name.localeCompare(b.name,'zh-CN'));
  const panelRows=[],fmt=v=>v==null?'':Number(v).toFixed(4);
  for(const m of selected){
   m.count=weeks.filter(w=>w.salesMap.has(m.key)).length;m.baseWeeks=p.coverageBase==='first'?weeks.filter(w=>w.period>=m.first).length:weeks.length;m.coverage=m.count/m.baseWeeks;
   // Expanded mode deliberately does not impute or filter out newly added low-coverage records.
   let total=0,unknown=false;
   for(const w of weeks){const e=w.salesMap.get(m.key),rank=w.map.get(m.key),value=e?.value_wan??null;
    if(w.period>=m.first&&value===null)unknown=true;if(value!==null)total+=value;
    const cumulative=w.period<m.first||unknown?null:total;
    panelRows.push([originalScope.source,originalScope.series,w.period,w.start,w.end,m.key,m.member_ids.length===1?m.key:'',m.name,rank?.[col.model]||'',m.brand,rank?.[col.rank]||'',fmt(value),'',fmt(value),fmt(cumulative),fmt(w.cutoff),'0',e?.source||'missing',String(m.count),String(weeks.length),m.coverage.toFixed(4),String(m.baseWeeks),m.first,weeks[0].period,weeks.at(-1).period,p.coverageBase,'0','0','none','expanded','0','0',e?.source||'',JSON.stringify(m.member_ids),VERSION]);
   }
  }
  rows.push(...panelRows);scopes.push({...originalScope,weeks,fullWeeks,models:selected,rows:panelRows,options:p,expanded:true,fusionIssues:result.issues});
 }
 return {header,rows,scopes,masterRevision:master.revision,expanded:true};
}
const api=Object.freeze({VERSION,catalog,trackedMatch,rankMatch,parseBoards,top30,fuse,aggregate,buildPanel});root.SalesFusion=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
