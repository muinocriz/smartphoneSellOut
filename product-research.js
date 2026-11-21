/* Shared product selection and grouping; no DOM or I/O. */
(function(root){
'use strict';
const normalize=root.BrandUtils.normalize, UNKNOWN='（未知或不适用）';
const FIELDS=Object.freeze([['brand','品牌'],['brand_group','母品牌'],['series','产品系列'],['variant','产品版本'],['price_band','首发价格带'],['chip_vendor','芯片供应商'],['chip_model','芯片平台'],['form_factor','产品形态'],['base_ram','起售 RAM'],['base_rom','起售 ROM']].map(Object.freeze));
const PRICE_BANDS=Object.freeze([[0,1000],[1000,2000],[2000,3000],[3000,4000],[4000,5000],[5000,6000],[6000,8000],[8000,Infinity]].map(Object.freeze));
function value(m,field){
 if(!m)return UNKNOWN;
 if(field==='price_band'){const b=!m.is_combined&&PRICE_BANDS.find(([a,z])=>Number.isFinite(m.launch_price)&&m.launch_price>=a&&m.launch_price<z);return b?(b[1]===Infinity?b[0]+'元及以上':b[0]+'–'+(b[1]-1)+'元'):UNKNOWN;}
 if(field==='base_ram'||field==='base_rom')return !m.is_combined&&Number.isFinite(m[field])?m[field]+'GB':UNKNOWN;
 if(field==='series')return m.series&&m.brand?(m.series.startsWith(m.brand)?m.series:m.brand+' '+m.series):UNKNOWN;
 if(field==='chip_model')return m.chip_model&&m.chip_vendor?m.chip_vendor+' / '+normalize(m.chip_model):UNKNOWN;
 return m[field]||UNKNOWN;
}
function matches(m,filters={}){
 for(const [field] of FIELDS)if(filters[field]&&value(m,field)!==filters[field])return false;
 if(filters.sale_from||filters.sale_to){const d=m?.sale_start_date;if(!d||(filters.sale_from&&d<filters.sale_from)||(filters.sale_to&&d>filters.sale_to))return false;}
 return true;
}
function options(models,field){return [...new Set(models.map(m=>value(m,field)))].sort((a,b)=>a===b?0:a===UNKNOWN?1:b===UNKNOWN?-1:a.localeCompare(b,'zh-CN',{numeric:true}));}
function groups(entries,field,filters={}){const map=new Map();for(const {key,model} of entries){if(!matches(model,filters))continue;const name=value(model,field);if(!map.has(name))map.set(name,[]);map.get(name).push(key);}return [...map].map(([name,keys])=>({name,keys:[...new Set(keys)]})).sort((a,b)=>a.name.localeCompare(b.name,'zh-CN',{numeric:true}));}
// Reuse module 1's ISO date utility, not its sales data.
const Iso=root.IsoSalesWeek;
function lifecycle(model,week){
 const date=model?.sale_start_date;if(!date||!week?.start)return null;
 const parts=date.split('-').map(Number),sale=Iso.utcDate(parts),start=root.SalesSeries.parseDate(week.start),end=root.SalesSeries.parseDate(week.end);
 if(sale===null||start===null||end===null||sale>end)return null;
 const index=Iso.lifecycleWeekIndex(start,Iso.firstFullWeekMonday(parts));
 if(index!==null)return {index,label:'W'+index,daysSinceSale:Math.floor((end-sale)/Iso.DAY),partial:false};
 return start===Iso.isoMonday(parts)?{index:0,label:'P0',daysSinceSale:Math.floor((end-sale)/Iso.DAY),partial:true}:null;
}
function aligned(model,weeks,points,cumulative=false){
 const byIndex=new Map();let total=0,complete=true,previous=0,estimated=false;
 weeks.forEach((week,i)=>{
  const age=lifecycle(model,week);if(!age||age.partial)return;
  const point=points[i]||{},v=Number.isFinite(point.value)?point.value:null;
  if(cumulative){if(age.index!==previous+1||v===null)complete=false;if(complete){total+=v;estimated=estimated||!!point.imputed;}}
  byIndex.set(age.index,{period:week.period,value:cumulative?(complete?total:null):v,imputed:cumulative?(complete&&estimated):v!==null&&!!point.imputed});
  previous=age.index;
 });
 return byIndex;
}
function lifecycleAxis(maps){
 const keys=maps.flatMap(m=>[...m.keys()]);if(!keys.length)return [];
 const min=Math.min(...keys),max=Math.max(...keys);return Array.from({length:max-min+1},(_,i)=>min+i);
}
function retention(model,weeks,key,col,target){
 const values=new Map();for(const w of weeks){const age=lifecycle(model,w),r=w.map.get(key);if(age&&!age.partial&&r)values.set(age.index,Number(r[col.estimated_wan]));}
 const base=values.get(1),v=values.get(target);return Number.isFinite(base)&&base>0&&Number.isFinite(v)?100*v/base:null;
}
function entryType(model,week,seen,newWeeks){
 if(seen)return 'return';const age=lifecycle(model,week);return !age?'unknown':age.index<=newWeeks?'new':'old';
}
root.ProductResearch=Object.freeze({FIELDS,UNKNOWN,PRICE_BANDS,value,matches,options,groups,lifecycle,aligned,lifecycleAxis,retention,entryType});
})(typeof globalThis!=='undefined'?globalThis:this);
