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
root.ProductResearch=Object.freeze({FIELDS,UNKNOWN,PRICE_BANDS,value,matches,options,groups});
})(typeof globalThis!=='undefined'?globalThis:this);
