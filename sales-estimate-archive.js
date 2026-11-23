/* Module 3: normalized historical estimates. No backend or write token is needed.
 * The deployed studio reads the committed CSV; the maintainer uploads the merged export.
 * History contains final estimates, not the original image/calibration workspace.
 */
(function () {
  'use strict';
  const FILE = 'sales-estimates.csv';
  const Series=window.SalesSeries;
  const HEADER=Series.HEADER,col=Series.col,allowedFit=new Set(Series.allowedFit);
  const metaByDataset = new WeakMap();
  let history = [];
  let loaded = false;
  let loading = true;
  let origin = '';
  let pending = false;

  const {sequenceIdentity,salesPanelOptions}=Series;
  const normalize=window.BrandUtils.normalize;
  let masterCatalog=null,masterLoading=true,masterError='';
  const canonicalName=name=>masterCatalog?.resolve(name)?.model_name||name;
  function matchesModel(key,name,q){const m=masterCatalog?.get(key);return !q||[key,name,m?.brand,m?.brand_group,m?.series,m?.chip_vendor,m?.chip_model,...(m?.aliases||[])].some(v=>normalize(v).includes(q));}
  function fail(message){throw new Error(message);}
  function defaults() {
    return {source:'RD观测', series:'手机销量榜', type:'weekly', period:'', start:'', end:'', top:''};
  }
  function datasetMeta(d) {
    if (!metaByDataset.has(d)) metaByDataset.set(d, defaults());
    return metaByDataset.get(d);
  }
  const normalizeMeta=Series.normalizeMeta;
  function buildRows(o = derivedData()) {
    const d = o.d, f = o.fit;
    // A historical studio export must reuse the original normalized archive rows and metadata.
    if (d.archiveRows) return d.archiveRows.map(r => r.slice());
    if (!allowedFit.has(f.fitMode) || !Number.isFinite(f.k) || f.k <= 0 || !o.canPublish) fail('请先完成有效标定；未标定、冲突或临时中位数结果不能进入正式销量 CSV。');
    if (o.models.some(m => !String(m.name).trim() || /^第\d+名$|^未命名/.test(String(m.name).trim()))) fail('请先补全所有机型名称。');
    if (o.models.some(m => !Number.isSafeInteger(m.rank) || m.rank < 1 || !Number.isSafeInteger(m.pixels) || m.pixels <= 0 || !Number.isFinite(m.sale) || !Number.isSafeInteger(Math.round(m.sale)) || m.sale < 0) || new Set(o.models.map(m => m.rank)).size !== o.models.length) fail('榜单排名、柱长或销量存在无效数据。');
    const keys = o.models.map(m => sequenceIdentity(m.name,masterCatalog));
    if (keys.some(k => !k) || new Set(keys).size !== keys.length) fail('同一期榜单存在空白或重复机型标识，请核对机型名称。');
    // A fresh value is captured once for the entire snapshot.
    const m = normalizeMeta(datasetMeta(d), o.models.length);
    const at = new Date().toISOString();
    return o.models.map(b => {
      const units = Math.round(b.sale);
      return [m.id,m.source,m.series,m.type,m.period,m.start,m.end,m.top,
        String(o.models.length),String(b.rank),String(b.name).trim(),b.brand,String(b.pixels),
        String(units),(units / 10000).toFixed(4),String(f.k),f.fitMode,
        String(d.calibrations.length),String(f.accepted.length),String($('outlier').value),'1',at];
    });
  }
  function labelOf(r) {
    return r[col.period] + ' · ' + (r[col.top_n] ? 'TOP' + r[col.top_n] : '自定义榜单') +
      ' · ' + r[col.source] + ' / ' + r[col.series] + '（' + r[col.actual_count] + '条）';
  }
  function studioDataset(list) {
    const r = list[0];
    const count = Number(r[col.calibration_count]), accepted = Number(r[col.accepted_count]);
    return {
      id: r[col.dataset_id],
      label: r[col.period] + ' · ' + (r[col.top_n] ? 'TOP' + r[col.top_n] : list.length + '条榜单') +
        (r[col.top_n] && Number(r[col.top_n]) !== list.length ? '（实收' + list.length + '条）' : ''),
      archiveDisplayLabel: labelOf(r),
      archiveSource: r[col.source],
      archiveRows: list.map(row => row.slice()),
      archiveCalibrationCount: count,
      archiveAcceptedCount: accepted,
      archiveFit: {k:Number(r[col.fit_k]),fitMode:r[col.fit_mode],statuses:[],accepted:[]},
      bars: list.map(row => ({rank:Number(row[col.rank]),name:row[col.model],pixels:Number(row[col.pixels]),
        archiveBrand:row[col.brand_group],archiveSale:Number(row[col.estimated_units])}))
    };
  }
  const {groups,sorted,parseCSV}=Series;
  function equalGroup(a,b) {
    return a.length === b.length && a.every((r,i) => r.every((value,j) => j === col.saved_at || value === b[i][j]));
  }
  function mergeRows(base, incoming) {
    const map = groups(base);
    let changed = false;
    for (const [id,list] of groups(incoming)) {
      const old = map.get(id);
      if (old && equalGroup(old,list)) continue;
      if (old && !window.confirm('历史中已存在同一来源、系列和周期的榜单：\n' + labelOf(old[0]) +
        '\n现有 ' + old.length + ' 条，新数据 ' + list.length + ' 条。\n确认整期替换？取消将保留原历史数据，不执行此次操作。')) return null;
      map.set(id,list); changed = true;
    }
    return {rows:sorted([...map.values()].flat()),changed};
  }

  // The HTML owns the final tab layout; switching tabs preserves live input and state.
  const tracker=$('module3-tracker');
  const modulePanes={estimate:$('module3-estimate'),history:$('module3-history'),tracker,social:$('socialStudio')};
  const moduleButtons=Object.fromEntries(Object.keys(modulePanes).map(id=>[id,$('module3-tab-'+id)]));
  function activateModuleTab(key){
    if(!modulePanes[key])return;
    for(const [id,pane] of Object.entries(modulePanes)){
      const active=id===key;pane.hidden=!active;pane.style.display=active?'':'none';
      moduleButtons[id].setAttribute('aria-selected',String(active));
      moduleButtons[id].className=active?'primary':'secondary';
    }
  }
  for(const [id,button] of Object.entries(moduleButtons))button.onclick=()=>activateModuleTab(id);
  activateModuleTab('estimate');

  // Shared history presentation helpers must not depend on research initialization.
  function classifyHeadBrand(row){const m=masterCatalog?.resolve(row[col.model]);return window.BrandUtils.classify(m?.model_name||row[col.model],m?.brand_group||row[col.brand_group]);}
  function historyDisplayWan(value){return Number.isFinite(value)?value.toLocaleString('zh-CN',{minimumFractionDigits:1,maximumFractionDigits:1, style:'decimal'}):'待标定';}
  let research = null;
  function reportConsumerError(area, err) {
    console.error('[Module 3] ' + area, err);
  }
  function reportResearchError(err) {
    reportConsumerError('专题研究', err);
    const status = $('trackerStatus');
    if (status) status.textContent = '专题研究暂不可用：' + (err?.message || String(err)) + '。历史榜单数据不受影响。';
  }
  function updateMasterStatus(){
    const status=$('modelMasterStatus'),retry=$('modelMasterRetry');
    if(!status||!retry)return;
    retry.disabled=masterLoading;retry.hidden=masterLoading||!!masterCatalog;
    status.className='msg'+(masterLoading?'':masterCatalog?' good':' warn');
    if(masterLoading){status.textContent='正在读取机型主数据…';return;}
    if(!masterCatalog){status.textContent='机型主数据不可用：'+masterError+'。销量序列暂用独立未匹配标识，不保存临时研究配置。';return;}
    const a=masterCatalog.audit(history);
    const warnings=[a.unmatched.length?'未匹配 '+a.unmatched.join('、'):'',a.conflicts.length?'同榜单身份冲突 '+a.conflicts.map(x=>x.dataset_id+' / '+x.name).join('、'):'',a.issues.length?'无效属性 '+a.issues.map(x=>x.id+' / '+x.field).join('、'):''].filter(Boolean);
    status.className='msg '+(warnings.length?'warn':'good');
    status.textContent=a.models+' 个机型资料 · '+a.matched+'/'+a.total+' 条销量记录匹配'+(a.total?'（'+(100*a.matched/a.total).toFixed(1)+'%）':'')+' · '+a.predecessors+' 个代际引用（'+a.unresolvedPredecessors+' 个待补资料）'+(warnings.length?' · '+warnings.join('；'):'');
  }
  function refreshResearch(){
    updateMasterStatus();
    if(!research||masterLoading)return;
    try{research.refreshTracker();}
    catch(err){reportResearchError(err);}
  }
  async function loadMaster(){
    masterLoading=true;updateMasterStatus();
    try{
      masterCatalog=await window.ModelMaster.load();
      // A retry after provisional research must not persist or reuse provisional identities.
      research?.resetIdentities();masterError='';
    }catch(err){masterCatalog=null;masterError=err?.message||String(err);reportConsumerError('机型主数据',err);}
    finally{masterLoading=false;updateMasterStatus();if(!loading)refreshResearch();}
  }
  async function sendResearchToStudio(key) {
    if (!research) { notify('专题研究暂不可用，请刷新页面后重试。'); return false; }
    try { return await research.sendResearchToStudio(key); }
    catch (err) { reportResearchError(err); notify('专题研究出图失败：' + (err?.message || String(err))); return false; }
  }

  // Research owns its UI and state. It consumes history; it never gates history loading.
  function initResearch() {
  const parameterPanel=document.createElement('section');
  parameterPanel.style.cssText='border:1px solid var(--ui-border,#dbe2ea);border-radius:12px;padding:14px;margin:12px 0';
  parameterPanel.innerHTML='<h3 id="trackerParameterTitle" style="margin:0 0 4px">时间序列构建参数</h3>'+
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px">'+
    '<div><label class="lbl" for="trackerStart">统计起始周</label><select id="trackerStart" class="field ui-field"></select></div>'+
    '<div><label class="lbl" for="trackerEnd">统计结束周</label><select id="trackerEnd" class="field ui-field"></select></div>'+
    '<div><label class="lbl" for="trackerCoverage">最低观测覆盖率 (%)</label><input id="trackerCoverage" type="number" min="0" max="100" step="1" value="80" class="field ui-field"></div>'+
    '<div><label class="lbl" for="trackerCoverageBase">覆盖率分母</label><select id="trackerCoverageBase" class="field ui-field"><option value="first">首次观测起（限所选区间）</option><option value="all">所选完整自然周区间</option></select></div>'+
    '<div><label class="lbl" for="trackerDataMode">数据模式</label><select id="trackerDataMode" class="field ui-field"><option value="filled">原始观测 + 插补</option><option value="raw">仅原始观测</option></select></div>'+
    '<div><label class="lbl" for="trackerImputeRule">插补方法</label><select id="trackerImputeRule" class="field ui-field"><option value="bounded">线性插值 + 动态 TOP N 门槛</option><option value="linear">无门槛线性插值</option></select></div>'+
    '<div><label class="lbl" for="trackerMaxGap">最多连续缺失周数</label><input id="trackerMaxGap" class="field ui-field" type="number" min="0" max="12" step="1" value="3"></div></div>'+
    '<div style="display:flex;gap:12px;flex-wrap:wrap;margin:12px 0"><label><input type="checkbox" id="trackerMissingBoard" checked> 允许整周榜单缺失的内部插补</label><label><input type="checkbox" id="trackerTrailing" checked> 最新历史末周允许门槛约束估算</label><button type="button" class="secondary" id="trackerResetParams">恢复默认参数</button></div>'+
    '<p class="mini" id="trackerInterpolationHint">覆盖率只计真实观测。首次观测口径排除历史首次观测前的周；0%仍要求区间内至少一次观测。插值仅使用区间内前后观测，不向首次观测前外推。末周估算仅限历史最新周、前一周有观测且完整 TOP N 门槛存在；门槛只是假设。</p><div id="trackerParameterStatus" class="msg" aria-live="polite"></div>';
  $('trackerScope').parentElement.parentElement.after(parameterPanel);
  const Pref=window.StudioPreferences,storedResearch=Pref.read('research'),Product=window.ProductResearch;
  const productPanel=document.createElement('section');productPanel.style.cssText=parameterPanel.style.cssText;
  productPanel.innerHTML='<h3 style="margin:0 0 8px">产品属性筛选</h3><div id="productFilterGrid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:8px"></div><button type="button" class="secondary" id="productFilterReset" style="margin-top:8px">清空属性筛选</button><p class="mini" id="productFilterInfo" aria-live="polite"></p>';
  parameterPanel.after(productPanel);
  const productGrid=$('productFilterGrid'),productControls={};
  for(const [field,label] of [...Product.FIELDS,['sale_from','开售日期自'],['sale_to','开售日期至']]){
    const wrap=document.createElement('div'),date=field.startsWith('sale_'),input=document.createElement(date?'input':'select');
    input.id='productFilter_'+field;input.className='field ui-field';if(date)input.type='date';
    const lab=document.createElement('label');lab.className='lbl';lab.htmlFor=input.id;lab.textContent=label;wrap.append(lab,input);productGrid.append(wrap);productControls[field]=input;
  }
  const filterIds=Object.values(productControls).map(n=>n.id);
  const filters=()=>Object.fromEntries(Object.entries(productControls).map(([k,n])=>[k,n.value]).filter(([,v])=>v));
  const matchesAttributes=key=>Product.matches(masterCatalog?.get(key),filters());
  const attributeTopics=new Set(['price','position','chip','age','cross']);
  const filterTopics=new Set(['model','series','structure','generation','tier','tail',...attributeTopics]);
  const groupField=()=>researchView==='series'?'series':$('researchGroupField').value;
  const observedGroups=key=>(key==='series'||key==='structure')&&$('researchGroupMode').value==='observed';
  let productOptionsReady=false;
  function refreshProductFilters(scope){
    const vals=scope?[...knownModels(scope).keys()].map(k=>masterCatalog?.get(k)||null):[];
    for(const [field] of Product.FIELDS){
      const sel=productControls[field],prior=sel.value||(!productOptionsReady?storedResearch.controls?.[sel.id]:'')||'';
      sel.replaceChildren();const all=document.createElement('option');all.value='';all.textContent='全部';sel.append(all);
      const opts=Product.options(vals,field);if(prior&&!opts.includes(prior))opts.push(prior);
      for(const value of opts){const o=document.createElement('option');o.value=value;o.textContent=value;sel.append(o);}sel.value=prior;
    }
    if(scope)productOptionsReady=true;updateProductInfo(scope);
  }
  function updateProductInfo(scope){
    const known=scope?knownModels(scope):new Map(),n=[...known.keys()].filter(matchesAttributes).length,f=filters();
    const hint=researchView==='model'?'只绘制符合条件的已选机型，保留原选择。':(researchView==='tail'||attributeTopics.has(researchView))?'筛选限定原始观测机型；TOP K 仍按原始排名。':observedGroups(researchView)?'筛选限定当期实际入榜样本。':'筛选用于候选池和自动生成；已有固定组及配对不自动缩减。';
    $('productFilterInfo').textContent=(f.sale_from&&f.sale_to&&f.sale_from>f.sale_to?'开售日期范围无效。':'')+n+' / '+known.size+' 个历史机型符合属性条件。'+hint+(!masterCatalog?' 主数据不可用。':'');
  }
  function onProductFilterChange(){updateProductInfo(currentScope());trackerOptions();syncResearchEditors();renderTracker();renderResearch();}
  for(const n of Object.values(productControls))n.onchange=onProductFilterChange;
  $('productFilterReset').onclick=()=>{for(const n of Object.values(productControls))n.value='';onProductFilterChange();};
  const researchControlIds=['trackerCoverage','trackerCoverageBase','trackerDataMode','trackerImputeRule','trackerMaxGap','trackerMissingBoard','trackerTrailing','trackerMode','trackerTrendView','researchStreak','dualView','dualBase','dualCompare','coverageView','coverageRates','headView','headBrand','headTrendMetric','headConcentration','brandView','brandMetric','brandCon','researchGroupField','researchGroupMode','researchGenerationLevel','trackerAxis','researchTailView','researchNewWeeks','priceCuts','priceView','priceMetric','priceBrandLevel','positionView','positionBrandLevel','positionHigh','chipDimension','chipView','chipMetric','chipLimit','ageView','ageMetric','ageBrandLevel','crossRow','crossColumn','crossMetric','crossRange','crossLimit',...filterIds];
  const safeEntries=value=>Array.isArray(value)?value.filter(v=>Array.isArray(v)&&v.length===2&&typeof v[0]==='string'):[];
  let catalog=[],activeScopeId='',restoringScope=false;
  const scopeSettings=new Map(safeEntries(storedResearch.scopes));
  const selectedByScope=new Map(safeEntries(storedResearch.selected).filter(([,v])=>Array.isArray(v)&&v.every(x=>typeof x==='string')).map(([k,v])=>[k,new Set(v)]));
  function restoreScopeSettings(scope){
    if(!scope)return;
    const saved=scopeSettings.get(scope.id);if(!saved)return;
    Pref.setControl($('trackerStart'),saved.start);
    if(!saved.followLatest)Pref.setControl($('trackerEnd'),saved.end);
  }
  function saveResearchPreferences(){
    if(!loaded||!masterCatalog||!currentScope()||restoringScope)return;
    const scope=currentScope(),end=$('trackerEnd'),p=readTrackerParams();
    const existing=scopeSettings.get(scope.id)||{};
    scopeSettings.set(scope.id,{...existing,start:p.start,end:p.end,followLatest:end.value===end.options[end.options.length-1]?.value,...(researchView==='brand'?{brandBase:$('brandBase').value,brandCompare:$('brandCompare').value}:{}),...(researchView==='dual'?{dualBase:$('dualBase').value,dualCompare:$('dualCompare').value}:{})});
    const activeTop={mode:$('researchTopMode').value,custom:$('researchTopK').value};
    Pref.write('research',{scopeId:scope.id,view:researchView,controls:Pref.values(researchControlIds),scopes:[...scopeSettings],selected:[...selectedByScope].map(([k,v])=>[k,[...v]]),groups:[...groupStates],pairs:[...pairStates],pairFocus:[...pairFocusStates],headTop:researchView==='head'?activeTop:headTopState,otherTop:researchView==='head'?otherTopState:activeTop});
  }
  function readTrackerParams(){return salesPanelOptions({scopeId:$('trackerScope').value,start:$('trackerStart').value,end:$('trackerEnd').value,coverage:$('trackerCoverage').value,coverageBase:$('trackerCoverageBase').value,maxGap:$('trackerMaxGap').value,method:$('trackerImputeRule').value,dataMode:$('trackerDataMode').value,missingBoard:$('trackerMissingBoard').checked,trailing:$('trackerTrailing').checked});}
  function updateParamControls(){
    const rawTopic=isRawResearch(researchView),rawMode=$('trackerDataMode').value==='raw',noGap=Number($('trackerMaxGap').value)===0;
    for(const id of ['trackerCoverage','trackerCoverageBase','trackerDataMode'])visible($(id).parentElement,!rawTopic);
    for(const id of ['trackerImputeRule','trackerMaxGap'])visible($(id).parentElement,!rawTopic&&!rawMode);
    visible($('trackerMissingBoard').parentElement,!rawTopic&&!rawMode&&!noGap);
    visible($('trackerTrailing').parentElement,!rawTopic&&!rawMode&&!noGap&&$('trackerImputeRule').value==='bounded');
    $('trackerImputeRule').disabled=rawTopic||rawMode;$('trackerMaxGap').disabled=rawTopic||rawMode;
    $('trackerMissingBoard').disabled=rawTopic||rawMode||noGap;$('trackerTrailing').disabled=rawTopic||rawMode||noGap||$('trackerImputeRule').value!=='bounded';
    visible($('trackerInterpolationHint'),!rawTopic);
    $('trackerParameterTitle').textContent=rawTopic?'统计区间':'时间序列构建参数';
    $('trackerResetParams').textContent=rawTopic?'恢复完整统计区间':'恢复默认参数';
    updateParameterStatus();
  }
  function updateParameterStatus(){
    const p=readTrackerParams(),scope=currentScope();if(!scope||p.start>p.end)return;
    $('trackerParameterStatus').textContent=p.start+' — '+p.end+' · '+scope.weeks.length+' 自然周 / '+scope.weeks.filter(w=>w.hasBoard).length+' 期实收榜单 · '+(isRawResearch(researchView)?'仅原始观测（不使用覆盖率及插补）':'覆盖率 ≥ '+p.coverage+'% · '+(p.dataMode==='raw'?'仅原始观测':p.maxGap===0?'未启用插补':p.method==='bounded'?'约束插补':'线性插值'));
  }
  function fillRangeControls(scope,preserve=false){
    const a=$('trackerStart'),b=$('trackerEnd'),oldA=a.value,oldB=b.value,oldLast=b.options[b.options.length-1]?.value;
    for(const sel of [a,b]){sel.replaceChildren();for(const w of scope?.fullWeeks||[]){const o=document.createElement('option');o.value=w.period;o.textContent=w.period+(w.hasBoard?'':'（无榜单）');sel.append(o);}sel.disabled=!scope;}
    if(scope){a.value=preserve&&scope.fullWeeks.some(w=>w.period===oldA)?oldA:scope.fullWeeks[0].period;b.value=preserve&&oldB!==oldLast&&scope.fullWeeks.some(w=>w.period===oldB)?oldB:scope.fullWeeks[scope.fullWeeks.length-1].period;}
  }
  function applyTrackerParams(resetSelection=false){
    const p=readTrackerParams();$('trackerCoverage').value=p.coverage;$('trackerMaxGap').value=p.maxGap;updateParamControls();
    if(!p.scopeId||!p.start||!p.end||p.start>p.end){trackerData={header:[],rows:[],scopes:[]};$('trackerParameterStatus').textContent=p.start>p.end?'起始周不能晚于结束周。':'暂无可选周榜。';trackerOptions();renderTracker();syncResearchEditors();renderResearch();return;}
    trackerData=Series.buildSalesPanel(history,p,masterCatalog);const scope=currentScope();
    refreshProductFilters(scope);
    if(scope){if(resetSelection){if(selectedByScope.has(scope.id)){const saved=selectedByScope.get(scope.id),known=knownModels(scope);trackerSelected=new Set([...saved].filter(k=>known.has(k)));if(saved.size&&!trackerSelected.size)defaultTrackerSelection(scope);selectedByScope.set(scope.id,new Set(trackerSelected));}else defaultTrackerSelection(scope);}if(!selectedByScope.has(scope.id))selectedByScope.set(scope.id,new Set(trackerSelected));updateParameterStatus();}
    trackerOptions();renderTracker();syncResearchEditors();renderResearch();
  }

  let trackerData = {header:[],rows:[],scopes:[]};
  let trackerSelected = new Set();
  const trackerPalette = ['#2563eb','#ea580c','#059669','#9333ea','#db2777','#0891b2','#92400e','#64748b'];
  // Keep parent-brand hues consistent with the shared brand charts. Assign shades
  // against the full known model catalog, not the currently checked subset.
  function trackerBrandColors(scope){
    const groups=new Map(),colors=new Map(),brandUtils=window.BrandUtils;
    const known=knownModels(scope);
    for(const m of scope.models){if(!known.has(m.key))known.set(m.key,m);}
    for(const [key,m] of known){
      const master=masterCatalog?.get(key)||m.master;
      const brand=brandUtils.classify(master?.model_name||m.name,master?.brand_group)||'其他';
      if(!groups.has(brand))groups.set(brand,[]);
      groups.get(brand).push(key);
    }
    const shade=(hex,factor)=>{
      const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
      // Mix toward black for dark shades, or white for lighter shades.
      return '#'+rgb.map(v=>Math.round(factor<0?v*(1+factor):v+(255-v)*factor).toString(16).padStart(2,'0')).join('');
    };
    for(const [brand,keys] of groups){
      const base=brandUtils.color(brand)||'#64748b';
      keys.sort((a,b)=>String(a).localeCompare(String(b),'en'));
      keys.forEach((key,i)=>{
        const index=i%12,order=[0,-.28,.24,-.44,.38,-.15,.12,-.36,.49,-.21,.31,-.49];
        colors.set(key,shade(base,order[index]));
      });
    }
    return colors;
  }
  function currentScope(){return trackerData.scopes.find(s=>s.id===$('trackerScope').value);}
  function defaultTrackerSelection(scope){
    const last=scope.weeks.filter(w=>w.hasBoard).at(-1);
    const eligible=new Set(scope.models.map(m=>m.key));
    const ranked=last?[...last.map].filter(([k])=>eligible.has(k)).sort((a,b)=>Number(a[1][col.rank])-Number(b[1][col.rank])).map(([k])=>k):[];
    trackerSelected=new Set([...new Set([...ranked,...scope.models.map(m=>m.key)])].slice(0,5));
  }
  function trackerOptions(){
    const scope=currentScope(), q=normalize($('trackerFilter').value);
    const target=$('trackerModels'); target.replaceChildren();
    if(!scope)return;
    for(const m of scope.models.filter(m=>matchesAttributes(m.key)&&matchesModel(m.key,m.name,q))){
      const label=document.createElement('label'), cb=document.createElement('input');
      cb.type='checkbox';cb.checked=trackerSelected.has(m.key);
      cb.onchange=()=>{if(cb.checked)trackerSelected.add(m.key);else trackerSelected.delete(m.key);selectedByScope.set(scope.id,new Set(trackerSelected));renderTracker();renderResearch();};
      label.append(cb,document.createTextNode(' '+m.name));target.append(label);
    }
  }
  const lifeMode=()=> $('trackerAxis').value==='lifecycle';
  const lifeMetric=metric=>metric==='cumulative_wan'?'W1 起完整销售周累计（不含 P0）':'完整销售周销量';
  function curvePoints(rows,c,metric){
    let estimated=false;
    return rows.map(r=>{const flag=r?.[c.is_imputed]==='1';estimated=estimated||flag;return {value:!r||r[c[metric]]===''?null:Number(r[c[metric]]),imputed:metric==='cumulative_wan'?estimated:flag};});
  }
  function seriesRows(scope,c,key){
    const map=new Map(scope.rows.filter(r=>r[c.sequence_id]===key).map(r=>[r[c.period],r]));return scope.weeks.map(w=>map.get(w.period));
  }
  function lifeMaps(scope,curves,c,metric){return curves.map(o=>Product.aligned(masterCatalog?.get(o.key),scope.weeks,curvePoints(o.rows,c,'weekly_wan'),metric==='cumulative_wan'));}
  function lifeChart(curves,maps,axis=Product.lifecycleAxis(maps)){
    return {axis:'lifecycle',periods:axis.map(n=>'W'+n),calendarPeriods:[...new Set(maps.flatMap(m=>axis.map(n=>m.get(n)).filter(v=>Number.isFinite(v?.value)).map(v=>v.period)))].sort(),unit:'万台',lines:curves.map((o,i)=>({name:o.name,color:o.color||trackerPalette[i%trackerPalette.length],values:axis.map(n=>maps[i].get(n)?.value??null),imputed:axis.map(n=>!!maps[i].get(n)?.imputed),sourcePeriods:axis.map(n=>maps[i].get(n)?.period||'')}))};
  }
  function modelExportRows(){
    const c=Object.fromEntries(trackerData.header.map((h,i)=>[h,i])),scope=currentScope(),metric=$('trackerMode').value;
    const rows=(scope?.rows||[]).filter(r=>trackerSelected.has(r[c.sequence_id])&&matchesAttributes(r[c.sequence_id]));
    const source=Series.versionedRows({...trackerData,rows}),byKey=new Map(),weeks=new Map((scope?.weeks||[]).map(w=>[w.period,w]));
    if(scope&&lifeMode())for(const key of new Set(rows.map(r=>r[c.sequence_id])))byKey.set(key,Product.aligned(masterCatalog?.get(key),scope.weeks,curvePoints(seriesRows(scope,c,key),c,'weekly_wan'),metric==='cumulative_wan'));
    return source.map((r,i)=>{
      if(!i)return [...r,'product_filters','chart_axis','chart_metric','sale_start_date','lifecycle_week','lifecycle_chart_wan','lifecycle_chart_imputed'];
      const model=masterCatalog?.get(r[c.sequence_id]),age=Product.lifecycle(model,weeks.get(r[c.period])),point=age&&!age.partial?byKey.get(r[c.sequence_id])?.get(age.index):null;
      return [...r,JSON.stringify(filters()),lifeMode()?'lifecycle':'calendar',metric,model?.sale_start_date||'',age?.label||'',point?.value==null?'':Number(point.value).toFixed(4),point?.value==null?'':point.imputed?'1':'0'];
    });
  }
  // Rank is always read from the original board, never inferred from estimated sales.
  const trackerView=document.createElement('select');
  trackerView.id='trackerTrendView';trackerView.className='field ui-field';
  trackerView.innerHTML='<option value="both">销量与排名走势</option><option value="sales">仅销量走势</option><option value="rank">仅排名走势</option><option value="matrix">历史排名矩阵</option>';
  const trackerViewBox=document.createElement('div');
  const trackerViewLabel=document.createElement('label');trackerViewLabel.className='lbl';trackerViewLabel.htmlFor=trackerView.id;trackerViewLabel.textContent='追踪图表';
  trackerViewBox.append(trackerViewLabel,trackerView);$('trackerChart').before(trackerViewBox);
  trackerView.onchange=()=>renderTracker();
  const trendExport=document.createElement('button');trendExport.type='button';trendExport.className='secondary';trendExport.textContent='导出当前图表 PNG';trendExport.disabled=true;trendExport.style.marginTop='8px';trackerViewBox.append(trendExport);
  const trendHint=document.createElement('p');trendHint.className='mini';trendHint.textContent='PNG 使用图文工作台当前水印及导出宽度，不包含安全区裁切。';trackerViewBox.append(trendHint);
  let trendSnapshot=null,trendBusy=false;
  function captureTrend(chart,scope,metric){
    const plots=[...chart.querySelectorAll('svg')].map(svg=>{
      const copy=svg.cloneNode(true),box=svg.viewBox.baseVal;
      copy.setAttribute('xmlns','http://www.w3.org/2000/svg');copy.setAttribute('width',box.width);copy.setAttribute('height',box.height);
      copy.removeAttribute('style');copy.setAttribute('color','#202a3d');copy.setAttribute('font-family',CJK_FONT);
      copy.querySelectorAll('[data-trend-guide]').forEach(n=>n.remove());
      return {title:svg.previousElementSibling?.textContent||'',width:box.width,height:box.height,xml:new XMLSerializer().serializeToString(copy)};
    });
    if(!plots.length)return;
    const range=scope.weeks[0].period+'—'+scope.weeks.at(-1).period;
    trendSnapshot={plots,names:trackerPublicationChart.lines.map(l=>({name:l.name,color:l.color,marker:l.marker})),title:'热销机型追踪 · '+trackerView.selectedOptions[0].textContent,source:scope.source+' / '+scope.series,range:range+(lifeMode()?' · 完整销售周 W1 起':' · ISO 自然周'),filenameRange:range,mode:trackerView.value,metricNote:'点形区分机型；销量虚线表示含插补。'+(metric==='cumulative_wan'?' 累计按当前统计口径。':'')};
    trendExport.disabled=trendBusy;
  }
  trendExport.onclick=async()=>{
    if(!trendSnapshot||trendBusy)return;
    const snapshot=trendSnapshot,wm={...watermarkState},width=PosterExport.widthOf($('posterExportWidth').value);
    trendBusy=true;trendExport.disabled=true;
    try{
      await PosterExport.waitForFonts();
      const blob=await PosterExport.canvasPNG(async canvas=>{
        const maxW=Math.max(...snapshot.plots.map(p=>p.width)),padding=32,logicalW=maxW+padding*2;
        const cols=Math.max(1,Math.floor(maxW/230)),legendH=Math.ceil(snapshot.names.length/cols)*34;
        const logicalH=155+legendH+snapshot.plots.reduce((a,p)=>a+p.height+52,0)+100;
        const scale=Math.min(width/logicalW,16000/logicalH,Math.sqrt(40000000/(logicalW*logicalH)));
        canvas.width=Math.max(1,Math.round(logicalW*scale));canvas.height=Math.max(1,Math.round(logicalH*scale));
        const ctx=canvas.getContext('2d');ctx.scale(scale,scale);ctx.fillStyle='#fff';ctx.fillRect(0,0,logicalW,logicalH);
        const text=(v,x,y,size=18,color='#202a3d',max=logicalW-64)=>{ctx.fillStyle=color;ctx.font='600 '+size+'px '+CJK_FONT;ctx.fillText(v,x,y,max);};
        text(snapshot.title,padding,52,32);text(snapshot.source,padding,86,18,'#64748b');text(snapshot.range,padding,114,18,'#64748b');
        snapshot.names.forEach((l,i)=>{const x=padding+(i%cols)*maxW/cols,y=150+Math.floor(i/cols)*34;ResearchCharts.canvasMarker(ctx,l.marker,x+8,y-6,6,l.color);text(l.name,x+22,y,16,'#202a3d',maxW/cols-28);});
        let y=155+legendH;
        for(const p of snapshot.plots){
          text(p.title,padding,y+24,22);y+=40;
          const url=URL.createObjectURL(new Blob([p.xml],{type:'image/svg+xml;charset=utf-8'}));
          try{const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('图表图像生成失败'));img.src=url;});ctx.drawImage(img,padding,y,p.width,p.height);}finally{URL.revokeObjectURL(url);}
          y+=p.height+12;
        }
        text('仅历史榜单估算样本，非全市场；缺失不等于零，排名不插补。',padding,y+20,17,'#64748b');
        text(snapshot.metricNote,padding,y+48,17,'#64748b');
        drawImageWatermark(ctx,logicalW,logicalH,0,0,wm,{safeEnabled:false},{muted:'#425772'});
      });
      PosterExport.downloadBlob(blob,'机型追踪-'+snapshot.mode+'-'+snapshot.filenameRange+'.png');notify('图表 PNG 已生成');
    }catch(err){notify('图表导出失败：'+err.message);}finally{trendBusy=false;trendExport.disabled=!trendSnapshot;}
  };
  function linkTrackerPlots(host,sales,rank){
    const svgs=[...host.querySelectorAll('svg')],n=sales.periods.length;if(!n||!svgs.length)return;
    const ns='http://www.w3.org/2000/svg',info=document.createElement('div');info.className='msg';info.style.cssText='position:sticky;left:0;max-width:100%;overflow-wrap:anywhere';info.textContent='移动鼠标或点击数据区，查看所选周的销量与排名。';host.prepend(info);
    const guides=svgs.map(svg=>{
      const g=document.createElementNS(ns,'line');g.setAttribute('data-trend-guide','1');g.setAttribute('y1','25');g.setAttribute('y2','265');g.setAttribute('stroke','#64748b');g.setAttribute('stroke-dasharray','4 4');g.setAttribute('pointer-events','none');g.setAttribute('visibility','hidden');svg.append(g);return {svg,g};
    });
    function show(i){
      guides.forEach(({svg,g})=>{const W=svg.viewBox.baseVal.width,x=n===1?(56+W-55)/2:56+i*(W-111)/(n-1);g.setAttribute('x1',x);g.setAttribute('x2',x);g.setAttribute('visibility','visible');});
      info.replaceChildren();const title=document.createElement('strong');title.textContent=sales.periods[i];info.append(title);
      sales.lines.forEach((l,j)=>{
        const p=rank.lines[j]?.points[i],v=l.values[i],row=document.createElement('div');row.style.color=l.color;
        row.textContent=l.name+'：'+(Number.isFinite(v)?v.toFixed(2)+' 万台'+(l.imputed?.[i]?'（含插补）':''):'销量缺失')+' / '+(Number.isFinite(p?.value)?'第 '+p.value+' 名（TOP '+p.top+'）':p?.status||'无对应记录')+(lifeMode()&&p?.period?' · '+p.period:'');info.append(row);
      });
    }
    for(const {svg} of guides){
      const move=ev=>{const pt=svg.createSVGPoint();pt.x=ev.clientX;pt.y=ev.clientY;const matrix=svg.getScreenCTM();if(!matrix)return;const q=pt.matrixTransform(matrix.inverse()),W=svg.viewBox.baseVal.width;if(q.y<25||q.y>265||q.x<50||q.x>W-49)return;show(n===1?0:Math.max(0,Math.min(n-1,Math.round((q.x-56)/(W-111)*(n-1)))));};
      svg.addEventListener('pointermove',move);svg.addEventListener('click',move);
      svg.addEventListener('pointerleave',()=>guides.forEach(({g})=>g.setAttribute('visibility','hidden')));
    }
  }
  function renderTrackerMatrix(host,rank){
    if(!rank.periods.length)return;
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),L=230,T=48,cw=78,ch=34,W=Math.max(720,L+rank.periods.length*cw+20),H=T+rank.lines.length*ch+55;
    svg.setAttribute('viewBox','0 0 '+W+' '+H);svg.setAttribute('role','img');svg.setAttribute('aria-label','历史原始排名矩阵');svg.style.cssText='display:block;width:100%;min-width:'+W+'px';
    function node(tag,attrs,txt,parent=svg){const el=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);if(txt!=null)el.textContent=txt;parent.append(el);return el;}
    const fill=v=>v===1?'#164e87':v<=3?'#327ab5':v<=5?'#83b6dc':v<=10?'#c6ddf0':'#e8f0f8';
    rank.periods.forEach((p,i)=>node('text',{x:L+(i+.5)*cw,y:30,'text-anchor':'middle','font-size':12,fill:'currentColor'},p));
    rank.lines.forEach((l,j)=>{
      const yy=T+j*ch;const name=node('text',{x:L-10,y:yy+22,'text-anchor':'end','font-size':13,fill:'currentColor'},l.name.length>17?l.name.slice(0,16)+'…':l.name);node('title',{},l.name,name);
      l.points.forEach((p,i)=>{
        const v=p?.value,x=L+i*cw,valid=Number.isFinite(v),rect=node('rect',{x:x+2,y:yy+2,width:cw-4,height:ch-4,rx:4,fill:valid?fill(v):'#f1f3f5',stroke:valid?'none':'#d7dce2'});
        node('title',{},l.name+' · '+(p?.period||rank.periods[i])+' · '+(valid?'第'+v+'名 / TOP '+p.top:p?.status||'无对应记录'),rect);
        node('text',{x:x+cw/2,y:yy+22,'text-anchor':'middle','font-size':14,fill:valid&&v<=3?'#fff':'#334155','pointer-events':'none'},valid?v:p?.status==='榜单缺失'?'×':'—');
      });
    });
    node('text',{x:10,y:H-25,'font-size':13,fill:'currentColor'},'深蓝：前3名  ·  蓝色：4–10名  ·  浅蓝：11名以后  ·  × 榜单缺失  ·  — 无排名记录');
    host.append(svg);
  }
  function trackerRankChart(scope,curves,periods){
    const rankOf=(w,key)=>{const r=w.map.get(key),v=Number(r?.[col.rank]);return Number.isSafeInteger(v)&&v>0?v:null;};
    return {periods,lines:curves.map(o=>{
      const byPeriod=new Map();
      for(const w of scope.weeks){
        const age=lifeMode()?Product.lifecycle(o.m.master,w):null;
        if(lifeMode()&&(!age||age.partial))continue;
        byPeriod.set(lifeMode()?age.label:w.period,{value:rankOf(w,o.m.key),period:w.period,top:w.top||w.count,status:!w.hasBoard?'榜单缺失':w.map.has(o.m.key)?'原始榜单观测':'无排名记录'});
      }
      return {name:o.m.name,color:o.color,points:periods.map(p=>byPeriod.get(p)||null)};
    })};
  }
  function renderTrackerRank(host,rank){
    const n=rank.periods.length;if(!n)return;
    const W=Math.max(720,n*48+110),H=310,L=56,R=W-55,T=25,B=265;
    const ranks=rank.lines.flatMap(l=>l.points.map(p=>p?.value)).filter(Number.isFinite);
    if(!ranks.length){const empty=document.createElement('p');empty.className='mini';empty.textContent='当前区间无原始排名记录。';host.append(empty);return;}
    const min=Math.min(...ranks),max=Math.max(...ranks),span=max-min;
    const x=i=>n===1?(L+R)/2:L+i*(R-L)/(n-1),y=v=>span===0?(T+B)/2:T+(v-min)*(B-T)/span;
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
    svg.setAttribute('viewBox','0 0 '+W+' '+H);svg.setAttribute('role','img');svg.setAttribute('aria-label','原始榜单排名走势，较高名次在顶部');svg.style.cssText='width:100%;min-width:560px';
    function node(tag,attrs,txt,parent=svg){const el=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);if(txt!=null)el.textContent=txt;parent.append(el);return el;}
    const step=Math.max(1,Math.ceil(span/8));
    for(const v of [...new Set([...Array.from({length:Math.floor(span/step)+1},(_,i)=>min+i*step),max])]){
      node('line',{x1:L,x2:R,y1:y(v),y2:y(v),stroke:'currentColor',opacity:.14});
      node('text',{x:L-8,y:y(v)+4,'text-anchor':'end',fill:'currentColor','font-size':11},v);
    }
    node('text',{x:L,y:13,fill:'currentColor','font-size':11},'原始排名');
    const stride=Math.max(1,Math.ceil(n/15));rank.periods.forEach((p,i)=>{if(i%stride===0||i===n-1)node('text',{x:x(i),y:B+20,'text-anchor':'middle',fill:'currentColor','font-size':10},p);});
    rank.lines.forEach(l=>l.points.forEach((p,i)=>{
      if(!Number.isFinite(p?.value))return;
      const prev=l.points[i-1];
      if(Number.isFinite(prev?.value))node('line',{x1:x(i-1),x2:x(i),y1:y(prev.value),y2:y(p.value),stroke:l.color,'stroke-width':2.5});
      svg.insertAdjacentHTML('beforeend',ResearchCharts.svgMarker(l.marker,x(i),y(p.value),4.5,l.color));const dot=svg.lastElementChild;
      node('title',{},l.name+' · '+p.period+' · 第'+p.value+'名 · TOP '+p.top,dot);
    }));
    host.append(svg);
    const note=document.createElement('p');note.className='mini';note.textContent='原始榜单排名，不因筛选重新排名；无记录留空，不插补。各期榜单规模可能不同，排名不代表全市场排名。';host.append(note);
  }
  let trackerPublicationChart=null,trackerPublicationRank=null;
  function renderTracker(){try{renderTrackerContent();}catch(err){trackerPublicationChart=null;trackerPublicationRank=null;trendSnapshot=null;trendExport.disabled=true;$('trackerExport').disabled=true;reportResearchError(err);throw err;}finally{if(researchView==='model')saveResearchPreferences();}}
  function renderTrackerContent(){
    trackerPublicationChart=null;trackerPublicationRank=null;trendSnapshot=null;trendExport.disabled=true;
    const scope=currentScope(), chart=$('trackerChart'), legend=$('trackerLegend'), table=$('trackerRows');
    chart.replaceChildren();legend.replaceChildren();table.replaceChildren();
    $('trackerExport').disabled=!scope||!scope.models.some(m=>trackerSelected.has(m.key)&&matchesAttributes(m.key));
    if(!scope){$('trackerStatus').textContent='暂无符合口径的周销量榜单数据。';return;}
    const c=Object.fromEntries(trackerData.header.map((h,i)=>[h,i]));
    const models=scope.models.filter(m=>trackerSelected.has(m.key)&&matchesAttributes(m.key));
    const metric=$('trackerMode').value;
    const brandColors=trackerBrandColors(scope);
    const curves=models.map(m=>({m,color:brandColors.get(m.key)||'#64748b',rows:scope.rows.filter(r=>r[c.sequence_id]===m.key)}));
    $('trackerStatus').textContent=scope.weeks.length+' 周 / '+scope.models.length+' 款长期追踪机型 · 已选且符合属性筛选 '+models.length+' 款 · 插补 '+curves.reduce((n,o)=>n+o.rows.filter(r=>r[c.is_imputed]==='1').length,0)+' 条';
    if(!curves.length){$('trackerStatus').textContent+=' · 请勾选符合当前参数的机型；必要时降低覆盖率。';return;}
    if(lifeMode()){
      const items=curves.map(o=>({key:o.m.key,name:o.m.name,color:o.color,rows:o.rows})),maps=lifeMaps(scope,items,c,metric);
      trackerPublicationChart=lifeChart(items,maps);
      $('trackerStatus').textContent+=' · '+lifeMetric(metric)+' · P0 不纳入；未知开售日期或缺失 W1 不回填。';
      if(!trackerPublicationChart.lines.some(l=>l.values.some(Number.isFinite)))$('trackerStatus').textContent+=' 当前区间无可绘制的完整销售周数据。';
    }else{
      trackerPublicationChart={periods:scope.weeks.map(w=>w.period),unit:'万台',lines:curves.map(o=>{const pts=curvePoints(o.rows,c,metric);return {name:o.m.name,color:o.color,values:pts.map(v=>v.value),imputed:pts.map(v=>v.imputed)};})};
    }
    const rankChart=trackerRankChart(scope,curves,trackerPublicationChart.periods);trackerPublicationRank=rankChart;
    trackerPublicationChart.lines.forEach((l,i)=>{l.marker=ResearchCharts.markerAt(i);rankChart.lines[i].marker=l.marker;});
    const addHeading=text=>{const h=document.createElement('h3');h.textContent=text;h.style.margin='16px 0 4px';chart.append(h);};
    if(trackerView.value==='both'||trackerView.value==='sales'){
      addHeading(metric==='cumulative_wan'?'累计销量增量走势':'周销量走势');
      ResearchCharts.svgLine(chart,legend,trackerPublicationChart,'热销机型销量折线图',4);
    }else{
      for(const l of trackerPublicationChart.lines){const span=document.createElement('span');span.style.color=l.color;span.textContent=(l.marker||'●')+' '+l.name;legend.append(span);}
    }
    if(trackerView.value==='both'||trackerView.value==='rank'){addHeading('榜单排名走势');renderTrackerRank(chart,rankChart);}
    if(trackerView.value==='matrix'){addHeading('历史排名矩阵');renderTrackerMatrix(chart,rankChart);}
    captureTrend(chart,scope,metric);
    if(trackerView.value!=='matrix')linkTrackerPlots(chart,trackerPublicationChart,rankChart);
    for(const o of curves){
      const last=o.rows[o.rows.length-1], n=o.rows.filter(r=>r[c.is_imputed]==='1').length;
      const show=v=>v===''?'—':Number(v).toFixed(2);
      const tr=document.createElement('tr');tr.innerHTML='<td>'+e(o.m.name)+'</td><td>'+e(o.m.master?.sale_start_date||'—')+'</td><td>'+e(Product.lifecycle(o.m.master,scope.weeks.at(-1))?.label||'—')+'</td><td>'+e((100*Number(last[c.coverage_rate])).toFixed(1))+'%</td><td>'+n+'</td><td class="num">'+e(show(last[c.weekly_wan]))+'</td><td class="num">'+e(show(last[c.cumulative_wan]))+'</td>';table.append(tr);
    }
  }

  function refreshTracker(){
    const previous=$('trackerScope').value||storedResearch.scopeId;
    try{
      catalog=Series.buildSalesPanel(history,{coverage:100,dataMode:'raw'},masterCatalog).scopes;
      const sel=$('trackerScope');sel.replaceChildren();for(const s of catalog){const option=document.createElement('option');option.value=s.id;option.textContent=s.source+' / '+s.series;sel.append(option);}
      if(catalog.some(s=>s.id===previous))sel.value=previous;
      const scope=catalog.find(s=>s.id===sel.value),changed=activeScopeId!==sel.value;
      fillRangeControls(scope,!changed);restoringScope=changed;if(changed)restoreScopeSettings(scope);activeScopeId=sel.value;try{applyTrackerParams(changed||!selectedByScope.has(sel.value));}finally{restoringScope=false;}saveResearchPreferences();
    }catch(err){trackerData={header:[],rows:[],scopes:[]};$('trackerScope').replaceChildren();fillRangeControls(null);trackerOptions();renderTracker();renderResearch();$('trackerParameterStatus').textContent=err.message;}
  }
  $('trackerScope').onchange=()=>{const s=catalog.find(q=>q.id===$('trackerScope').value);activeScopeId=$('trackerScope').value;restoringScope=true;fillRangeControls(s);restoreScopeSettings(s);try{applyTrackerParams(true);}finally{restoringScope=false;}saveResearchPreferences();};
  for(const id of ['trackerStart','trackerEnd','trackerCoverage','trackerCoverageBase','trackerDataMode','trackerImputeRule','trackerMaxGap','trackerMissingBoard','trackerTrailing'])$(id).addEventListener('change',()=>applyTrackerParams());
  $('trackerResetParams').onclick=()=>{fillRangeControls(catalog.find(s=>s.id===$('trackerScope').value));if(isRawResearch(researchView)){applyTrackerParams();return;}$('trackerCoverage').value='80';$('trackerCoverageBase').value='first';$('trackerDataMode').value='filled';$('trackerImputeRule').value='bounded';$('trackerMaxGap').value='3';$('trackerMissingBoard').checked=true;$('trackerTrailing').checked=true;applyTrackerParams();};
  $('trackerFilter').oninput=trackerOptions;
  $('trackerMode').onchange=()=>{renderTracker();renderResearch();};
  $('trackerAxis').onchange=()=>{renderTracker();renderResearch();};
  $('trackerExport').onclick=()=>exportCSVBlob(modelExportRows(),'weekly-sales-panel-'+$('trackerStart').value+'_'+$('trackerEnd').value+'.csv');

  // Research views share the selected source/series and never combine different observation scopes.
  const researchNav=document.createElement('div');
  researchNav.style.cssText='display:grid;gap:12px;margin:12px 0';
  const researchViews={model:'机型销量趋势',series:'系列销量趋势',generation:'代际替代分析',structure:'产品结构分析',tier:'同档代际对比',tail:'长尾韧性分析',flow:'榜单流动分析',brand:'榜单品牌结构与集中度',head:'品牌头部效应与全市场对比',dual:'TOP30 vs 全市场品牌结构流向',coverage:'TOP30市场覆盖率估算',price:'价格带竞争分析',position:'品牌产品定位分析',chip:'芯片平台竞争分析',age:'新老产品结构分析',cross:'多维产品竞争分析'};
  // A single topic registry drives both research navigation and publication chooser.
  const researchCategories=[
    {label:'产品销量研究',keys:['model','series','generation','tier']},
    {label:'产品属性与竞争研究',keys:['structure','price','position','chip','cross']},
    {label:'生命周期研究',keys:['tail','age']},
    {label:'榜单生态研究',keys:['flow','brand']},
    {label:'跨模块研究',keys:['head','dual','coverage']}
  ];
  const isRawResearch=key=>['tail','flow','brand','head','coverage','dual'].includes(key)||attributeTopics.has(key)||observedGroups(key);
  const usesTopK=key=>['flow','brand','head'].includes(key)||attributeTopics.has(key);
  const researchButtons={};
  let researchView='model';
  const scopeControl=$('trackerScope');
  // The research navigation follows the retained heading, not optional descriptive copy.
  tracker.querySelector('h2').after(researchNav);
  const researchPanel=document.createElement('div');
  researchPanel.innerHTML='<h3 id="researchTitle"></h3><p id="researchDesc" class="mini"></p>'+
    '<div id="researchGroupControls"><p class="mini">固定成员可手动编辑；应用自动分组会替换现有分组。筛选不会自动减少已配置的固定成员。</p>'+
    '<div id="researchGroupModeWrap"><label class="lbl" for="researchGroupMode">成员统计口径</label><select id="researchGroupMode" class="field ui-field"><option value="fixed">固定机型组（覆盖率与可选插补）</option><option value="observed">当期原始入榜样本（自动属性分组）</option></select></div>'+
    '<div id="researchGroupFieldWrap"><label class="lbl" for="researchGroupField">自动分组维度</label><select id="researchGroupField" class="field ui-field">'+Product.FIELDS.map(([k,label])=>'<option value="'+k+'"'+(k==='variant'?' selected':'')+'>'+label+'</option>').join('')+'</select></div>'+
    '<div id="researchGenerationChoice"><label class="lbl" for="researchGenerationPair">明确的前代关系</label><select id="researchGenerationPair" class="field ui-field"></select><label class="lbl" for="researchGenerationLevel">比较对象</label><select id="researchGenerationLevel" class="field ui-field"><option value="model">配对机型</option><option value="series">对应系列历史已观测成员</option></select></div>'+
    '<div id="researchGroupButtons" style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0"><button type="button" class="secondary" id="researchSeriesPreset">应用自动分组</button><button type="button" class="secondary" id="researchAddGroup">+ 添加分组</button></div>'+
    '<div id="researchGroupEditor"></div><p id="researchGroupInfo" class="mini" aria-live="polite"></p></div>'+
    '<div id="researchTierControls"><p class="mini">按明确代际关系或手动配对，支持自然周及完整销售周同期；缺少双边可比数据时不计算差值、倍数或贡献率。</p>'+
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0"><button type="button" class="secondary" id="researchPairPreset">按主数据生成代际配对</button><button type="button" class="secondary" id="researchAddPair">+ 添加档位</button></div>'+
    '<div id="researchPairEditor"></div><label class="lbl" for="researchPairFocus">图表展示档位</label><select id="researchPairFocus" class="field ui-field"></select><p id="researchPairInfo" class="mini"></p></div>'+
    '<div id="researchTopControls"><label class="lbl" for="researchTopMode">榜单样本口径</label><select id="researchTopMode" class="field ui-field"><option value="all">原始榜单全量</option><option value="10">固定 TOP10</option><option value="20">固定 TOP20</option><option value="30">固定 TOP30</option><option value="custom">自定义 TOP K</option></select>'+
    '<div id="researchTopCustom"><label class="lbl" for="researchTopK">K（正整数）</label><input id="researchTopK" class="field ui-field" type="number" min="1" max="10000" step="1" value="40"></div>'+
    '<p class="mini">固定 TOP K 只取原始排名 1–K；任何一个名次缺失，该周不可比较，不插补、不按零处理。不影响其他销量追踪专题及原始数据。</p><p id="researchTopInfo" class="mini"></p></div>'+
    '<div id="researchBrandControls"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px">'+
    '<div><label class="lbl" for="brandView">图表方式</label><select id="brandView" class="field ui-field"><option value="stack">多周堆叠柱状图</option><option value="ribbon">双周堆叠流向图</option><option value="concentration">集中度趋势</option><option value="line">品牌占比 / 销量折线图</option></select></div>'+
    '<div id="brandMetricControl"><label class="lbl" for="brandMetric">统计维度</label><select id="brandMetric" class="field ui-field"><option value="share">品牌榜单销量占比</option><option value="count">品牌上榜数量占比</option><option value="volume">品牌绝对销量（万台）</option></select></div>'+
    '<div id="brandBaseControl"><label class="lbl" for="brandBase">基准周</label><select id="brandBase" class="field ui-field"></select></div>'+
    '<div id="brandCompareControl"><label class="lbl" for="brandCompare">对比周</label><select id="brandCompare" class="field ui-field"></select></div>'+
    '<div id="brandConControl"><label class="lbl" for="brandCon">集中度指标（按销量）</label><select id="brandCon" class="field ui-field"><option value="cr">CR1 / CR3 / CR5（%）</option><option value="hhi">HHI（0–10000）</option></select></div></div>'+
    '<p class="mini">母品牌归并，与模块2颜色一致。份额图按当周样本归一至100%；绝对销量图按共同纵轴绘制；不使用插补。色带仅连接同一品牌，不表示用户流向。</p></div>'+
    '<div id="researchHeadControls"><p class="mini">动态关联模块2 market-share.csv；OPPO（含一加、realme）、vivo（含 iQOO）、小米（含 REDMI）。六大集团之外为其他，不重复累加、不强制归一化。</p>'+
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px"><div><label class="lbl" for="headView">研究视图</label><select id="headView" class="field ui-field"><option value="distribution">品牌销量分布对比</option><option value="enrichment">头部销量富集指数</option><option value="strength">单品销量强度指数</option><option value="matrix">品牌双指标四象限</option><option value="trend">头部效应历史趋势</option><option value="concentration">品牌集中度差异</option></select></div>'+
    '<div id="headBrandControl"><label class="lbl" for="headBrand">趋势研究品牌</label><select id="headBrand" class="field ui-field"><option>Apple</option><option>华为</option><option>小米系</option><option>OPPO系</option><option>vivo系</option><option>荣耀</option><option>其他</option></select></div>'+
    '<div id="headTrendControl"><label class="lbl" for="headTrendMetric">趋势指标</label><select id="headTrendMetric" class="field ui-field"><option value="share">榜单与市场份额</option><option value="index">头部富集与单品强度</option></select></div>'+
    '<div id="headConcentrationControl"><label class="lbl" for="headConcentration">集中度指标</label><select id="headConcentration" class="field ui-field"><option value="cr3">CR3（%）</option><option value="hhi">HHI（共同品牌组）</option></select></div></div>'+
    '<button type="button" class="secondary" id="headReload">重新读取全市场 CSV</button><p id="headDataInfo" class="mini" aria-live="polite"></p></div>'+
    '<div id="researchDualControls"><p class="mini">固定完整TOP30与模块2同周市场份额；上下双图沿用六大集团颜色及顺序，不对隐藏的“其他”重新归一化。色带仅连接同一品牌，不表示用户流向。双周模式只在变化(pp)数字背后高亮最大涨跌，多周模式不显示变化(pp)列。</p>'+
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px"><div><label class="lbl" for="dualView">图表方式</label><select id="dualView" class="field ui-field"><option value="pair">双周品牌结构流向</option><option value="multi">多周堆叠流向图</option></select></div><div id="dualBaseWrap"><label class="lbl" for="dualBase">基准周</label><select id="dualBase" class="field ui-field"></select></div><div id="dualCompareWrap"><label class="lbl" for="dualCompare">对比周</label><select id="dualCompare" class="field ui-field"></select></div></div>'+
    '<p class="mini" id="dualRangeHint">多周模式采用页面上方的统计起始周、结束周，不插补；仅连接相邻两期都有效的同一品牌。缺失周保留空位。</p>'+
    '<button type="button" class="secondary" id="dualReload" style="margin-top:8px">重新读取全市场 CSV</button><p id="dualDataInfo" class="mini" aria-live="polite"></p></div>'+
    '<div id="researchCoverageControls"><p class="mini">独立按原始排名1–30名统计，缺任一名次整周不计算；只使用相同ISO周模块2苹果份额，苹果榜外销量未知。理论上限假定苹果100%入榜；其他比例仅为情景假设，不代表实际覆盖率。</p>'+
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px"><div><label class="lbl" for="coverageView">图表视图</label><select id="coverageView" class="field ui-field"><option value="coverage">覆盖率上限与情景趋势</option><option value="mom">市场环比规模指数对比</option><option value="gap">环比偏差绝对值</option></select></div>'+
    '<div><label class="lbl" for="coverageRates">苹果入榜覆盖率情景（%，逗号分隔）</label><input id="coverageRates" class="field ui-field" value="98,95,90,85" placeholder="98,95,90,85"></div></div>'+
    '<button type="button" class="secondary" id="coverageReload" style="margin-top:8px">重新读取全市场 CSV</button><p id="coverageDataInfo" class="mini" aria-live="polite"></p></div>'+
    '<div id="researchTailControls"><label class="lbl" for="researchStreak">最少连续上榜周数（最长连续纪录）</label><input type="number" id="researchStreak" class="field ui-field" min="1" step="1" value="12"><label class="lbl" for="researchTailView">展示方式</label><select id="researchTailView" class="field ui-field"><option value="table">韧性指标表</option><option value="scatter">末周上市年龄 × 销量（最多12款）</option></select></div>'+
    '<div id="researchFlowControls"><label class="lbl" for="researchNewWeeks">新品门槛（完整销售周，含 P0）</label><input id="researchNewWeeks" type="number" class="field ui-field" min="0" max="52" step="1" value="4"></div>'+
    '<div id="researchPriceControls"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px">'+
    '<div><label class="lbl" for="priceCuts">价格分界线（元，升序逗号分隔）</label><input id="priceCuts" class="field ui-field" value="'+Product.DEFAULT_CUTS.join(',')+'"></div>'+
    '<div><label class="lbl" for="priceView">研究视图</label><select id="priceView" class="field ui-field"><option value="stack">价格带历史堆叠</option><option value="line">价格带趋势折线</option><option value="matrix">末周价格带 × 品牌</option></select></div>'+
    '<div><label class="lbl" for="priceMetric">统计指标</label><select id="priceMetric" class="field ui-field"><option value="share">销量占比</option><option value="volume">销量（万台）</option><option value="count">入榜数量</option></select></div>'+
    '<div id="priceBrandWrap"><label class="lbl" for="priceBrandLevel">品牌层级</label><select id="priceBrandLevel" class="field ui-field"><option value="brand_group">母品牌</option><option value="brand">子品牌/品牌</option></select></div></div><button id="priceResetCuts" type="button" class="secondary" style="margin-top:8px">恢复默认价格带</button><p class="mini">专题自定义价格带独立于通用筛选器的默认价格带。末周指所选统计结束周。</p></div>'+
    '<div id="researchPositionControls" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px">'+
    '<div><label class="lbl" for="positionView">研究视图</label><select id="positionView" class="field ui-field"><option value="weighted">加权首发价趋势</option><option value="high">高价位销量贡献趋势</option><option value="scatter">末周销量 × 加权首发价</option></select></div>'+
    '<div><label class="lbl" for="positionBrandLevel">品牌层级</label><select id="positionBrandLevel" class="field ui-field"><option value="brand_group">母品牌</option><option value="brand">子品牌/品牌</option></select></div>'+
    '<div><label class="lbl" for="positionHigh">高价位门槛（元）</label><input id="positionHigh" class="field ui-field" type="number" min="1" max="1000000" step="1" value="6000"></div></div>'+
    '<div id="researchChipControls" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px">'+
    '<div><label class="lbl" for="chipDimension">芯片粒度</label><select id="chipDimension" class="field ui-field"><option value="chip_vendor">供应商</option><option value="chip_model">具体平台</option></select></div>'+
    '<div><label class="lbl" for="chipView">研究视图</label><select id="chipView" class="field ui-field"><option value="stack">历史结构堆叠</option><option value="line">销量趋势折线</option><option value="rank">末周平台排名</option><option value="brand">末周芯片 × 品牌</option></select></div>'+
    '<div><label class="lbl" for="chipMetric">统计指标</label><select id="chipMetric" class="field ui-field"><option value="share">销量占比</option><option value="volume">销量（万台）</option><option value="count">入榜数量</option></select></div>'+
    '<div><label class="lbl" for="chipLimit">图表最多保留主要类别</label><input id="chipLimit" class="field ui-field" type="number" min="1" max="12" step="1" value="8"></div></div>'+
    '<div id="researchAgeControls" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px">'+
    '<div><label class="lbl" for="ageView">研究视图</label><select id="ageView" class="field ui-field"><option value="stack">上市年龄结构趋势</option><option value="line">上市年龄折线趋势</option><option value="brand">末周品牌 × 上市年龄</option><option value="new">品牌新品销量贡献趋势</option></select></div>'+
    '<div id="ageMetricWrap"><label class="lbl" for="ageMetric">指标</label><select id="ageMetric" class="field ui-field"><option value="share">样本销量占比</option><option value="volume">销量（万台）</option><option value="count">入榜统计项数</option></select></div>'+
    '<div id="ageBrandWrap"><label class="lbl" for="ageBrandLevel">品牌层级</label><select id="ageBrandLevel" class="field ui-field"><option value="brand_group">母品牌</option><option value="brand">品牌</option></select></div></div>'+
    '<div id="researchCrossControls" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px">'+
    '<div><label class="lbl" for="crossRow">行属性</label><select id="crossRow" class="field ui-field">'+Product.AGE_FIELDS.map(([k,label])=>'<option value="'+k+'"'+(k==='brand_group'?' selected':'')+'>'+label+'</option>').join('')+'</select></div>'+
    '<div><label class="lbl" for="crossColumn">列属性</label><select id="crossColumn" class="field ui-field">'+Product.AGE_FIELDS.map(([k,label])=>'<option value="'+k+'"'+(k==='price_band'?' selected':'')+'>'+label+'</option>').join('')+'</select></div>'+
    '<div><label class="lbl" for="crossRange">统计范围</label><select id="crossRange" class="field ui-field"><option value="last">所选末周</option><option value="range">所选区间有效周汇总</option></select></div>'+
    '<div><label class="lbl" for="crossMetric">矩阵指标</label><select id="crossMetric" class="field ui-field"><option value="volume">累计样本销量（万台）</option><option value="count">入榜统计项/机型周次</option><option value="share">全样本销量占比</option><option value="row_share">行内销量占比</option><option value="col_share">列内销量占比</option></select></div>'+
    '<div><label class="lbl" for="crossLimit">每轴主要已知类别（1–8）</label><input id="crossLimit" class="field ui-field" type="number" min="1" max="8" step="1" value="6"></div><div style="align-self:end"><button id="crossSwap" type="button" class="secondary">交换行列</button></div></div>'+
    '<div id="researchNotice" class="msg" aria-live="polite"></div><div id="researchChart" style="overflow:auto"></div><div id="researchLegend" style="display:flex;flex-wrap:wrap;gap:8px 16px"></div>'+
    '<div class="tablewrap"><table class="ranktable"><thead id="researchHead"></thead><tbody id="researchRows"></tbody></table></div>'+
    '<button type="button" class="secondary" id="researchExport" style="margin-top:10px" disabled>导出当前专题 CSV</button>';
  tracker.append(researchPanel);
  // Scope is always visible. The original chart/filter controls are retained for the model view.
  const commonGrid=scopeControl.parentElement.parentElement;
  const modelNodes=Array.from(tracker.children).filter(n=>n!==researchNav&&n!==researchPanel&&n!==parameterPanel&&n!==productPanel&&n!==$('modelMasterStatus')&&n!==$('modelMasterRetry')&&n!==commonGrid&&n!==tracker.querySelector('h2')&&n!==$('trackerExport'));
  const metricNode=$('trackerMode').parentElement,axisNode=$('trackerAxis').parentElement;
  function visible(node,show){if(!node)return;node.hidden=!show;node.style.display=show?(node.dataset.researchDisplay||''):'none';}
  for(const n of [...modelNodes,productPanel,metricNode,axisNode,researchPanel,$('researchGroupControls'),$('researchTierControls'),$('researchTopControls'),$('researchBrandControls'),$('researchHeadControls'),$('researchCoverageControls'),$('researchDualControls'),$('researchTailControls'),$('researchPriceControls'),$('researchPositionControls'),$('researchChipControls'),$('researchAgeControls'),$('researchCrossControls')])if(n)n.dataset.researchDisplay=n.style.display||'';
  let headTopState={mode:'30',custom:'40'},otherTopState={mode:'all',custom:'40'};
  function setResearchView(key){
    if(key!==researchView&&(key==='head'||researchView==='head')){
      const old={mode:$('researchTopMode').value,custom:$('researchTopK').value};
      if(researchView==='head')headTopState=old;else otherTopState=old;
      const next=key==='head'?headTopState:otherTopState;$('researchTopMode').value=next.mode;$('researchTopK').value=next.custom;
    }
    researchView=key;
    updateParamControls();
    for(const [id,b] of Object.entries(researchButtons)){b.className=id===key?'primary':'secondary';b.setAttribute('aria-pressed',String(id===key));}
    for(const n of modelNodes)visible(n,key==='model');
    visible(productPanel,filterTopics.has(key));updateProductInfo(currentScope());
    visible(metricNode,key==='model'||key==='series'||key==='tier');visible(axisNode,key==='model'||key==='tier');
    visible(researchPanel,key!=='model');visible($('trackerExport'),key==='model');
    visible($('researchGroupControls'),['series','generation','structure'].includes(key));
    visible($('researchTierControls'),key==='tier');
    visible($('researchTopControls'),usesTopK(key));
    visible($('researchHeadControls'),key==='head');visible($('researchCoverageControls'),key==='coverage');visible($('researchDualControls'),key==='dual');
    visible($('researchBrandControls'),key==='brand');
    $('researchTopCustom').hidden=$('researchTopMode').value!=='custom';
    visible($('researchTailControls'),key==='tail');visible($('researchFlowControls'),key==='flow');visible($('researchPriceControls'),key==='price');visible($('researchPositionControls'),key==='position');visible($('researchChipControls'),key==='chip');visible($('researchAgeControls'),key==='age');visible($('researchCrossControls'),key==='cross');
    if(key==='model'){trackerOptions();renderTracker();}else {syncResearchEditors();renderResearch();}
  }
  function topicSection(host,label,gridClass){
    const section=document.createElement('section'),heading=document.createElement('h4'),grid=document.createElement('div');
    heading.className='topic-category-title';heading.textContent=label;grid.className=gridClass;
    if(gridClass==='research-topic-grid')grid.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:8px';
    section.append(heading,grid);host.append(section);return grid;
  }
  for(const category of researchCategories){
    const grid=topicSection(researchNav,category.label,'research-topic-grid');
    for(const id of category.keys){
      const b=document.createElement('button');b.type='button';b.textContent=researchViews[id];b.className='secondary';b.setAttribute('aria-pressed','false');b.onclick=()=>setResearchView(id);researchButtons[id]=b;grid.append(b);
    }
  }
  let researchExportRows=[],researchPublicationChart=null,researchPublicationTable=null;
  function researchTable(headers,rows){
    researchPublicationTable={headers:[...headers],rows:rows.map(r=>[...r])};
    const p=readTrackerParams();const rawView=isRawResearch(researchView);const meta=['榜单口径','统计起始周','统计结束周','最低覆盖率%','覆盖率分母','数据模式','插补方法','最大缺失周','允许整周插补','允许末周估算'];const values=[p.scopeId,p.start,p.end,rawView?'不适用':p.coverage,rawView?'不适用':p.coverageBase,rawView?'raw':p.dataMode,rawView||p.dataMode==='raw'?'不适用':p.method,rawView||p.dataMode==='raw'?'不适用':p.maxGap,rawView||p.dataMode==='raw'?'不适用':String(p.missingBoard),rawView||p.dataMode==='raw'?'不适用':String(p.trailing)];const scope=currentScope(),isTop=usesTopK(researchView),isGroup=['series','generation','structure'].includes(researchView);meta.push('时间序列算法版本','机型主数据版本指纹','榜单样本模式','固定TOP K','机型分组定义','产品属性筛选','成员统计口径');values.push(Series.VERSION,masterCatalog?.revision||'',isTop?(topKValue()===null?'all':'fixed'):'不适用',isTop&&topKValue()!==null?String(topKValue()):'',isGroup&&scope?JSON.stringify(activeGroups(scope)):'',filterTopics.has(researchView)?JSON.stringify(filters()):'',isGroup?(observedGroups(researchView)?'当期原始入榜':'固定成员'):'');if(researchView==='brand'){meta.push('品牌研究视图','品牌统计维度','基准周','对比周','集中度指标');const view=$('brandView').value;values.push(view,view==='concentration'?'sales':$('brandMetric').value,view==='ribbon'?$('brandBase').value:'',view==='ribbon'?$('brandCompare').value:'',view==='concentration'?$('brandCon').value:'');}if(researchView==='flow'){meta.push('新品完整周门槛');values.push($('researchNewWeeks').value);}if(researchView==='tier'){meta.push('对齐横轴');values.push(lifeMode()?'lifecycle':'calendar');}if(researchView==='tail'){meta.push('长尾展示方式','最少连续上榜周');values.push($('researchTailView').value,$('researchStreak').value);}if(attributeTopics.has(researchView)){meta.push('属性专题配置');values.push(JSON.stringify(attributeSettings(researchView)));}if(researchView==='dual'){const multi=$('dualView').value==='multi';meta.push('双图榜单口径','双图展示方式','双图基准周','双图对比周','其他品牌处理','pp极值判定');values.push('原始排名固定TOP30',multi?'多周堆叠流向图':'双周流向图',multi?'':$('dualBase').value,multi?'':$('dualCompare').value,'两图保持原始分母，其他不绘制',multi?'不显示pp及极值高亮':'显示一位小数，允许并列');}if(researchView==='coverage'){meta.push('覆盖率榜单口径','苹果入榜率情景/%','环比偏差假设');values.push('原始排名TOP30',$('coverageRates').value,'苹果入榜率跨周不变，仅比较相邻有效自然周');}researchExportRows=[[...meta,...headers],...rows.map(r=>[...values,...r])];
    $('researchHead').innerHTML='<tr>'+headers.map(h=>'<th>'+e(h)+'</th>').join('')+'</tr>';
    $('researchRows').innerHTML=rows.length?rows.map(r=>'<tr>'+r.map(v=>'<td>'+e(v)+'</td>').join('')+'</tr>').join(''):'<tr><td colspan="'+headers.length+'">暂无符合条件的数据</td></tr>';
    $('researchExport').disabled=!rows.length;
  }
  const numberText=(v,d=2)=>v==null?'':Number(v).toFixed(d);
  // Chart points are explicit nullable observations; no missing value is replaced with zero.
  function researchPlot(weeks,lines,unit,limit){
    researchPublicationChart={periods:weeks.map(w=>w.period),lines:lines.map((l,i)=>({name:l.name,color:l.color||trackerPalette[i%trackerPalette.length],values:[...l.values],imputed:l.imputed?[...l.imputed]:[]})),unit,limit};
    ResearchCharts.svgLine($('researchChart'),$('researchLegend'),researchPublicationChart,researchViews[researchView]);
  }
  // Session-local, per-source/series editors. No model registry or extra CSV input.
  const groupStates=new Map(safeEntries(storedResearch.groups).filter(([,v])=>Array.isArray(v)&&v.every(g=>g&&typeof g.name==='string'&&Array.isArray(g.keys)&&g.keys.every(k=>typeof k==='string'))));
  const pairStates=new Map(safeEntries(storedResearch.pairs).filter(([,v])=>Array.isArray(v)&&v.every(p=>p&&typeof p.name==='string'&&typeof p.old==='string'&&typeof p.next==='string')));
  const pairFocusStates=new Map(safeEntries(storedResearch.pairFocus).filter(([,v])=>Number.isInteger(v)&&v>=0));
  function knownModels(scope){
    const known=new Map();for(const w of scope.fullWeeks)for(const [k,r] of w.map)known.set(k,canonicalName(r[col.model]));return known;
  }
  function entriesFor(scope,raw=false){
    return raw?[...knownModels(scope).keys()].map(key=>({key,model:masterCatalog?.get(key)||null})):scope.models.map(m=>({key:m.key,model:m.master||null}));
  }
  function predecessorPreset(scope){
    const known=knownModels(scope);
    return (masterCatalog?.models||[]).filter(m=>m.predecessor_id&&known.has(m.model_id)&&m.predecessor_id!==m.model_id&&matchesAttributes(m.model_id)).map(m=>({name:m.model_name+' / 上一代',old:m.predecessor_id,next:m.model_id}));
  }
  function fillGenerationChoices(scope){
    const select=$('researchGenerationPair'),prior=select.value;select.replaceChildren();
    for(const pair of predecessorPreset(scope)){const o=document.createElement('option');o.value=pair.next;o.textContent=(masterCatalog?.get(pair.old)?.model_name||pair.old)+' → '+(masterCatalog?.get(pair.next)?.model_name||pair.next);select.append(o);}
    if([...select.options].some(o=>o.value===prior))select.value=prior;select.disabled=!select.options.length;
  }
  function generationPreset(scope){
    const pairs=predecessorPreset(scope),pair=pairs.find(p=>p.next===$('researchGenerationPair').value)||pairs[0];if(!pair)return [];
    const a=masterCatalog?.get(pair.old),b=masterCatalog?.get(pair.next),known=knownModels(scope);
    if($('researchGenerationLevel').value==='series'&&a&&b&&a.brand===b.brand&&a.series&&b.series&&a.series!==b.series)return [a,b].map(m=>({name:Product.value(m,'series'),keys:masterCatalog.getSeries(m.brand,m.series).filter(v=>known.has(v.model_id)||v.model_id===m.model_id).map(v=>v.model_id)}));
    return [{name:a?.model_name||pair.old,keys:[pair.old]},{name:b?.model_name||pair.next,keys:[pair.next]}];
  }
  function groupPreset(scope){return researchView==='generation'?generationPreset(scope):Product.groups(entriesFor(scope,observedGroups(researchView)),groupField(),filters());}
  function groupStateKey(scope,view=researchView){return JSON.stringify([scope.id,view]);}
  function activeGroups(scope){
    const key=groupStateKey(scope);
    if(observedGroups(researchView))return groupPreset(scope);
    if(!groupStates.has(key))groupStates.set(key,groupPreset(scope));
    return groupStates.get(key);
  }
  function activePairs(scope){
    if(!pairStates.has(scope.id))pairStates.set(scope.id,predecessorPreset(scope));
    return pairStates.get(scope.id);
  }
  function labeledControl(label,control){const wrap=document.createElement('label');wrap.className='lbl';wrap.textContent=label;wrap.append(control);return wrap;}
  function smallButton(label,action){const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent=label;b.onclick=action;return b;}
  function inputField(value,placeholder){const input=document.createElement('input');input.className='field ui-field';input.value=value;input.placeholder=placeholder;return input;}
  function editorCard(){const d=document.createElement('div');d.style.cssText='border:1px solid var(--ui-border,#dbe2ea);border-radius:10px;padding:12px;margin:8px 0';return d;}
  function renderGroupEditor(scope){
    const host=$('researchGroupEditor'),groups=activeGroups(scope),known=knownModels(scope),eligible=new Set(scope.models.map(m=>m.key));
    host.replaceChildren();
    if(observedGroups(researchView))return;
    groups.forEach((g,index)=>{
      const box=editorCard(),head=document.createElement('div'),name=inputField(g.name,'分组名称');
      head.style.cssText='display:flex;gap:8px;align-items:center';name.setAttribute('aria-label','分组名称 '+(index+1));
      name.onchange=()=>{g.name=name.value.trim();renderResearch();};
      head.append(name,smallButton('删除',()=>{groups.splice(index,1);renderGroupEditor(scope);renderResearch();}));box.append(head);
      const chosen=document.createElement('div');chosen.style.cssText='display:flex;gap:6px;flex-wrap:wrap;margin:8px 0';
      for(const key of g.keys){
        const label=(known.get(key)||masterCatalog?.get(key)?.model_name||key)+(eligible.has(key)?'':'（当前不可用）');
        chosen.append(smallButton(label+' ×',()=>{g.keys=g.keys.filter(k=>k!==key);renderGroupEditor(scope);renderResearch();}));
      }
      if(!g.keys.length)chosen.textContent='尚未选择机型';box.append(chosen);
      const filter=inputField('','搜索标准名称 / 别名 / ID'),pool=document.createElement('div');
      filter.setAttribute('aria-label','搜索分组机型');pool.style.cssText='max-height:160px;overflow:auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:5px;padding:8px 0';
      const drawPool=()=>{
        pool.replaceChildren();const q=normalize(filter.value);
        const entries=[...known].filter(([k,name])=>matchesAttributes(k)&&matchesModel(k,name,q)).sort((a,b)=>a[1].localeCompare(b[1],'zh-CN'));
        for(const [k,display] of entries){
          const label=document.createElement('label'),cb=document.createElement('input');
          cb.type='checkbox';cb.checked=g.keys.includes(k);
          const other=groups.find(h=>h!==g&&h.keys.includes(k));
          cb.disabled=!cb.checked&&(!!other||!eligible.has(k));
          cb.onchange=()=>{if(cb.checked&&!groups.some(h=>h!==g&&h.keys.includes(k)))g.keys.push(k);else g.keys=g.keys.filter(v=>v!==k);renderGroupEditor(scope);renderResearch();};
          label.append(cb,document.createTextNode(' '+display+(other?'（已分配：'+other.name+'）':eligible.has(k)?'':'（覆盖率/区间不可用）')));pool.append(label);
        }
      };
      filter.oninput=drawPool;drawPool();box.append(filter,pool);host.append(box);
    });
  }
  function pairSelect(known,eligible,value,aria){
    const s=document.createElement('select');s.className='field ui-field';s.setAttribute('aria-label',aria);
    const empty=document.createElement('option');empty.value='';empty.textContent='选择机型';s.append(empty);
    const entries=[...known].filter(([k])=>k===value||matchesAttributes(k)).sort((a,b)=>a[1].localeCompare(b[1],'zh-CN'));
    if(value&&!entries.some(([k])=>k===value))entries.unshift([value,masterCatalog?.get(value)?.model_name||value]);
    for(const [k,n] of entries){const o=document.createElement('option');o.value=k;o.textContent=n+(eligible.has(k)?'':'（当前无可用序列）');o.disabled=!eligible.has(k)&&k!==value;s.append(o);}
    s.value=value||'';return s;
  }
  function renderPairEditor(scope){
    const host=$('researchPairEditor'),pairs=activePairs(scope),known=knownModels(scope),eligible=new Set(scope.models.map(m=>m.key)),focus=$('researchPairFocus');
    host.replaceChildren();focus.replaceChildren();
    pairs.forEach((p,i)=>{
      const box=editorCard(),grid=document.createElement('div'),name=inputField(p.name,'档位名称'),old=pairSelect(known,eligible,p.old,'旧代机型'),next=pairSelect(known,eligible,p.next,'新代机型');
      grid.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px';
      const change=()=>{p.name=name.value.trim();p.old=old.value;p.next=next.value;renderPairEditor(scope);renderResearch();};
      name.onchange=change;old.onchange=change;next.onchange=change;
      grid.append(labeledControl('产品档位',name),labeledControl('旧代',old),labeledControl('新代',next));
      box.append(grid,smallButton('删除档位',()=>{pairs.splice(i,1);pairFocusStates.delete(scope.id);renderPairEditor(scope);renderResearch();}));host.append(box);
      const o=document.createElement('option');o.value=String(i);o.textContent=p.name||'档位 '+(i+1);focus.append(o);
    });
    const current=pairFocusStates.get(scope.id);
    const preferred=pairs.findIndex(p=>p.old&&p.next&&p.old!==p.next&&eligible.has(p.old)&&eligible.has(p.next));
    focus.value=String(Number.isInteger(current)&&current>=0&&current<pairs.length?current:Math.max(0,preferred));
    focus.disabled=!pairs.length;
  }
  function researchGroups(scope,c){
    const models=new Map(scope.models.map(m=>[m.key,m])),known=knownModels(scope),used=new Set(),groups=[],issues=[],names=new Set();
    for(const g of activeGroups(scope)){
      const name=g.name.trim(),keys=[...new Set(g.keys)];
      if(!name||!keys.length){issues.push('存在未命名或空分组，不参与统计');continue;}
      if(names.has(name)||keys.some(k=>used.has(k))){issues.push(name+'：组名或机型重复，不参与统计');continue;}
      names.add(name);keys.forEach(k=>used.add(k));
      if(observedGroups(researchView)){
        groups.push({name,keys,values:scope.weeks.map(w=>!w.hasBoard?null:keys.reduce((sum,k)=>sum+(w.map.has(k)?Number(w.map.get(k)[col.estimated_wan]):0),0)),imputed:scope.weeks.map(()=>false)});
        continue;
      }
      const missing=keys.filter(k=>!models.has(k));
      if(missing.length)issues.push(name+'：'+missing.map(k=>known.get(k)||k).join('、')+' 当前不可用；整组留空，不缩减样本');
      const per=keys.map(k=>scope.rows.filter(r=>r[c.sequence_id]===k));
      groups.push({name,keys,values:scope.weeks.map((w,i)=>per.some(p=>!p[i]||p[i][c.weekly_wan]==='')?null:per.reduce((sum,p)=>sum+Number(p[i][c.weekly_wan]),0)),imputed:scope.weeks.map((w,i)=>per.some(p=>p[i]?.[c.is_imputed]==='1'))});
    }
    $('researchGroupInfo').textContent=groups.map(g=>g.name+'：'+g.keys.map(k=>known.get(k)||k).join('、')).concat(issues).join('；');
    return groups;
  }
  function topKValue(){
    const mode=$('researchTopMode').value;if(mode==='all')return null;
    const n=Number(mode==='custom'?$('researchTopK').value:mode);
    return Number.isSafeInteger(n)&&n>=1&&n<=10000?n:NaN;
  }
  function fixedTopWeeks(weeks,k){
    return weeks.map(w=>{
      if(k===null)return {...w,valid:w.hasBoard,originalCount:w.count,comparisonStatus:w.hasBoard?'原始全量':'无榜单'};
      const entries=[...w.map].filter(([,r])=>Number(r[col.rank])>=1&&Number(r[col.rank])<=k);
      const valid=w.hasBoard&&entries.length===k&&new Set(entries.map(([,r])=>Number(r[col.rank]))).size===k;
      const last=valid?entries.find(([,r])=>Number(r[col.rank])===k):null;
      return {...w,originalCount:w.count,valid,hasBoard:valid,map:new Map(valid?entries:[]),count:valid?k:null,cutoff:last?Number(last[1][col.estimated_wan]):null,comparisonStatus:valid?'可比较':w.hasBoard?'前 K 名不完整':'无榜单'};
    });
  }
  function renderTierComparison(scope,c){
    const weeks=scope.weeks,known=knownModels(scope),pairs=activePairs(scope),metric=$('trackerMode').value,focus=Number($('researchPairFocus').value),life=lifeMode();
    const metricName=life?lifeMetric(metric):metric==='cumulative_wan'?'区间累计增量':'周销量增量';
    $('researchDesc').textContent=life?'按各机型正式开售后的完整销售周对齐。P0 排除；累计仅从 W1 连续有效观测起算，允许当前设置下的插补，不向历史前回填。双边缺失不计算比较。':'按相同自然周比较旧代与新代，不推断用户换机；双边有效才计算差值、倍数及贡献率。';
    const records=[],issues=[],eligible=new Set(scope.models.map(m=>m.key));
    const series=key=>({key,name:known.get(key)||masterCatalog?.get(key)?.model_name||key||'未选择',rows:seriesRows(scope,c,key)});
    pairs.forEach((p,i)=>{
      const name=p.name.trim()||'档位 '+(i+1),old=series(p.old),next=series(p.next),distinct=p.old&&p.next&&p.old!==p.next;
      if(!distinct)issues.push(name+'：请选择不同的新旧代机型');
      else if(!eligible.has(p.old)||!eligible.has(p.next))issues.push(name+'：部分机型当前无可用序列');
      let axis,points,chart;
      if(life){
        const maps=lifeMaps(scope,[old,next],c,metric);axis=Product.lifecycleAxis(maps);
        chart=lifeChart([old,next],maps,axis);
        points=maps.map(m=>axis.map(n=>m.get(n)||{value:null,period:'',imputed:false}));
        if(!masterCatalog?.get(p.old)?.sale_start_date||!masterCatalog?.get(p.next)?.sale_start_date)issues.push(name+'：缺少开售日期');
      }else{
        axis=weeks.map(w=>w.period);points=[old,next].map(o=>curvePoints(o.rows,c,metric).map((v,j)=>({...v,period:axis[j]})));
        chart={periods:axis,unit:'万台',lines:[old,next].map((o,j)=>({name:o.name,color:trackerPalette[j],values:points[j].map(v=>v.value),imputed:points[j].map(v=>v.imputed)}))};
      }
      if(i===focus&&distinct){researchPublicationChart=chart;ResearchCharts.svgLine($('researchChart'),$('researchLegend'),chart,researchViews[researchView]);}
      let comparable=0;
      axis.forEach((w,j)=>{const a=points[0][j],b=points[1][j],x=a.value,y=b.value,ok=!!distinct&&x!==null&&y!==null;if(ok)comparable++;
        records.push([name,life?'W'+w:w,old.name,next.name,a.period||'',b.period||'',metricName,numberText(x,4),numberText(y,4),numberText(ok?y-x:null,4),numberText(ok&&x>0?y/x:null,3),numberText(ok&&x+y>0?100*y/(x+y):null),!distinct?'机型未配置或重复':!ok?'缺少可比数据':a.imputed||b.imputed?'含插补':'原始观测']);
      });
      if(distinct&&!comparable)issues.push(name+'：没有双边有效的'+(life?'完整销售周':'自然周'));
    });
    $('researchPairInfo').textContent=issues.join('；');
    researchTable(['档位','周期','旧代机型','新代机型','旧代自然周','新代自然周','统计指标','旧代销量/万台','新代销量/万台','新旧销量差/万台','新代/旧代倍数','新代贡献率/%','数据状态'],records);
    $('researchNotice').textContent=pairs.length+' 个档位 · '+(life?'完整销售周同期':'自然周同期')+' · 图表展示选定档位；CSV 包含全部档位。空值不代表零。';
  }

  // Cross-module analysis uses the same validated parent-brand parser as module 2.
  const headBrands=window.BrandUtils.groups.map(g=>g.key);
  const headMarketKeys=window.BrandUtils.groups.filter(g=>g.id!=='other').map(g=>g.id);
  const headViews={distribution:'品牌销量分布对比',enrichment:'头部销量富集指数（HSCR）',strength:'单品销量强度指数',matrix:'品牌双指标四象限',trend:'头部效应历史趋势',concentration:'品牌集中度差异'};
  let marketCache=null,marketError='',marketPending=null,headPublicationInfo=null,coveragePublicationInfo=null,dualPublicationInfo=null;
  function ensureMarketData(force=false){
    if(marketPending)return marketPending;
    if(marketCache&&!force)return Promise.resolve(marketCache);
    marketCache=null;marketError='';
    marketPending=(async()=>{
      try{
        const res=await fetch('market-share.csv?t='+Date.now(),{cache:'no-store'});
        if(!res.ok)throw Error('HTTP '+res.status);
        const content=window.MarketShareData.decodeCSV(await res.arrayBuffer());
        marketCache=window.MarketShareData.parseMarketShareCSV(content,window.IsoSalesWeek.isoWeekMonday);
        return marketCache;
      }catch(err){marketError='全市场 CSV 读取或口径校验失败：'+err.message;return null;}
      finally{marketPending=null;if(['head','coverage','dual'].includes(researchView))renderResearch();}
    })();
    return marketPending;
  }
  const headMean=xs=>xs.length?xs.reduce((s,v)=>s+v,0)/xs.length:null;
  const headRatio=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&b>0?a/b:null;
  const headDiff=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)?a-b:null;
  function brandConcentration(shares){
    if(!shares)return {cr1:null,cr3:null,cr5:null,hhi:null};
    const sorted=[...shares].sort((a,b)=>b-a),cr=n=>sorted.slice(0,n).reduce((a,b)=>a+b,0);
    return {cr1:cr(1),cr3:cr(3),cr5:cr(5),hhi:shares.reduce((a,b)=>a+b*b,0)};
  }
  // Accept fixedTopWeeks output; neither imputation nor coverage filtering is involved.
  function aggregateBoardBrands(weeks){
    return weeks.map(w=>{
      const sales=Object.fromEntries(boardBrandOrder.map(k=>[k,0])),counts={...sales};
      const unknown=[];let badSales=false;
      if(w.valid)for(const r of w.map.values()){
        const brand=classifyHeadBrand(r),raw=r[col.estimated_wan],v=Number(raw);
        if(!brand||!Object.prototype.hasOwnProperty.call(sales,brand)){unknown.push(r[col.model]);continue;}
        if(raw==null||String(raw).trim()===''||!Number.isFinite(v)||v<0){badSales=true;continue;}
        sales[brand]+=v;counts[brand]++;
      }
      const total=Object.values(sales).reduce((a,b)=>a+b,0),count=Object.values(counts).reduce((a,b)=>a+b,0);
      const valid=!!w.valid&&!unknown.length&&!badSales&&count>0;
      const shares=valid&&total>0?boardBrandOrder.map(k=>100*sales[k]/total):null;
      const countShares=valid?boardBrandOrder.map(k=>100*counts[k]/count):null;
      const status=!w.valid?w.comparisonStatus:unknown.length?'未识别品牌：'+unknown.join('、'):badSales?'榜单销量无效':!count?'无有效记录':total===0?'销量总和为零，销量占比不可算':w.comparisonStatus;
      return {...w,valid,sales,counts,count:valid?count:null,total:valid?total:null,shares,countShares,...brandConcentration(shares),status};
    });
  }
  function headCompareWeeks(weeks,marketRows){
    const markets=new Map(marketRows.map(r=>[r.week.replace('W','-W'),r]));
    return aggregateBoardBrands(weeks).map(w=>{
      const market=markets.get(w.period),marketShares=market?[...headMarketKeys.map(k=>market.brands[k]),market.other]:null;
      const topShares=w.shares,boardValid=!!topShares,comparable=boardValid&&!!market;
      const status=!boardValid?w.status:!market?'缺少同周全市场份额':'可比较';
      return {period:w.period,originalCount:w.originalCount,usedCount:boardValid?w.count:null,marketShares,topShares,countShares:boardValid?w.countShares:null,counts:boardValid?headBrands.map(k=>w.counts[k]):null,total:boardValid?w.total:null,comparable,status,topCon:topShares?brandConcentration(topShares):null,marketCon:marketShares?brandConcentration(marketShares):null};
    });
  }
  function headSummarize(records){
    const valid=records.filter(r=>r.comparable);
    if(!valid.length)return [];
    return headBrands.map((brand,i)=>{
      const top=headMean(valid.map(r=>r.topShares[i])),market=headMean(valid.map(r=>r.marketShares[i])),countShare=headMean(valid.map(r=>r.countShares[i]));
      return {brand,top,market,countShare,count:headMean(valid.map(r=>r.counts[i])),gap:headDiff(top,market),enrichment:headRatio(top,market),strength:headRatio(top,countShare)};
    });
  }
  // Structured chart data is also used by the existing Canvas poster studio.
  function drawHeadStatic(kind,categories,lines,unit,baseline){
    researchPublicationChart={kind,periods:categories,unit,baseline,lines:lines.map((l,i)=>({name:l.name,color:l.color||trackerPalette[i%trackerPalette.length],values:[...l.values],imputed:[]}))};
    ResearchCharts.renderComposition($('researchChart'),researchPublicationChart,headViews[$('headView').value]);
    if(kind==='scatter')categories.forEach((name,i)=>{const span=document.createElement('span');span.style.color=window.BrandUtils.color(name)||trackerPalette[i%trackerPalette.length];const x=lines[0].values[i],y=lines[1].values[i];span.textContent=name+'：'+(Number.isFinite(x)&&Number.isFinite(y)?numberText(x)+' / '+numberText(y):'不可计算');$('researchLegend').append(span);});
  }
  function renderHeadMarket(scope,weeks){
    headPublicationInfo=null;
    const notice=$('researchNotice'),mode=$('headView').value,info=$('headDataInfo');
    $('headBrandControl').hidden=mode!=='trend';$('headTrendControl').hidden=mode!=='trend';$('headConcentrationControl').hidden=mode!=='concentration';
    $('researchDesc').textContent='同一 ISO 自然周、同一母品牌口径比较；仅双方有效的周纳入平均。不使用插补。榜单占比与市场份额来源不同，指数为相对代表性，不是品牌榜外实际销量。';
    if(!marketCache){
      info.textContent=marketError||'正在读取模块2全市场份额…';
      notice.textContent=marketError?'请修正数据或点击重新读取。':'等待全市场 CSV';
      if(!marketPending&&!marketError)ensureMarketData();
      return;
    }
    const records=headCompareWeeks(weeks,marketCache),valid=records.filter(r=>r.comparable),summary=headSummarize(records);
    const sampleMode=topKValue()===null?'原始全量':'固定 TOP'+topKValue();
    const common=valid.map(r=>r.period),range=common.length?common[0]+'—'+common[common.length-1]:'无共同有效周';
    info.textContent='全市场 CSV：'+marketCache.length+' 周 · '+sampleMode+' · 共同有效 '+valid.length+' / '+weeks.length+' 周 · '+range;
    notice.textContent=info.textContent+'。区间均值为共同有效周的等权算术平均；不按销量加权。';
    const fmt=numberText,rows=[];
    for(const s of summary)rows.push(['共同有效周均值',range,'可比较',valid.length,'',s.brand,fmt(s.count),fmt(s.countShare),fmt(s.top),fmt(s.market),fmt(s.gap),fmt(s.enrichment,4),fmt(s.strength,4),fmt(headMean(valid.map(r=>r.topCon.cr3))),fmt(headMean(valid.map(r=>r.marketCon.cr3))),fmt(headMean(valid.map(r=>r.topCon.hhi))),fmt(headMean(valid.map(r=>r.marketCon.hhi)))]);
    for(const r of records)headBrands.forEach((brand,i)=>{
      const t=r.topShares?.[i]??null,m=r.marketShares?.[i]??null,c=r.countShares?.[i]??null;
      // Keep independent observations visible even for an unmatched week; no cross-source indices.
      rows.push(['逐周',r.period,r.status,r.originalCount,r.usedCount??'',brand,r.counts?.[i]??'',fmt(c),fmt(t),fmt(m),fmt(r.comparable?headDiff(t,m):null),fmt(r.comparable?headRatio(t,m):null,4),fmt(r.comparable?headRatio(t,c):null,4),fmt(r.topCon?.cr3),fmt(r.marketCon?.cr3),fmt(r.topCon?.hhi),fmt(r.marketCon?.hhi)]);
    });
    researchTable(['统计层级','周期','比较状态','原始条数/共同周数','使用条数','品牌组','上榜条目数','条目占比/%','榜单销量占比/%','全市场份额/%','差值/pp','头部富集指数','单品强度指数','榜单CR3/%','市场CR3/%','榜单HHI','市场HHI'],rows);
    if(!valid.length)return;
    const cats=summary.map(s=>s.brand);
    if(mode==='distribution')drawHeadStatic('bars',cats,[{name:'榜单销量占比',values:summary.map(s=>s.top),color:'#2563eb'},{name:'全市场份额',values:summary.map(s=>s.market),color:'#94a3b8'}],'%',null);
    else if(mode==='enrichment'||mode==='strength')drawHeadStatic('bars',cats,[{name:headViews[mode],values:summary.map(s=>s[mode])}],'倍',1);
    else if(mode==='matrix')drawHeadStatic('scatter',cats,[{name:'头部销量富集指数',values:summary.map(s=>s.enrichment)},{name:'单品销量强度指数',values:summary.map(s=>s.strength)}],'指数',1);
    else if(mode==='trend'){
      const i=headBrands.indexOf($('headBrand').value),index=$('headTrendMetric').value==='index';
      const lines=index?[{name:'头部富集指数',values:records.map(r=>r.comparable?headRatio(r.topShares[i],r.marketShares[i]):null)},{name:'单品强度指数',values:records.map(r=>r.comparable?headRatio(r.topShares[i],r.countShares[i]):null)}]:[{name:'榜单销量占比',values:records.map(r=>r.comparable?r.topShares[i]:null)},{name:'全市场份额',values:records.map(r=>r.comparable?r.marketShares[i]:null)}];
      researchPlot(weeks,lines,index?'指数':'%',index?undefined:100);
    }else if(mode==='concentration'){
      const key=$('headConcentration').value,unit=key==='cr3'?'CR3 / %':'共同品牌组 HHI';
      researchPlot(weeks,[{name:'榜单 '+key.toUpperCase(),values:records.map(r=>r.comparable?r.topCon[key]:null)},{name:'全市场 '+key.toUpperCase(),values:records.map(r=>r.comparable?r.marketCon[key]:null)}],unit,key==='cr3'?100:10000);
    }
    const metricLabel=headViews[mode]+(mode==='trend'?' · '+$('headBrand').value+' · '+($('headTrendMetric').value==='index'?'指数':'份额'):mode==='concentration'?' · '+$('headConcentration').value.toUpperCase():'');
    const note=mode==='concentration'?'其他品牌合为一组，CR3/HHI为共同七组口径，不是逐品牌精确市场集中度。':mode==='matrix'?'横轴：头部富集指数；纵轴：单品强度；1 为基准，象限不直接判断品牌策略。':mode==='enrichment'?'头部富集 = 榜单销量占比 ÷ 全市场份额；1 为基准。':mode==='strength'?'单品强度 = 榜单销量占比 ÷ 上榜条目占比；1 为基准。':'仅共同有效周；榜单样本份额不等于全市场份额。';
    headPublicationInfo={range,effectivePeriods:common,metricLabel,note,detail:info.textContent+'；'+note+'；全市场数据沿用模块2母品牌口径。'};
    $('researchDesc').textContent+=' '+note+' 其他品牌为合并组；指数分母为零时留空，四象限不显示无有效双指标的品牌。';
  }
  for(const id of ['headView','headBrand','headTrendMetric','headConcentration'])$(id).onchange=renderResearch;
  $('headReload').onclick=()=>ensureMarketData(true);




  // Fixed TOP30 and module-2 shares are never mixed in the denominator.
  let dualWeekScope='';
  function fillDualWeeks(scope){
    const periods=scope.weeks.map(w=>w.period),identity=scope.id+'|'+periods.join(',');
    if(dualWeekScope===identity)return;
    const prevScope=dualWeekScope.split('|')[0],same=prevScope===scope.id,
          previousBase=$('dualBase').value,previousCompare=$('dualCompare').value;
    dualWeekScope=identity;
    const eligible=fixedTopWeeks(scope.weeks,30).filter(w=>w.valid).map(w=>w.period);
    const defaults=eligible.length>=2?eligible.slice(-2):periods.slice(-2),
          saved=scopeSettings.get(scope.id)||{};
    for(const id of ['dualBase','dualCompare']){
      const select=$(id);select.replaceChildren();
      periods.forEach(period=>{
        const option=document.createElement('option');option.value=period;option.textContent=period;select.append(option);
      });
    }
    const base=same&&periods.includes(previousBase)?previousBase:periods.includes(saved.dualBase)?saved.dualBase:defaults[0],
          compare=same&&periods.includes(previousCompare)?previousCompare:periods.includes(saved.dualCompare)?saved.dualCompare:defaults[1];
    $('dualBase').value=base||periods[0]||'';
    $('dualCompare').value=compare||periods.at(-1)||'';
  }

  function renderDualMarketMulti(scope){
    const info=$('dualDataInfo'),notice=$('researchNotice'),groups=window.BrandUtils.groups.filter(g=>g.id!=='other');
    const periods=scope.weeks.map(w=>w.period);
    $('researchDesc').textContent='多周堆叠流向：上下分别为TOP30原始榜单和模块2全市场份额，每周一根柱，相邻有效周以同品牌半透明带连接。不展示变化(pp)列，未绘出的其他品牌仍保留在分母中；缺失周留空且连接中断。';
    if(!marketCache){
      info.textContent=marketError||'正在读取模块2全市场份额…';
      notice.textContent=marketError?'全市场CSV读取失败，可点击重新读取。':'等待模块2市场份额CSV';
      if(!marketPending&&!marketError)ensureMarketData();
      return;
    }
    const topWeeks=aggregateBoardBrands(fixedTopWeeks(scope.weeks,30)),
          topMap=new Map(topWeeks.map(w=>[w.period,w])),
          marketMap=new Map(marketCache.map(m=>[m.week.replace('W','-W'),m]));
    const panels=[
      {key:'top',title:'TOP30 榜单品牌结构流向',subtitle:'原始榜单排名1–30名 · 样本销量占比'},
      {key:'market',title:'全市场品牌份额流向',subtitle:'模块2 market-share.csv · 品牌份额'}
    ].map(panel=>{
      const weeks=periods.map(period=>{
        const t=topMap.get(period),m=marketMap.get(period);
        const valid=panel.key==='top'?!!t?.valid&&t.total>0:!!m&&groups.every(g=>Number.isFinite(m.brands[g.id]));
        const reason=valid?'可比较':panel.key==='top'?(t?.status||'没有完整TOP30'):!m?'缺少同周市场份额':'全市场品牌份额不可用';
        return {period,valid,reason,originalCount:panel.key==='top'?t?.originalCount??'':'',
          total:panel.key==='top'&&valid?t.total:null,
          series:valid?groups.map(g=>({key:g.key,label:g.label,color:g.color,share:panel.key==='top'?100*t.sales[g.key]/t.total:m.brands[g.id],
            units:panel.key==='top'?t.sales[g.key]:null})) :[]};
      });
      return {...panel,weeks};
    });
    const lines=panels.flatMap(panel=>groups.map(g=>({
      name:(panel.key==='top'?'TOP30':'全市场')+' · '+g.label,
      color:g.color,values:panel.weeks.map(w=>w.valid?w.series.find(s=>s.key===g.key).share:null),
      imputed:periods.map(()=>false)
    })));
    const rows=panels.flatMap(panel=>panel.weeks.flatMap(w=>groups.map(g=>{
      const s=w.series.find(v=>v.key===g.key);
      return [panel.key==='top'?'TOP30样本':'全市场',w.period,w.reason,w.originalCount,g.label,
        numberText(s?.units,4),numberText(s?.share),numberText(w.total,4)];
    })));
    researchTable(['口径','周期','周数据状态','原始榜单实收条数','品牌组','品牌TOP30销量/万台','品牌份额/%','TOP30总销量/万台'],rows);
    const topValid=panels[0].weeks.filter(w=>w.valid).length,marketValid=panels[1].weeks.filter(w=>w.valid).length,
          effective=periods.filter((period,i)=>panels.some(panel=>panel.weeks[i].valid));
    info.textContent=periods.length+' 自然周 · TOP30 '+topValid+' 周有效 · 全市场 '+marketValid+' 周有效';
    notice.textContent=info.textContent+'；缺失周不插补；相邻两周有缺失时不连接色带；不显示变化pp列。';
    if(!effective.length)return;
    const chart={kind:'dualBrandFlowMulti',periods,unit:'%',panels,lines,calendarPeriods:effective};
    researchPublicationChart=chart;
    ResearchCharts.renderComposition($('researchChart'),chart,'TOP30与全市场多周堆叠流向图');
    const note='多周固定完整TOP30，六大品牌份额保留各自原始分母；相邻有效周的色带只连接同品牌，不表示销量转移；无变化pp列。';
    dualPublicationInfo={range:periods[0]+'—'+periods.at(-1),effectivePeriods:effective,
      metricLabel:'TOP30 vs 全市场多周堆叠流向',note,detail:notice.textContent+'；'+note};
    $('researchDesc').textContent+=' '+note;
  }

  function renderDualMarket(scope){
    dualPublicationInfo=null;
    const info=$('dualDataInfo'),notice=$('researchNotice');
    fillDualWeeks(scope);
    const multi=$('dualView').value==='multi';
    visible($('dualBaseWrap'),!multi);visible($('dualCompareWrap'),!multi);
    visible($('dualRangeHint'),multi);
    if(multi){renderDualMarketMulti(scope);return;}
    const base=$('dualBase').value,compare=$('dualCompare').value;
    $('researchDesc').textContent='上图：原始排名完整TOP30的品牌销量占比；下图：模块2全市场品牌份额。相同母品牌、顺序和颜色；六大品牌之外的“其他”未绘制且不重新归一化。变化单位为百分点，淡红/淡绿仅标识本图最大上涨/最大下跌（显示值并列则都标识）。';
    if(!base||!compare||base===compare){
      notice.textContent='请选择两个不同的自然周作为基准周和对比周。';
      info.textContent='须选择两周';return;
    }
    if(!marketCache){
      info.textContent=marketError||'正在读取模块2全市场份额…';
      notice.textContent=marketError?'全市场CSV读取失败，可点击重新读取。':'等待模块2市场份额CSV';
      if(!marketPending&&!marketError)ensureMarketData();
      return;
    }
    const periods=[base,compare],topWeeks=fixedTopWeeks(scope.weeks.filter(w=>periods.includes(w.period)),30),
          topMap=new Map(aggregateBoardBrands(topWeeks).map(w=>[w.period,w])),
          marketMap=new Map(marketCache.map(m=>[m.week.replace('W','-W'),m])),
          groups=window.BrandUtils.groups.filter(g=>g.id!=='other');
    const topA=topMap.get(base),topB=topMap.get(compare),marketA=marketMap.get(base),marketB=marketMap.get(compare);
    const topValid=!!topA?.valid&&!!topB?.valid&&topA.total>0&&topB.total>0,
          marketValid=!!marketA&&!!marketB&&groups.every(g=>Number.isFinite(marketA.brands[g.id])&&Number.isFinite(marketB.brands[g.id]));
    const dataset=(key,valid,title,subtitle,message,extract)=>({
      key,title,subtitle,status:valid?'ok':'missing',message:valid?'':message,
      series:valid?groups.map(g=>({key:g.key,label:g.label,color:g.color,
        base:extract(g,base),compare:extract(g,compare)})):[]
    });
    const topPanel=dataset('top',topValid,'TOP30 榜单品牌结构流向','原始榜单排名1–30名 · 样本销量占比',
      !topA?.valid?'基准周TOP30不完整：'+(topA?.status||'未收录'):!topB?.valid?'对比周TOP30不完整：'+(topB?.status||'未收录'):'TOP30销量不可计算',
      (g,period)=>{const r=topMap.get(period);return 100*r.sales[g.key]/r.total;});
    const marketPanel=dataset('market',marketValid,'全市场品牌份额流向','模块2 market-share.csv · 品牌份额',
      !marketA?'缺少基准周全市场份额':!marketB?'缺少对比周全市场份额':'全市场份额不可计算',
      (g,period)=>marketMap.get(period).brands[g.id]);
    const panels=[topPanel,marketPanel],lines=[];
    for(const p of panels)for(const g of groups){
      const row=p.series.find(r=>r.key===g.key);
      lines.push({name:(p.key==='top'?'TOP30':'全市场')+' · '+g.label,color:g.color,
        values:row?[row.base,row.compare]:[null,null],imputed:[false,false]});
    }
    const extremes=panel=>{
      if(panel.status!=='ok')return {up:[],down:[]};
      const diffs=panel.series.map(row=>Math.round((row.compare-row.base)*10)/10),
            upper=Math.max(0,...diffs),lower=Math.min(0,...diffs);
      return {up:panel.series.filter((r,i)=>upper>0&&diffs[i]===upper).map(r=>r.label),
        down:panel.series.filter((r,i)=>lower<0&&diffs[i]===lower).map(r=>r.label)};
    };
    const topExtreme=extremes(topPanel),marketExtreme=extremes(marketPanel);
    const fmt=numberText;
    const rows=panels.flatMap(panel=>groups.map(g=>{
      const r=panel.series.find(s=>s.key===g.key),ext=extremes(panel),delta=r?Math.round((r.compare-r.base)*10)/10:null;
      return [panel.key==='top'?'TOP30样本':'全市场',base,compare,panel.status==='ok'?'可比较':panel.message,g.label,
        fmt(r?.base),fmt(r?.compare),fmt(delta),r&&ext.up.includes(g.label)?'是':'',r&&ext.down.includes(g.label)?'是':'',
        panel.key==='top'&&r?fmt(topMap.get(base).sales[g.key],4):'',panel.key==='top'&&r?fmt(topMap.get(compare).sales[g.key],4):'',
        panel.key==='top'?topA?.originalCount??'':'',panel.key==='top'?topB?.originalCount??'':''];
    }));
    researchTable(['口径','基准周','对比周','数据状态','品牌组','基准占比/%','对比占比/%','变化/pp','本图最大上涨','本图最大下跌','基准品牌销量/万台','对比品牌销量/万台','基准原始条数','对比原始条数'],rows);
    const desc=(name,panel,ext)=>panel.status==='ok'?name+'：最大上涨 '+(ext.up.join('、')||'无')+'；最大下跌 '+(ext.down.join('、')||'无'):name+'：'+panel.message;
    info.textContent=base+' → '+compare+' · TOP30：'+(topValid?'有效':'不可绘制')+' · 全市场：'+(marketValid?'有效':'不可绘制');
    notice.textContent=desc('TOP30',topPanel,topExtreme)+'；'+desc('全市场',marketPanel,marketExtreme)+'。原始份额分母各自独立；不代表销量从一个品牌转移到另一个品牌。';
    if(!topValid&&!marketValid)return;
    const chart={kind:'dualBrandFlow',periods,unit:'%',lines,panels,calendarPeriods:periods};
    researchPublicationChart=chart;
    ResearchCharts.renderComposition($('researchChart'),chart,'TOP30与全市场品牌结构双流向图');
    const note='两图仅对照品牌结构；各自分母不同，其他未绘制；pp极值按显示0.1pp判定，允许并列；流向色带不表示用户转移。';
    dualPublicationInfo={range:base+' → '+compare,effectivePeriods:periods,metricLabel:'TOP30 vs 全市场品牌结构流向',note,detail:info.textContent+'；'+notice.textContent};
    $('researchDesc').textContent+=' '+note;
  }
  for(const id of ['dualView','dualBase','dualCompare'])$(id).onchange=renderResearch;
  $('dualReload').onclick=()=>ensureMarketData(true);

  // TOP30 market coverage is a scenario model, not a full-market sales observation.
  function coverageRates(){
    const raw=$('coverageRates').value.trim(),tokens=raw.split(/[,，\s]+/).filter(Boolean);
    if(!tokens.length||tokens.length>6)throw Error('请设置1–6个苹果入榜率情景（如98,95,90,85）。');
    const values=tokens.map(Number);
    if(values.some(v=>!Number.isFinite(v)||v<=0||v>=100)||new Set(values).size!==values.length)
      throw Error('情景入榜率必须互不重复，且大于0、小于100；100%已单独作为理论上限。');
    return values.sort((a,b)=>b-a);
  }
  // The percentage keyword rule mirrors module 2's getStackMarketScale(). An unquantified
  // direction is unknown, NOT zero growth.
  function coverageReportedTrend(value){
    const match=String(value||'').normalize('NFKC').match(/(下降|下跌|下滑|回落|减少|降低|上升|上涨|增长|提升|增加|回升)[^\d%+\-]*(\d+(?:\.\d+)?)\s*%/);
    if(!match)return null;
    const magnitude=Number(match[2]),down=/下降|下跌|下滑|回落|减少|降低/.test(match[1]);
    if(!Number.isFinite(magnitude)||(down&&magnitude>100))return null;
    return down?-magnitude:magnitude;
  }
  function renderCoverageMarket(scope){
    coveragePublicationInfo=null;
    const notice=$('researchNotice'),info=$('coverageDataInfo'),mode=$('coverageView').value;
    $('researchDesc').textContent='榜单前30名样本与模块2苹果品牌份额的条件性反推。上限=T×苹果市场份额÷苹果入榜销量；情景值=上限×假定苹果入榜率。市场环比偏差基于相邻两周的苹果锚点全市场销量下限，只有在苹果入榜率跨周不变时才可与模块2描述趋势比较。';
    let rates;
    try{rates=coverageRates();}catch(err){info.textContent=err.message;notice.textContent='请修正苹果入榜率情景，CSV与图表暂不生成。';return;}
    if(!marketCache){
      info.textContent=marketError||'正在读取模块2全市场份额…';
      notice.textContent=marketError?'请检查CSV或重新读取全市场数据。':'等待全市场 CSV';
      if(!marketPending&&!marketError)ensureMarketData();
      return;
    }
    const markets=new Map(marketCache.map(m=>[m.week.replace('W','-W'),m]));
    // Always take ranks 1–30, including from a TOP40 archive. Do not impute or
    // mistake an incomplete board for a complete TOP30.
    const weeks=fixedTopWeeks(scope.weeks,30),boards=aggregateBoardBrands(weeks);
    const records=boards.map(w=>{
      const market=markets.get(w.period),share=market?.brands.apple;
      const apple=w.valid?w.sales.Apple:null;
      const basic=!!w.valid&&Number.isFinite(w.total)&&w.total>0&&Number.isFinite(apple)&&apple>0&&Number.isFinite(share)&&share>0;
      const marketMin=basic?apple/(share/100):null;
      const rawUpper=basic?100*w.total/marketMin:null;
      // >100% means the two independent source scopes cannot support this model.
      const valid=basic&&Number.isFinite(rawUpper)&&rawUpper<=100+1e-8;
      const status=!w.valid?w.status:!market?'缺少同周市场份额':!Number.isFinite(share)||share<=0?'苹果市场份额为零或无效':!Number.isFinite(apple)||apple<=0?'榜内苹果销量为零或无效':!Number.isFinite(w.total)||w.total<=0?'TOP30总销量无效':!valid?'跨来源口径冲突：理论上限超过100%':'可计算';
      return {period:w.period,originalCount:w.originalCount,count:w.count,cutoff:w.cutoff,total:w.valid?w.total:null,apple,share,market,marketMin:valid?marketMin:null,upper:valid?rawUpper:null,valid,status,reported:market?.trend||'',reportedGrowth:coverageReportedTrend(market?.trend),scenarios:valid?rates.map(rate=>rawUpper*rate/100):null,modelGrowth:null,gap:null,growthStatus:''};
    });
    for(let i=0;i<records.length;i++){
      const r=records[i],prior=records[i-1];
      if(!r.valid){r.growthStatus='当周覆盖率不可计算';continue;}
      if(!prior||!prior.valid||!r.market||!prior.market||r.market.monday-prior.market.monday!==604800000){
        r.growthStatus='缺少相邻有效基准周';continue;
      }
      r.modelGrowth=100*(r.marketMin/prior.marketMin-1);
      if(r.reportedGrowth===null){r.growthStatus='市场趋势未量化，无法计算偏差';continue;}
      r.gap=r.modelGrowth-r.reportedGrowth;
      r.growthStatus='可比较（情景假定苹果入榜率跨周固定）';
    }
    const headers=['周期','原始实收条数','使用条数','数据状态','TOP30销量/万台','苹果入榜销量/万台','第30名销量/万台','苹果市场份额/%','苹果榜内份额/%','全市场销量下限/万台','TOP30覆盖率理论上限/%',...rates.map(rate=>'苹果入榜率'+rate+'%时覆盖率/%'),'苹果锚点推算环比/%','模块2趋势原文','模块2趋势量化/%','环比偏差/pp','环比比较状态'];
    const fmt=numberText;
    researchTable(headers,records.map(r=>[
      r.period,r.originalCount??'',r.count??'',r.status,fmt(r.total,4),fmt(r.apple,4),fmt(r.valid?r.cutoff:null,4),fmt(r.share),fmt(r.valid?100*r.apple/r.total:null),fmt(r.marketMin,4),fmt(r.upper),...rates.map((rate,i)=>fmt(r.scenarios?.[i])),fmt(r.modelGrowth),r.reported,fmt(r.reportedGrowth),fmt(r.gap),r.growthStatus
    ]));
    const valid=records.filter(r=>r.valid),comparable=records.filter(r=>r.gap!==null);
    const effective=mode==='coverage'?valid:mode==='mom'?comparable:comparable;
    const range=records.length?records[0].period+'—'+records.at(-1).period:'';
    const total=valid.reduce((s,r)=>s+r.total,0),minMarket=valid.reduce((s,r)=>s+r.marketMin,0);
    const aggregate=total>0&&minMarket>0?100*total/minMarket:null;
    info.textContent='同周市场份额 '+marketCache.length+' 期 · 完整TOP30 '+valid.length+'/'+records.length+' 周 · 环比量化可比较 '+comparable.length+' 周';
    notice.textContent=info.textContent+(aggregate!==null?' · 有效周销量加权覆盖率上限 '+fmt(aggregate)+'%':'')+'。正偏差代表锚点推算涨幅高于CSV描述；无法量化的描述不按0%处理。';
    if(!valid.length)return;
    const x=records.map(r=>({period:r.period}));
    if(mode==='coverage'){
      researchPlot(x,[{name:'理论上限（苹果100%入榜）',color:'#2563eb',values:records.map(r=>r.upper)},...rates.map((rate,i)=>({name:'入榜率'+rate+'%情景',color:trackerPalette[(i+1)%trackerPalette.length],values:records.map(r=>r.scenarios?.[i]??null)}))],'%',100);
    }else if(mode==='mom'){
      researchPlot(x,[{name:'苹果锚点环比指数',color:'#2563eb',values:records.map(r=>r.gap===null?null:100+r.modelGrowth)},{name:'模块2趋势指数',color:'#ea580c',values:records.map(r=>r.gap===null?null:100+r.reportedGrowth)}],'前周=100的环比规模指数');
    }else{
      researchPlot(x,[{name:'环比偏差绝对值',color:'#9333ea',values:records.map(r=>r.gap===null?null:Math.abs(r.gap))}],'环比偏差绝对值 / pp');
    }
    const metricLabel=mode==='coverage'?'TOP30覆盖率上限与苹果入榜率情景':mode==='mom'?'苹果锚点与CSV大盘环比规模指数':'苹果锚点与CSV趋势的环比偏差绝对值';
    const note='固定完整TOP30；上限假定苹果100%入榜，其他为情景值；环比比较假设苹果入榜率跨周固定；模糊市场趋势不等于0%。';
    coveragePublicationInfo={range,effectivePeriods:effective.map(r=>r.period),metricLabel,note,detail:info.textContent+'；'+notice.textContent+'；情景入榜率：'+rates.join('/')+'%；'+note};
    $('researchDesc').textContent+=' '+note+' 图表仅显示选择的指标，全部指标、带正负号的偏差及未量化趋势保留在下方CSV表格。';
  }
  for(const id of ['coverageView','coverageRates'])$(id).onchange=renderResearch;
  $('coverageReload').onclick=()=>ensureMarketData(true);

  const boardBrandColors=window.BrandUtils.colors;
  const boardBrandOrder=headBrands;
  const boardBrandLabel=window.BrandUtils.label;
  const brandMetricLabels={share:'品牌榜单销量占比',count:'品牌上榜数量占比',volume:'品牌绝对销量'};
  const brandViewLabels={stack:'多周堆叠柱状图',ribbon:'双周堆叠流向图',concentration:'集中度趋势',line:'品牌折线图'};
  let brandPublicationInfo=null,brandWeekScope='';
  function fillBrandWeeks(weeks,scopeId){
    const a=$('brandBase'),b=$('brandCompare'),oldA=a.value,oldB=b.value;
    if(brandWeekScope===scopeId&&Array.from(a.options).map(o=>o.value).join(',')===weeks.map(w=>w.period).join(','))return;
    const sameScope=brandWeekScope===scopeId;brandWeekScope=scopeId;
    for(const select of [a,b]){
      select.replaceChildren();
      weeks.forEach(w=>{const option=document.createElement('option');option.value=w.period;option.textContent=w.period;select.append(option);});
    }
    const valid=weeks.filter(w=>w.valid);
    a.value=sameScope&&weeks.some(w=>w.period===oldA)?oldA:(valid[valid.length-2]?.period||weeks[0]?.period||'');
    b.value=sameScope&&weeks.some(w=>w.period===oldB)?oldB:(valid[valid.length-1]?.period||weeks[weeks.length-1]?.period||'');
    if(!sameScope){const saved=scopeSettings.get(scopeId);Pref.setControl(a,saved?.brandBase);Pref.setControl(b,saved?.brandCompare);}
  }
  function plotBrandComposition(chart){
    researchPublicationChart=chart;
    ResearchCharts.renderComposition($('researchChart'),chart,'品牌结构图');
  }
  function renderBoardBrand(scope,weeks){
    const view=$('brandView').value,metric=$('brandMetric').value,con=$('brandCon').value;
    visible($('brandMetricControl'),view!=='concentration');visible($('brandBaseControl'),view==='ribbon');visible($('brandCompareControl'),view==='ribbon');visible($('brandConControl'),view==='concentration');
    fillBrandWeeks(weeks,scope.id);
    const per=aggregateBoardBrands(weeks),unit=metric==='volume'?'万台':'%',sample=topKValue()===null?'原始全量':'固定 TOP'+topKValue();
    const validMetric=r=>r.valid&&(metric!=='share'||r.total>0);
    const value=(r,k,i)=>!validMetric(r)?null:metric==='volume'?r.sales[k]:metric==='count'?r.countShares[i]:r.shares[i];
    const brands=boardBrandOrder.filter(k=>k!=='其他'||per.some(r=>r.valid&&r.counts[k]>0));
    const linesFor=records=>brands.map(k=>({name:boardBrandLabel(k),color:boardBrandColors[k],values:records.map(r=>value(r,k,boardBrandOrder.indexOf(k))),imputed:[]}));
    const notice=$('researchNotice');
    $('researchDesc').textContent='按母品牌归并原始榜单：小米含 REDMI、OPPO含一加/realme、vivo含 iQOO。榜单样本并非全市场；固定 TOP K 缺名次整周留空。不使用覆盖率筛选与插补。多周堆叠柱相邻有效周间以半透明色带连接同一品牌，缺失周断开；色带不表示实际销量迁移。CR/HHI 按销量计算，其他品牌合为一组。';
    let records=per,range=weeks[0].period+'—'+weeks[weeks.length-1].period;
    if(view==='ribbon'){
      const base=per.find(r=>r.period===$('brandBase').value),compare=per.find(r=>r.period===$('brandCompare').value);
      if(base&&compare){records=[base,compare];range=base.period+' → '+compare.period;}
      else records=[];
    }
    // Export only the chosen pair for ribbon; other views retain all natural weeks.
    const headers=['周期','原始实收条数','分析条数','周样本状态','样本销量/万台',...brands.flatMap(k=>[boardBrandLabel(k)+'销量/万台',boardBrandLabel(k)+'销量占比/%',boardBrandLabel(k)+'上榜数量',boardBrandLabel(k)+'数量占比/%']),'CR1/%','CR3/%','CR5/%','HHI'];
    const rows=records.map(r=>[r.period,r.originalCount,r.count??'',r.status,numberText(r.total,4),...brands.flatMap(k=>{const i=boardBrandOrder.indexOf(k);return r.valid?[numberText(r.sales[k],4),numberText(r.shares?.[i]),r.counts[k],numberText(r.countShares[i])]:['','','',''];}),numberText(r.cr1),numberText(r.cr3),numberText(r.cr5),numberText(r.hhi,0)]);
    if(view==='ribbon'&&records.length===2&&records[0].period!==records[1].period){
      headers.push(...brands.map(k=>boardBrandLabel(k)+'变化/'+(metric==='volume'?'万台':'pp')));
      rows[0].push(...brands.map(()=>''));rows[1].push(...brands.map(k=>{const i=boardBrandOrder.indexOf(k),a=value(records[0],k,i),b=value(records[1],k,i);return numberText(a===null||b===null?null:b-a,4);}));
    }
    researchTable(headers,rows);
    const metricLabel=view==='concentration'?(con==='cr'?'CR1 / CR3 / CR5':'HHI')+' · 销量集中度':brandMetricLabels[metric]+' · '+brandViewLabels[view];
    const note=(view==='ribbon'?'色带连接同一品牌，非用户流向；':view==='stack'?'相邻有效周之间以半透明色带连接同一品牌，缺失周断开；':view==='concentration'?'销量集中度；其他品牌合并为一组；':'缺失周留空；')+sample+' · 仅榜单样本，非全市场';
    brandPublicationInfo={metricLabel,range,note,detail:sample+'；'+metricLabel+'；'+range};
    const good=view==='concentration'?records.filter(r=>r.cr1!==null):records.filter(validMetric);
    brandPublicationInfo.effectivePeriods=good.map(r=>r.period);
    notice.textContent=sample+' · '+good.length+' / '+records.length+' 周有有效数据 · '+metricLabel;
    if(view==='ribbon'&&(records.length!==2||records[0].period===records[1].period||good.length!==2)){notice.textContent='请选择两个不同且均有有效数据的自然周；不完整周不绘制流向图。';return;}
    if(!good.length)return;
    if(view==='concentration'){
      const keys=con==='cr'?['cr1','cr3','cr5']:['hhi'];
      researchPlot(weeks,keys.map(k=>({name:k.toUpperCase(),values:per.map(r=>r[k])})),con==='cr'?'销量集中度 / %':'HHI',con==='cr'?100:10000);
    }else if(view==='line')researchPlot(weeks,linesFor(per),brandMetricLabels[metric]+' / '+unit,metric==='volume'?undefined:100);
    else plotBrandComposition({kind:view==='stack'?'brandStack':'brandRibbon',connectAdjacentBands:view==='stack',periods:records.map(r=>r.period),lines:linesFor(records),unit,limit:metric==='volume'?null:100});
  }
  for(const id of ['brandView','brandMetric','brandBase','brandCompare','brandCon'])$(id).onchange=renderResearch;

  // Shared attribute-study output. The same frozen chart/table is consumed by the studio.
  let attributePublicationInfo=null;
  const attributeColors=['#2563eb','#ea580c','#059669','#9333ea','#db2777','#0891b2','#92400e','#64748b','#be123c','#4d7c0f','#0369a1','#7c3aed','#b45309','#0f766e'];
  const attrColor=(name,i)=>name===Product.UNKNOWN?'#94a3b8':name==='其他已知类别'?'#64748b':window.BrandUtils.color(name)||attributeColors[i%attributeColors.length];
  function attributeSettings(key){
    if(key==='price')return {cuts:$('priceCuts').value,view:$('priceView').value,metric:$('priceMetric').value,brandLevel:$('priceBrandLevel').value};
    if(key==='position')return {view:$('positionView').value,brandLevel:$('positionBrandLevel').value,high:$('positionHigh').value};
    if(key==='age')return {view:$('ageView').value,metric:$('ageMetric').value,brandLevel:$('ageBrandLevel').value,ageCuts:Product.AGE_CUTS};
    if(key==='cross')return {row:$('crossRow').value,column:$('crossColumn').value,metric:$('crossMetric').value,range:$('crossRange').value,limit:$('crossLimit').value,ageCuts:Product.AGE_CUTS,priceCuts:Product.DEFAULT_CUTS};
    return {dimension:$('chipDimension').value,view:$('chipView').value,metric:$('chipMetric').value,limit:$('chipLimit').value};
  }
  const attrMetricLabel=metric=>metric==='share'?'样本销量占比':metric==='count'?'入榜统计项数':'样本销量';
  const attrUnit=metric=>metric==='share'?'%':metric==='count'?'项':'万台';
  const pct=(v,total)=>total>0?100*v/total:null;
  const nonempty=w=>w.valid&&w.count>0;
  function attrValue(stats,metric,denom){return metric==='share'?pct(stats?.sales||0,denom):metric==='count'?(stats?.count||0):(stats?.sales||0);}
  function attrBrand(x,level){return x.model?.[level]||(level==='brand_group'?window.BrandUtils.classify('',x.brand)||Product.UNKNOWN:Product.UNKNOWN);}
  function attrPlot(chart,label){researchPublicationChart=chart;if(chart.kind)ResearchCharts.renderComposition($('researchChart'),chart,label);else ResearchCharts.svgLine($('researchChart'),$('researchLegend'),chart,label);}
  function setAttributeInfo(metricLabel,periods,note,detail){
    const adjacent=researchPublicationChart?.kind==='brandStack'&&researchPublicationChart.connectAdjacentBands;
    const ribbonNote=adjacent?'相邻有效周之间使用同类别半透明色带，缺失周断开；色带不是销量迁移。':'';
    attributePublicationInfo={metricLabel,range:periods.length?periods[0]+'—'+periods.at(-1):'',effectivePeriods:periods,note:[note,ribbonNote].filter(Boolean).join('；'),detail};
  }
  function attrRows(per,labels,classify,knownField){
    const out=[];
    for(const w of per){
      const stats=Product.aggregate(w.entries,classify),unknown=w.entries.filter(x=>knownField(x)===Product.UNKNOWN).reduce((s,x)=>s+x.units,0);
      for(const name of labels){const a=stats.get(name);out.push([w.period,w.status,w.count??'',numberText(w.total,4),name,w.valid?(a?.count||0):'',w.valid?numberText(a?.sales||0,4):'',w.valid?numberText(pct(a?.sales||0,w.total)):'',w.valid?numberText(unknown,4):'',w.valid?numberText(pct(w.total-unknown,w.total)):'']);}
    }
    return out;
  }
  const attrHeaders=['周期','样本状态','筛选后入榜统计项数','样本销量/万台','类别','类别入榜统计项数','类别销量/万台','类别销量占比/%','未知属性销量/万台','已知属性销量覆盖率/%'];
  function attrTrend(per,labels,classify,metric,view){
    const maps=per.map(w=>Product.aggregate(w.entries,classify)),unit=attrUnit(metric);
    return {kind:view==='stack'?'brandStack':undefined,connectAdjacentBands:view==='stack',periods:per.map(w=>w.period),calendarPeriods:per.filter(w=>nonempty(w)&&(metric!=='share'||w.total>0)).map(w=>w.period),unit,limit:metric==='share'?100:undefined,lines:labels.map((name,i)=>({name,color:attrColor(name,i),values:per.map((w,j)=>nonempty(w)?attrValue(maps[j].get(name),metric,w.total):null)}))};
  }
  function attrMatrix(last,rows,columns,rowOf,colOf,metric){
    const maps=new Map(rows.map(k=>[k,Product.aggregate(last.entries.filter(x=>rowOf(x)===k),colOf)]));
    const records=rows.flatMap(r=>columns.map(c=>{const a=maps.get(r).get(c);return [last.period,last.status,r,c,a?.count||0,numberText(a?.sales||0,4),numberText(pct(a?.sales||0,last.total))];}));
    const chart={kind:'brandStack',periods:rows,calendarPeriods:[last.period],unit:attrUnit(metric),limit:metric==='share'?100:undefined,lines:columns.map((name,i)=>({name,color:attrColor(name,i),values:rows.map(k=>attrValue(maps.get(k).get(name),metric,last.total))}))};
    return {records,chart};
  }
  function crossHeatmap(matrix,rowLabels,colLabels,metric,effective,rowLabel,colLabel){
    const unit=metric==='count'?'项次':metric==='volume'?'万台':'%';
    return {kind:'heatmap',periods:rowLabels,calendarPeriods:effective,unit,rowLabel,colLabel,lines:colLabels.map(name=>({name,values:rowLabels.map(r=>Product.matrixValue(matrix,r,name,metric))}))};
  }
  function crossRecords(matrix,rows,cols,range,periods){
    const cov=[pct(matrix.knownRow,matrix.total),pct(matrix.knownCol,matrix.total),pct(matrix.knownBoth,matrix.total)];
    return rows.flatMap(r=>cols.map(c=>{const v=matrix.cells.get(r)?.get(c)||{sales:0,count:0};return [range,periods.join(' / '),periods.length,r,c,v.count,numberText(v.sales,4),numberText(Product.matrixValue(matrix,r,c,'share')),numberText(Product.matrixValue(matrix,r,c,'row_share')),numberText(Product.matrixValue(matrix,r,c,'col_share')),numberText(matrix.total,4),...cov.map(x=>numberText(x))];}));
  }
  const crossHeaders=['统计区间','有效自然周','有效周数','行类别','列类别','入榜统计项次','样本销量/万台','全样本销量占比/%','行内销量占比/%','列内销量占比/%','全部样本销量/万台','行属性覆盖率/%','列属性覆盖率/%','双属性覆盖率/%'];
  function renderCrossStudy(per,weeks,cfg,general,sample){
    const notice=$('researchNotice'),fields=new Map(Product.AGE_FIELDS),limit=Number(cfg.limit);
    $('researchDesc').textContent=general+' 可交叉两个不同属性；区间汇总是有效榜单的样本销量之和，不是完整市场累计。同一机型每周入榜计一次；上市年龄按当周计算。行内/列内占比的分母包含该行/列未知类别。';
    if(cfg.row===cfg.column||!fields.has(cfg.row)||!fields.has(cfg.column)){notice.textContent='请选择两个不同的有效属性。';return;}
    if(!Number.isSafeInteger(limit)||limit<1||limit>8){notice.textContent='每轴主要已知类别须为1–8之间的整数。';return;}
    const selected=cfg.range==='last'?[per.at(-1)]:per,usable=selected.filter(nonempty),periods=usable.map(w=>w.period);
    if(!usable.length){notice.textContent=cfg.range==='last'?'所选末周无有效样本，不自动换周。':'所选区间无有效筛选后样本。';return;}
    const entries=usable.flatMap(w=>w.entries),rowOf=x=>Product.dimension(x,cfg.row),colOf=x=>Product.dimension(x,cfg.column),matrix=Product.cross(entries,rowOf,colOf);
    const rows=Product.rankedKeys(matrix.rows),cols=Product.rankedKeys(matrix.cols),r=Product.displayDimension(matrix.rows,limit),c=Product.displayDimension(matrix.cols,limit);
    const collapsed=Product.cross(entries,x=>r.collapse(rowOf(x)),x=>c.collapse(colOf(x))),rowLabel=fields.get(cfg.row),colLabel=fields.get(cfg.column);
    const range=selected[0].period+'—'+selected.at(-1).period,metricLabel=({volume:'样本销量（万台）',count:'入榜统计项次',share:'全样本销量占比',row_share:'行内销量占比',col_share:'列内销量占比'})[cfg.metric];
    researchTable(crossHeaders.map((h,i)=>i===3?rowLabel:i===4?colLabel:h),crossRecords(matrix,rows,cols,range,periods));
    const chart=crossHeatmap(collapsed,r.labels,c.labels,cfg.metric,periods,rowLabel,colLabel);
    if(chart.lines.some(l=>l.values.some(Number.isFinite)))attrPlot(chart,rowLabel+' × '+colLabel);
    const coverage=pct(matrix.knownBoth,matrix.total);
    setAttributeInfo(rowLabel+' × '+colLabel+' · '+metricLabel,periods,'未知独立；次要类别合并；颜色按数值统一标尺；非全市场','所选区间 '+range+'；实际有效 '+periods.length+'/'+selected.length+' 周；完整 '+rows.length+'×'+cols.length+' 矩阵见 CSV；合并后图表 '+r.labels.length+'×'+c.labels.length+'；双属性销量覆盖率 '+(coverage===null?'—':coverage.toFixed(2)+'%')+'；'+general);
    notice.textContent=sample+' · '+metricLabel+' · '+periods.length+'/'+selected.length+' 周有样本 · 完整 '+rows.length+'×'+cols.length+'，图表 '+r.labels.length+'×'+c.labels.length+' · 双属性覆盖率 '+(coverage===null?'—':coverage.toFixed(2)+'%');
  }
  function renderAgeStudy(per,weeks,cfg,general,sample){
    const notice=$('researchNotice'),last=per.at(-1),valid=per.filter(nonempty),classify=x=>Product.ageBand(x.model,x.week),labels=[...Product.ageLabels(),Product.UNKNOWN],metric=cfg.metric;
    const brandView=cfg.view==='brand'||cfg.view==='new';
    visible($('ageBrandWrap'),brandView);visible($('ageMetricWrap'),cfg.view!=='new');
    $('researchDesc').textContent=general+' 年龄基于每条观测对应自然周及正式开售日，P0 为不完整开售周。默认 P0–W4、W5–W12、W13–W26、W27–W52、W53及以上；年龄无法判断的统计项计入未知。新品为 P0–W4，不以首次上榜代替上市。';
    const note='按正式开售日及当周周龄；未知计入分母；非全市场';
    let effective=[],metricLabel='上市年龄'+attrMetricLabel(metric);
    if(cfg.view==='brand'){
      if(!nonempty(last)){notice.textContent='所选末周无有效样本，不自动换周。';return;}
      const brand=x=>Product.value(x.model,cfg.brandLevel),matrix=Product.cross(last.entries,brand,classify),rows=Product.rankedKeys(matrix.rows),r=Product.displayDimension(matrix.rows,8);
      const collapsed=Product.cross(last.entries,x=>r.collapse(brand(x)),classify);effective=[last.period];
      researchTable(crossHeaders.map((h,i)=>i===3?'品牌':i===4?'上市年龄':h),crossRecords(matrix,rows,labels,last.period,effective));
      attrPlot(crossHeatmap(collapsed,r.labels,labels,metric,effective,'品牌','上市年龄'),'品牌 × 上市年龄');
    }else if(cfg.view==='new'){
      const brand=x=>Product.value(x.model,cfg.brandLevel),ranked=Product.rankGroups(per,brand),known=ranked.filter(k=>k!==Product.UNKNOWN),major=known.slice(0,8),other='其他已知类别';
      const shown=[...major,...(known.length>major.length?[other]:[]),...(ranked.includes(Product.UNKNOWN)?[Product.UNKNOWN]:[])],chartBrand=x=>{const k=brand(x);return k===Product.UNKNOWN||major.includes(k)?k:other;};
      function stats(entries){const total=entries.reduce((s,x)=>s+x.units,0),newSales=entries.filter(x=>classify(x)===labels[0]).reduce((s,x)=>s+x.units,0),unknown=entries.filter(x=>classify(x)===Product.UNKNOWN).reduce((s,x)=>s+x.units,0);return {total,newSales,unknown,share:pct(newSales,total),coverage:pct(total-unknown,total)};}
      const rows=per.flatMap(w=>ranked.map(k=>{const a=stats(w.entries.filter(x=>brand(x)===k));return [w.period,w.status,k,w.valid?numberText(a.total,4):'',w.valid?numberText(a.newSales,4):'',w.valid?numberText(a.unknown,4):'',w.valid?numberText(a.coverage):'',w.valid?numberText(a.share):''];}));
      researchTable(['周期','样本状态','品牌','品牌样本销量/万台','新品销量/万台','未知年龄销量/万台','年龄覆盖率/%','新品占品牌样本/%'],rows);
      const lines=shown.map((name,i)=>({name,color:attrColor(name,i),values:per.map(w=>nonempty(w)?stats(w.entries.filter(x=>chartBrand(x)===name)).share:null)}));
      effective=per.filter((w,i)=>lines.some(l=>Number.isFinite(l.values[i]))).map(w=>w.period);metricLabel='品牌新品销量贡献率（P0–W4）';
      if(effective.length)attrPlot({periods:per.map(w=>w.period),calendarPeriods:effective,unit:'%',limit:100,lines},metricLabel);
    }else{
      researchTable(attrHeaders,attrRows(per,labels,classify,classify));
      const chart=attrTrend(per,labels,classify,metric,cfg.view);effective=chart.calendarPeriods;if(effective.length)attrPlot(chart,metricLabel);
    }
    const unknown=last?.entries.filter(x=>classify(x)===Product.UNKNOWN).reduce((s,x)=>s+x.units,0)||0,coverage=last?.total>0?pct(last.total-unknown,last.total):null;
    setAttributeInfo(metricLabel,effective,note,'年龄分组 '+labels.join(' / ')+'；新品贡献以品牌全部筛选样本为分母；未知年龄计入分母；完整分类见 CSV。');
    notice.textContent=metricLabel+' · '+sample+' · '+valid.length+'/'+weeks.length+' 周有样本 · 末周年龄覆盖率 '+(coverage===null?'—':coverage.toFixed(2)+'%');
  }
  function renderAttributeStudy(scope,weeks){
    const key=researchView,notice=$('researchNotice'),cfg=attributeSettings(key);
    const per=Product.observed(weeks,masterCatalog,col,filters()),last=per.at(-1),valid=per.filter(nonempty),periods=valid.map(w=>w.period);
    const sample=topKValue()===null?'原始榜单全量':'固定 TOP'+topKValue();
    const general='先按原始排名确定有效榜单，再限定属性筛选；仅原始观测，不插补。占比以筛选后全部入榜样本销量为分母，未知属性仍计入分母；非全市场。历史堆叠图相邻有效周以半透明色带连接同一类别，缺失周断连；色带不代表用户或销量转移。';
    const suffix=' · '+sample+' · '+valid.length+'/'+weeks.length+' 周有筛选后样本';
    if(!masterCatalog){notice.textContent='机型主数据未加载，产品属性专题暂不可用；其他销量研究不受影响。';return;}
    if(key==='cross'){renderCrossStudy(per,weeks,cfg,general,sample);return;}
    if(key==='age'){renderAgeStudy(per,weeks,cfg,general,sample);return;}
    if(key==='price'){
      const cuts=Product.parseCuts(cfg.cuts);visible($('priceBrandWrap'),cfg.view==='matrix');
      $('researchDesc').textContent=general+' 首发价为起售价，不是成交价；含其他版本的统计项按主数据代表性首发价归类，不拆分销量。';
      if(!cuts){notice.textContent='请输入1–8个严格递增的正整数价格分界线（不超过1000000元）。';return;}
      const classify=x=>Product.priceBand(x.model,cuts),labels=[...Product.bandLabels(cuts),Product.UNKNOWN],metric=cfg.metric;
      const metricLabel='首发价格带'+attrMetricLabel(metric),note='首发起售价分组（含版本项用代表价）；未知计入分母；非全市场';
      if(cfg.view==='matrix'){
        if(!nonempty(last)){notice.textContent='所选末周无有效样本，不自动改用较早周。';return;}
        const colOf=x=>attrBrand(x,cfg.brandLevel),columns=Product.rankGroups([last],colOf);
        const {records,chart}=attrMatrix(last,labels,columns,classify,colOf,metric);
        researchTable(['周期','样本状态','首发价格带','品牌','入榜统计项数','销量/万台','占末周筛选样本销量/%'],records);
        attrPlot(chart,'末周价格带与品牌');setAttributeInfo(metricLabel+' · 品牌矩阵',[last.period],note,'矩阵百分比以整个末周筛选样本为分母，而非各价格带内部。');
      }else{
        researchTable(attrHeaders,attrRows(per,labels,classify,classify));
        if(valid.length)attrPlot(attrTrend(per,labels,classify,metric,cfg.view),'价格带竞争');
        setAttributeInfo(metricLabel,per.filter(w=>nonempty(w)&&(metric!=='share'||w.total>0)).map(w=>w.period),note,'价格分界线：'+cuts.join(' / ')+' 元；'+general);
      }
      const cov=last?.total>0?pct(last.knownPrice,last.total):null;
      notice.textContent=metricLabel+suffix+' · 末周有效价格销量覆盖率 '+(cov===null?'—':cov.toFixed(2)+'%');return;
    }
    if(key==='position'){
      const threshold=Number(cfg.high);$('researchDesc').textContent=general+' 加权首发价以价格有效的销量为分母，仅未知或无效价格不参与加权；含其他版本的统计项使用主数据代表性首发价；高价位贡献以筛选样本（含未知价格）为分母，不是成交 ASP。';
      if(!Number.isSafeInteger(threshold)||threshold<=0||threshold>1000000){notice.textContent='请输入1–1000000元的整数高价门槛。';return;}
      const classify=x=>attrBrand(x,cfg.brandLevel),labels=Product.rankGroups(per,classify),selected=cfg.view==='scatter'?[last]:per;
      const byWeek=selected.map(w=>new Map(labels.map(k=>[k,Product.priceStats(w.entries.filter(x=>classify(x)===k),threshold)])));
      const rows=selected.flatMap((w,i)=>labels.map(k=>{const a=byWeek[i].get(k);return [w.period,w.status,k,w.valid?numberText(a.sales,4):'',w.valid?numberText(a.known,4):'',w.valid?numberText(a.unknown,4):'',w.valid?numberText(a.coverage):'',w.valid?numberText(a.weightedPrice,2):'',w.valid?numberText(a.high,4):'',w.valid?numberText(a.highShare):'',w.valid?numberText(pct(a.high,w.total)):''];}));
      researchTable(['周期','样本状态','品牌','品牌样本销量/万台','价格有效销量/万台','未知价格销量/万台','价格覆盖率/%','销量加权首发价/元','高价位销量/万台','高价位占品牌样本/%','高价位占全部筛选样本/%'],rows);
      const note='代表性首发价加权，非 ASP；价格覆盖率见 CSV';
      let chart,metricLabel,effective;
      if(cfg.view==='scatter'){
        const points=labels.map(k=>({k,...byWeek[0].get(k)})).filter(a=>nonempty(last)&&a.weightedPrice!==null&&a.sales>0).slice(0,12);
        metricLabel='品牌样本销量 × 加权首发价';effective=points.length?[last.period]:[];
        if(points.length)chart={kind:'scatter',xLabel:'品牌样本销量（万台）',yLabel:'销量加权首发价（元）',periods:points.map(a=>a.k),calendarPeriods:effective,lines:[{name:'样本销量',values:points.map(a=>a.sales)},{name:'加权首发价',values:points.map(a=>a.weightedPrice)}]};
      }else{
        const high=cfg.view==='high';metricLabel=high?'品牌高价位销量贡献率（≥'+threshold+'元）':'销量加权首发价（元）';
        const lines=labels.map((k,i)=>({name:k,color:attrColor(k,i),values:per.map((w,j)=>nonempty(w)?(high?byWeek[j].get(k).highShare:byWeek[j].get(k).weightedPrice):null)}));
        effective=per.filter((w,j)=>lines.some(l=>Number.isFinite(l.values[j]))).map(w=>w.period);if(effective.length)chart={periods:per.map(w=>w.period),calendarPeriods:effective,unit:high?'%':'元',limit:high?100:undefined,lines};
      }
      if(chart)attrPlot(chart,metricLabel);
      setAttributeInfo(metricLabel,effective,note,'高价门槛 '+threshold+' 元；高价贡献率以品牌全部样本销量为分母；散点最多12组，表格保留全部。');
      notice.textContent=metricLabel+suffix+' · 末周全样本价格覆盖率 '+(last?.total>0?pct(last.knownPrice,last.total).toFixed(2)+'%':'—')+(effective.length?'':' · 无有效图表数据');return;
    }
    $('researchDesc').textContent=general+' 芯片供应商、平台遵循主数据人工归类，不恢复移除的变体后缀；平台标识含供应商。';
    const limit=Number(cfg.limit);if(!Number.isSafeInteger(limit)||limit<1||limit>12){notice.textContent='主要类别数量应为1–12之间的整数。';return;}
    const classify=x=>Product.value(x.model,cfg.dimension),metric=cfg.metric,one=cfg.view==='rank'||cfg.view==='brand',selected=one?[last]:per;
    const all=Product.rankGroups(selected,classify),known=all.filter(k=>k!==Product.UNKNOWN),major=known.slice(0,limit),other='其他已知类别';
    const shown=[...major,...(known.length>major.length?[other]:[]),...(all.includes(Product.UNKNOWN)?[Product.UNKNOWN]:[])],classForChart=x=>{const k=classify(x);return k===Product.UNKNOWN||major.includes(k)?k:other;};
    const metricLabel=(cfg.dimension==='chip_vendor'?'芯片供应商':'芯片平台')+attrMetricLabel(metric),note='芯片人工归类；仅原始榜单样本；完整类别见 CSV';
    let effective=[];
    if(cfg.view==='brand'){
      if(nonempty(last)){
        const colOf=x=>attrBrand(x,'brand_group'),columns=Product.rankGroups([last],colOf),full=attrMatrix(last,all,columns,classify,colOf,metric);
        researchTable(['周期','样本状态','芯片类别','母品牌','入榜统计项数','销量/万台','占末周筛选样本销量/%'],full.records);
        const display=attrMatrix(last,shown,columns,classForChart,colOf,metric);effective=[last.period];attrPlot(display.chart,'末周芯片与母品牌');
      }
    }else{
      researchTable(attrHeaders,attrRows(selected,all,classify,classify));
      if(cfg.view==='rank'&&nonempty(last)){
        const map=Product.aggregate(last.entries,classForChart);effective=[last.period];
        attrPlot({kind:'bars',periods:shown,calendarPeriods:effective,unit:attrUnit(metric),lines:[{name:metricLabel,color:'#2563eb',values:shown.map(k=>attrValue(map.get(k),metric,last.total))}]},metricLabel);
      }else if(!one&&valid.length){const chart=attrTrend(per,shown,classForChart,metric,cfg.view);effective=chart.calendarPeriods;attrPlot(chart,metricLabel);}
    }
    setAttributeInfo(metricLabel,effective,note,'显示主要已知类别 '+major.length+' 个，其余已知归为其他；未知独立；排名按所选展示区间销量；矩阵百分比以全部末周样本为分母。');
    const unknown=last?.entries.filter(x=>classify(x)===Product.UNKNOWN).reduce((s,x)=>s+x.units,0)||0;
    notice.textContent=metricLabel+suffix+' · 末周属性覆盖率 '+(last?.total>0?pct(last.total-unknown,last.total).toFixed(2)+'%':'—')+(one&&!nonempty(last)?' · 末周无有效样本':'')+' · 全部类别 '+all.length+' 个，图表保留 '+shown.length+' 组';
  }
  for(const id of ['priceCuts','priceView','priceMetric','priceBrandLevel','positionView','positionBrandLevel','positionHigh','chipDimension','chipView','chipMetric','chipLimit','ageView','ageMetric','ageBrandLevel','crossRow','crossColumn','crossMetric','crossRange','crossLimit'])$(id).onchange=renderResearch;
  $('crossSwap').onclick=()=>{const a=$('crossRow'),b=$('crossColumn'),v=a.value;a.value=b.value;b.value=v;renderResearch();};
  $('priceResetCuts').onclick=()=>{$('priceCuts').value=Product.DEFAULT_CUTS.join(',');renderResearch();};

  function renderResearch(){try{renderResearchContent();}catch(err){researchPublicationChart=null;researchPublicationTable=null;researchExportRows=[];$('researchExport').disabled=true;reportResearchError(err);throw err;}finally{saveResearchPreferences();}}
  function renderResearchContent(){
    if(researchView==='model')return;
    researchPublicationChart=null;researchPublicationTable=null;headPublicationInfo=null;coveragePublicationInfo=null;dualPublicationInfo=null;brandPublicationInfo=null;attributePublicationInfo=null;
    const scope=currentScope(),notice=$('researchNotice');
    $('researchTitle').textContent=researchViews[researchView];$('researchDesc').textContent='';
    $('researchChart').replaceChildren();$('researchLegend').replaceChildren();researchTable([],[]);notice.textContent='';
    if(!scope){notice.textContent='暂无周榜数据';return;}
    const c=Object.fromEntries(trackerData.header.map((h,i)=>[h,i]));
    let weeks=scope.weeks;
    if(researchView==='tier'){renderTierComparison(scope,c);return;}
    if(usesTopK(researchView)){
      const k=topKValue();$('researchTopCustom').hidden=$('researchTopMode').value!=='custom';
      if(Number.isNaN(k)){notice.textContent='请输入 1–10000 的整数 K。';$('researchTopInfo').textContent='';return;}
      weeks=fixedTopWeeks(weeks,k);$('researchTopInfo').textContent=(k===null?'原始全量':'固定 TOP'+k)+' · '+weeks.filter(w=>w.valid).length+' / '+weeks.length+' 周可比较';
    }
    if(attributeTopics.has(researchView)){renderAttributeStudy(scope,weeks);return;}
    if(researchView==='head'){renderHeadMarket(scope,weeks);return;}
    if(researchView==='coverage'){renderCoverageMarket(scope);return;}
    if(researchView==='dual'){renderDualMarket(scope);return;}
    if(['series','generation','structure'].includes(researchView)){
      $('researchDesc').textContent=observedGroups(researchView)?'按属性汇总各周原始入榜样本，不使用覆盖率或插补；未入榜只表示对当周榜单的贡献为零，不表示真实销量为零；整周缺榜留空。':'仅统计固定机型样本，不代表完整系列；任何组员不满足当前覆盖率、区间或插补要求时，该周合计留空，不自动缩减组员。组间不允许重复机型。';
      const groups=researchGroups(scope,c);
      if(!groups.length){notice.textContent='请填写有效分组。';return;}
      if(researchView==='series'){
        const cumulative=$('trackerMode').value==='cumulative_wan';
        const lines=groups.map(g=>{let sum=0,broken=false,est=false;return cumulative?{name:g.name,values:g.values.map(v=>{if(v===null)broken=true;else sum+=v;return broken?null:sum;}),imputed:g.imputed.map(v=>est=est||v)}:g;});
        researchPlot(weeks,lines,'万台');
        researchTable(['周期',...lines.map(g=>g.name+' (万台)'), '含插补'],weeks.map((w,i)=>[w.period,...lines.map(g=>numberText(g.values[i],4)),lines.some(g=>g.imputed[i])?'是':'否']));
        notice.textContent=(observedGroups(researchView)?'当期原始入榜系列样本合计':'固定系列样本合计')+' · '+(cumulative?'区间累计增量':'周销量增量');return;
      }
      if(researchView==='generation'&&groups.length!==2){notice.textContent='代际替代分析需要恰好两个不重叠分组（旧代、新代）。';return;}
      const totals=weeks.map((w,i)=>groups.some(g=>g.values[i]===null)?null:groups.reduce((s,g)=>s+g.values[i],0));
      const shares=groups.map(g=>({name:g.name,values:g.values.map((v,i)=>v===null||!totals[i]?null:100*v/totals[i]),imputed:weeks.map((w,i)=>groups.some(g=>g.imputed[i]))}));
      researchPlot(weeks,shares,'样本销量占比 / %',100);
      researchTable(['周期',...groups.flatMap(g=>[g.name+' (万台)',g.name+' 占比 (%)']),'含插补'],weeks.map((w,i)=>[w.period,...groups.flatMap((g,j)=>[numberText(g.values[i],4),numberText(shares[j].values[i])]),groups.some(g=>g.imputed[i])?'是':'否']));
      notice.textContent=researchView==='generation'?'两个代际的样本销量及相对占比；占比变化不证明用户实际换机。':'各组占所选样本总销量的贡献比例，并非整体市场份额。';return;
    }
    if(researchView==='tail'){
      $('researchDesc').textContent='只使用原始入榜观测；整周缺失中断连续纪录。末周年龄及销量对应所选末周；保持率 W4/W1、W8/W1 仅在所选区间具备两个真实完整销售周观测且 W1 大于零时计算。缺失不等于零。';
      const all=new Map();weeks.forEach(w=>w.map.forEach((r,k)=>matchesAttributes(k)&&all.set(k,canonicalName(r[col.model]))));
      const minimum=Math.max(1,Math.floor(Number($('researchStreak').value)||1)),end=weeks.at(-1);
      const records=[...all].map(([k,name])=>{let streak=0,best=0,count=0,first=null,last=null,total=0;
        for(const w of weeks){const r=w.map.get(k);if(r){count++;streak++;best=Math.max(best,streak);let v=Number(r[col.estimated_wan]);if(first===null)first=v;last=v;total+=v;}else streak=0;}
        const m=masterCatalog?.get(k),age=Product.lifecycle(m,end),r=end.map.get(k);
        return {name,count,best,streak,total,first,last,change:first>0?100*(last-first)/first:null,date:m?.sale_start_date||'',age,now:r?Number(r[col.estimated_wan]):null,w4:Product.retention(m,weeks,k,col,4),w8:Product.retention(m,weeks,k,col,8)};
      }).filter(r=>r.best>=minimum).sort((a,b)=>b.best-a.best||b.count-a.count||b.total-a.total);
      researchTable(['机型','观测周数','最长连续上榜','截至末周连续上榜','首个观测销量/万台','最近观测销量/万台','首末变化/%','上榜周销量合计/万台','开售日期','末周生命周期','末周上市天数','末周销量/万台','W4/W1保持率/%','W8/W1保持率/%'],records.map(r=>[r.name,r.count,r.best,r.streak,numberText(r.first),numberText(r.last),numberText(r.change),numberText(r.total),r.date,r.age?.label||'',r.age?.daysSinceSale??'',numberText(r.now,4),numberText(r.w4),numberText(r.w8)]));
      const valid=records.filter(r=>r.age&&Number.isFinite(r.now)).sort((a,b)=>b.now-a.now),shown=valid.slice(0,12);
      if($('researchTailView').value==='scatter'&&shown.length){
        researchPublicationChart={kind:'scatter',axis:'age',xLabel:'末周上市天数',yLabel:'末周销量（万台）',periods:shown.map(r=>r.name),lines:[{name:'上市天数',values:shown.map(r=>r.age.daysSinceSale)},{name:'销量/万台',values:shown.map(r=>r.now)}],calendarPeriods:[end.period]};
        ResearchCharts.renderComposition($('researchChart'),researchPublicationChart,'末周上市年龄与销量');
      }
      notice.textContent=weeks.length+' 周历史 · '+records.length+' 款达到 '+minimum+' 周门槛'+(weeks.length<minimum?'（当前历史长度不足）':'')+($('researchTailView').value==='scatter'?' · 散点展示末周有年龄及销量的前 '+shown.length+'/'+valid.length+' 款（按销量），表格保留全部。':'');return;
    }
    if(researchView==='flow'){
      const threshold=Math.min(52,Math.max(0,Math.floor(Number($('researchNewWeeks').value)||0)));$('researchNewWeeks').value=threshold;
      $('researchDesc').textContent='相邻可比较自然周才统计流动；按同一榜单口径的全部历史区分回榜和首次观测。首次观测且开售年龄为 P0 或 W1–W'+threshold+' 归为新品；更老为老机首次观测，无法判断日期为未知。首次观测不是实际首次上榜，退出不等于停销。';
      const rows=[],values=[[],[],[],[],[],[]],seen=new Set(),first=weeks[0].period;
      for(const w of fixedTopWeeks(scope.fullWeeks,topKValue())){if(w.period>=first)break;if(w.hasBoard)for(const k of w.map.keys())seen.add(k);}
      weeks.forEach((w,i)=>{const prev=weeks[i-1],ok=!!prev?.hasBoard&&w.hasBoard,add=ok?[...w.map].filter(([k])=>!prev.map.has(k)):[],out=ok?[...prev.map].filter(([k])=>!w.map.has(k)):[],stay=ok?w.count-add.length:null;
        const types={new:[],old:[],return:[],unknown:[]};for(const [k,r] of add)types[Product.entryType(masterCatalog?.get(k),w,seen.has(k),threshold)].push(canonicalName(r[col.model]));
        [stay,ok?types.new.length:null,ok?types.old.length:null,ok?types.return.length:null,ok?types.unknown.length:null,ok?out.length:null].forEach((v,j)=>values[j].push(v));
        rows.push([w.period,w.top,w.originalCount,w.count??'',w.comparisonStatus,numberText(w.cutoff,4),stay??'',ok?add.length:'',ok?out.length:'',ok?types.new.length:'',ok?types.old.length:'',ok?types.return.length:'',ok?types.unknown.length:'',types.new.join('、'),types.old.join('、'),types.return.join('、'),types.unknown.join('、'),out.map(x=>canonicalName(x[1][col.model])).join('、')]);
        if(w.hasBoard)for(const k of w.map.keys())seen.add(k);
      });
      researchPlot(weeks,['留榜','新品首次观测进入','老机首次观测进入','重新上榜','年龄未知进入','退出榜单'].map((name,i)=>({name,values:values[i]})),'机型数');
      researchTable(['周期','标称 TOP','原始实收条数','分析条数','周样本状态','门槛/万台','留榜','新进入合计','退出','新品首次观测','老机首次观测','重新上榜','年龄未知','新品名单','老机首次观测名单','回榜名单','未知名单','退出名单'],rows);
      notice.textContent='仅原始观测 · 新品门槛 P0 至 W'+threshold+' · 回榜按所选榜单口径全部历史判定。';return;
    }
    if(researchView==='brand'){renderBoardBrand(scope,weeks);return;}
  }

  function syncResearchEditors(){
    const scope=currentScope();
    if(!scope){$('researchGroupEditor').replaceChildren();$('researchPairEditor').replaceChildren();$('researchPairFocus').replaceChildren();$('researchGroupInfo').textContent='';$('researchPairInfo').textContent='';$('researchTopInfo').textContent='';return;}
    if(['series','generation','structure'].includes(researchView)){
      const generation=researchView==='generation',raw=observedGroups(researchView);
      visible($('researchGroupModeWrap'),!generation);visible($('researchGroupFieldWrap'),researchView==='structure');
      visible($('researchGenerationChoice'),generation);visible($('researchGroupButtons'),!raw);
      if(generation)fillGenerationChoices(scope);renderGroupEditor(scope);
    }
    if(researchView==='tier')renderPairEditor(scope);
  }
  $('researchSeriesPreset').onclick=()=>{const s=currentScope();if(s){groupStates.set(groupStateKey(s),groupPreset(s));renderGroupEditor(s);renderResearch();}};
  $('researchGroupField').onchange=()=>{if(currentScope()){if(observedGroups(researchView))syncResearchEditors();renderResearch();}};
  $('researchGroupMode').onchange=()=>{updateParamControls();syncResearchEditors();updateProductInfo(currentScope());renderResearch();};
  $('researchAddGroup').onclick=()=>{const s=currentScope();if(s){activeGroups(s).push({name:'',keys:[]});renderGroupEditor(s);renderResearch();}};
  $('researchPairPreset').onclick=()=>{const s=currentScope();if(s){pairStates.set(s.id,predecessorPreset(s));pairFocusStates.delete(s.id);renderPairEditor(s);renderResearch();}};
  $('researchAddPair').onclick=()=>{const s=currentScope();if(s){activePairs(s).push({name:'',old:'',next:''});renderPairEditor(s);renderResearch();}};
  $('researchPairFocus').onchange=()=>{const s=currentScope();if(s){pairFocusStates.set(s.id,Number($('researchPairFocus').value));renderResearch();}};
  $('researchTopMode').onchange=renderResearch;$('researchTopK').onchange=renderResearch;
  $('researchStreak').oninput=renderResearch;$('researchTailView').onchange=renderResearch;$('researchNewWeeks').onchange=renderResearch;
  $('researchExport').onclick=()=>exportCSVBlob(researchExportRows,'sales-research-'+researchView+'.csv');

  const researchSubtitles={model:'重点机型周销量与累计增量变化',series:'样本机型的销量合计与变化',generation:'新旧两代样本机型销量占比变化',structure:'不同产品分组样本销量贡献',tier:'同产品档位新旧机型销量对比',tail:'连续上榜纪录与销量长尾表现',flow:'新入、退出及留榜机型的变化',brand:'品牌结构、双周变化、集中度趋势',head:'头部榜单与全市场的品牌结构、富集与单品强度',dual:'TOP30与全市场品牌结构的双周流向对照',coverage:'苹果锚点TOP30覆盖率上限、情景与环比偏差',price:'首发价位的销量结构、趋势及品牌竞争',position:'销量加权首发价与高价位贡献',chip:'供应商及具体芯片平台的样本销量竞争',age:'各上市年龄段销量结构及品牌新品贡献',cross:'双属性交叉矩阵与销量结构'};
  const researchSend=document.createElement('button');researchSend.type='button';researchSend.className='primary';researchSend.textContent='用当前专题生成图卡';
  researchSend.style.margin='8px 0';researchNav.after(researchSend);
  researchSend.onclick=()=>sendResearchToStudio(researchView);
  function researchSnapshot(key){
    if(!Object.prototype.hasOwnProperty.call(researchViews,key)||masterLoading||!loaded)return null;
    setResearchView(key);
    const scope=currentScope();if(!scope)return null;
    const p=readTrackerParams(),rawView=isRawResearch(key),metric=$('trackerMode').value;
    const selectedRange=scope.weeks[0].period+'—'+scope.weeks[scope.weeks.length-1].period;
    let chart=key==='model'?trackerPublicationChart:researchPublicationChart,table=key==='model'?null:researchPublicationTable;
    const trendMode=key==='model'?trackerView.value:'sales';
    const rankOnly=key==='model'&&['rank','matrix'].includes(trendMode),combined=key==='model'&&trendMode==='both';
    if(chart&&trackerPublicationRank&&(rankOnly||combined)){
      const rankLines=trackerPublicationRank.lines.map(l=>({name:l.name,color:l.color,marker:l.marker,values:l.points.map(p=>p?.value??null),imputed:l.points.map(()=>false),sourcePeriods:l.points.map(p=>p?.period||''),statuses:l.points.map(p=>p?.status||'无对应记录'),boardSizes:l.points.map(p=>p?.top||'')}));
      const effective=new Set(combined?(chart.calendarPeriods||chart.periods.filter((_,i)=>chart.lines.some(l=>Number.isFinite(l.values[i])))):[]);
      rankLines.forEach(l=>l.values.forEach((v,i)=>{if(Number.isFinite(v)&&l.sourcePeriods[i])effective.add(l.sourcePeriods[i]);}));
      chart={...chart,kind:combined?'trackerBoth':trendMode==='matrix'?'trackerMatrix':'trackerRank',unit:rankOnly?'名':'万台',lines:rankOnly?rankLines:chart.lines,rankLines:combined?rankLines:undefined,calendarPeriods:[...effective].sort(),salesLabel:lifeMode()?lifeMetric(metric):metric==='cumulative_wan'?'区间累计增量':'周销量'};
    }
    if(chart){
      // Keep original line colors, precisely preserve missing points and estimate flags.
      chart={...chart,lines:chart.lines.map(l=>({...l,values:l.values.map(v=>Number.isFinite(v)?v:null),imputed:[...(l.imputed||[])]}))};
      chart.imputed=chart.lines.some(l=>l.values.some((v,i)=>v!==null&&l.imputed[i]));
    }
    const hasData=chart?(chart.kind==='scatter'?chart.lines[0].values.some((v,i)=>Number.isFinite(v)&&Number.isFinite(chart.lines[1].values[i])):(chart.lines.some(l=>l.values.some(Number.isFinite))||!!chart.rankLines?.some(l=>l.values.some(Number.isFinite)))):key==='tail'&&!!table?.rows.length;
    if(!hasData)return null;
    const timeAxis=chart?.periods?.length&&chart.periods.every(v=>/^\d{4}-W\d{2}$/.test(v));
    const chartRange=key==='dual'&&dualPublicationInfo?dualPublicationInfo.range:key==='coverage'&&coveragePublicationInfo?coveragePublicationInfo.range:attributeTopics.has(key)&&attributePublicationInfo?attributePublicationInfo.range:chart?.axis==='lifecycle'&&chart.periods.length?chart.periods[0]+'—'+chart.periods.at(-1)+'（完整销售周）':key==='brand'&&brandPublicationInfo?brandPublicationInfo.range:timeAxis?chart.periods[0]+'—'+chart.periods[chart.periods.length-1]:key==='head'&&headPublicationInfo?headPublicationInfo.range:selectedRange;
    const effectivePeriods=chart?.calendarPeriods|| (key==='dual'?dualPublicationInfo?.effectivePeriods||[]:key==='coverage'?coveragePublicationInfo?.effectivePeriods||[]:key==='head'?headPublicationInfo?.effectivePeriods||[]:key==='brand'?brandPublicationInfo?.effectivePeriods||[]:timeAxis?chart.periods.filter((_,i)=>chart.lines.some(l=>Number.isFinite(l.values[i]))):scope.weeks.filter(w=>w.hasBoard).map(w=>w.period));
    const range=chartRange;
    const chartKind=chart?.kind|| (chart?'line':'table');
    if(chart&&chart.lines.length>24){notify('单张图卡最多展示24条曲线，请减少研究机型或分组。');return null;}
    const top=['coverage','dual'].includes(key)?30:usesTopK(key)?topKValue():null;
    const modeLabel=rankOnly?'仅原始排名':rawView?'仅原始观测':p.dataMode==='raw'?'仅原始观测':p.maxGap===0?'不插补':p.method==='bounded'?'门槛约束插补':'线性插值';
    const displayMetric=rankOnly?(trendMode==='matrix'?'历史原始排名矩阵':'原始榜单排名走势'):combined?(chart.salesLabel+'与原始排名'):attributeTopics.has(key)?attributePublicationInfo?.metricLabel||researchViews[key]:chart?.axis==='lifecycle'?lifeMetric(metric):chart?.axis==='age'?'末周上市年龄与销量':key==='dual'?(dualPublicationInfo?.metricLabel||'TOP30与全市场双流向图'):key==='coverage'?(coveragePublicationInfo?.metricLabel||'TOP30市场覆盖率情景'):key==='head'?(headPublicationInfo?.metricLabel||'跨模块品牌研究'):key==='generation'||key==='structure'?'样本销量占比':key==='brand'?(brandPublicationInfo?.metricLabel||'榜单品牌结构'):key==='flow'?'榜单流动 · '+(top===null?'原始全量':'固定 TOP'+top):key==='tail'?'连续上榜 · ≥ '+$('researchStreak').value+' 周':metric==='cumulative_wan'?'区间累计增量':'周销量增量';
    let detail='';
    if(['series','generation','structure'].includes(key))detail=$('researchGroupInfo').textContent;
    if(key==='tier')detail=activePairs(scope).map(q=>q.name+'：'+q.old+' / '+q.next).join('；')+'；'+$('researchPairInfo').textContent;
    if(filterTopics.has(key)&&Object.keys(filters()).length)detail+=(detail?'；':'')+'属性筛选：'+JSON.stringify(filters())+(['series','structure','generation','tier'].includes(key)&&!observedGroups(key)?'（固定成员未自动缩减）':'');
    if(usesTopK(key))detail=$('researchTopInfo').textContent+(key==='flow'?'；'+$('researchNotice').textContent:'');
    if(key==='head')detail=headPublicationInfo?.detail||detail;
    if(key==='coverage')detail=coveragePublicationInfo?.detail||detail;
    if(key==='dual')detail=dualPublicationInfo?.detail||detail;
    if(key==='brand')detail=brandPublicationInfo?.detail||detail;
    if(attributeTopics.has(key))detail=[attributePublicationInfo?.detail, $('researchTopInfo').textContent,'属性筛选：'+JSON.stringify(filters()),'专题配置：'+JSON.stringify(attributeSettings(key))].filter(Boolean).join('；');
    const note=(key==='dual'?'两图分别使用TOP30榜单样本与模块2全市场份额；仅为结构对比，不推断品牌间销量流向。':key==='coverage'?'苹果锚点反推仅为覆盖率条件上限与情景；模块2品牌份额和趋势为独立数据源；缺失不等于零。':key==='head'?'头部榜单为估算样本；全市场份额来自模块2独立数据源；缺失不等于零。':'数据为历史榜单估算样本，不代表全市场销量或份额；缺失不等于零。')+(chart?.imputed?'图中含插补值。':'');
    const chartNote=rankOnly?'原始排名，不插补；各期榜单规模可能不同。':combined?'销量按当前统计口径；排名只取原始榜单，不插补。':attributeTopics.has(key)?attributePublicationInfo?.note||'仅原始榜单样本':chart?.axis==='lifecycle'?'完整销售周 W1 起；不含 P0；累计缺 W1 或中断留空':chart?.axis==='age'?'末周实收样本；按销量最多12款，完整记录见 CSV':key==='dual'?(dualPublicationInfo?.note||'双周样本与市场份额对比'):key==='coverage'?(coveragePublicationInfo?.note||'完整TOP30、入榜率情景、市场环比偏差'):key==='head'?(headPublicationInfo?.note||'仅共同有效周'):key==='brand'?(brandPublicationInfo?.note||'仅榜单样本'):key==='flow'?'相邻可比较周 · 进入/退出不代表上市/停销':key==='tail'?'连续上榜只计原始观测 · 未入榜不等于零销量':key==='generation'||key==='structure'?'仅分组样本占比 · 不代表市场份额':'估算销量 · 仅所选样本，非上市以来累计';
    const summary=key==='model'?(rankOnly?'原始排名 · '+chart.lines.length+' 款机型 · '+effectivePeriods.length+' 个有效自然周' : $('trackerStatus').textContent):$('researchNotice').textContent;
    const description=rankOnly?'所选机型的原始榜单排名，无记录不等于停销；不根据筛选重排。':combined?'所选机型销量与原始排名共享时间轴；销量插补不用于排名。':key==='model'?(chart?.axis==='lifecycle'?'按正式开售日对齐完整销售周；累计从 W1 连续有效起算，不含 P0。':'选中机型在当前统计区间的销量趋势。'):$('researchDesc').textContent;
    const baseCsv=key==='model'?modelExportRows():researchExportRows;
    if(!baseCsv.length||baseCsv.length<2)return null;
    const effectiveText=effectivePeriods.length+' 周'+(effectivePeriods.length?'（'+effectivePeriods[0]+'—'+effectivePeriods[effectivePeriods.length-1]+'）':'');
    const csv=baseCsv.map((r,i)=>i===0?[...r,'发布所选区间','发布图表区间','发布有效周次']: [...r,selectedRange,chartRange,effectivePeriods.join(' / ')]);
    const sampleLabel=top===null?(observedGroups(key)?'当期原始入榜样本':usesTopK(key)?'原始全量':'所选样本'):'固定 TOP'+top;
    const footer=[['head','coverage','dual'].includes(key)?'来源：'+scope.source+' / '+scope.series+' + 模块2市场份额':'来源：'+scope.source+' / '+scope.series+' · 历史榜单估算样本',key==='dual'?($('dualView').value==='multi'?'TOP30与全市场保留原始分母；相邻有效周色带仅连接同品牌，多周模式不显示变化pp列。':'TOP30与全市场两图分母不同，颜色带不是品牌间销量迁移；仅在变化pp列突出涨跌极值。'):key==='coverage'?'仅条件性理论上限与情景假设；跨来源统计口径及苹果入榜率未知，环比比较假定入榜率固定。':key==='head'?'榜单样本占比非市场份额；跨数据源比较，不推断榜外销量。':'仅所选榜单样本，不代表全市场销量或品牌市场份额；缺失不等于零。',sampleLabel+' · '+(chart?.imputed?'含插补':'图中未使用插补')+' · '+effectivePeriods.length+' 个有效自然周'].join('\n');
    const config={scopeId:scope.id,selectedRange,chartRange,source:scope.source,series:scope.series,algorithm:Series.VERSION,masterRevision:masterCatalog?.revision||null,masterStatus:masterCatalog?'loaded':'unavailable',parameters:rawView?{start:p.start,end:p.end,dataMode:'raw'}:{...p},topK:top,filters:filterTopics.has(key)?filters():{},topic:attributeTopics.has(key)?attributeSettings(key):key==='tier'?{axis:lifeMode()?'lifecycle':'calendar',metric,pairs:activePairs(scope),focus:Number($('researchPairFocus').value)}:key==='model'?{axis:lifeMode()?'lifecycle':'calendar',metric,trendMode,selected:[...trackerSelected].filter(matchesAttributes)}:['series','generation','structure'].includes(key)?{memberMode:observedGroups(key)?'observed':'fixed',groups:activeGroups(scope),metric}:key==='brand'?{view:$('brandView').value,metric:$('brandMetric').value,base:$('brandBase').value,compare:$('brandCompare').value,concentration:$('brandCon').value}:key==='dual'?{top:30,view:$('dualView').value,base:$('dualView').value==='pair'?$('dualBase').value:null,compare:$('dualView').value==='pair'?$('dualCompare').value:null,brandGroups:'six',showOther:false,extremeRule:$('dualView').value==='multi'?'none':'rounded-0.1pp-with-ties',connectAdjacentValidOnly:true}:key==='coverage'?{top:30,view:$('coverageView').value,appleCaptureRates:coverageRates(),marketTrendRule:'module2-quantified-only',constantCaptureForGrowth:true}:key==='head'?{view:$('headView').value,brand:$('headBrand').value,trend:$('headTrendMetric').value,concentration:$('headConcentration').value}:key==='tail'?{minimum:$('researchStreak').value,view:$('researchTailView').value}:key==='flow'?{newWeeks:$('researchNewWeeks').value}:{},chartKind};
    const snapshot={schemaVersion:2,config,ready:true,key,title:researchViews[key],subtitle:key==='model'&&(rankOnly||combined)?displayMetric:attributeTopics.has(key)?attributePublicationInfo?.metricLabel||researchSubtitles[key]:key==='brand'?(brandPublicationInfo?.metricLabel||researchSubtitles[key]):key==='head'?(headPublicationInfo?.metricLabel||researchSubtitles[key]):key==='coverage'?(coveragePublicationInfo?.metricLabel||researchSubtitles[key]):key==='dual'?(dualPublicationInfo?.metricLabel||researchSubtitles[key]):researchSubtitles[key],range,effectivePeriods,footer,source:scope.source+' / '+scope.series+(['head','coverage','dual'].includes(key)?' + 模块2 市场份额':''),context:scope.source+' / '+scope.series+' · 图表 '+chartRange+' · 所选 '+selectedRange+' · '+(['head','coverage','dual'].includes(key)?'共同有效':'有效观测')+' '+effectiveText+' · '+modeLabel+(top===null?'':' · 固定 TOP'+top),modeLabel,displayMetric,chart,table,summary,description,detail,note,chartNote,csv};
    return JSON.parse(JSON.stringify(snapshot));
  }
  async function sendResearchToStudio(key=researchView){
    if(masterLoading||!loaded){notify('历史销量或机型主数据尚在加载，请读取完成后再生成专题。');return false;}
    if(['head','coverage','dual'].includes(key)&&!marketCache){await ensureMarketData();}
    const s=researchSnapshot(key);
    if(!s){notify('当前专题没有可发布的研究结果；请检查区间、机型及分组。');return false;}
    if(!applyResearchTopicToStudio(s))return false;
    activateModuleTab('social');$('socialStudio').scrollIntoView({behavior:'smooth',block:'start'});return true;
  }
  // Add the research topics to the existing publishing-topic chooser.
  const chooser=$('templateChooser'),researchChooser=document.createElement('section'),researchHeading=document.createElement('h4');
  researchHeading.className='topic-category-title';researchHeading.textContent='专题研究发布';researchChooser.className='studio-research-topics';researchChooser.append(researchHeading);chooser.append(researchChooser);
  for(const category of researchCategories){
    const grid=topicSection(researchChooser,category.label,'post-templates');
    for(const key of category.keys){
      const b=document.createElement('button');b.type='button';b.className='template-option';b.dataset.template='research:'+key;
      b.innerHTML='<span><b>'+e(researchViews[key])+'</b><small>'+e(researchSubtitles[key])+'</small></span>';grid.append(b);
    }
  }
  const prefReset=document.createElement('button');prefReset.type='button';prefReset.className='secondary';prefReset.textContent='清除本地研究配置';prefReset.onclick=()=>{if(confirm('清除本浏览器的研究参数、机型选择与分组配置？不会改变任何 CSV。')){Pref.remove('research');location.reload();}};parameterPanel.append(prefReset);
  const importCurrent=document.createElement('button');importCurrent.type='button';importCurrent.className='secondary';importCurrent.textContent='导入当前研究专题';importCurrent.style.margin='8px 0';
  importCurrent.onclick=()=>sendResearchToStudio(researchView);chooser.after(importCurrent);

  Pref.apply(storedResearch.controls,researchControlIds);
  for(const [target,saved] of [[headTopState,storedResearch.headTop],[otherTopState,storedResearch.otherTop]]){if(['all','10','20','30','custom'].includes(saved?.mode))target.mode=saved.mode;if(Number(saved?.custom)>=1&&Number(saved.custom)<=10000)target.custom=String(saved.custom);}
  Pref.setControl($('researchTopMode'),otherTopState.mode);Pref.setControl($('researchTopK'),otherTopState.custom);
  setResearchView(Object.prototype.hasOwnProperty.call(researchViews,storedResearch.view)?storedResearch.view:'model');
  function resetIdentities(){
    // Preserve current-version preferences at initial load; discard provisional state only after failure.
    if(masterError){for(const n of Object.values(productControls))n.value='';selectedByScope.clear();groupStates.clear();pairStates.clear();pairFocusStates.clear();trackerSelected.clear();}
  }
  return {refreshTracker,sendResearchToStudio,resetIdentities};
  }

  const controls = {source:'archiveSource',series:'archiveSeries',type:'archiveType',period:'archivePeriod',
    start:'archiveStart',end:'archiveEnd',top:'archiveTop'};
  function initEstimateArchive() {
  $('exportCsv').textContent = '导出本期销量 CSV';
  const report = document.createElement('button');
  report.type = 'button'; report.className = 'secondary'; report.textContent = '导出标定报告 CSV';
  $('exportCsv').after(report);
  report.onclick = exportCSV;

  for (const [key,id] of Object.entries(controls)) {
    $(id).addEventListener('input', () => {
      const m = datasetMeta(ds());
      const oldType = m.type;
      readControls();
      if (key === 'type' && oldType !== m.type) {
        m.period = ''; $('archivePeriod').value = '';
      }
      updateControls();
    });
  }
  $('exportCsv').onclick = () => {
    try { const rows = buildRows(); exportCSVBlob([HEADER,...rows],singleName(rows)); notify('本期标准销量 CSV 已导出'); }
    catch (err) { notify(err.message); }
  };
  updateControls(true);
  }
  function readControls() {
    const m = datasetMeta(ds());
    for (const [key,id] of Object.entries(controls)) m[key] = $(id).value;
    return m;
  }
  function updateControls(reset = false) {
    const m = datasetMeta(ds());
    if (reset) for (const [key,id] of Object.entries(controls)) $(id).value = m[key];
    $('archivePeriodWrap').hidden = m.type === 'custom';
    $('archiveDatesWrap').hidden = m.type !== 'custom';
    $('archivePeriod').placeholder = m.type === 'monthly' ? '2026-M11' : '2026-W46';
    const count = ds().bars.length;
    try {
      const normalized = normalizeMeta(m,count);
      const partial = normalized.top && Number(normalized.top) > count;
      $('archiveMetaStatus').className = 'msg' + (partial ? ' warn' : '');
      $('archiveMetaStatus').textContent = normalized.period + ' · ' + (normalized.top ? 'TOP' + normalized.top : '自定义榜单') +
        ' · 实际 ' + count + ' 条' + (partial ? '（少于标称规模，按不完整榜单保存）' : '') + ' · ' + normalized.start + ' 至 ' + normalized.end;
    } catch (err) {
      $('archiveMetaStatus').className = 'msg warn';
      $('archiveMetaStatus').textContent = '实际识别 ' + count + ' 条。' + err.message;
    }
    const o = derivedData();
    let ready = false;
    try { buildRows(o); ready = true; } catch (_) {}
    $('archiveMerge').disabled = !loaded || loading || !ready;
    $('exportCsv').disabled = !ready;
  }
  function showHistory(message) {
    const map = groups(history);
    const select = $('archiveSelect'), old = select.value;
    select.replaceChildren();
    for (const [id,list] of [...map.entries()].sort((a,b) => b[1][0][col.period_end].localeCompare(a[1][0][col.period_end]) || a[0].localeCompare(b[0]))) {
      const option = document.createElement('option'); option.value = id; option.textContent = labelOf(list[0]); select.append(option);
    }
    if (map.has(old)) select.value = old;
    if (!map.size) {
      const option = document.createElement('option'); option.value = ''; option.textContent = loading ? '正在加载历史榜单…' : loaded ? '仓库暂无历史榜单' : '历史加载失败，请查看上方提示'; select.append(option);
    }
    select.disabled = !map.size;
    $('archiveUseStudio').disabled = !map.size;
    $('archiveReload').disabled = loading;
    $('archiveHistoryStatus').className = 'msg' + (!loaded || pending ? ' warn' : ' good');
    $('archiveHistoryStatus').textContent = message || (loaded ?
      origin + ' · ' + map.size + ' 期榜单 / ' + history.length + ' 条记录' + (pending ? ' · 含本会话尚待提交的数据' : '') :
      '尚未加载历史 CSV；为防止覆盖历史，请先导入完整历史文件。');
    $('archiveImport').disabled = loading;
    showHistoryRows();
    // Optional downstream consumers cannot prevent the history UI or other consumers updating.
    if (!loading) {
      try {
        if (socialArchiveDataset) {
          const selected = map.get(select.value);
          if (!selected) setSocialArchiveDataset(null);
          else if (socialArchiveDataset.id !== select.value ||
              JSON.stringify(socialArchiveDataset.archiveRows) !== JSON.stringify(selected)) setSocialArchiveDataset(studioDataset(selected));
        }
      } catch (err) { reportConsumerError('图文工作台', err); }
    }
    try { updateControls(); }
    catch (err) { reportConsumerError('榜单估算', err); }
    if (!loading) refreshResearch();
  }
  function showHistoryRows() {
    const list = groups(history).get($('archiveSelect').value) || [];
    $('archiveRows').innerHTML = list.length ? list.map(r => '<tr><td>'+e(r[col.rank])+'</td><td>'+e(r[col.model])+'</td><td>'+e(classifyHeadBrand(r)||'未识别品牌')+'</td><td class="num">'+e(historyDisplayWan(Number(r[col.estimated_units])/10000))+'</td></tr>').join('') : '<tr><td colspan="4" class="empty">'+(loading ? '正在加载历史销量…' : loaded ? '尚无历史销量记录' : '历史加载失败，请查看上方提示')+'</td></tr>';
  }
  function bindSelectedHistory(scroll = false) {
    const list = groups(history).get($('archiveSelect').value);
    if (!list || !list.length) return;
    if (!socialArchiveDataset || socialArchiveDataset.id !== list[0][col.dataset_id] ||
        JSON.stringify(socialArchiveDataset.archiveRows) !== JSON.stringify(list)) setSocialArchiveDataset(studioDataset(list));
    if (scroll) { if(researchStudioActive()){leaveResearchStudio('top');updateSocial(true);} activateModuleTab('social'); $('socialStudio').scrollIntoView({behavior:'smooth',block:'start'}); }
  }
  $('archiveSelect').onchange = () => { showHistoryRows(); bindSelectedHistory(); };
  $('archiveUseStudio').onclick = () => bindSelectedHistory(true);
  $('archiveImport').onclick = () => $('archiveFile').click();
  $('archiveFile').onchange = async ev => {
    const file = ev.target.files[0]; ev.target.value = ''; if (!file || loading) return;
    try {
      const incoming = parseCSV(await file.text());
      if (!loaded && !window.confirm('仓库历史未能加载。确定此文件包含需要保留的完整历史数据？')) return;
      const merged = mergeRows(history,incoming); if (!merged) return;
      history = merged.rows; pending = pending || merged.changed || !loaded;
      loaded = true; origin = '已读取本地 CSV 并合并';
      showHistory(); notify('历史数据已导入');
    } catch (err) { notify('导入失败：' + err.message); }
  };
  function singleName(rows) {
    const r = rows[0];
    return 'sales-estimates_' + slugName(r[col.period]) + (r[col.top_n] ? '_TOP' + r[col.top_n] : '_sample' + r[col.actual_count]) + '.csv';
  }
  $('archiveMerge').onclick = () => {
    try {
      if (!loaded || loading) fail('请先加载完整历史 CSV。');
      const rows = buildRows(), merged = mergeRows(history,rows);
      if (!merged) return;
      exportCSVBlob([HEADER,...merged.rows],FILE);
      history = merged.rows; pending = pending || merged.changed;
      showHistory(); notify('完整历史 CSV 已导出，请提交到 GitHub');
    } catch (err) { notify('导出失败：' + err.message); }
  };

  function returnToStudioSource(){
    const key=researchStudioActive()?'tracker':socialArchiveDataset?'history':null;
    if(!key)return;
    // Navigation only: preserve the frozen publication and the live source controls.
    activateModuleTab(key);
    modulePanes[key].scrollIntoView({behavior:'smooth',block:'start'});
  }
  window.SalesEstimateArchive = Object.freeze({buildRows,sendResearchToStudio,returnToStudioSource,updateControls,header:HEADER.slice()});
  async function loadRepository() {
    loading = true;
    showHistory('正在读取仓库历史数据…');
    try {
      const r = await fetch(FILE + '?t=' + Date.now(), {cache:'no-store'});
      if (!r.ok) fail('HTTP ' + r.status);
      history = parseCSV(await r.text()); loaded = true; pending = false; origin = '仓库历史数据已加载';
    } catch (err) {
      // Keep already loaded rows visible, but require a successful reload or an explicit import before merging.
      origin = ''; loaded = false;
      loading = false;
      showHistory('读取仓库历史失败（' + err.message + '）。请刷新仓库历史，或导入完整历史 CSV 后再合并，避免丢失历史记录。');
      return;
    }
    loading = false; showHistory();
  }
  $('archiveReload').onclick = () => {
    if (loading) return;
    if (pending && !window.confirm('刷新仓库历史将替换当前会话的未提交数据。请确认已导出备份，是否继续？')) return;
    loadRepository();
  };
  // Start the history request before initializing optional UI consumers.
  loadRepository();
  try { initEstimateArchive(); }
  catch (err) {
    reportConsumerError('榜单估算初始化', err);
    const status = $('archiveMetaStatus');
    if (status) status.textContent = '榜单估算存档初始化失败：' + (err?.message || String(err));
  }
  try { research = initResearch(); }
  catch (err) { reportResearchError(err); }
  $('modelMasterRetry').onclick=()=>{if(!masterLoading)loadMaster();};
  loadMaster();
})();
