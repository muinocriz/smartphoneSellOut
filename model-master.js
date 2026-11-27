/* Popular Models and Ranking Research canonical model catalog. No history rows are rewritten. Browser + Node. */
(function(root){
'use strict';
const Series=root.SalesSeries, Brand=root.BrandUtils;
const HEADER=Object.freeze('model_id,model_name,brand,brand_group,aliases,series,generation,variant,form_factor,sale_start_date,predecessor_id,launch_price,chip_vendor,chip_model,base_ram,base_rom,source_url,notes,verification,tracking_group'.split(','));
const normalize=Brand.normalize;
const VERSION='model-master-v2';
function fingerprint(raw){let h=2166136261;for(let i=0;i<raw.length;i++)h=Math.imul(h^raw.charCodeAt(i),16777619);return (h>>>0).toString(16).padStart(8,'0');}
function parse(raw){
  const rows=Series.readCSV(raw),header=rows.shift();
  if(!header||![HEADER.length,HEADER.length-1].includes(header.length)||header.some((v,i)=>v!==HEADER[i]))throw Error('机型主数据 CSV 表头不匹配。');
  const byId=new Map(),byName=new Map(),bySeries=new Map(),issues=[];
  for(const [i,row] of rows.entries()){
    if(row.length!==header.length)throw Error('机型主数据第 '+(i+2)+' 行列数不正确。');
    const m=Object.fromEntries(HEADER.map((k,j)=>[k,(row[j]??'').trim()]));
    if(!m.model_id||m.model_id.startsWith('unmatched:')||!normalize(m.model_name))throw Error('机型主数据第 '+(i+2)+' 行缺少合法 ID 或名称。');
    if(byId.has(m.model_id))throw Error('机型 ID 重复：'+m.model_id);
    // Canonical OSTA identity is distinct from HUAWEI; the existing parent key remains 华为.
    if(Brand.isOsta(m.brand)){m.brand='OSTA';m.brand_group='华为';}
    m.aliases=Object.freeze(m.aliases.split(';').map(s=>s.trim()).filter(Boolean));
    for(const k of ['launch_price','base_ram','base_rom']){
      const v=m[k], n=Number(v);
      m[k]=/^\d+(?:\.\d+)?$/.test(v)&&Number.isFinite(n)&&n>0?n:null;
      if(v&&m[k]===null)issues.push({id:m.model_id,field:k,value:v});
    }
    const date=Series.parseDate(m.sale_start_date);
    if(m.sale_start_date&&date===null)issues.push({id:m.model_id,field:'sale_start_date',value:m.sale_start_date});
    m.sale_start_date=date===null?null:new Date(date).toISOString().slice(0,10);
    Object.freeze(m);byId.set(m.model_id,m);
    for(const name of [m.model_name,...m.aliases]){
      const k=normalize(name);if(!k)continue;
      const prior=byName.get(k);if(prior&&prior!==m)throw Error('标准名称或别名冲突：'+name+' / '+prior.model_id+' / '+m.model_id);
      byName.set(k,m);
    }
    if(m.brand&&m.series){
      const k=JSON.stringify([normalize(m.brand),normalize(m.series)]);
      if(!bySeries.has(k))bySeries.set(k,[]);
      bySeries.get(k).push(m);
    }
  }
  const models=Object.freeze([...byId.values()]);
  const get=id=>byId.get(id)||null,resolve=name=>byName.get(normalize(name))||null;
  const getSeries=(brand,series)=>Object.freeze([...(bySeries.get(JSON.stringify([normalize(brand),normalize(series)]))||[])]);
  const getPredecessor=id=>{const m=get(id);return m?.predecessor_id?Object.freeze({id:m.predecessor_id,model:get(m.predecessor_id)}):null;};
  const catalog={version:VERSION,revision:fingerprint(String(raw)),models,issues:Object.freeze(issues.map(Object.freeze)),get,resolve,getSeries,getPredecessor};
  catalog.enrich=rows=>rows.map(row=>{const model=resolve(row[Series.col.model]);return {row,model,sequence_id:Series.sequenceIdentity(row[Series.col.model],catalog),model_id:model?.model_id||null};});
  catalog.audit=rows=>{
    const unmatched=new Map(),seen=new Map(),conflicts=[];let matched=0;
    for(const x of catalog.enrich(rows)){
      const r=x.row,name=r[Series.col.model];
      if(x.model)matched++;else if(!unmatched.has(x.sequence_id))unmatched.set(x.sequence_id,name);
      const board=r[Series.col.dataset_id];if(!seen.has(board))seen.set(board,new Set());
      const keys=seen.get(board);if(keys.has(x.sequence_id))conflicts.push({dataset_id:board,sequence_id:x.sequence_id,name});keys.add(x.sequence_id);
    }
    return {total:rows.length,matched,unmatched:[...unmatched.values()],conflicts,models:models.length,predecessors:models.filter(m=>m.predecessor_id).length,unresolvedPredecessors:models.filter(m=>m.predecessor_id&&!get(m.predecessor_id)).length,issues:catalog.issues};
  };
  return Object.freeze(catalog);
}
async function load(url='model-master.csv'){
  if(url==='model-master.csv'&&root.SalesSite?.readProject){
    return parse(await root.SalesSite.readProject(url));
  }
  const response=await fetch(url+'?t='+Date.now(),{cache:'no-store'});
  if(!response.ok)throw Error('HTTP '+response.status);
  return parse(await response.text());
}
const api=Object.freeze({HEADER,VERSION,parse,load});
root.ModelMaster=api;
if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
