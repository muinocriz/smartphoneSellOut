/* Market-share CSV importer/UI. Loaded after market-share.html's inline studio logic.
 * Does not change the existing charts; only updates their state inputs.
 */
(function(){
  'use strict';
  const data=window.MarketShareData;
  const STORAGE='phone_market_share_viz_state_v1';
  const AUTO_FIELDS={
    title:'inputTitle',subtitle:'inputSubtitle',insight:'inputInsight',
    w1Label:'inputW1Label',w2Label:'inputW2Label'
  };
  let rows=[],pairs=[],sourceName='仓库 CSV',loadVersion=0;
  const byId=id=>document.getElementById(id);
  const num=n=>n>0?'+'+n.toFixed(1):n.toFixed(1);
  const weekLabel=id=>id.replace('W',' W');
  const dateLabel=timestamp=>{
    const d=new Date(timestamp);
    return (d.getUTCMonth()+1)+'.'+d.getUTCDate();
  };
  const weekRange=row=>dateLabel(row.monday)+'–'+dateLabel(row.monday+6*IsoSalesWeek.DAY);
  const fieldOverrides=()=>state.textOverrides||(state.textOverrides={});

  function status(message,isError=false){
    const el=byId('marketShareCsvStatus');
    el.textContent=message;
    el.className='text-[11px] leading-relaxed '+(isError?'text-rose-500':'text-slate-500');
  }
  function badge(text){
    const el=byId('currentMarketShareWeek');
    if(el)el.textContent=text;
  }
  function legacyState(){
    let saved=null;
    try{saved=JSON.parse(localStorage.getItem(STORAGE))}catch(_){}
    if(!saved||typeof saved!=='object')return;
    if(!saved.dataMode){
      // Upgrading older browser state: keep genuinely edited figures instead of overwriting them.
      state.dataMode=JSON.stringify(saved.brands)===JSON.stringify(getDefaultBrands())?'csv':'manual';
    }
    if(!saved.textOverrides){
      const defaults=getDefaultState();
      const overrides=fieldOverrides();
      for(const key of Object.keys(AUTO_FIELDS)){
        if(typeof saved[key]==='string'&&saved[key]!==defaults[key])overrides[key]=true;
      }
    }
  }
  function setAutoField(key,value){
    if(!fieldOverrides()[key])state[key]=value;
  }
  function buildInsight(){
    const brands=getComputedMarketData().filter(b=>b.id!=='other');
    const up=brands.reduce((a,b)=>b.diff>a.diff?b:a);
    const down=brands.reduce((a,b)=>b.diff<a.diff?b:a);
    return `份额提升最大：${up.name} ${num(up.diff)}pp · 回落最大：${down.name} ${num(down.diff)}pp`;
  }
  function applyPair(week,allowFallback=true){
    let index=pairs.find(i=>rows[i].week===week);
    if(index===undefined){
      if(!allowFallback||!pairs.length)return false;
      index=pairs[pairs.length-1];
    }
    const previous=rows[index-1],current=rows[index];
    state.brands=data.buildBrandState(previous,current,getDefaultBrands);
    state.selectedWeek=current.week;
    state.dataMode='csv';
    setAutoField('title',`${weekLabel(current.week)} 国内手机市场份额周环比变化`);
    setAutoField('subtitle',`对比 ${weekLabel(previous.week)} (${weekRange(previous)}) 与 ${weekLabel(current.week)} (${weekRange(current)}) | 份额 % · 变化 pp`);
    setAutoField('w1Label',`${previous.week.slice(4)} (${weekRange(previous)})`);
    setAutoField('w2Label',`${current.week.slice(4)} (${weekRange(current)})`);
    // Trend cards always reflect the selected CSV rows, even if older local
    // state contains textOverrides from a previously edited week.
    delete fieldOverrides().w1Market;
    delete fieldOverrides().w2Market;
    state.w1Market=`大盘趋势：${previous.trend}`;
    state.w2Market=`大盘趋势：${current.trend}`;
    setAutoField('insight',buildInsight());
    byId('marketShareWeekSelect').value=current.week;
    badge(`${weekLabel(previous.week)} → ${weekLabel(current.week)}`);
    byId('resetDataBtn').textContent='恢复所选周 CSV 原始数据';
    syncUIWithState();
    renderDataInputs();
    renderPoster();
    saveStateToLocal();
    status(`已加载 ${sourceName}，共 ${rows.length} 周；展示 ${previous.week} → ${current.week}`);
    return true;
  }
  function renderWeekChoices(){
    const el=byId('marketShareWeekSelect');
    el.replaceChildren();
    if(!pairs.length){
      const opt=document.createElement('option');opt.textContent='没有连续两周的数据';opt.value='';el.appendChild(opt);
      el.disabled=true;
      return;
    }
    el.disabled=false;
    for(const i of pairs){
      const opt=document.createElement('option');
      opt.value=rows[i].week;
      opt.textContent=`${rows[i-1].week} → ${rows[i].week}`;
      el.appendChild(opt);
    }
  }
  function installCsv(text,source,preferSaved){
    // Parse before mutating the UI so an invalid file cannot overwrite valid data.
    const next=data.parseMarketShareCSV(text,IsoSalesWeek.isoWeekMonday);
    const nextPairs=data.pairIndices(next);
    if(!nextPairs.length)throw new Error('CSV 没有可比较的连续两周，请补充相邻 ISO 周');
    rows=next;pairs=nextPairs;sourceName=source;
    if(typeof state.followLatestMarketShare!=='boolean')state.followLatestMarketShare=true;
    renderWeekChoices();
    // Follow newly published weeks unless an older pair was explicitly selected.
    if(!preferSaved)state.followLatestMarketShare=true;
    const selected=preferSaved&&state.followLatestMarketShare===false?state.selectedWeek:null;
    if(preferSaved&&state.dataMode==='manual'){
      const selectedIndex=pairs.find(i=>rows[i].week===selected);
      byId('marketShareWeekSelect').value=selectedIndex===undefined?rows[pairs[pairs.length-1]].week:selected;
      badge('手动编辑数据');
      status(`已读取 ${source}（${rows.length} 周）；当前显示浏览器保存的手动数据，选择周次可应用 CSV`);
      return;
    }
    applyPair(selected);
  }
  async function fetchRepositoryCsv(){
    const response=await fetch('./market-share.csv?t='+Date.now(),{cache:'no-store'});
    if(!response.ok)throw new Error('HTTP '+response.status);
    const text=data.decodeCSV(await response.arrayBuffer());
    return text;
  }
  async function reloadRepo(force){
    const version=++loadVersion;
    status('正在读取仓库 market-share.csv…');
    try{
      const text=await fetchRepositoryCsv();
      if(version!==loadVersion)return; // A newer local import or reload takes precedence.
      installCsv(text,'仓库 CSV',!force);
    }catch(error){
      if(version===loadVersion)status(`仓库 CSV 读取失败：${error.message}。可以手动选择本地 CSV。`,true);
    }
  }
  function insertControls(){
    const card=byId('toggleDataEditorBtn').parentElement.parentElement;
    card.insertAdjacentHTML('afterbegin',`
      <div class="space-y-2.5 pb-3 mb-3 border-b border-slate-200">
        <h3 class="ui-section-title">CSV 数据源与历史周</h3>
        <div class="flex gap-2 flex-wrap items-center">
          <select id="marketShareWeekSelect" aria-label="选择市场份额对比周" class="ui-field ui-field--inline grow min-w-[160px] max-w-full"></select>
          <button id="marketShareReloadCsv" type="button" class="rounded-lg bg-blue-50 px-2.5 py-2 text-xs font-semibold text-blue-700 border border-blue-200">重载仓库 CSV</button>
          <label class="cursor-pointer rounded-lg bg-slate-100 px-2.5 py-2 text-xs font-semibold text-slate-700 border border-slate-200">导入本地 CSV<input id="marketShareUploadCsv" type="file" accept=".csv,text/csv" class="hidden" /></label>
        </div>
        <p id="marketShareCsvStatus" class="text-[11px] text-slate-500" aria-live="polite">准备读取仓库 CSV…</p>
      </div>`);
  }
  function bindEvents(){
    byId('marketShareWeekSelect').addEventListener('change',e=>{
      const latest=pairs.length?rows[pairs[pairs.length-1]].week:null;
      state.followLatestMarketShare=e.target.value===latest;
      applyPair(e.target.value,false);
    });
    byId('marketShareReloadCsv').addEventListener('click',()=>reloadRepo(true));
    byId('marketShareUploadCsv').addEventListener('change',async e=>{
      const file=e.target.files&&e.target.files[0];if(!file)return;
      const version=++loadVersion;
      try{
        const text=data.decodeCSV(await file.arrayBuffer());
        if(version===loadVersion)installCsv(text,`本地文件 ${file.name}`,false);
      }catch(err){if(version===loadVersion)status('CSV 导入失败：'+err.message,true)}
      finally{e.target.value=''}
    });
    for(const [key,id] of Object.entries(AUTO_FIELDS)){
      byId(id).addEventListener('input',()=>{
        fieldOverrides()[key]=true;
        saveStateToLocal();
      });
    }
    // The existing input rows have their own listeners; capture input before they save.
    byId('brandInputsList').addEventListener('input',()=>{
      state.dataMode='manual';
      badge('手动编辑数据');
      status('正在使用手动调整后的份额（仅保存在本浏览器）；重新选择周次可恢复 CSV');
    },true);
    byId('resetDataBtn').addEventListener('click',event=>{
      if(!pairs.length)return;
      event.stopImmediatePropagation();
      state.textOverrides={};
      applyPair(byId('marketShareWeekSelect').value);
    },true);
  }
  window.addEventListener('DOMContentLoaded',()=>{
    insertControls();
    legacyState();
    bindEvents();
    reloadRepo(false);
  });
})();
