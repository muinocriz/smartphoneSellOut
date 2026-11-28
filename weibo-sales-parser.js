/* Deterministic, side-effect-free Weibo text -> tracking long records. */
(function(root){
 'use strict';
 const SalesLongData=typeof module==='object'&&module.exports?require('./sales-long-data.js'):root.SalesLongData;
 const aliases={
  '华为':'华为','huawei':'华为','荣耀':'荣耀','honor':'荣耀','vivo':'vivo','iqoo':'iQOO',
  'redmi':'REDMI','红米':'REDMI','小米':'小米','xiaomi':'小米','oppo':'OPPO',
  '一加':'一加','oneplus':'一加','真我':'realme','realme':'realme',
  '苹果':'苹果','apple':'苹果','iphone':'苹果','osta':'OSTA','星芒':'OSTA','osta星芒':'OSTA','星芒osta':'OSTA',
  '三星':'三星','samsung':'三星','魅族':'魅族','meizu':'魅族','努比亚':'努比亚','nubia':'努比亚'
 };
 const clean=s=>String(s??'').normalize('NFKC').replace(/\p{Cf}/gu,'').replace(/[‐‑‒–—―−]/g,'-').replace(/\s+/g,' ').trim();
 const norm=s=>clean(s).toUpperCase().replace(/\s/g,'');
 const brand=s=>aliases[clean(s).toLowerCase()]||'';
 const brandKey=s=>norm(brand(s)||s);
 const aliasKeys=Object.keys(aliases).sort((a,b)=>b.length-a.length);
 const splitBrand=s=>{
  const text=clean(s),lower=text.toLowerCase();
  for(const a of aliasKeys){
   if(!lower.startsWith(a))continue;
   const rest=text.slice(a.length);
   // Permit compact forms such as iQOO16 and REDMIK100; guard ordinary English words.
   if(/^[a-z]/i.test(rest)&&/^[a-z]+$/i.test(a)&&!/\d/.test(rest)&&!/^(?:neo|note|turbo|mate|magic|find|reno|galaxy|ace|fold|flip|pad)\b/i.test(rest))continue;
   const model=a==='iphone'?text:rest.trim().replace(/^[:：]\s*/,'');
   return {brand:aliases[a],model};
  }
  return {brand:'',model:text};
 };
 const {DAY:day,isoWeekMonday}=typeof module==='object'&&module.exports
  ?require('./iso-sales-week.js'):root.IsoSalesWeek;
 const weekPattern=/(?:(\d{4})\s*(?:年|[-_/])?\s*)?(?:W\s*(\d{1,2})(?!\d)|第?\s*(\d{1,2})\s*周)/i;
 const categoryPattern=/([\p{Script=Han}A-Za-z0-9]+?\s*SO)(?:\s*[-_/：:]\s*([\p{Script=Han}A-Za-z0-9]+(?:\s*-\s*[A-Za-z0-9]+)*))?/iu;
 const headerLike=s=>categoryPattern.test(s)||/(?:^|\s)(?:截至|截止|截止至)|(?:20\d{2}\s*年?\s*[-_]?\s*W\s*\d)|(?:^|\s)W\s*\d|20\d{2}\s*年\s*第?\s*\d+\s*周/i.test(s);
 function header(s,options){
  const w=weekPattern.exec(s),c=categoryPattern.exec(s);
  if(!w||!c)throw Error('标题缺少可识别的 ISO 周次或 SO 分类');
  if((s.match(new RegExp(weekPattern.source,'gi'))||[]).length!==1)throw Error('标题存在多个周次，无法确定记录归属');
  const y=w[1]?Number(w[1]):Number(options.defaultYear),n=Number(w[2]||w[3]);
  const monday=y>=1900&&y<=9999?isoWeekMonday(y,n):null;
  if(monday===null)throw Error('无效 ISO 年/周');
  const p=y+'-W'+String(n).padStart(2,'0');
  const cumulative=/截至|截止|累计|累销/i.test(s),weekly=/周销量|周增量|本周销量|单周|当周/i.test(s);
  if(cumulative&&weekly)throw Error('标题同时包含累计与周增量标记');
  const metric=cumulative?'cumulative':weekly?'weekly':options.defaultMetric;
  if(!SalesLongData.METRICS.includes(metric))throw Error('未明确销量类型');
  const range=/\(\s*(\d{1,2})[.\/月](\d{1,2})日?\s*(?:-|~|至|到)\s*(\d{1,2})[.\/月](\d{1,2})日?\s*\)/.exec(s);
  if(!range&&/\(\s*\d{1,2}[.\/月]\d{1,2}/.test(s))throw Error('标题日期范围格式无法识别');
  if(range){
   const a=new Date(monday),b=new Date(monday+6*day);
   if([a.getUTCMonth()+1,a.getUTCDate(),b.getUTCMonth()+1,b.getUTCDate()].some((v,i)=>v!==Number(range[i+1])))throw Error('标题日期范围与 ISO 周次不一致');
  }
  const base=c[1].replace(/\s/g,'').replace(/so$/i,'SO'),suffix=(c[2]||'').replace(/\s*-\s*/g,'-').split('-').filter(Boolean);
  // Also accept a brand separated from the category by spaces, without treating arbitrary prose as a brand.
  const tail=s.slice(c.index+c[0].length).trim();
  if(!suffix.length){const b=aliasKeys.find(a=>tail.toLowerCase()===a||tail.toLowerCase().startsWith(a+'-'));if(b)suffix.push(...tail.split('-'));}
  if(!suffix.length&&/^[-_/:：]/.test(tail))throw Error('标题分类后缺少有效品牌');
  const b=brand(suffix[0]);
  if(suffix.length&&!b)throw Error('标题品牌无法识别：'+suffix[0]);
  return {period:p,metric,brand:b,category:b==='荣耀'?[base,'荣耀',...suffix.slice(1)].join('-'):base};
 }
 const operators={'约':'approx','大约':'approx','约为':'approx','大概':'approx','近':'near','接近':'near','左右':'near','上下':'near','~':'approx','≈':'approx','≃':'approx','≒':'approx',
  '=':'=','为':'=','超':'>=','超过':'>=','突破':'>=','破':'>=','大于':'>=','>':'>=','≥':'>=','>=':'>=','至少':'>=','不低于':'>=','达到':'>=',
  '不足':'<','不到':'<','低于':'<','小于':'<','<':'<'};
 const opPattern=Object.keys(operators).sort((a,b)=>b.length-a.length).map(s=>s.replace(/[.*+?^\${}()|[\]\\]/g,'\\$&')).join('|');
 const numberPattern='(?:\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?|\\.\\d+)';
 const unitPattern='(?:万\\s*(?:台|部)?|[wW]\\s*(?:台|部)?|千\\s*(?:台|部)?|[kK]\\s*(?:台|部)?|百\\s*(?:台|部)?|亿\\s*(?:台|部)?|台|部)';
 const quantity=new RegExp('('+numberPattern+')\\s*('+unitPattern+')\\s*(左右|上下)?\\s*[。;；!！]?$', 'i');
 const opEnd=new RegExp('('+opPattern+')\\s*$');
 function decimal(value,unit){
  const u=unit.toLowerCase().replace(/\s/g,'').replace(/[台部]$/,'');
  const shift=({'万':0,w:0,'千':-1,k:-1,'百':-2,'亿':4,'':-4})[u];
  if(shift===undefined)throw Error('不支持的销量单位');
  const [i,f='']=value.replace(/,/g,'').split('.'),digits=(i||'0')+f,pos=(i||'0').length+shift;
  let v=pos<=0?'0.'+'0'.repeat(-pos)+digits:pos>=digits.length?digits+'0'.repeat(pos-digits.length):digits.slice(0,pos)+'.'+digits.slice(pos);
  v=v.replace(/^0+(?=\d)/,'').replace(/(\.\d*?)0+$/,'$1').replace(/\.$/,'');
  if(!Number.isFinite(Number(v))||v.length>40)throw Error('销量数值超出支持范围');
  return v;
 }
 function amount(s,options){
  const m=quantity.exec(s);
  if(!m)throw Error('未识别行尾销量数值或单位');
  let item=s.slice(0,m.index),op='',warnings=[];
  // Do not silently consume the end of a malformed number or a range.
  if(/[\d.,+-]\s*$/.test(item)&&!/\s$/.test(item))throw Error('数值边界不明确、区间值或数字格式错误');
  const o=opEnd.exec(item.trimEnd());
  if(o){op=o[1];item=item.trimEnd().slice(0,o.index);}
  else if(!/\s$|[:：]$/.test(item))throw Error('机型与数值之间缺少分隔符或运算符');
  item=item.trim().replace(/(?:累计销量|周销量|销量)\s*[:：]?\s*$/,'').replace(/[:：]\s*$/,'').replace(/^[•·●▪]\s*|^\d+[.)、]\s*/,'').trim();
  if(!op&&/\d+\s+\d+\s*$/.test(item))throw Error('疑似空格分组数字，无法确定机型与销量边界');
  if(!item||/[-~至到]\s*$/.test(item)||/(?:\d[\d.,]*\s*[-~至到]|[<>≤≥≈=])\s*$/.test(item)||/\d[\d.,]*\s*(?:万|千|台|部)\s*$/.test(item))throw Error('机型为空、销量区间或混合运算符');
  if(m[3]&&op&&operators[op]!=='approx'&&operators[op]!=='near')throw Error('前后运算符冲突');
  const kind=operators[op]||(m[3]?'near':'='),operator=kind==='approx'?(options.approximateAsExact?'=':'≈'):kind==='near'?'≈':kind;
  if(kind==='approx'&&operator==='=')warnings.push('约值按普通统计点值录入');
  if(['超','超过','突破','破','大于','>'].includes(op))warnings.push('严格大于按现有数据库下限 ≥ 保存');
  const value_wan=decimal(m[1],m[2]);
  if(operator==='<'&&Number(value_wan)<=0)throw Error('小于上限必须为正数');
  if(Number(value_wan)>10000)throw Error('销量超过 10000 万台，需人工核实');
  return {item,operator,value_wan,warnings};
 }
 function identityKeys(b,m){
  const q=splitBrand(m),keys=new Set([norm(m)]);
  if(q.brand&&brandKey(q.brand)===brandKey(b)&&q.model)keys.add(norm(q.model));
  if(brandKey(b)===brandKey('苹果')){const n=norm(m);if(n.startsWith('IPHONE'))keys.add(n.slice(6));else keys.add('IPHONE'+n);}
  return keys;
 }
 const intersects=(a,b)=>[...a].some(x=>b.has(x));
 function resolve(item,ctx,options){
  const explicit=splitBrand(item);
  if(explicit.brand&&ctx.brand&&brandKey(explicit.brand)!==brandKey(ctx.brand))throw Error('数据行品牌与标题品牌冲突');
  let b=explicit.brand||ctx.brand,m=explicit.model;
  if(!m||m.length>100||/总计|合计|总销量|销量|转发|评论|阅读|点赞|博主|数据来源|免责声明|仅供参考|统计说明|[：:，,。!?！？#@]/.test(m))throw Error('非标准机型名称');
  const existing=options.existingModels||[],catalog=options.modelMaster||[];
  const sameBrand=x=>!b||brandKey(x.brand)===brandKey(b);
  const direct=existing.filter(x=>sameBrand(x)&&intersects(identityKeys(x.brand,m),identityKeys(x.brand,x.model)));
  const series=/系列$/u.test(m);
  const masters=catalog.filter(x=>sameBrand(x)&&(series?x.tracking_group&&intersects(identityKeys(x.brand,m),identityKeys(x.brand,x.tracking_group)):
    !/系列$/u.test(m)&&[x.model_name,...String(x.aliases||'').split(';')].filter(Boolean).some(a=>intersects(identityKeys(x.brand,m),identityKeys(x.brand,a)))));
  let matches=direct;
  if(!matches.length&&masters.length===1&&!series){
   const x=masters[0],names=[x.model_name,...String(x.aliases||'').split(';')].filter(Boolean);
   matches=existing.filter(t=>brandKey(t.brand)===brandKey(x.brand)&&!/系列$/u.test(t.model)&&names.some(a=>intersects(identityKeys(x.brand,a),identityKeys(t.brand,t.model))));
  }
  if(matches.length>1)throw Error('匹配多个已有机型，请人工统一名称');
  if(matches.length===1){
   const t=matches[0],warnings=[];
   if(t.category!==ctx.category)warnings.push('分类不同，保留已有分类：'+(t.category||'空'));
   return {brand:t.brand,model:t.model,category:t.category,date:t.date,warnings};
  }
  const brands=new Set(masters.map(x=>brandKey(x.brand)));
  if(!b&&brands.size===1)b=brand(masters[0].brand)||masters[0].brand;
  if(!b)throw Error('缺少品牌，且无法唯一匹配已有机型');
  if(masters.length>1&&!series)throw Error('机型表别名存在歧义');
  if(!/\d/.test(m)&&!masters.length)throw Error('新机型名称缺少可核实标识');
  if(!series&&masters.length===1){const v=splitBrand(masters[0].model_name);if(v.model&&(!v.brand||brandKey(v.brand)===brandKey(b)))m=v.model;}
  const date=!series&&masters.length===1&&options.validDate?.(masters[0].sale_start_date)?masters[0].sale_start_date:'';
  // Preserve the established spelling of the independent brand, never its parent group.
  const spellings=[...new Set(existing.filter(x=>brandKey(x.brand)===brandKey(b)).map(x=>x.brand))];
  if(spellings.length===1)b=spellings[0];
  return {brand:b,model:m,category:brandKey(b)===brandKey('荣耀')&&!ctx.brand?ctx.category+'-荣耀':ctx.category,date,warnings:date?[]:['未知开售日期留空']};
 }
 function parse(raw,options={}){
  const result={records:[],lines:[],issues:[],duplicates:[],conflicts:[],stats:{total:0,blank:0,headers:0,data:0,failed:0,ignored:0}};
  let ctx=null;
  const groups=new Map();
  const add=(line,status,reason='',extra={})=>{const entry={...line,status,reason,...extra};result.lines.push(entry);return entry;};
  String(raw??'').split(/\r\n|\r|\n|\u2028|\u2029/).forEach((raw,i)=>{
   const s=clean(raw),line={line:i+1,raw,clean:s};result.stats.total++;
   if(!s){result.stats.blank++;add(line,'blank');return;}
   if(headerLike(s)){
    ctx=null;
    try{ctx=header(s,options);result.stats.headers++;add(line,'header','',ctx);}
    catch(e){result.stats.failed++;result.issues.push(add(line,'failed',e.message,{headerInvalid:true}));}
    return;
   }
   if(/^(?:#[^#]+#\s*)+$/.test(s)||/^(?:[-_=*·•]\s*){3,}$/.test(s)){
    result.stats.ignored++;result.issues.push(add(line,'ignored','话题或分隔线'));return;
   }
   try{
    if(!ctx)throw Error('缺少有效的数据块标题');
    const a=amount(s,options),m=resolve(a.item,ctx,options);
    const {warnings,...meta}=m;
    const record={...meta,period:ctx.period,metric:ctx.metric,value_wan:a.value_wan,operator:a.operator};
    const entry=add(line,'data','',{record,warnings:[...a.warnings,...warnings]});
    result.stats.data++;
    const key=SalesLongData.recordKey(brandKey(record.brand),norm(record.model),record.period,record.metric);
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(entry);
   }catch(e){result.stats.failed++;result.issues.push(add(line,'failed',e.message));}
  });
  // Conflicting values or metadata within one identity are never chosen by input order.
  const identities=new Map();
  for(const entries of groups.values())for(const e of entries){
   const k=SalesLongData.modelKey(brandKey(e.record.brand),norm(e.record.model));
   if(!identities.has(k))identities.set(k,new Set());
   identities.get(k).add(JSON.stringify([e.record.brand,e.record.model,e.record.category,e.record.date]));
  }
  for(const entries of groups.values()){
   const first=entries[0],r=first.record,k=SalesLongData.modelKey(brandKey(r.brand),norm(r.model));
   if(identities.get(k).size>1||entries.some(e=>e.record.value_wan!==r.value_wan||e.record.operator!==r.operator)){
    for(const e of entries){e.status='conflict';e.reason='同批次同一机型存在名称、元数据或销量冲突';result.conflicts.push(e);result.issues.push(e);}
    continue;
   }
   result.records.push(r);
   for(const e of entries.slice(1)){e.status='duplicate';e.reason='同批次相同记录，保留第 '+first.line+' 行';result.duplicates.push(e);result.issues.push(e);}
  }
  return result;
 }
 root.WeiboSalesParser=Object.freeze({parse});
})(globalThis);
