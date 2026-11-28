/* Weekly market-share Weibo blocks; no network or persistence. */
(function(root){
 'use strict';
 const header=['ISO 周','趋势','苹果','华为','OSTA','小米','OPPO','一加','realme','vivo','iQOO','荣耀'];
 const aliases={'苹果':'苹果',apple:'苹果','华为':'华为',huawei:'华为','小米':'小米',xiaomi:'小米',oppo:'OPPO',vivo:'vivo','荣耀':'荣耀',honor:'荣耀',osta:'OSTA','星芒':'OSTA','osta星芒':'OSTA','星芒osta':'OSTA','一加':'一加',oneplus:'一加',realme:'realme','真我':'realme',iqoo:'iQOO'};
 const parents={'华为':['OSTA'],OPPO:['一加','realme'],vivo:['iQOO']};
 const groups=['苹果','华为','小米','OPPO','vivo','荣耀'];
 const clean=s=>String(s??'').normalize('NFKC').replace(/\p{Cf}/gu,'').replace(/[‐-‒–—―−]/g,'-').replace(/\\+\s*$/,'').trim();
 const alias=s=>aliases[s.replace(/\s/g,'').toLowerCase()];
 const canonical=(v,i,period)=>i===0?String(v).replace('-W','W'):i===1?clean(v).replace(/^本周大盘\s*/,'').replace(/[。.!！]+$/,'').trim()||'未提供':String(v??'').trim()===''?(i===4&&period<'2026W47'?'0':''):Number.isFinite(Number(v))?String(Number(v)):String(v);
 function equal(a,b){const p=canonical(a[0],0);return a.every((v,i)=>canonical(v,i,p)===canonical(b[i],i,p));}
 function parse(raw){
  const records=[],reports=[],blocks=[],byPeriod=new Map();
  let block=null;
  const report=(line,text,reason)=>reports.push({line,text,reason});
  for(const [i,original] of String(raw??'').split(/\r\n|\r|\n|\u2028|\u2029/).entries()){
   const s=clean(original),line=i+1;
   if(!s)continue;
   const w=/^(\d{4})\s*(?:年\s*)?[-_]?\s*W\s*(\d{1,2})(?!\d)/i.exec(s);
   const month=/^\d{4}\s*年\s*\d{1,2}\s*月/.test(s);
   if(w||month||/市场份额.*sell\s*out/i.test(s)){
    block=null;
    if(month){report(line,s,'月报：整段跳过，不写入周度表');continue;}
    if(!w||!/市场份额/.test(s)){report(line,s,'无法识别的周报标题');continue;}
    const y=Number(w[1]),n=Number(w[2]),monday=root.IsoSalesWeek.isoWeekMonday(y,n);
    if(y<1900||y>9999||monday==null){report(line,s,'无效 ISO 周次');continue;}
    const range=/\(\s*(\d{1,2})[.\/月](\d{1,2})日?\s*[-~至到]\s*(\d{1,2})[.\/月](\d{1,2})日?\s*\)/.exec(s);
    if(!range&&/\(\s*\d{1,2}[.\/月]\d/.test(s)){report(line,s,'日期范围格式无效');continue;}
    if(range){const a=new Date(monday),b=new Date(monday+6*86400000);if([a.getUTCMonth()+1,a.getUTCDate(),b.getUTCMonth()+1,b.getUTCDate()].some((v,j)=>v!==Number(range[j+1]))){report(line,s,'日期范围与 ISO 周次不一致');continue;}}
    block={line,text:s,period:y+'-W'+String(n).padStart(2,'0'),trend:'',values:Object.create(null),errors:[]};blocks.push(block);continue;
   }
   if(!block){report(line,s,'无有效周报标题或属于已跳过的数据块');continue;}
   if(/^本周大盘/.test(s)){
    const trend=s.replace(/^本周大盘\s*/,'').replace(/[。.!！]+$/,'').trim();
    if(!trend||block.trend&&block.trend!==trend)block.errors.push('第 '+line+' 行：趋势为空或重复冲突');else block.trend=trend;
    continue;
   }
   const body=s.replace(/^\d+\s*[.)、]\s*/,'');
   const m=/^([^\d%()]+?)\s*(\d+(?:\.\d+)?)\s*%\s*(?:\(\s*含\s*(.*?)\s*\))?\s*[。.]?$/.exec(body);
   const fail=reason=>{block.errors.push('第 '+line+' 行：'+reason);report(line,s,reason);};
   if(!m){if(/^\d+\s*[.)、]|%/.test(s))fail('品牌份额格式无法识别');else report(line,s,'非数据说明，未导入');continue;}
   const key=alias(m[1]);
   if(!groups.includes(key)){fail('未知集团品牌');continue;}
   if(Object.hasOwn(block.values,key)){fail('集团品牌重复：'+key);continue;}
   block.values[key]=m[2];
   if(m[3]){
    for(const part of m[3].split(/[,、;，；]/)){
     const sub=/^\s*([^\d%]+?)\s*(\d+(?:\.\d+)?)\s*%\s*$/.exec(part);
     const k=sub&&alias(sub[1]);
     if(!sub||!parents[key]?.includes(k)||Object.hasOwn(block.values,k)){fail('子品牌格式、归属或重复错误：'+part);continue;}
     block.values[k]=sub[2];
    }
   }
  }
  for(const b of blocks){
   const p=b.period.replace('-W','W');
   const missing=header.slice(2).filter(k=>k!=='OSTA'&&!Object.hasOwn(b.values,k));
   if(missing.length)b.errors.push('缺少份额：'+missing.join('、'));
   if(!b.trend)b.errors.push('缺少大盘趋势');
   if(!Object.hasOwn(b.values,'OSTA'))b.values.OSTA=p<'2026W47'?'0':'';
   const row=[b.period,b.trend,...header.slice(2).map(k=>b.values[k]??'')];
   if(!b.errors.length){
    try{
     const csv=root.CsvUtils.stringifyCSV([header,[p,...row.slice(1)]],{eol:'\n'});
     root.MarketShareData.parseMarketShareCSV(csv,root.IsoSalesWeek.isoWeekMonday);
    }
    catch(e){b.errors.push(e.message);}
   }
   if(!byPeriod.has(b.period))byPeriod.set(b.period,[]);
   byPeriod.get(b.period).push({b,row});
  }
  for(const entries of byPeriod.values()){
   const first=entries[0];
   if(entries.some(x=>x.b.errors.length)||entries.some(x=>!equal(first.row,x.row))){
    for(const {b} of entries)report(b.line,b.text,b.errors.join('；')||'同批周报冲突或存在无效副本，整周不导入');
    continue;
   }
   records.push(first.row);
   report(first.b.line,first.b.text,'解析成功'+(first.row[4]===''?'；OSTA 未披露留空':''));
   for(const {b} of entries.slice(1))report(b.line,b.text,'同批相同周报，已去重');
  }
  return {records:records.sort((a,b)=>a[0].localeCompare(b[0])),reports:reports.sort((a,b)=>a.line-b.line)};
 }
 root.WeiboMarketParser=Object.freeze({parse,equal});
})(globalThis);
