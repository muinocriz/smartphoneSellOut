/* CSV adapter for the market-share poster studio.
 * Huawei includes OSTA; OPPO includes OnePlus/realme; vivo includes iQOO. Values are percentage points.
 */
(function(root,factory){
  const CsvUtils=typeof module==='object'&&module.exports?require('./csv-utils.js'):root.CsvUtils;
  const api=factory(CsvUtils);
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.MarketShareData=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(CsvUtils){
  'use strict';
  const REQUIRED=['ISO 周','趋势','苹果','华为','小米','OPPO','一加','realme','vivo','iQOO','荣耀'];
  const KEY_ALIASES=new Map(REQUIRED.map(s=>[s.replace(/\s+/g,'').toLowerCase(),s]));
  // Optional for legacy CSV; an undisclosed new-week share stays null.
  for(const alias of ['osta','星芒','osta星芒','星芒osta'])KEY_ALIASES.set(alias,'OSTA');
  const numericFields=REQUIRED.slice(2);
  const OSTA_FIRST_WEEK='2026W47';
  const DAY=86400000;
  const round=n=>Math.round((n+Number.EPSILON)*100)/100;

  const parseCSV=text=>CsvUtils.parseCSV(text,{mode:'market-share'});
  const {decodeCSV}=CsvUtils;

  function parseMarketShareCSV(text,isoWeekMonday){
    if(typeof isoWeekMonday!=='function')throw new Error('缺少 ISO 周历函数');
    const rows=parseCSV(text);
    if(rows.length<2)throw new Error('CSV 至少需要表头及一周数据');
    const header=rows[0].map(s=>KEY_ALIASES.get(s.replace(/\s+/g,'').toLowerCase())||null);
    for(const key of REQUIRED){
      const count=header.filter(h=>h===key).length;
      if(count!==1)throw new Error(count?'字段重复：'+key:'缺少字段：'+key);
    }
    if(header.filter(h=>h==='OSTA').length>1)throw new Error('字段重复：OSTA');
    const idx=Object.fromEntries([...REQUIRED,'OSTA'].map(k=>[k,header.indexOf(k)]));
    const seen=new Set();
    const results=rows.slice(1).map((row,i)=>{
      const line=i+2;
      if(row.length!==rows[0].length)throw new Error('第 '+line+' 行字段数量不一致');
      const week=(row[idx['ISO 周']]||'').toUpperCase();
      const m=/^(\d{4})W(\d{1,2})$/.exec(week);
      if(!m)throw new Error('第 '+line+' 行 ISO 周格式错误');
      const monday=isoWeekMonday(+m[1],+m[2]);
      if(monday==null)throw new Error('第 '+line+' 行 ISO 周不存在');
      const id=m[1]+'W'+m[2].padStart(2,'0');
      if(seen.has(id))throw new Error('ISO 周重复：'+id);
      seen.add(id);
      const value={};
      for(const key of numericFields){
        const token=row[idx[key]];
        if(token==='')throw new Error('第 '+line+' 行缺少 '+key+' 份额');
        const n=Number(token);
        if(!Number.isFinite(n)||n<0||n>100)throw new Error('第 '+line+' 行 '+key+' 份额超出范围');
        value[key]=n;
      }
      const ostaToken=idx.OSTA<0?'':row[idx.OSTA];
      const osta=ostaToken===''?(id<OSTA_FIRST_WEEK?0:null):Number(ostaToken);
      if(osta!==null&&(!Number.isFinite(osta)||osta<0||osta>100))throw new Error('第 '+line+' 行 OSTA 份额超出范围');
      if(osta!==null&&osta>value['华为'])throw new Error(id+' OSTA 份额超过华为集团份额');
      const huaweiMain=osta===null?null:round(value['华为']-osta);
      const oppoMain=round(value['OPPO']-value['一加']-value.realme);
      const vivoMain=round(value.vivo-value.iQOO);
      if(oppoMain< -0.005||vivoMain< -0.005)throw new Error(id+' 子品牌份额超过集团份额');
      const total=round(value['苹果']+value['华为']+value['小米']+value['OPPO']+value.vivo+value['荣耀']);
      if(total>100)throw new Error(id+' 六大品牌份额合计超过 100%（'+total+'%）');
      const brands={
        apple:value['苹果'],huawei:value['华为'],osta,huaweiMain,xiaomi:value['小米'],
        oppo:value['OPPO'],oneplus:value['一加'],realme:value.realme,
        oppoMain:Math.max(0,oppoMain),vivo:value.vivo,iqoo:value.iQOO,
        vivoMain:Math.max(0,vivoMain),honor:value['荣耀']
      };
      return {week:id,monday,trend:row[idx['趋势']]||'未提供',brands,other:Math.max(0,round(100-total))};
    });
    results.sort((a,b)=>a.monday-b.monday);
    return results;
  }

  function pairIndices(rows){
    const pairs=[];
    for(let i=1;i<rows.length;i++)if(rows[i].monday-rows[i-1].monday===7*DAY)pairs.push(i);
    return pairs;
  }

  function buildBrandState(previous,current,defaultBrands){
    const list=defaultBrands();
    const source=[previous,current];
    for(const brand of list){
      if(brand.id==='huawei'){
        brand.w1=source[0].brands.huawei;
        brand.w2=source[1].brands.huawei;
        if(brand.subBrands?.length>=2){
          brand.subBrands[0].w1=source[0].brands.huaweiMain;
          brand.subBrands[0].w2=source[1].brands.huaweiMain;
          brand.subBrands[1].w1=source[0].brands.osta;
          brand.subBrands[1].w2=source[1].brands.osta;
        }
      }else if(brand.id==='oppo'){
        brand.subBrands[0].w1=source[0].brands.oppoMain;
        brand.subBrands[0].w2=source[1].brands.oppoMain;
        brand.subBrands[1].w1=source[0].brands.oneplus;
        brand.subBrands[1].w2=source[1].brands.oneplus;
        brand.subBrands[2].w1=source[0].brands.realme;
        brand.subBrands[2].w2=source[1].brands.realme;
      }else if(brand.id==='vivo'){
        brand.subBrands[0].w1=source[0].brands.vivoMain;
        brand.subBrands[0].w2=source[1].brands.vivoMain;
        brand.subBrands[1].w1=source[0].brands.iqoo;
        brand.subBrands[1].w2=source[1].brands.iqoo;
      }else{
        brand.w1=source[0].brands[brand.id];
        brand.w2=source[1].brands[brand.id];
      }
    }
    return list;
  }

  return Object.freeze({parseCSV,decodeCSV,parseMarketShareCSV,pairIndices,buildBrandState});
});
