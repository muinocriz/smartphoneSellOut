/* Shared historical CSV parser and weekly-series algorithm (browser + Node). */
(function(root){
'use strict';
  const HEADER = 'dataset_id,source,series,period_type,period,period_start,period_end,top_n,actual_count,rank,model,brand_group,pixels,estimated_units,estimated_wan,fit_k,fit_mode,calibration_count,accepted_count,outlier_threshold,algorithm_version,saved_at'.split(',');
  const col = Object.fromEntries(HEADER.map((name, index) => [name, index]));
  const allowedFit = new Set(['single', 'fit', 'robust']);
  function fail(message) { throw new Error(message); }
  function normalizeModelName(name) {
  return root.BrandUtils.normalize(name);
}
  function cutoffOf(list,col) {
  const n=Number(list[0]?.[col.top_n]);
  if(!Number.isSafeInteger(n)||n<1||list.length!==n||!list.every(r=>Number(r[col.top_n])===n&&Number(r[col.actual_count])===n&&Number(r[col.rank])>=1&&Number(r[col.rank])<=n)||new Set(list.map(r=>Number(r[col.rank]))).size!==n)return null;
  const last=list.find(r=>Number(r[col.rank])===n);
  return Number(last[col.estimated_wan]);
}
  function salesPanelOptions(p={}){
  const num=(v,d,min,max)=>v==null||v===''||!Number.isFinite(Number(v))?d:Math.min(max,Math.max(min,Math.round(Number(v))));
  return {scopeId:p.scopeId||'',start:p.start||'',end:p.end||'',coverage:num(p.coverage,80,0,100),coverageBase:p.coverageBase==='all'?'all':'first',maxGap:num(p.maxGap,3,0,12),method:p.method==='linear'?'linear':'bounded',dataMode:p.dataMode==='raw'?'raw':'filled',missingBoard:p.missingBoard!==false,trailing:p.trailing!==false};
}
  function buildSalesPanel(rows,col,options={}){
  const p=salesPanelOptions(options);
  const header=['source','series','period','period_start','period_end','model_key','model','raw_model','brand_group','rank','observed_wan','imputed_wan','weekly_wan','cumulative_wan','cutoff_wan','is_imputed','impute_method','observed_weeks','total_weeks','coverage_rate','coverage_base_weeks','first_observed_period','range_start','range_end','coverage_base','min_coverage_pct','max_gap_weeks','impute_rule','data_mode','allow_missing_board','allow_trailing'];
  const scopes=new Map(),all=[],byScope=[],fmt=v=>v==null?'':v.toFixed(4),weekMs=604800000;
  for(const r of rows){
    if(r[col.period_type]!=='weekly')continue;
    const id=JSON.stringify([r[col.source],r[col.series]]);
    if(p.scopeId&&id!==p.scopeId)continue;
    if(!scopes.has(id))scopes.set(id,[]);scopes.get(id).push(r);
  }
  for(const [id,records] of scopes){
    const [source,series]=JSON.parse(id),boards=new Map(),firstSeen=new Map();
    for(const r of records){const t=Date.parse(r[col.period_start]+'T00:00:00Z');if(!boards.has(t))boards.set(t,[]);boards.get(t).push(r);}
    const dates=[...boards.keys()].sort((a,b)=>a-b),fullWeeks=[];
    for(let t=dates[0];t<=dates[dates.length-1];t+=weekMs){
      const list=boards.get(t)||[],start=new Date(t).toISOString().slice(0,10),end=new Date(t+6*86400000).toISOString().slice(0,10);
      const y=new Date(t+3*86400000).getUTCFullYear(),jan4=Date.UTC(y,0,4),first=jan4-((new Date(jan4).getUTCDay()+6)%7)*86400000;
      const period=y+'-W'+String(1+Math.round((t-first)/weekMs)).padStart(2,'0'),map=new Map();
      for(const r of list){const key=normalizeModelName(r[col.model]);if(!key||map.has(key))throw Error('同一期榜单存在空白或重复机型标识：'+period+' / '+key);map.set(key,r);if(!firstSeen.has(key))firstSeen.set(key,period);}
      fullWeeks.push({period,start,end,cutoff:cutoffOf(list,col),map,hasBoard:list.length>0,top:list[0]?.[col.top_n]||'',count:list.length});
    }
    const weeks=fullWeeks.filter(w=>(!p.start||w.period>=p.start)&&(!p.end||w.period<=p.end));
    if(!weeks.length)continue;
    const models=new Map();
    for(const w of weeks)for(const [key,r] of w.map){if(!models.has(key))models.set(key,{key,count:0,first:firstSeen.get(key)});const m=models.get(key);m.count++;m.name=r[col.model];m.brand=classifyHeadBrand(r)||'未识别品牌';}
    for(const m of models.values()){m.baseWeeks=p.coverageBase==='first'?weeks.filter(w=>w.period>=m.first).length:weeks.length;m.coverage=m.count/m.baseWeeks;}
    const selected=[...models.values()].filter(m=>m.count*100>=p.coverage*m.baseWeeks).sort((a,b)=>a.name.localeCompare(b.name,'zh-CN')),panelRows=[];
    for(const m of selected){
      const observed=weeks.map(w=>w.map.has(m.key)?Number(w.map.get(m.key)[col.estimated_wan]):null),firstIndex=weeks.findIndex(w=>w.period>=m.first);
      let total=0,unknown=false;
      for(let i=0;i<weeks.length;i++){
        const w=weeks[i],original=w.map.get(m.key),value=observed[i];let estimate=null,method='missing';
        if(value!==null)method='observed';
        else if(i<firstIndex)method='before_first_observation';
        else if(p.dataMode==='raw'||p.maxGap===0)method=w.hasBoard?'missing_unfilled':'missing_board';
        else{
          if(!w.hasBoard)method='missing_board';
          let left=i-1,right=i+1;while(left>=0&&observed[left]===null)left--;while(right<weeks.length&&observed[right]===null)right++;
          if(left>=0&&right<weeks.length&&right-left-1<=p.maxGap&&(p.missingBoard||weeks.slice(left+1,right).every(q=>q.hasBoard))){
            estimate=observed[left]+(observed[right]-observed[left])*(i-left)/(right-left);method=w.hasBoard?'linear_interpolation':'linear_interpolation_missing_board';
          }else if(p.trailing&&p.method==='bounded'&&left===i-1&&i===weeks.length-1&&w.cutoff!==null&&w.period===fullWeeks[fullWeeks.length-1].period){estimate=observed[left];method='previous_week';}
          if(estimate!==null&&p.method==='bounded'&&w.cutoff!==null){estimate=Math.min(estimate,w.cutoff);method+='_cutoff';}
          if(estimate!==null)estimate=Math.round(estimate*10000)/10000;
        }
        const weekly=value??estimate;
        if(i>=firstIndex&&weekly===null)unknown=true;if(weekly!==null)total+=weekly;
        const cumulative=i<firstIndex||unknown?null:total;
        panelRows.push([source,series,w.period,w.start,w.end,m.key,m.name,original?original[col.model]:'',m.brand,original?original[col.rank]:'',fmt(value),fmt(estimate),fmt(weekly),fmt(cumulative),fmt(w.cutoff),estimate!==null?'1':'0',method,String(m.count),String(weeks.length),m.coverage.toFixed(4),String(m.baseWeeks),m.first,weeks[0].period,weeks[weeks.length-1].period,p.coverageBase,String(p.coverage),String(p.maxGap),p.method,p.dataMode,p.missingBoard?'1':'0',p.trailing?'1':'0']);
      }
    }
    all.push(...panelRows);byScope.push({id,source,series,weeks,fullWeeks,models:selected,rows:panelRows,options:p});
  }
  return {header,rows:all,scopes:byScope};
}
  function dateText(t) { return new Date(t).toISOString().slice(0, 10); }
  function parseDate(s) {
    // Spreadsheet editors may save date cells as YYYY/M/D instead of ISO YYYY-MM-DD.
    const p = String(s ?? '').trim().match(/^([1-9]\d{3})([-/])(\d{1,2})\2(\d{1,2})$/);
    if (!p) return null;
    const iso = p[1] + '-' + p[3].padStart(2,'0') + '-' + p[4].padStart(2,'0');
    const t = Date.parse(iso + 'T00:00:00Z');
    return Number.isFinite(t) && dateText(t) === iso ? t : null;
  }
  function normalizeMeta(m, count) {
    const source = String(m.source || '').trim();
    const series = String(m.series || '').trim();
    if (!source || !series) fail('请填写数据来源和榜单系列。');
    let period, start, end;
    if (m.type === 'weekly') {
      const p = String(m.period).trim().toUpperCase().match(/^([1-9]\d{3})-?W(\d{1,2})$/);
      if (!p) fail('请填写 ISO 周，例如 2026-W46。');
      const t = root.IsoSalesWeek.isoWeekMonday(Number(p[1]), Number(p[2]));
      if (t === null) fail('该年份不存在此 ISO 周。');
      period = p[1] + '-W' + p[2].padStart(2,'0');
      start = dateText(t); end = dateText(t + 6 * 86400000);
    } else if (m.type === 'monthly') {
      const p = String(m.period).trim().toUpperCase().match(/^([1-9]\d{3})-?M?(\d{1,2})$/);
      if (!p || Number(p[2]) < 1 || Number(p[2]) > 12) fail('请填写月份，例如 2026-M09。');
      const month = Number(p[2]);
      period = p[1] + '-M' + String(month).padStart(2,'0');
      start = p[1] + '-' + String(month).padStart(2,'0') + '-01';
      end = dateText(Date.UTC(Number(p[1]), month, 0));
    } else if (m.type === 'custom') {
      const a = parseDate(m.start), b = parseDate(m.end);
      if (a === null || b === null || a > b) fail('请填写有效的起止日期。');
      start = dateText(a); end = dateText(b); period = start + '~' + end;
    } else fail('未知统计周期类型。');
    const top = String(m.top ?? '').trim();
    if (top && (!/^\d+$/.test(top) || !Number.isSafeInteger(Number(top)) || Number(top) < count || Number(top) < 1)) fail('标称 TOP 数量必须为正整数，且不少于实际条目数；未知时留空。');
    // Keep natural-language labels readable; escape only the separator and escape marker.
    const id = [source, series, m.type, period].map(s => s.replace(/%/g, '%25').replace(/\|/g, '%7C')).join('|');
    return {id, source, series, type:m.type, period, start, end, top:top ? String(Number(top)) : ''};
  }
  function groups(rows) {
    const map = new Map();
    for (const r of rows) {
      const id = r[col.dataset_id];
      if (!map.has(id)) map.set(id, []);
      map.get(id).push(r);
    }
    for (const list of map.values()) list.sort((a,b) => Number(a[col.rank]) - Number(b[col.rank]));
    return map;
  }
  function sorted(rows) {
    return [...rows].sort((a,b) => a[col.period_end].localeCompare(b[col.period_end]) ||
      a[col.dataset_id].localeCompare(b[col.dataset_id]) || Number(a[col.rank]) - Number(b[col.rank]));
  }
  function parseCSV(raw) {
    const s = String(raw).replace(/^\uFEFF/, '');
    const rows = []; let row = [], cell = '', quoted = false, closed = false;
    function field() { row.push(cell); cell = ''; closed = false; }
    function line() { field(); if (row.some(v => v !== '')) rows.push(row); row = []; }
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (quoted) {
        if (c === '"') {
          if (s[i+1] === '"') { cell += '"'; i++; }
          else { quoted = false; closed = true; }
        } else cell += c;
      } else if (c === ',') field();
      else if (c === '\r' || c === '\n') {
        line(); if (c === '\r' && s[i+1] === '\n') i++;
      } else if (c === '"' && cell === '' && !closed) quoted = true;
      else if (c === '"' || closed) fail('CSV 引号格式不正确。');
      else cell += c;
    }
    if (quoted) fail('CSV 引号未闭合。');
    if (row.length || cell !== '' || closed) line();
    const head = rows.shift();
    if (!head || head.length !== HEADER.length || head.some((v,i) => v !== HEADER[i])) fail('CSV 表头与模块 3 历史数据库不匹配。请使用 sales-estimates.csv 或新版标准销量 CSV。');
    for (const [i,r] of rows.entries()) {
      const context = 'CSV 第 ' + (i + 2) + ' 条记录（含表头计数；' + (r[col.period] || '未知周期') + ' / 排名 ' + (r[col.rank] || '未知') + '）';
      if (r.length !== HEADER.length) fail(context + '：列数不正确。');
      const count = Number(r[col.actual_count]), rank = Number(r[col.rank]);
      const k = Number(r[col.fit_k]), pixels = Number(r[col.pixels]), units = Number(r[col.estimated_units]);
      const n = Number(r[col.calibration_count]), accepted = Number(r[col.accepted_count]);
      const threshold = Number(r[col.outlier_threshold]);
      if (!r[col.model].trim() || !r[col.brand_group].trim() ||
          !Number.isSafeInteger(count) || count < 2 || !Number.isSafeInteger(rank) || rank < 1 ||
          !Number.isSafeInteger(pixels) || pixels < 1 || !Number.isFinite(k) || k <= 0 ||
          !/^\d+$/.test(r[col.estimated_units]) || !Number.isSafeInteger(units) || units !== Math.round(k*pixels) ||
          !allowedFit.has(r[col.fit_mode]) || !Number.isSafeInteger(n) || n < 1 ||
          !Number.isSafeInteger(accepted) || accepted < 1 || accepted > n ||
          !Number.isFinite(threshold) || threshold <= 0 || !r[col.algorithm_version] ||
          !Number.isFinite(Date.parse(r[col.saved_at]))) fail(context + '：存在无效估算记录，请检查销量、柱长及标定参数。');
      // Compare numeric values, not display strings; keep one canonical export format.
      const wan = r[col.estimated_wan].trim();
      if (!/^\d+(?:\.\d+)?$/.test(wan) || Number(wan) !== units/10000) fail(context + '：台数和万台数不一致。');
      const start = parseDate(r[col.period_start]), end = parseDate(r[col.period_end]);
      if (start === null || end === null) fail(context + '：统计日期无效。');
      const m = normalizeMeta({source:r[col.source],series:r[col.series],type:r[col.period_type],period:r[col.period],
        start:r[col.period_start],end:r[col.period_end],top:r[col.top_n]}, count);
      if (m.id !== r[col.dataset_id] || m.period !== r[col.period] || m.start !== dateText(start) || m.end !== dateText(end)) fail(context + '：榜单标识或统计周期不一致。');
      r[col.period_start] = m.start;
      r[col.period_end] = m.end;
      r[col.estimated_wan] = (units/10000).toFixed(4);
    }
    const shared = ['source','series','period_type','period','period_start','period_end','top_n','actual_count',
      'fit_k','fit_mode','calibration_count','accepted_count','outlier_threshold','algorithm_version','saved_at'];
    for (const [id,list] of groups(rows)) {
      const keys = list.map(r => normalizeModelName(r[col.model]));
      if (keys.some(k => !k) || new Set(keys).size !== keys.length) fail('同一期榜单存在空白或重复机型标识：' + id);
      if (list.length !== Number(list[0][col.actual_count]) || new Set(list.map(r => Number(r[col.rank]))).size !== list.length ||
          list.some(r => shared.some(key => r[col[key]] !== list[0][col[key]]))) fail('CSV 中存在重复、不完整或参数不一致的榜单：' + id);
    }
    return sorted(rows);
  }

function classifyHeadBrand(row){return root.BrandUtils.classify(row[col.model],row[col.brand_group]);}
const VERSION='weekly-panel-v1';
const DEFAULT_OPTIONS=Object.freeze(salesPanelOptions());
function versionedRows(panel){return [[...panel.header,'panel_algorithm_version'],...panel.rows.map(r=>[...r,VERSION])];}
const api=Object.freeze({HEADER:Object.freeze(HEADER),col:Object.freeze(col),allowedFit:Object.freeze([...allowedFit]),normalizeModelName,salesPanelOptions,buildSalesPanel:(rows,options)=>buildSalesPanel(rows,col,options),normalizeMeta,groups,sorted,parseCSV,VERSION,DEFAULT_OPTIONS,versionedRows});
root.SalesSeries=api;
if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
