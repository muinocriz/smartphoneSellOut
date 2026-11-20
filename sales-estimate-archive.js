/* Module 3: normalized historical estimates. No backend or write token is needed.
 * GitHub Pages reads the committed CSV; the maintainer uploads the merged export.
 * History contains final estimates, not the original image/calibration workspace.
 */
(function () {
  'use strict';
  const FILE = 'sales-estimates.csv';
  const HEADER = 'dataset_id,source,series,period_type,period,period_start,period_end,top_n,actual_count,rank,model,brand_group,pixels,estimated_units,estimated_wan,fit_k,fit_mode,calibration_count,accepted_count,outlier_threshold,algorithm_version,saved_at'.split(',');
  const col = Object.fromEntries(HEADER.map((name, index) => [name, index]));
  const allowedFit = new Set(['single', 'fit', 'robust']);
  const metaByDataset = new WeakMap();
  let activeDataset = null;
  let history = [];
  let loaded = false;
  let loading = true;
  let origin = '';
  let pending = false;

  function fail(message) { throw new Error(message); }
  function normalizeModelName(name) {
  return String(name ?? "").normalize("NFKC").toUpperCase().replace(/[\s\u200B-\u200D\u2060\uFEFF]+/g,"");
}
  function buildSalesPanel(rows,col) {
  const header = ['source','series','period','period_start','period_end','model_key','model','raw_model','brand_group','rank','observed_wan','imputed_wan','weekly_wan','cumulative_wan','cutoff_wan','is_imputed','impute_method','observed_weeks','total_weeks','coverage_rate'];
  const scopes = new Map(), all = [], byScope = [];
  for (const r of rows) {
    // 同来源、同系列的周榜统一追踪；TOP 数量不是机型时间序列的过滤条件。
    if (r[col.period_type] !== 'weekly') continue;
    const id = JSON.stringify([r[col.source],r[col.series]]);
    if (!scopes.has(id)) scopes.set(id,[]);
    scopes.get(id).push(r);
  }
  const fmtWan = v => v == null ? '' : v.toFixed(4);
  const weekMs = 7*86400000;
  for (const [id,records] of scopes) {
    const [source,series] = JSON.parse(id);
    const boards = new Map(), models = new Map();
    for (const r of records) {
      const t = Date.parse(r[col.period_start]+'T00:00:00Z');
      if (!boards.has(t)) boards.set(t,[]);
      boards.get(t).push(r);
    }
    const dates = [...boards.keys()].sort((a,b)=>a-b);
    const weeks = [];
    for (let t=dates[0]; t<=dates[dates.length-1]; t+=weekMs) {
      const list=boards.get(t)||[];
      const start=new Date(t).toISOString().slice(0,10), end=new Date(t+6*86400000).toISOString().slice(0,10);
      const thu=new Date(t+3*86400000),y=thu.getUTCFullYear(),jan4=Date.UTC(y,0,4);
      const first=jan4-((new Date(jan4).getUTCDay()+6)%7)*86400000;
      const period=y+'-W'+String(1+Math.round((t-first)/weekMs)).padStart(2,'0');
      // 只有明确标称 TOP30 且 1–30 名齐全，才采用原先的 TOP30 门槛约束。
      const full=list.length===30 && list.every(r=>Number(r[col.top_n])===30&&Number(r[col.actual_count])===30&&Number(r[col.rank])>=1&&Number(r[col.rank])<=30) && new Set(list.map(r=>Number(r[col.rank]))).size===30;
      const cutoff=full?Math.min(...list.map(r=>Number(r[col.estimated_wan]))):null;
      const map=new Map();
      for (const r of list) {
        const key=normalizeModelName(r[col.model]);
        if (!key || map.has(key)) throw new Error('同一期榜单存在空白或重复机型标识：'+period+' / '+key);
        map.set(key,r);
        if (!models.has(key)) models.set(key,{key, count:0});
        Object.assign(models.get(key),{name:r[col.model],brand:r[col.brand_group]});
        models.get(key).count++;
      }
      weeks.push({period,start,end,cutoff,map,hasBoard:list.length>0});
    }
    const selected=[...models.values()].filter(m=>m.count/weeks.length>=0.8).sort((a,b)=>a.name.localeCompare(b.name,'zh-CN'));
    const panelRows=[];
    for (const m of selected) {
      const observed=weeks.map(w=>w.map.has(m.key)?Number(w.map.get(m.key)[col.estimated_wan]):null);
      const firstIndex=observed.findIndex(v=>v!==null);
      let total=0, unknown=false;
      for (let i=0;i<weeks.length;i++) {
        const w=weeks[i], original=w.map.get(m.key), value=observed[i];
        let estimate=null, method='missing';
        if (value!==null) method='observed';
        else if(i<firstIndex) method='before_first_observation';
        else {
          if (!w.hasBoard) method='missing_board';
          let left=i-1,right=i+1;
          while(left>=0&&observed[left]===null) left--;
          while(right<weeks.length&&observed[right]===null) right++;
          if(left>=0&&right<weeks.length&&right-left-1<=3) {
            estimate=observed[left]+(observed[right]-observed[left])*(i-left)/(right-left);
            method=w.hasBoard?'linear_interpolation':'linear_interpolation_missing_board';
          } else if(left===i-1&&i===weeks.length-1&&w.cutoff!==null) {
            estimate=observed[left]; method='previous_week';
          }
          if(estimate!==null&&w.cutoff!==null) {
            estimate=Math.min(estimate,w.cutoff); method+='_cutoff';
          }
          if(estimate!==null) estimate=Math.round(estimate*10000)/10000;
        }
        const weekly=value??estimate;
        if(i>=firstIndex&&weekly===null) unknown=true;
        if(weekly!==null) total+=weekly;
        const cumulative=i<firstIndex||unknown?null:total;
        panelRows.push([source,series,w.period,w.start,w.end,m.key,m.name,original?original[col.model]:'',m.brand,original?original[col.rank]:'',fmtWan(value),fmtWan(estimate),fmtWan(weekly),fmtWan(cumulative),fmtWan(w.cutoff),estimate!==null?'1':'0',method,String(m.count),String(weeks.length),(m.count/weeks.length).toFixed(4)]);
      }
    }
    all.push(...panelRows);
    byScope.push({id,source,series,weeks,models:selected,rows:panelRows});
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
  function defaults() {
    return {source:'RD观测', series:'手机销量榜', type:'weekly', period:'', start:'', end:'', top:''};
  }
  function datasetMeta(d) {
    if (!metaByDataset.has(d)) metaByDataset.set(d, defaults());
    return metaByDataset.get(d);
  }
  function normalizeMeta(m, count) {
    const source = String(m.source || '').trim();
    const series = String(m.series || '').trim();
    if (!source || !series) fail('请填写数据来源和榜单系列。');
    let period, start, end;
    if (m.type === 'weekly') {
      const p = String(m.period).trim().toUpperCase().match(/^([1-9]\d{3})-?W(\d{1,2})$/);
      if (!p) fail('请填写 ISO 周，例如 2026-W46。');
      const t = window.IsoSalesWeek.isoWeekMonday(Number(p[1]), Number(p[2]));
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
  function buildRows(o = derivedData()) {
    const d = o.d, f = o.fit;
    // A historical studio export must reuse the original normalized archive rows and metadata.
    if (d.archiveRows) return d.archiveRows.map(r => r.slice());
    if (!allowedFit.has(f.fitMode) || !Number.isFinite(f.k) || f.k <= 0 || !o.canPublish) fail('请先完成有效标定；未标定、冲突或临时中位数结果不能进入正式销量 CSV。');
    if (o.models.some(m => !String(m.name).trim() || /^第\d+名$|^未命名/.test(String(m.name).trim()))) fail('请先补全所有机型名称。');
    if (o.models.some(m => !Number.isSafeInteger(m.rank) || m.rank < 1 || !Number.isSafeInteger(m.pixels) || m.pixels <= 0 || !Number.isFinite(m.sale) || !Number.isSafeInteger(Math.round(m.sale)) || m.sale < 0) || new Set(o.models.map(m => m.rank)).size !== o.models.length) fail('榜单排名、柱长或销量存在无效数据。');
    const keys = o.models.map(m => normalizeModelName(m.name));
    if (keys.some(k => !k) || new Set(keys).size !== keys.length) fail('同一期榜单存在空白或重复机型标识，请核对机型名称。');
    // A fresh value is captured once for the entire snapshot.
    const m = normalizeMeta(datasetMeta(d), o.models.length);
    const at = new Date().toISOString();
    return o.models.map(b => {
      const units = Math.round(b.sale);
      return [m.id,m.source,m.series,m.type,m.period,m.start,m.end,m.top,
        String(o.models.length),String(b.rank),String(b.name).trim(),b.brand,String(b.pixels),
        String(units),(units / 10000).toFixed(4),String(f.k),f.fitMode,
        String(d.calibrations.length),String(f.accepted.length),String(d.archiveOutlier ?? $('outlier').value),'1',at];
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

  const panel = document.createElement('section');
  panel.className = 'panel';
  panel.innerHTML = '<h2 class="panel-title">榜单信息与历史销量存档</h2>' +
    '<p class="panel-desc">历史结果统一保存到 sales-estimates.csv。榜单规模不限；同一来源、系列和周期的重新估算需确认整期替换。</p>' +
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px">' +
    '<div><label class="lbl" for="archiveSource">数据来源</label><input id="archiveSource" class="field ui-field" maxlength="80"></div>' +
    '<div><label class="lbl" for="archiveSeries">榜单系列（同周期不同口径时区分）</label><input id="archiveSeries" class="field ui-field" maxlength="80"></div>' +
    '<div><label class="lbl" for="archiveType">统计周期类型</label><select id="archiveType" class="field ui-field"><option value="weekly">周榜（ISO 周）</option><option value="monthly">月榜</option><option value="custom">自定义日期范围</option></select></div>' +
    '<div id="archivePeriodWrap"><label class="lbl" for="archivePeriod">统计周期</label><input id="archivePeriod" class="field ui-field" maxlength="12"></div>' +
    '<div id="archiveDatesWrap" hidden><label class="lbl" for="archiveStart">开始日期</label><input id="archiveStart" type="date" class="field ui-field"><label class="lbl" for="archiveEnd">结束日期</label><input id="archiveEnd" type="date" class="field ui-field"></div>' +
    '<div><label class="lbl" for="archiveTop">原榜标称 TOP 数（可留空）</label><input id="archiveTop" type="number" min="1" step="1" class="field ui-field" placeholder="例如 25 或 30"></div>' +
    '</div><div class="msg" id="archiveMetaStatus" aria-live="polite"></div>' +
    '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px">' +
    '<button type="button" class="primary" id="archiveMerge" disabled>合并本期并导出完整历史 CSV</button>' +
    '<button type="button" class="secondary" id="archiveReload" disabled>刷新仓库历史</button>' +
    '<button type="button" class="secondary" id="archiveImport">导入已有历史 CSV</button>' +
    '<input type="file" accept=".csv,text/csv" id="archiveFile" hidden>' +
    '</div><div class="msg" id="archiveHistoryStatus" aria-live="polite">正在读取仓库历史数据…</div>' +
    '<p class="mini">导出后请将完整 CSV 提交到 GitHub 根目录，替换同名文件；页面不会直接写入仓库。尚未提交的多期导出只在当前页面会话中保留，刷新前请下载备份。</p>' +
    '<details id="archiveHistoryDetails" open style="margin-top:12px"><summary>查看历史榜单（只读）</summary>' +
    '<label class="lbl" for="archiveSelect">选择历史榜单（同步图文工作台）</label><select id="archiveSelect" class="field ui-field"></select>' +
    '<button type="button" class="secondary" id="archiveUseStudio" style="margin-top:8px" disabled>使用所选历史榜单生成图文</button>' +
    '<p class="mini">直接使用已归档的估算销量，无需重新导入截图或标定；上方标定编辑区不受影响。</p>' +
    '<div class="tablewrap" style="margin-top:8px"><table class="ranktable"><thead><tr><th>排名</th><th>机型</th><th>品牌系列</th><th class="num">估算销量 / 万台</th></tr></thead><tbody id="archiveRows"></tbody></table></div></details>';
  const resultPanel = $('exportCsv').closest('.panel');
  resultPanel.before(panel);

  // The tracker derives its data from the existing archive, never from a second manually maintained input.
  const tracker = document.createElement('section');
  tracker.className = 'panel';
  tracker.innerHTML = '<h2 class="panel-title">热销机型追踪</h2>' +
    '<p class="panel-desc">基于同来源、同系列的周销量榜单构建连续机型销量序列，兼容不同榜单规模。默认追踪全区间上榜率至少 80% 的机型；仅对短期缺失进行估算。</p>' +
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px">' +
    '<div><label class="lbl" for="trackerScope">榜单口径</label><select id="trackerScope" class="field ui-field"></select></div>' +
    '<div><label class="lbl" for="trackerMode">统计方式</label><select id="trackerMode" class="field ui-field"><option value="weekly_wan">周销量增量</option><option value="cumulative_wan">区间累计增量</option></select></div></div>' +
    '<label class="lbl" for="trackerFilter">筛选机型（支持空格、大小写变体）</label><input class="field ui-field" id="trackerFilter" placeholder="例如 iPhone 18 或 Pro Max">' +
    '<div id="trackerModels" style="display:flex;flex-wrap:wrap;gap:8px 16px;max-height:180px;overflow:auto;padding:10px 0"></div>' +
    '<button class="secondary" type="button" id="trackerExport" disabled>导出完整整理后 CSV</button>' +
    '<div id="trackerStatus" class="msg" aria-live="polite"></div>' +
    '<div id="trackerChart" style="overflow:auto"></div><div id="trackerLegend" style="display:flex;flex-wrap:wrap;gap:8px 16px"></div>' +
    '<p class="mini">单位：万台。原始观测值使用实心点和实线，插补值使用空心点及相关虚线；累计曲线从首次含插补的周起使用虚线。不同榜单规模的原始数据均保留。仅当 TOP30 榜单完整时，末位销量作为落榜假设下的插补上限。整周无榜单时，只有前后均有观测且连续缺失不超过3周才进行插补，不设榜单门槛；其他缺失留空。累计值从首次观测开始，未解决的缺失导致后续累计留空，并非上市以来累计销量。</p>' +
    '<div class="tablewrap"><table class="ranktable"><thead><tr><th>机型</th><th>上榜率</th><th>插补周数</th><th class="num">最新周销量 / 万台</th><th class="num">累计增量 / 万台</th></tr></thead><tbody id="trackerRows"></tbody></table></div>';
  panel.after(tracker);
  let trackerData = {header:[],rows:[],scopes:[]};
  let trackerSelected = new Set();
  const trackerPalette = ['#2563eb','#ea580c','#059669','#9333ea','#db2777','#0891b2','#92400e','#64748b'];
  function currentScope(){return trackerData.scopes.find(s=>s.id===$('trackerScope').value);}
  function defaultTrackerSelection(scope){
    const apple=scope.models.filter(m=>/^IPHONE(?:17|18)(?:PRO|PROMAX)?$/.test(m.key));
    trackerSelected=new Set((apple.length?apple:scope.models.slice(0,5)).map(m=>m.key));
  }
  function trackerOptions(){
    const scope=currentScope(), q=normalizeModelName($('trackerFilter').value);
    const target=$('trackerModels'); target.replaceChildren();
    if(!scope)return;
    for(const m of scope.models.filter(m=>!q||m.key.includes(q))){
      const label=document.createElement('label'), cb=document.createElement('input');
      cb.type='checkbox';cb.checked=trackerSelected.has(m.key);
      cb.onchange=()=>{if(cb.checked)trackerSelected.add(m.key);else trackerSelected.delete(m.key);renderTracker();};
      label.append(cb,document.createTextNode(' '+m.name));target.append(label);
    }
  }
  function renderTracker(){
    const scope=currentScope(), chart=$('trackerChart'), legend=$('trackerLegend'), table=$('trackerRows');
    chart.replaceChildren();legend.replaceChildren();table.replaceChildren();
    $('trackerExport').disabled=!trackerData.rows.length;
    if(!scope){$('trackerStatus').textContent='暂无符合口径的周销量榜单数据。';return;}
    const c=Object.fromEntries(trackerData.header.map((h,i)=>[h,i]));
    const models=scope.models.filter(m=>trackerSelected.has(m.key));
    const metric=$('trackerMode').value;
    const curves=models.map((m,i)=>({m,color:trackerPalette[i%trackerPalette.length],rows:scope.rows.filter(r=>r[c.model_key]===m.key)}));
    $('trackerStatus').textContent=scope.weeks.length+' 周 / '+scope.models.length+' 款长期追踪机型 · 已选 '+models.length+' 款 · 插补 '+curves.reduce((n,o)=>n+o.rows.filter(r=>r[c.is_imputed]==='1').length,0)+' 条';
    if(!curves.length)return;
    const val=r=>r[c[metric]]===''?null:Number(r[c[metric]]);
    const max=Math.max(1,...curves.flatMap(o=>o.rows.map(val).filter(v=>v!==null)));
    const step=Math.pow(10,Math.floor(Math.log10(max)))/2;
    const top=Math.ceil(max/step)*step;
    const W=Math.max(680,scope.weeks.length*48+80), H=310, L=55, R=55, T=20, B=45;
    const x=i=>L+i*(W-L-R)/Math.max(1,scope.weeks.length-1), y=v=>H-B-v/top*(H-B-T);
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 '+W+' '+H);svg.style.width='100%';svg.style.minWidth='560px';
    svg.setAttribute('role','img');svg.setAttribute('aria-label','热销机型销量折线图');
    let content='';
    for(let i=0;i<=4;i++){const v=top*i/4;content+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+y(v)+'" y2="'+y(v)+'" stroke="currentColor" opacity=".14"/><text x="'+(L-8)+'" y="'+(y(v)+4)+'" text-anchor="end" fill="currentColor" font-size="11">'+e(Number(v.toFixed(2)))+'</text>';}
    scope.weeks.forEach((w,i)=>{if(i%Math.max(1,Math.ceil(scope.weeks.length/16))===0||i===scope.weeks.length-1)content+='<text x="'+x(i)+'" y="'+(H-B+20)+'" text-anchor="middle" fill="currentColor" font-size="10">'+e(w.period)+'</text>';});
    for(const o of curves){
      let cumulativeImputed=false;
      const dashed=o.rows.map(r=>{if(r[c.is_imputed]==='1')cumulativeImputed=true;return metric==='cumulative_wan'?cumulativeImputed:r[c.is_imputed]==='1';});
      o.rows.forEach((r,i)=>{
        const v=val(r);
        if(v===null)return;
        if(i&&val(o.rows[i-1])!==null)content+='<line x1="'+x(i-1)+'" y1="'+y(val(o.rows[i-1]))+'" x2="'+x(i)+'" y2="'+y(v)+'" stroke="'+o.color+'" stroke-width="2.5" '+(dashed[i]||dashed[i-1]?'stroke-dasharray="6 4"':'')+'/>';
        content+='<circle cx="'+x(i)+'" cy="'+y(v)+'" r="3.5" stroke="'+o.color+'" stroke-width="2" fill="'+(dashed[i]?'white':o.color)+'"><title>'+e(o.m.name+' · '+r[c.period]+' · '+v.toFixed(4)+' 万台'+(dashed[i]?'（含插补）':''))+'</title></circle>';
      });
      const lab=document.createElement('span');lab.style.color=o.color;lab.textContent='● '+o.m.name;legend.append(lab);
      const last=o.rows[o.rows.length-1], n=o.rows.filter(r=>r[c.is_imputed]==='1').length;
      const show=v=>v===''?'—':Number(v).toFixed(2);
      const tr=document.createElement('tr');tr.innerHTML='<td>'+e(o.m.name)+'</td><td>'+e((100*Number(last[c.coverage_rate])).toFixed(1))+'%</td><td>'+n+'</td><td class="num">'+e(show(last[c.weekly_wan]))+'</td><td class="num">'+e(show(last[c.cumulative_wan]))+'</td>';table.append(tr);
    }
    svg.innerHTML=content;chart.append(svg);
  }
  function refreshTracker(){
    const previous=$('trackerScope').value;
    try{
      trackerData=buildSalesPanel(history,col);
      const sel=$('trackerScope');sel.replaceChildren();
      for(const s of trackerData.scopes){const option=document.createElement('option');option.value=s.id;option.textContent=s.source+' / '+s.series;sel.append(option);}
      if(trackerData.scopes.some(s=>s.id===previous))sel.value=previous;
      const scope=currentScope();
      if(scope&&(!previous||previous!==scope.id))defaultTrackerSelection(scope);
      else if(scope)trackerSelected=new Set([...trackerSelected].filter(k=>scope.models.some(m=>m.key===k)));
      trackerOptions();renderTracker();
    }catch(err){trackerData={header:[],rows:[],scopes:[]};$('trackerScope').replaceChildren();trackerOptions();renderTracker();$('trackerStatus').textContent=err.message;}
  }
  $('trackerScope').onchange=()=>{const s=currentScope();if(s)defaultTrackerSelection(s);trackerOptions();renderTracker();};
  $('trackerFilter').oninput=trackerOptions;
  $('trackerMode').onchange=renderTracker;
  $('trackerExport').onclick=()=>exportCSVBlob([trackerData.header,...trackerData.rows],'weekly-sales-panel.csv');

  $('exportCsv').textContent = '导出本期销量 CSV';
  const report = document.createElement('button');
  report.type = 'button'; report.className = 'secondary'; report.textContent = '导出标定报告 CSV';
  $('exportCsv').after(report);
  report.onclick = exportCSV;

  const controls = {source:'archiveSource',series:'archiveSeries',type:'archiveType',period:'archivePeriod',
    start:'archiveStart',end:'archiveEnd',top:'archiveTop'};
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
    refreshTracker();
    // Refresh an already bound snapshot if the selected historical records changed.
    if (socialArchiveDataset && !loading) {
      const selected = map.get(select.value);
      if (!selected) setSocialArchiveDataset(null);
      else if (socialArchiveDataset.id !== select.value ||
          JSON.stringify(socialArchiveDataset.archiveRows) !== JSON.stringify(selected)) setSocialArchiveDataset(studioDataset(selected));
    }
    updateControls();
  }
  function showHistoryRows() {
    const list = groups(history).get($('archiveSelect').value) || [];
    $('archiveRows').innerHTML = list.length ? list.map(r => '<tr><td>'+e(r[col.rank])+'</td><td>'+e(r[col.model])+'</td><td>'+e(r[col.brand_group])+'</td><td class="num">'+e(displayWan(Number(r[col.estimated_units])))+'</td></tr>').join('') : '<tr><td colspan="4" class="empty">'+(loading ? '正在加载历史销量…' : loaded ? '尚无历史销量记录' : '历史加载失败，请查看上方提示')+'</td></tr>';
  }
  function bindSelectedHistory(scroll = false) {
    const list = groups(history).get($('archiveSelect').value);
    if (!list || !list.length) return;
    if (!socialArchiveDataset || socialArchiveDataset.id !== list[0][col.dataset_id] ||
        JSON.stringify(socialArchiveDataset.archiveRows) !== JSON.stringify(list)) setSocialArchiveDataset(studioDataset(list));
    if (scroll) $('socialStudio').scrollIntoView({behavior:'smooth',block:'start'});
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
  $('exportCsv').onclick = () => {
    try { const rows = buildRows(); exportCSVBlob([HEADER,...rows],singleName(rows)); notify('本期标准销量 CSV 已导出'); }
    catch (err) { notify(err.message); }
  };
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

  // Each board owns its threshold and metadata; a new custom screenshot starts fresh.
  const previousRender = renderAll;
  renderAll = function (...args) {
    const d = ds(), switched = d !== activeDataset;
    if (switched) {
      activeDataset = d;
      $('outlier').value = d.archiveOutlier || '0.15';
      d.archiveOutlier = $('outlier').value;
    } else d.archiveOutlier = $('outlier').value;
    previousRender(...args);
    if (switched && socialArchiveDataset) setSocialArchiveDataset(null);
    updateControls(switched);
  };
  activeDataset = ds();
  activeDataset.archiveOutlier = $('outlier').value;
  window.SalesEstimateArchive = Object.freeze({buildRows, normalizeModelName, buildSalesPanel: rows => buildSalesPanel(rows,col), header:HEADER.slice()});
  updateControls(true);
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
  loadRepository();
})();
