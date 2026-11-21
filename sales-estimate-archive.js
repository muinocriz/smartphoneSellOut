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
  const Pref=window.StudioPreferences,storedResearch=Pref.read('research');
  const researchControlIds=['trackerCoverage','trackerCoverageBase','trackerDataMode','trackerImputeRule','trackerMaxGap','trackerMissingBoard','trackerTrailing','trackerMode','researchStreak','headView','headBrand','headTrendMetric','headConcentration','brandView','brandMetric','brandCon'];
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
    scopeSettings.set(scope.id,{...existing,start:p.start,end:p.end,followLatest:end.value===end.options[end.options.length-1]?.value,eventStart:$('researchStart').value,eventEnd:$('researchEnd').value,...(researchView==='brand'?{brandBase:$('brandBase').value,brandCompare:$('brandCompare').value}:{})});
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
    if(scope){if(resetSelection){if(selectedByScope.has(scope.id)){const saved=selectedByScope.get(scope.id),known=knownModels(scope);trackerSelected=new Set([...saved].filter(k=>known.has(k)));if(saved.size&&!trackerSelected.size)defaultTrackerSelection(scope);selectedByScope.set(scope.id,new Set(trackerSelected));}else defaultTrackerSelection(scope);}if(!selectedByScope.has(scope.id))selectedByScope.set(scope.id,new Set(trackerSelected));researchPeriods(scope);updateParameterStatus();}
    trackerOptions();renderTracker();syncResearchEditors();renderResearch();
  }

  let trackerData = {header:[],rows:[],scopes:[]};
  let trackerSelected = new Set();
  const trackerPalette = ['#2563eb','#ea580c','#059669','#9333ea','#db2777','#0891b2','#92400e','#64748b'];
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
    for(const m of scope.models.filter(m=>matchesModel(m.key,m.name,q))){
      const label=document.createElement('label'), cb=document.createElement('input');
      cb.type='checkbox';cb.checked=trackerSelected.has(m.key);
      cb.onchange=()=>{if(cb.checked)trackerSelected.add(m.key);else trackerSelected.delete(m.key);selectedByScope.set(scope.id,new Set(trackerSelected));renderTracker();renderResearch();};
      label.append(cb,document.createTextNode(' '+m.name));target.append(label);
    }
  }
  let trackerPublicationChart=null;
  function renderTracker(){try{renderTrackerContent();}finally{if(researchView==='model')saveResearchPreferences();}}
  function renderTrackerContent(){
    trackerPublicationChart=null;
    const scope=currentScope(), chart=$('trackerChart'), legend=$('trackerLegend'), table=$('trackerRows');
    chart.replaceChildren();legend.replaceChildren();table.replaceChildren();
    $('trackerExport').disabled=!trackerData.rows.length;
    if(!scope){$('trackerStatus').textContent='暂无符合口径的周销量榜单数据。';return;}
    const c=Object.fromEntries(trackerData.header.map((h,i)=>[h,i]));
    const models=scope.models.filter(m=>trackerSelected.has(m.key));
    const metric=$('trackerMode').value;
    const curves=models.map((m,i)=>({m,color:trackerPalette[i%trackerPalette.length],rows:scope.rows.filter(r=>r[c.sequence_id]===m.key)}));
    $('trackerStatus').textContent=scope.weeks.length+' 周 / '+scope.models.length+' 款长期追踪机型 · 已选 '+models.length+' 款 · 插补 '+curves.reduce((n,o)=>n+o.rows.filter(r=>r[c.is_imputed]==='1').length,0)+' 条';
    if(!curves.length){$('trackerStatus').textContent+=' · 请勾选符合当前参数的机型；必要时降低覆盖率。';return;}
    const val=r=>r[c[metric]]===''?null:Number(r[c[metric]]);
    trackerPublicationChart={periods:scope.weeks.map(w=>w.period),unit:'万台',lines:curves.map(o=>{let prior=false;return {name:o.m.name,color:o.color,values:o.rows.map(val),imputed:o.rows.map(r=>{const now=r[c.is_imputed]==='1';prior=prior||now;return metric==='cumulative_wan'?prior:now;})};})};
    ResearchCharts.svgLine(chart,legend,trackerPublicationChart,'热销机型销量折线图',4);
    for(const o of curves){
      const last=o.rows[o.rows.length-1], n=o.rows.filter(r=>r[c.is_imputed]==='1').length;
      const show=v=>v===''?'—':Number(v).toFixed(2);
      const tr=document.createElement('tr');tr.innerHTML='<td>'+e(o.m.name)+'</td><td>'+e((100*Number(last[c.coverage_rate])).toFixed(1))+'%</td><td>'+n+'</td><td class="num">'+e(show(last[c.weekly_wan]))+'</td><td class="num">'+e(show(last[c.cumulative_wan]))+'</td>';table.append(tr);
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
  $('trackerExport').onclick=()=>exportCSVBlob(Series.versionedRows(trackerData),'weekly-sales-panel-'+$('trackerStart').value+'_'+$('trackerEnd').value+'.csv');

  // Research views share the selected source/series and never combine different observation scopes.
  const researchNav=document.createElement('div');
  researchNav.style.cssText='display:grid;gap:12px;margin:12px 0';
  const researchViews={model:'机型销量趋势',series:'系列销量趋势',generation:'代际替代分析',structure:'产品结构分析',tier:'同档代际对比',tail:'长尾韧性分析',flow:'榜单流动分析',event:'促销区间对比',brand:'榜单品牌结构与集中度',head:'品牌头部效应与全市场对比'};
  // A single topic registry drives both research navigation and publication chooser.
  const researchCategories=[
    {label:'产品销量研究',keys:['model','series','generation','structure','tier','event']},
    {label:'榜单生态研究',keys:['tail','flow','brand']},
    {label:'跨模块研究',keys:['head']}
  ];
  const isRawResearch=key=>['tail','flow','brand','head'].includes(key);
  const usesTopK=key=>['flow','brand','head'].includes(key);
  const researchButtons={};
  let researchView='model';
  const scopeControl=$('trackerScope');
  // The research navigation follows the retained heading, not optional descriptive copy.
  tracker.querySelector('h2').after(researchNav);
  const researchPanel=document.createElement('div');
  researchPanel.innerHTML='<h3 id="researchTitle"></h3><p id="researchDesc" class="mini"></p>'+
    '<div id="researchGroupControls"><p class="mini">创建分组、命名并从机型池勾选成员。一个机型只能属于一个组；不自动合并不同产品版本。</p>'+
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0"><button type="button" class="secondary" id="researchSeriesPreset">按当前品牌自动分系列</button><button type="button" class="secondary" id="researchTierPreset">按当前品牌自动分版本</button><button type="button" class="secondary" id="researchAddGroup">+ 添加分组</button></div>'+
    '<div id="researchGroupEditor"></div><p id="researchGroupInfo" class="mini" aria-live="polite"></p></div>'+
    '<div id="researchTierControls"><p class="mini">手动选择相同产品档位的新旧机型。按相同自然周比较，非上市同期；未观测且无法插补时保留空值。</p>'+
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
    '<div id="researchTailControls"><label class="lbl" for="researchStreak">最少连续上榜周数（最长连续纪录）</label><input type="number" id="researchStreak" class="field ui-field" min="1" step="1" value="12"></div>'+
    '<div id="researchEventControls" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px"><div><label class="lbl" for="researchStart">活动起始周</label><select id="researchStart" class="field ui-field"></select></div><div><label class="lbl" for="researchEnd">活动结束周</label><select id="researchEnd" class="field ui-field"></select></div></div>'+
    '<div id="researchNotice" class="msg" aria-live="polite"></div><div id="researchChart" style="overflow:auto"></div><div id="researchLegend" style="display:flex;flex-wrap:wrap;gap:8px 16px"></div>'+
    '<div class="tablewrap"><table class="ranktable"><thead id="researchHead"></thead><tbody id="researchRows"></tbody></table></div>'+
    '<button type="button" class="secondary" id="researchExport" style="margin-top:10px" disabled>导出当前专题 CSV</button>';
  tracker.append(researchPanel);
  // Scope is always visible. The original chart/filter controls are retained for the model and event views.
  const commonGrid=scopeControl.parentElement.parentElement;
  const modelNodes=Array.from(tracker.children).filter(n=>n!==researchNav&&n!==researchPanel&&n!==parameterPanel&&n!==commonGrid&&n!==tracker.querySelector('h2')&&n!==$('trackerExport'));
  // Keep selection controls available in event comparison without duplicating them.
  const eventPickNodes=[$('trackerFilter').previousElementSibling,$('trackerFilter'),$('trackerModels')];
  const metricNode=$('trackerMode').parentElement;
  function visible(node,show){if(!node)return;node.hidden=!show;node.style.display=show?(node.dataset.researchDisplay||''):'none';}
  for(const n of [...modelNodes,...eventPickNodes,metricNode,researchPanel,$('researchGroupControls'),$('researchTierControls'),$('researchTopControls'),$('researchBrandControls'),$('researchHeadControls'),$('researchTailControls'),$('researchEventControls')])if(n)n.dataset.researchDisplay=n.style.display||'';
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
    for(const n of modelNodes)visible(n,key==='model'||(key==='event'&&eventPickNodes.includes(n)));
    visible(metricNode,key==='model'||key==='series'||key==='tier');
    visible(researchPanel,key!=='model');
    visible($('researchGroupControls'),['series','generation','structure'].includes(key));
    visible($('researchTierControls'),key==='tier');
    visible($('researchTopControls'),usesTopK(key));
    visible($('researchHeadControls'),key==='head');
    visible($('researchBrandControls'),key==='brand');
    $('researchTopCustom').hidden=$('researchTopMode').value!=='custom';
    visible($('researchTailControls'),key==='tail');
    visible($('researchEventControls'),key==='event');
    if(key==='model')renderTracker();else {syncResearchEditors();renderResearch();}
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
    const p=readTrackerParams();const rawView=isRawResearch(researchView);const meta=['榜单口径','统计起始周','统计结束周','最低覆盖率%','覆盖率分母','数据模式','插补方法','最大缺失周','允许整周插补','允许末周估算'];const values=[p.scopeId,p.start,p.end,rawView?'不适用':p.coverage,rawView?'不适用':p.coverageBase,rawView?'raw':p.dataMode,rawView||p.dataMode==='raw'?'不适用':p.method,rawView||p.dataMode==='raw'?'不适用':p.maxGap,rawView||p.dataMode==='raw'?'不适用':String(p.missingBoard),rawView||p.dataMode==='raw'?'不适用':String(p.trailing)];const scope=currentScope(),isTop=usesTopK(researchView),isGroup=['series','generation','structure'].includes(researchView);meta.push('时间序列算法版本','机型主数据版本指纹','榜单样本模式','固定TOP K','机型分组定义');values.push(Series.VERSION,masterCatalog?.revision||'',isTop?(topKValue()===null?'all':'fixed'):'不适用',isTop&&topKValue()!==null?String(topKValue()):'',isGroup&&scope?JSON.stringify(activeGroups(scope)):'');if(researchView==='brand'){meta.push('品牌研究视图','品牌统计维度','基准周','对比周','集中度指标');const view=$('brandView').value;values.push(view,view==='concentration'?'sales':$('brandMetric').value,view==='ribbon'?$('brandBase').value:'',view==='ribbon'?$('brandCompare').value:'',view==='concentration'?$('brandCon').value:'');}researchExportRows=[[...meta,...headers],...rows.map(r=>[...values,...r])];
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
  function researchPeriods(scope){
    const a=$('researchStart'),b=$('researchEnd'),A=a.value,B=b.value;
    for(const sel of [a,b]){sel.replaceChildren();for(const w of scope.weeks){const o=document.createElement('option');o.value=w.period;o.textContent=w.period;sel.append(o);}}
    if(scope.weeks.some(w=>w.period===A))a.value=A;else a.selectedIndex=Math.max(0,scope.weeks.length-2);
    if(scope.weeks.some(w=>w.period===B))b.value=B;else b.selectedIndex=scope.weeks.length-1;
    if(restoringScope){const saved=scopeSettings.get(scope.id);Pref.setControl(a,saved?.eventStart);Pref.setControl(b,saved?.eventEnd);}
  }

  // Session-local, per-source/series editors. No model registry or extra CSV input.
  const groupStates=new Map(safeEntries(storedResearch.groups).filter(([,v])=>Array.isArray(v)&&v.every(g=>g&&typeof g.name==='string'&&Array.isArray(g.keys)&&g.keys.every(k=>typeof k==='string'))));
  const pairStates=new Map(safeEntries(storedResearch.pairs).filter(([,v])=>Array.isArray(v)&&v.every(p=>p&&typeof p.name==='string'&&typeof p.old==='string'&&typeof p.next==='string')));
  const pairFocusStates=new Map(safeEntries(storedResearch.pairFocus).filter(([,v])=>Number.isInteger(v)&&v>=0));
  function knownModels(scope){
    const known=new Map();for(const w of scope.fullWeeks)for(const [k,r] of w.map)known.set(k,canonicalName(r[col.model]));return known;
  }
  function preferredBrand(scope){
    return scope.models.find(m=>trackerSelected.has(m.key)&&m.master?.brand)?.master.brand||scope.models.find(m=>m.master?.brand)?.master.brand||'';
  }
  function attributePreset(scope,field){
    const brand=preferredBrand(scope),groups=new Map();
    for(const m of scope.models){
      const v=m.master;if(!v||v.brand!==brand||!v[field])continue;
      const name=field==='series'?(v.series.startsWith(brand)?v.series:brand+' '+v.series):v[field];
      if(!groups.has(name))groups.set(name,[]);
      groups.get(name).push(m.key);
    }
    return [...groups].map(([name,keys])=>({name,keys}));
  }
  function predecessorPreset(scope){
    const known=knownModels(scope);
    return (masterCatalog?.models||[]).filter(m=>m.predecessor_id&&known.has(m.model_id)&&m.predecessor_id!==m.model_id)
      .map(m=>({name:m.model_name+' / 上一代',old:m.predecessor_id,next:m.model_id}));
  }
  function generationPreset(scope){
    const eligible=new Set(scope.models.map(m=>m.key)),pairs=predecessorPreset(scope);
    const pair=pairs.find(x=>eligible.has(x.old)&&eligible.has(x.next))||pairs[0];if(!pair)return [];
    const a=masterCatalog?.get(pair.old),b=masterCatalog?.get(pair.next);
    if(a&&b&&a.brand===b.brand&&a.series&&b.series&&a.series!==b.series){
      return [a,b].map(m=>({name:m.brand+' '+m.series,keys:masterCatalog.getSeries(m.brand,m.series).filter(v=>eligible.has(v.model_id)||v.model_id===m.model_id).map(v=>v.model_id)}));
    }
    return [{name:a?.model_name||pair.old,keys:[pair.old]},{name:b?.model_name||pair.next,keys:[pair.next]}];
  }
  function seriesPreset(scope){return researchView==='generation'?generationPreset(scope):attributePreset(scope,'series');}
  function variantPreset(scope){return researchView==='generation'?generationPreset(scope):attributePreset(scope,'variant');}
  function groupStateKey(scope,view=researchView){return JSON.stringify([scope.id,view]);}
  function activeGroups(scope){
    const key=groupStateKey(scope);
    if(!groupStates.has(key))groupStates.set(key,researchView==='structure'?variantPreset(scope):seriesPreset(scope));
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
    groups.forEach((g,index)=>{
      const box=editorCard(),head=document.createElement('div'),name=inputField(g.name,'分组名称');
      head.style.cssText='display:flex;gap:8px;align-items:center';name.setAttribute('aria-label','分组名称 '+(index+1));
      name.onchange=()=>{g.name=name.value.trim();renderResearch();};
      head.append(name,smallButton('删除',()=>{groups.splice(index,1);renderGroupEditor(scope);renderResearch();}));box.append(head);
      const chosen=document.createElement('div');chosen.style.cssText='display:flex;gap:6px;flex-wrap:wrap;margin:8px 0';
      for(const key of g.keys){
        const label=(known.get(key)||key)+(eligible.has(key)?'':'（当前不可用）');
        chosen.append(smallButton(label+' ×',()=>{g.keys=g.keys.filter(k=>k!==key);renderGroupEditor(scope);renderResearch();}));
      }
      if(!g.keys.length)chosen.textContent='尚未选择机型';box.append(chosen);
      const filter=inputField('','搜索标准名称 / 别名 / ID'),pool=document.createElement('div');
      filter.setAttribute('aria-label','搜索分组机型');pool.style.cssText='max-height:160px;overflow:auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:5px;padding:8px 0';
      const drawPool=()=>{
        pool.replaceChildren();const q=normalize(filter.value);
        const entries=[...known].filter(([k,name])=>matchesModel(k,name,q)).sort((a,b)=>a[1].localeCompare(b[1],'zh-CN'));
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
    const entries=[...known].sort((a,b)=>a[1].localeCompare(b[1],'zh-CN'));
    if(value&&!known.has(value))entries.unshift([value,masterCatalog?.get(value)?.model_name||value]);
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
    const weeks=scope.weeks,known=knownModels(scope),pairs=activePairs(scope),metric=$('trackerMode').value,focus=Number($('researchPairFocus').value);
    const metricName=metric==='cumulative_wan'?'区间累计增量':'周销量增量';
    $('researchDesc').textContent='按同一自然周对比旧代与新代的'+metricName+'。销量差为新代减旧代；倍数和贡献率仅在双边数据有效时计算。非上市同期，不推断用户换机。';
    const records=[],issues=[];
    const series=key=>{
      let estimated=false;
      const map=new Map(scope.rows.filter(r=>r[c.sequence_id]===key).map(r=>[r[c.period],r]));
      return {name:known.get(key)||masterCatalog?.get(key)?.model_name||key||'未选择',values:weeks.map(w=>{const r=map.get(w.period);return !r||r[c[metric]]===''?null:Number(r[c[metric]]);}),imputed:weeks.map(w=>{const flag=map.get(w.period)?.[c.is_imputed]==='1';estimated=estimated||flag;return metric==='cumulative_wan'?estimated:flag;})};
    };
    const eligible=new Set(scope.models.map(m=>m.key));
    pairs.forEach((p,i)=>{
      const name=p.name.trim()||'档位 '+(i+1),old=series(p.old),next=series(p.next),distinct=p.old&&p.next&&p.old!==p.next;
      if(!distinct)issues.push(name+'：请选择不同的新旧代机型');
      else if(!eligible.has(p.old)||!eligible.has(p.next))issues.push(name+'：部分机型当前无可用序列');
      if(i===focus&&distinct)researchPlot(weeks,[old,next],'万台');
      weeks.forEach((w,j)=>{
        const x=old.values[j],y=next.values[j],ok=!!distinct&&x!==null&&y!==null;
        const status=!distinct?'机型未配置或重复':!ok?'缺少可比数据':old.imputed[j]||next.imputed[j]?'含插补':'原始观测';
        records.push([name,w.period,old.name,next.name,metricName,numberText(x,4),numberText(y,4),numberText(ok?y-x:null,4),numberText(ok&&x>0?y/x:null,3),numberText(ok&&x+y>0?100*y/(x+y):null),status]);
      });
    });
    $('researchPairInfo').textContent=issues.join('；');
    researchTable(['档位','周期','旧代机型','新代机型','统计指标','旧代销量/万台','新代销量/万台','新旧销量差/万台','新代/旧代倍数','新代贡献率/%','数据状态'],records);
    $('researchNotice').textContent=pairs.length+' 个档位 · 图表展示选定档位，表格及 CSV 包含全部档位。空值不代表零。';
  }

  // Cross-module analysis uses the same validated parent-brand parser as module 2.
  const headBrands=window.BrandUtils.groups.map(g=>g.key);
  const headMarketKeys=window.BrandUtils.groups.filter(g=>g.id!=='other').map(g=>g.id);
  const headViews={distribution:'品牌销量分布对比',enrichment:'头部销量富集指数（HSCR）',strength:'单品销量强度指数',matrix:'品牌双指标四象限',trend:'头部效应历史趋势',concentration:'品牌集中度差异'};
  let marketCache=null,marketError='',marketPending=null,headPublicationInfo=null;
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
      finally{marketPending=null;if(researchView==='head')renderResearch();}
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
    $('researchDesc').textContent='按母品牌归并原始榜单：小米含 REDMI、OPPO含一加/realme、vivo含 iQOO。榜单样本并非全市场；固定 TOP K 缺名次整周留空。不使用覆盖率筛选与插补。CR/HHI 按销量计算，其他品牌合为一组。';
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
    const note=(view==='ribbon'?'色带连接同一品牌，非用户流向；':view==='concentration'?'销量集中度；其他品牌合并为一组；':'缺失周留空；')+sample+' · 仅榜单样本，非全市场';
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
    else plotBrandComposition({kind:view==='stack'?'brandStack':'brandRibbon',periods:records.map(r=>r.period),lines:linesFor(records),unit,limit:metric==='volume'?null:100});
  }
  for(const id of ['brandView','brandMetric','brandBase','brandCompare','brandCon'])$(id).onchange=renderResearch;

  function renderResearch(){try{renderResearchContent();}finally{saveResearchPreferences();}}
  function renderResearchContent(){
    if(researchView==='model')return;
    researchPublicationChart=null;researchPublicationTable=null;headPublicationInfo=null;brandPublicationInfo=null;
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
    if(researchView==='head'){renderHeadMarket(scope,weeks);return;}
    if(['series','generation','structure'].includes(researchView)){
      $('researchDesc').textContent='仅统计明确列出的机型样本，不代表完整系列；任何组员不满足当前覆盖率、区间或插补要求时，该周合计留空，不自动缩减组员。组间不允许重复机型。';
      const groups=researchGroups(scope,c);
      if(!groups.length){notice.textContent='请填写有效分组。';return;}
      if(researchView==='series'){
        const cumulative=$('trackerMode').value==='cumulative_wan';
        const lines=groups.map(g=>{let sum=0,broken=false,est=false;return cumulative?{name:g.name,values:g.values.map(v=>{if(v===null)broken=true;else sum+=v;return broken?null:sum;}),imputed:g.imputed.map(v=>est=est||v)}:g;});
        researchPlot(weeks,lines,'万台');
        researchTable(['周期',...lines.map(g=>g.name+' (万台)'), '含插补'],weeks.map((w,i)=>[w.period,...lines.map(g=>numberText(g.values[i],4)),lines.some(g=>g.imputed[i])?'是':'否']));
        notice.textContent='系列样本合计 · '+(cumulative?'区间累计增量':'周销量增量');return;
      }
      if(researchView==='generation'&&groups.length!==2){notice.textContent='代际替代分析需要恰好两个不重叠分组（旧代、新代）。';return;}
      const totals=weeks.map((w,i)=>groups.some(g=>g.values[i]===null)?null:groups.reduce((s,g)=>s+g.values[i],0));
      const shares=groups.map(g=>({name:g.name,values:g.values.map((v,i)=>v===null||!totals[i]?null:100*v/totals[i]),imputed:weeks.map((w,i)=>groups.some(g=>g.imputed[i]))}));
      researchPlot(weeks,shares,'样本销量占比 / %',100);
      researchTable(['周期',...groups.flatMap(g=>[g.name+' (万台)',g.name+' 占比 (%)']),'含插补'],weeks.map((w,i)=>[w.period,...groups.flatMap((g,j)=>[numberText(g.values[i],4),numberText(shares[j].values[i])]),groups.some(g=>g.imputed[i])?'是':'否']));
      notice.textContent=researchView==='generation'?'两个代际的样本销量及相对占比；占比变化不证明用户实际换机。':'各组占所选样本总销量的贡献比例，并非整体市场份额。';return;
    }
    if(researchView==='tail'){
      $('researchDesc').textContent='基于所选区间全部原始上榜机型（不受覆盖率和插补设置限制）；仅真实观测计入连续上榜，整周缺失会中断连续纪录。无价格数据，不自动判断中低端。';
      const all=new Map();weeks.forEach(w=>w.map.forEach((r,k)=>all.set(k,canonicalName(r[col.model]))));
      const minimum=Math.max(1,Math.floor(Number($('researchStreak').value)||1));
      const records=[...all].map(([k,name])=>{let streak=0,best=0,count=0,first=null,last=null,total=0;
        for(const w of weeks){const r=w.map.get(k);if(r){count++;streak++;best=Math.max(best,streak);let v=Number(r[col.estimated_wan]);if(first===null)first=v;last=v;total+=v;}else streak=0;}
        const change=first>0?100*(last-first)/first:null;
        return {name,count,best,streak,total,first,last,change};}).filter(r=>r.best>=minimum).sort((a,b)=>b.best-a.best||b.count-a.count||b.total-a.total);
      researchTable(['机型','观测周数','最长连续上榜','截至末周连续上榜','首个观测销量/万台','最近观测销量/万台','首末变化/%','上榜周销量合计/万台'],records.map(r=>[r.name,r.count,r.best,r.streak,numberText(r.first),numberText(r.last),numberText(r.change),numberText(r.total)]));
      notice.textContent=weeks.length+' 周历史 · '+records.length+' 款达到 '+minimum+' 周门槛'+(weeks.length<minimum?'（当前历史长度不足）':'');return;
    }
    if(researchView==='flow'){
      $('researchDesc').textContent='相邻自然周均满足当前榜单口径时比较机型集合；不可比较周中断比较。新增/退出仅是榜单可见性变化，不等于上市或停销。原始全量模式下榜单规模变化会影响结果。';
      const rows=[],values=[[],[],[]];
      weeks.forEach((w,i)=>{const p=weeks[i-1],ok=!!p?.hasBoard&&w.hasBoard;const add=ok?[...w.map].filter(([k])=>!p.map.has(k)):[],out=ok?[...p.map].filter(([k])=>!w.map.has(k)):[],stay=ok?w.count-add.length:null;
        [stay,ok?add.length:null,ok?out.length:null].forEach((v,j)=>values[j].push(v));
        rows.push([w.period,w.top,w.originalCount,w.count??'',w.comparisonStatus,numberText(w.cutoff,4),stay??'',ok?add.length:'',ok?out.length:'',add.map(x=>canonicalName(x[1][col.model])).join('、'),out.map(x=>canonicalName(x[1][col.model])).join('、')]);});
      researchPlot(weeks,['留榜','新进入榜单','退出榜单'].map((name,i)=>({name,values:values[i]})),'机型数');
      researchTable(['周期','标称 TOP','原始实收条数','分析条数','周样本状态','门槛/万台','留榜','新进入','退出','进入名单','退出名单'],rows);
      notice.textContent='按所选区间原始观测识别榜单流动，不受覆盖率与插补设置限制。';return;
    }
    if(researchView==='brand'){renderBoardBrand(scope,weeks);return;}
    if(researchView==='event'){
      $('researchDesc').textContent='选择活动自然周与对照期（活动前等长自然周），比较所选长期追踪机型。任一周无法估算则该区间留空；增减不代表促销的因果效果。';
      if($('researchStart').options.length!==weeks.length)researchPeriods(scope);
      const a=weeks.findIndex(w=>w.period===$('researchStart').value),b=weeks.findIndex(w=>w.period===$('researchEnd').value),n=b-a+1;
      if(a<0||n<1||a-n<0){notice.textContent='活动区间无效或之前没有等长对照期。';return;}
      const models=scope.models.filter(m=>trackerSelected.has(m.key));
      const lines=models.map(m=>{const r=scope.rows.filter(r=>r[c.sequence_id]===m.key);return {name:m.name,values:r.map(x=>x[c.weekly_wan]===''?null:Number(x[c.weekly_wan])),imputed:r.map(x=>x[c.is_imputed]==='1')};});
      researchPlot(weeks.slice(a-n,b+1),lines.map(l=>({name:l.name,values:l.values.slice(a-n,b+1),imputed:l.imputed.slice(a-n,b+1)})),'万台');
      const sum=v=>v.some(x=>x===null)?null:v.reduce((s,x)=>s+x,0);
      researchTable(['机型','对照期销量/万台','活动期销量/万台','增量/万台','变化率/%','含插补'],lines.map(l=>{const prev=sum(l.values.slice(a-n,a)),now=sum(l.values.slice(a,b+1)),diff=prev===null||now===null?null:now-prev;return [l.name,numberText(prev,4),numberText(now,4),numberText(diff,4),numberText(diff!==null&&prev>0?100*diff/prev:null),l.imputed.slice(a-n,b+1).some(Boolean)?'是':'否'];}));
      notice.textContent='对照 '+weeks[a-n].period+'—'+weeks[a-1].period+'；活动 '+weeks[a].period+'—'+weeks[b].period;return;
    }
  }

  function syncResearchEditors(){
    const scope=currentScope();
    if(!scope){$('researchGroupEditor').replaceChildren();$('researchPairEditor').replaceChildren();$('researchPairFocus').replaceChildren();$('researchGroupInfo').textContent='';$('researchPairInfo').textContent='';$('researchTopInfo').textContent='';return;}
    if(['series','generation','structure'].includes(researchView))renderGroupEditor(scope);
    if(researchView==='tier')renderPairEditor(scope);
  }
  $('researchSeriesPreset').onclick=()=>{const s=currentScope();if(s){groupStates.set(groupStateKey(s),seriesPreset(s));renderGroupEditor(s);renderResearch();}};
  $('researchTierPreset').onclick=()=>{const s=currentScope();if(s){groupStates.set(groupStateKey(s),variantPreset(s));renderGroupEditor(s);renderResearch();}};
  $('researchAddGroup').onclick=()=>{const s=currentScope();if(s){activeGroups(s).push({name:'',keys:[]});renderGroupEditor(s);renderResearch();}};
  $('researchPairPreset').onclick=()=>{const s=currentScope();if(s){pairStates.set(s.id,predecessorPreset(s));pairFocusStates.delete(s.id);renderPairEditor(s);renderResearch();}};
  $('researchAddPair').onclick=()=>{const s=currentScope();if(s){activePairs(s).push({name:'',old:'',next:''});renderPairEditor(s);renderResearch();}};
  $('researchPairFocus').onchange=()=>{const s=currentScope();if(s){pairFocusStates.set(s.id,Number($('researchPairFocus').value));renderResearch();}};
  $('researchTopMode').onchange=renderResearch;$('researchTopK').onchange=renderResearch;
  $('researchStreak').oninput=renderResearch;$('researchStart').onchange=renderResearch;$('researchEnd').onchange=renderResearch;
  $('researchExport').onclick=()=>exportCSVBlob(researchExportRows,'sales-research-'+researchView+'.csv');

  const researchSubtitles={model:'重点机型周销量与累计增量变化',series:'样本机型的销量合计与变化',generation:'新旧两代样本机型销量占比变化',structure:'不同产品分组样本销量贡献',tier:'同产品档位新旧机型销量对比',tail:'连续上榜纪录与销量长尾表现',flow:'新入、退出及留榜机型的变化',event:'活动期与等长对照期销量差异',brand:'品牌结构、双周变化、集中度趋势',head:'头部榜单与全市场的品牌结构、富集与单品强度'};
  const researchSend=document.createElement('button');researchSend.type='button';researchSend.className='primary';researchSend.textContent='用当前专题生成图卡';
  researchSend.style.margin='8px 0';researchNav.after(researchSend);
  researchSend.onclick=()=>sendResearchToStudio(researchView);
  function researchSnapshot(key){
    if(!Object.prototype.hasOwnProperty.call(researchViews,key))return null;
    setResearchView(key);
    const scope=currentScope();if(!scope)return null;
    const p=readTrackerParams(),rawView=isRawResearch(key),metric=$('trackerMode').value;
    const selectedRange=scope.weeks[0].period+'—'+scope.weeks[scope.weeks.length-1].period;
    let chart=key==='model'?trackerPublicationChart:researchPublicationChart,table=key==='model'?null:researchPublicationTable;
    if(chart){
      // Keep original line colors, precisely preserve missing points and estimate flags.
      chart={...chart,lines:chart.lines.map(l=>({...l,values:l.values.map(v=>Number.isFinite(v)?v:null),imputed:[...(l.imputed||[])]}))};
      chart.imputed=chart.lines.some(l=>l.values.some((v,i)=>v!==null&&l.imputed[i]));
    }
    const hasData=chart?(chart.kind==='scatter'?chart.lines[0].values.some((v,i)=>Number.isFinite(v)&&Number.isFinite(chart.lines[1].values[i])):chart.lines.some(l=>l.values.some(Number.isFinite))):key==='tail'&&!!table?.rows.length;
    if(!hasData)return null;
    const timeAxis=chart?.periods?.length&&chart.periods.every(v=>/^\d{4}-W\d{2}$/.test(v));
    const chartRange=key==='brand'&&brandPublicationInfo?brandPublicationInfo.range:timeAxis?chart.periods[0]+'—'+chart.periods[chart.periods.length-1]:key==='head'&&headPublicationInfo?headPublicationInfo.range:selectedRange;
    const effectivePeriods=key==='head'?headPublicationInfo?.effectivePeriods||[]:key==='brand'?brandPublicationInfo?.effectivePeriods||[]:timeAxis?chart.periods.filter((_,i)=>chart.lines.some(l=>Number.isFinite(l.values[i]))):scope.weeks.filter(w=>w.hasBoard).map(w=>w.period);
    const range=chartRange;
    if(chart&&chart.lines.length>24){notify('单张图卡最多展示24条曲线，请减少研究机型或分组。');return null;}
    const top=usesTopK(key)?topKValue():null;
    const modeLabel=rawView?'仅原始观测':p.dataMode==='raw'?'仅原始观测':p.maxGap===0?'不插补':p.method==='bounded'?'门槛约束插补':'线性插值';
    const displayMetric=key==='head'?(headPublicationInfo?.metricLabel||'跨模块品牌研究'):key==='generation'||key==='structure'?'样本销量占比':key==='brand'?(brandPublicationInfo?.metricLabel||'榜单品牌结构'):key==='flow'?'榜单流动 · '+(top===null?'原始全量':'固定 TOP'+top):key==='tail'?'连续上榜 · ≥ '+$('researchStreak').value+' 周':key==='event'?'对照期 / 活动期周销量':metric==='cumulative_wan'?'区间累计增量':'周销量增量';
    let detail='';
    if(['series','generation','structure'].includes(key))detail=$('researchGroupInfo').textContent;
    if(key==='tier')detail=activePairs(scope).map(q=>q.name+'：'+q.old+' / '+q.next).join('；');
    if(key==='event')detail=$('researchNotice').textContent;
    if(usesTopK(key))detail=$('researchTopInfo').textContent;
    if(key==='head')detail=headPublicationInfo?.detail||detail;
    if(key==='brand')detail=brandPublicationInfo?.detail||detail;
    const note=(key==='head'?'头部榜单为估算样本；全市场份额来自模块2独立数据源；缺失不等于零。':'数据为历史榜单估算样本，不代表全市场销量或份额；缺失不等于零。')+(chart?.imputed?'图中含插补值。':'');
    const chartNote=key==='head'?(headPublicationInfo?.note||'仅共同有效周'):key==='brand'?(brandPublicationInfo?.note||'仅榜单样本'):key==='flow'?'相邻可比较周 · 进入/退出不代表上市/停销':key==='tail'?'连续上榜只计原始观测 · 未入榜不等于零销量':key==='event'?detail:key==='generation'||key==='structure'?'仅分组样本占比 · 不代表市场份额':'估算销量 · 仅所选样本，非上市以来累计';
    const summary=key==='model'?$('trackerStatus').textContent:$('researchNotice').textContent;
    const description=key==='model'?'选中机型在当前统计区间的销量趋势。':$('researchDesc').textContent;
    const baseCsv=key==='model'?Series.versionedRows({header:trackerData.header,masterRevision:trackerData.masterRevision,rows:scope.rows.filter(r=>trackerSelected.has(r[trackerData.header.indexOf('sequence_id')]))}):researchExportRows;
    const effectiveText=effectivePeriods.length+' 周'+(effectivePeriods.length?'（'+effectivePeriods[0]+'—'+effectivePeriods[effectivePeriods.length-1]+'）':'');
    const csv=baseCsv.map((r,i)=>i===0?[...r,'发布所选区间','发布图表区间','发布有效周次']: [...r,selectedRange,chartRange,effectivePeriods.join(' / ')]);
    const sampleLabel=top===null?(usesTopK(key)?'原始全量':'所选样本'):'固定 TOP'+top;
    const footer=[key==='head'?'来源：'+scope.source+' / '+scope.series+' + 模块2市场份额':'来源：'+scope.source+' / '+scope.series+' · 历史榜单估算样本',key==='head'?'榜单样本占比非市场份额；跨数据源比较，不推断榜外销量。':'仅所选榜单样本，不代表全市场销量或品牌市场份额；缺失不等于零。',sampleLabel+' · '+(chart?.imputed?'含插补':rawView||p.dataMode==='raw'?'仅原始观测':'未出现插补值')+' · '+(key==='head'?'共同有效':'有效观测')+' '+effectiveText].join('\n');
    const snapshot={ready:true,key,title:researchViews[key],subtitle:key==='brand'?(brandPublicationInfo?.metricLabel||researchSubtitles[key]):key==='head'?(headPublicationInfo?.metricLabel||researchSubtitles[key]):researchSubtitles[key],range,effectivePeriods,footer,source:scope.source+' / '+scope.series+(key==='head'?' + 模块2 市场份额':''),context:scope.source+' / '+scope.series+' · 图表 '+chartRange+' · 所选 '+selectedRange+' · '+(key==='head'?'共同有效':'有效观测')+' '+effectiveText+' · '+modeLabel+(top===null?'':' · 固定 TOP'+top),modeLabel,displayMetric,chart,table,summary,description,detail,note,chartNote,csv};
    return JSON.parse(JSON.stringify(snapshot));
  }
  async function sendResearchToStudio(key=researchView){
    if(key==='head'&&!marketCache){await ensureMarketData();}
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
    // Preserve saved v2 preferences at initial successful load; discard provisional state only after a failed load.
    if(masterError){selectedByScope.clear();groupStates.clear();pairStates.clear();pairFocusStates.clear();trackerSelected.clear();}
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

  window.SalesEstimateArchive = Object.freeze({buildRows,sendResearchToStudio,updateControls,header:HEADER.slice()});
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
