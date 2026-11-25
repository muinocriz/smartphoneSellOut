/* Module 3 publishing workflow, immutable export snapshots and local preferences. */
const socialState={template:'top',ratio:'3:4',theme:'editorial_paper',duelA:0,duelB:1,lastDS:null,duelOptions:null,safeEnabled:true,safeRight:13,safeBottom:10,safeGuides:true};
const watermarkDefaults=PosterWatermark.defaults;
const watermarkState={...watermarkDefaults};
const socialCopyState={title:'',subtitle:'',tagLabel:'',markLeft:'',markRight:'',disclaimer:'',chartNote:''};
const socialCopyDirty={title:false,subtitle:false,tagLabel:false,markLeft:false,markRight:false,disclaimer:false,chartNote:false};
// Shared theme system: market-share SVG and estimator Canvas use identical tokens.
const socialPalettes=window.PosterThemes.estimatorPalettes;
function derivedData(){return deriveDataset(ds(),getFit())}
let socialArchiveDataset=null;
let socialResearchSnapshot=null;
let savedResearchHeader=null;
const researchContentFields=['title','subtitle','tagLabel','disclaimer','chartNote'];
function isResearchTemplate(type=socialState.template){return String(type).startsWith('research:');}
function researchStudioActive(){return isResearchTemplate()&&!!socialResearchSnapshot;}
function socialData(){return socialArchiveDataset?deriveDataset(socialArchiveDataset,socialArchiveDataset.archiveFit):derivedData()}
function syncStudioSourceActions(){
 const research=researchStudioActive(),archive=!research&&!!socialArchiveDataset,back=$('studioReturnSource'),current=$('studioUseCurrent');
 back.hidden=!(research||archive);back.textContent=research?'返回热销机型追踪':'返回历史榜单';
 current.hidden=!(research||archive);
}
function calibrationCount(o){return o.d.archiveRows?o.d.archiveCalibrationCount:o.d.calibrations.length}
function rejectedCount(o){return o.d.archiveRows?o.d.archiveCalibrationCount-o.d.archiveAcceptedCount:o.fit.statuses.filter(v=>v==='outlier').length}
function socialSourceName(o){return o.d.archiveSource||'RD观测'}
function setSocialArchiveDataset(d){
 if(socialArchiveDataset!==d){socialArchiveDataset=d;if(!researchStudioActive())for(const k of Object.keys(socialCopyDirty))socialCopyDirty[k]=false;}
 updateSocial(!researchStudioActive());
}
function deriveDataset(d,fit){const bars=d.bars||[],total=bars.reduce((x,b)=>x+b.pixels,0);
 const models=bars.map((b,i)=>({name:b.name,rank:b.rank,pixels:b.pixels,brand:window.BrandUtils.classify(b.name,d.archiveRows?b.archiveBrand:'')||'未识别品牌',sale:fit.k===null?null:d.archiveRows?b.archiveSale:fit.k*b.pixels,share:total?b.pixels/total:0,rel:bars[0]?b.pixels/bars[0].pixels:0,index:i}));
 const brands=[],by=Object.create(null);
 models.forEach(m=>{if(!by[m.brand]){by[m.brand]={brand:m.brand,count:0,pixels:0,sale:fit.k===null?null:0,share:0,hero:m.name,heroPixels:m.pixels,heroRank:m.rank};brands.push(by[m.brand])}
  const b=by[m.brand];b.count++;b.pixels+=m.pixels;if(fit.k!==null)b.sale+=m.sale;if(m.pixels>b.heroPixels){b.hero=m.name;b.heroPixels=m.pixels;b.heroRank=m.rank}
 });
 brands.forEach(b=>{b.share=total?b.pixels/total:0});brands.sort((a,b)=>b.pixels-a.pixels);
 const top3=models.slice(0,3).reduce((x,b)=>x+b.pixels,0),top5=models.slice(0,5).reduce((x,b)=>x+b.pixels,0);
 return {d,fit,models,brands,total,top3:total?top3/total:0,top5:total?top5/total:0,ratio:models.length>1?models[0].pixels/models[1].pixels:null,canPublish:fit.k!==null&&!['conflict','median'].includes(fit.fitMode)&&models.length>1}
}
// Presentation only: all estimated volumes are shown in wan units with one decimal.
function displayWan(value){return value===null||value===undefined||!Number.isFinite(value)?'待标定':fmt(value/10000,1)}
function displayTimes(v){return v===null||!Number.isFinite(v)?'—':fmt(v,2)+' 倍'}
function displayPct(v){return Number.isFinite(v)?fmt(v*100,1)+'%':'—'}
function displaySale(value){return value===null||value===undefined||!Number.isFinite(value)?'待标定':displayWan(value)+' 万台'}
function updateSafeLabels(){const r=Math.round(socialState.safeRight),b=Math.round(socialState.safeBottom);if($('safeRightVal'))$('safeRightVal').textContent=r+'%'+(r===13?'（推荐）':'');if($('safeBottomVal'))$('safeBottomVal').textContent=b+'%'+(b===10?'（推荐）':'');if($('safeEnable'))$('safeEnable').checked=!!socialState.safeEnabled;if($('safeGuides'))$('safeGuides').checked=!!socialState.safeGuides;if($('safeRight'))$('safeRight').value=String(r);if($('safeBottom'))$('safeBottom').value=String(b)}
function syncPaletteChooser(){
 const holder=$('paletteChooser');if(!holder)return;
 holder.querySelectorAll('[data-theme]').forEach(btn=>{
  const theme=btn.dataset.theme;
  btn.classList.toggle('is-selected',theme===socialState.theme);
  btn.setAttribute('aria-pressed',String(theme===socialState.theme));
  const colors=socialPalettes[theme].swatches;
  btn.querySelectorAll('.ui-swatches i').forEach((dot,i)=>{dot.style.background=colors[i]||'#ffffff'});
 });
}
// Public-facing chart copy: intentionally separate from research method notes and CSV metadata.
const publicResearchHeadings={
 model:['机型销量趋势','重点机型销量走势'],
 generation:['新旧机型销量对比','两代合计周销量与新代替代率'],
 structure:['产品结构分析','不同产品类型的销量表现'],
 tier:['同档代际对比','同价位新旧机型销量比较'],
 tail:['长尾韧性分析','哪些老机型仍保持榜单活跃？'],
 flow:['榜单流动分析','哪些机型进入或退出榜单？'],
 brand:['榜单品牌结构与集中度','各品牌上榜表现与集中度'],
 dual:['榜内与全市场品牌竞争分析','品牌份额与增长来源'],
 coverage:['TOP30市场覆盖率与销量分层','市场规模及销量分层'],
 price:['价格带竞争分析','不同首发价位的销量表现'],
 position:['品牌产品定位分析','各品牌首发价位与销量分布'],
 chip:['芯片平台竞争分析','不同芯片平台的上榜表现'],
 age:['新老产品结构分析','新品与老机型销量占比'],
 cross:['多维产品竞争分析','不同产品属性的销量分布']
};
function publicResearchTag(s){
 let tag=String(s.range||'').replace(/\s*→\s*/g,' vs ').replace(/（完整销售周）/g,' · 上市后周次').trim();
 if(!tag)return '';
 if(['coverage','dual'].includes(s.key)&&!tag.includes('TOP30'))tag+=' · TOP30';
 if(s.config?.sampleMode==='expanded')tag+=' · 扩展样本';
 return tag;
}
function publicResearchChartNote(s){
 const key=s.key,kind=s.chart?.kind||'',imputed=!!s.chart?.imputed;
 if(s.config?.sampleMode==='expanded'){const details={generation:'替代率为新代销量占两代合计比例，不代表实际换机',tier:'仅比较所选统计范围，缺失不等于零',price:'价格按正式首发价归类；合计项无法归类时保留未知',position:'销量加权首发价并非成交均价',chip:'跨芯片类别合计项保留未知',age:'按正式开售时间划分；未知年龄不强行归类',cross:'合计项不拆分；跨类别保留未知',brand:'占比以扩展样本为分母；色带不代表销量迁移',structure:'只统计所选样本，不代表市场份额',model:kind==='trackerBoth'?'销量采用扩展样本；排名仍为原始榜单':'缺失不等于零；合计项不拆分'};return details[key]||'扩展样本，非全市场';}
 if(key==='model'){
  if(kind==='trackerRank'||kind==='trackerMatrix')return '未上榜不代表停销；排名仅代表当前榜单';
  if(kind==='trackerBoth')return '销量为估算值；榜单排名并非全市场排名';
  if(imputed)return '空心点代表补充估算，不能当作实测销量';
  return '';
 }
 if(key==='generation')return kind==='generationDualAxis'?'替代率为新代周销量占比，不代表实际换机'+(imputed?'\n浅色柱及折线虚线段含插补':''):'两代机型销量变化不等于用户实际换机';
 if(key==='tail')return s.chart?.tail?'周均销量只计近期实际入榜周；未上榜不代表停销或零销量':'未出现在榜单中不代表机型已停销';
 if(key==='flow')return '进入或退出榜单，不等于上市或停销';
 if(key==='brand'&&['brandStack','brandRibbon'].includes(kind))return '浅色连接仅表示同品牌份额变化，不代表销量转移';
 if(key==='dual')return kind==='brandGrowth'?'榜外、总销量变化为模型情景；区间跨零时方向不确定':'上下图统计范围不同；色带仅连接同一品牌';
 if(key==='coverage'){
  if(kind==='coverageLayers')return s.chart?.skuEnabled?'紫线为市场总销量情景中点；下图榜外为推导值':'紫线仅为市场下界；无上界时不绘制分层';
  if(kind==='coverageTrend')return s.chart?.skuEnabled?
   '紫线是情景区间中点；浅色带是市场总销量估算范围':
   '紫线仅为市场总销量下界，不能视作完整市场销量';
  return '市场规模和覆盖率均为条件性估算';
 }
 if(key==='price')return '价格按首发起售价划分，并非实际成交价';
 if(key==='position')return '价格为首发价，不代表实际成交均价';
 if(key==='age')return '新品按开售时间划分，不以首次上榜为准';
 if(key==='tier')return '只对比所选机型，不代表同价位全部产品';
 if(key==='cross')return '仅比较所选产品属性及入榜机型';
 if(imputed)return '空心点代表补充估算，不能当作实测销量';
 return '';
}
function publicResearchCopy(s){
 const names=publicResearchHeadings[s.key]||[s.title,s.subtitle],tagLabel=publicResearchTag(s);
 let title=names[0],subtitle=names[1];
 if(s.key==='model'){
  const kind=s.chart?.kind;
  if(kind==='trackerRank'||kind==='trackerMatrix'){title='机型榜单排名走势';subtitle='重点机型在榜单中的排名变化';}
  else if(kind==='trackerBoth'){title='机型销量与榜单排名';subtitle='销量与排名一起看';}
  else if(s.chart?.axis==='lifecycle')subtitle='上市后各周销量变化';
 }
 if(s.key==='tail'&&s.chart?.tail)subtitle='上市年龄与近期销售活跃度';
 if(s.key==='dual'&&s.chart?.kind==='brandGrowth'){title='品牌销量增长贡献分解';subtitle='六大母品牌榜内与榜外环比变化';}
 if(s.key==='coverage'){
  const view=s.config?.topic?.view;
  if(view==='coverage')subtitle='TOP30样本销量占整体市场多少？';
  else if(view==='mom')subtitle='市场环比变化对比';
  else if(view==='gap')subtitle='市场环比走势差异';
 }
 const source=[s.config?.source,s.config?.series].filter(Boolean).join(' / ')||s.source||'历史销量榜';
 const cross=['dual','coverage'].includes(s.key);
 if(s.config?.sampleMode==='expanded'){if(s.key==='brand'){title='品牌销量结构与集中度';subtitle='扩展样本中的品牌销量表现';}if(s.key==='chip')subtitle='不同芯片平台的样本销量表现';return {title,subtitle,tagLabel,chartNote:publicResearchChartNote(s),disclaimer:'来源：重点机型周增量／累计差分 + '+source+' TOP30估算\n扩展样本按覆盖范围去重，不代表全市场销量或份额'};}
 let disclaimer='来源：'+source+(cross?'；对照：全市场品牌份额数据':' · 榜单销量为估算值');
 if(s.key==='dual')disclaimer+=s.chart?.kind==='brandGrowth'?'\n榜外与品牌总销量为条件性估算，不是官方统计':'\nTOP30仅代表入榜样本；下图为整体市场份额';
 else if(s.key==='coverage')disclaimer+='\n市场总销量为条件性估算，不是官方统计';
 else if(s.key==='model'&&['trackerRank','trackerMatrix'].includes(s.chart?.kind))disclaimer+='\n排名只代表所选榜单，不是全市场排名';
 else disclaimer+='\n仅统计入榜样本，不代表全市场销量或份额';
 return {title,subtitle,tagLabel,chartNote:publicResearchChartNote(s),disclaimer};
}
function defaultPosterTag(o){
 if(o.d.archiveRows)return String(o.d.label||'').replace(/（实收(\d+)条）/g,' · 实收$1条');
 if(!o.models.length)return '';
 const filename=String(o.d.label||'').replace(/\.(?:png|jpe?g|webp)$/i,'').trim();
 // An upload filename without a recognizable period is not a useful public label.
 return /(?:20\d{2}[-/]?W\d{1,2}|\d{1,2}月\d{1,2}日|第\d{1,2}周|W\d{1,2})/i.test(filename)?filename:'本期入榜样本';
}
function researchNoteDefaults(s){
 const publicCopy=publicResearchCopy(s);
 return {chartNote:publicCopy.chartNote,disclaimer:publicCopy.disclaimer};
}
function posterCopyDefaults(type,o){
 if(isResearchTemplate(type)&&socialResearchSnapshot)return {
  ...publicResearchCopy(socialResearchSnapshot),markLeft:'',markRight:''
 };
 const hd=posterHeading(type);
 return {title:hd.title,subtitle:hd.sub,tagLabel:defaultPosterTag(o),markLeft:'',markRight:'',
  disclaimer:'来源：'+socialSourceName(o)+' · 榜单销量为估算值\n仅统计本次榜单样本，不代表全市场销量或份额'};
}
function syncPosterCopyUI(type,o,force=false){const defs=posterCopyDefaults(type,o);const bind={title:'copyTitle',subtitle:'copySubtitle',tagLabel:'copyTagLabel',markLeft:'copyMarkLeft',markRight:'copyMarkRight',disclaimer:'copyDisclaimer',chartNote:'copyChartNote',chartHeader:'copyChartHeader',chartSubheader:'copyChartSubheader'};for(const [key,id] of Object.entries(bind)){if(force||!socialCopyDirty[key])socialCopyState[key]=defs[key]??'';if($(id) && $(id).value!==socialCopyState[key])$(id).value=socialCopyState[key];}}
function getPosterCopy(type,o){const defs=posterCopyDefaults(type,o);const copy={title:socialCopyDirty.title?socialCopyState.title:defs.title,subtitle:socialCopyDirty.subtitle?socialCopyState.subtitle:defs.subtitle,tagLabel:socialCopyDirty.tagLabel?socialCopyState.tagLabel:defs.tagLabel,markLeft:socialCopyDirty.markLeft?socialCopyState.markLeft:defs.markLeft,markRight:socialCopyDirty.markRight?socialCopyState.markRight:defs.markRight,disclaimer:socialCopyDirty.disclaimer?socialCopyState.disclaimer:defs.disclaimer};for(const k of ['chartNote'])copy[k]=socialCopyDirty[k]?socialCopyState[k]:(defs[k]??'');return copy;}
function resetPosterCopy(force=false){if(researchStudioActive()){for(const k of researchContentFields)socialCopyDirty[k]=false;syncPosterCopyUI(socialState.template,socialData());if(!force)updateSocial(false);return;}for(const k of Object.keys(socialCopyDirty))socialCopyDirty[k]=false;const o=socialData();syncPosterCopyUI(socialState.template,o,true);if(!force)updateSocial(false)}
function activeColumnMode(){if(researchStudioActive())return 'research';const chosen=$('contentColumn')?.value||'auto';if(chosen!=='auto')return chosen;return({top:'weekly',versus:'duel',brands:'brands',leader:'leader'})[socialState.template]||'weekly'}
function columnModeLabel(mode=activeColumnMode()){if(mode==='research')return socialResearchSnapshot?.title||'研究专题';return({weekly:'每周 TOP10 栏目',duel:'双机销量 PK 栏目',brands:'品牌上榜实力栏目',leader:'榜首断层分析栏目'})[mode]||'自动栏目'}
function generateHeadlinePack(type,o){if(isResearchTemplate(type)&&socialResearchSnapshot){const p=publicResearchCopy(socialResearchSnapshot);return {xhs:p.title+'｜'+p.tagLabel,dy:p.title+'\n'+p.tagLabel,carousel:['P1 封面：'+p.title+' · '+p.tagLabel,'P2 图表：'+p.subtitle,'P3 阅读提示：'+(p.chartNote||'根据图表观察销量及占比变化'),'P4 说明：'+p.disclaimer.replace(/\n/g,'；')].join('\n')};}if(o.models.length<2)return {xhs:'',dy:'',carousel:''};const top=o.models[0],second=o.models[1],period=defaultPosterTag(o),mode=activeColumnMode();let xhs='',dy='',carousel='';if(mode==='weekly'){xhs=`${period}销量TOP10｜${top.name}排第一，领先第二名${displayTimes(o.ratio)}`;dy=`${period.replace(' · ',' ')}
TOP10谁卖得最好？
${top.name}冲到第一`;carousel=`P1 封面：${period}手机销量TOP10
P2 榜首信息：${top.name}约${displaySale(top.sale)}，领先第二名 ${displayTimes(o.ratio)}
P3 TOP3看点：TOP3估算样本占比 ${displayPct(o.top3)}
P4 4-7名：中段机型表现与品牌分布
P5 8-10名：入榜守门员与尾部差距
P6 结尾：说明“仅统计当前榜单入榜样本，非全市场份额”`;}else if(mode==='duel'){const a=o.models[socialState.duelA]||top,b=o.models[socialState.duelB]||second;const bigger=a.sale>=b.sale?a:b,smaller=a.sale>=b.sale?b:a;xhs=`${a.name} vs ${b.name}｜同榜销量差多少？${bigger.name}约领先${displaySale(Math.abs(a.sale-b.sale))}`;dy=`双机销量PK
${a.name}
VS
${b.name}`;carousel=`P1 封面：${a.name} VS ${b.name}
P2 A机型：第${a.rank}名，约${displaySale(a.sale)}
P3 B机型：第${b.rank}名，约${displaySale(b.sale)}
P4 差距：${bigger.name}约是${smaller.name}的 ${displayTimes(bigger.pixels/smaller.pixels)}
P5 结论：两机差值约 ${displaySale(Math.abs(a.sale-b.sale))}
P6 口径说明：只比较同榜同周期上榜样本`;}else if(mode==='brands'){const first=o.brands[0],secondBrand=o.brands[1];xhs=`${period}品牌上榜实力｜${first?first.brand:'头部品牌'}居前，入榜样本结构一图看懂`;dy=`品牌上榜实力
${period.replace(' · ',' ')}
谁在这份榜里更强？`;carousel=`P1 封面：${period}品牌上榜实力
P2 第1品牌：${first?first.brand+'，'+first.count+'条上榜':''}
P3 第2品牌：${secondBrand?secondBrand.brand+'，'+secondBrand.count+'条上榜':''}
P4 结构观察：头部品牌合计占比、腰部品牌分布
P5 注意事项：这里只看入榜样本，不等于品牌市场份额
P6 结尾：可补一句“你更看好谁继续冲榜？”`;}else{const lead=top.sale-second.sale;xhs=`${top.name}断层第一？｜${period}榜首领先约${displaySale(lead)}`;dy=`榜首断层分析
${top.name}第一
领先多少？`;carousel=`P1 封面：榜首断层分析
P2 第一名：${top.name}约${displaySale(top.sale)}
P3 第二名：${second.name}约${displaySale(second.sale)}
P4 差距：榜首约领先 ${displaySale(lead)}，倍数 ${displayTimes(o.ratio)}
P5 集中度：TOP3占比 ${displayPct(o.top3)}，TOP5占比 ${displayPct(o.top5)}
P6 结尾：说明这是当前榜单的头部集中度，不是全市场集中度`;}
 return {xhs,dy,carousel};}
function normalizeDuelSelection(data){
 if(socialState.lastDS!==data.d){
  socialCopyDirty.tagLabel=false;
  socialState.lastDS=data.d;socialState.duelA=0;
  const target=data.models.find(m=>m.brand==='华为');
  socialState.duelB=target?target.index:1;
 }
 if(!data.models.length){socialState.duelA=0;socialState.duelB=1;return}
 const max=data.models.length-1;
 socialState.duelA=Math.max(0,Math.min(socialState.duelA,max));
 socialState.duelB=Math.max(0,Math.min(socialState.duelB,max));
 if(max>0&&socialState.duelA===socialState.duelB)socialState.duelB=(socialState.duelA+1)%data.models.length;
}
function updateDuelSelects(data=socialData()){
 normalizeDuelSelection(data);
 const options=data.models.map(m=>`<option value="${m.index}">#${m.rank} ${e(m.name)}</option>`).join('');
 for(const key of ['A','B']){
  const node=$('duel'+key);
  if(socialState.duelOptions!==options)node.innerHTML=options;
  node.disabled=data.models.length<2;
  const value=data.models.length?String(socialState['duel'+key]):'';
  if(node.value!==value)node.value=value;
 }
 socialState.duelOptions=options;
}
function isMissingPostLabel(m){const name=String(m.name).trim();return !name||/^第\d+名$|^未命名/.test(name)}
function missingPostModels(o){return o.models.filter(isMissingPostLabel)}
function unclassifiedModels(o){return o.models.filter(m=>m.brand==='未识别品牌')}
function unclassifiedCount(o){return unclassifiedModels(o).length}
function formatModelRows(models){return models.map(m=>`第${m.rank}行（${m.name||'空白'}）`).join('、')}
function canDownloadSocial(o=socialData(),type=socialState.template){if(isResearchTemplate(type))return !!socialResearchSnapshot?.ready;if(!o.canPublish)return false;const namesMissing=o.models.filter(m=>/^第\d+名$/.test(m.name));if(type==='bundle')return !namesMissing.length&&!unclassifiedCount(o);if(type==='brands')return !unclassifiedCount(o);if(type==='top')return !namesMissing.some(m=>m.rank<=10);if(type==='versus')return ![o.models[socialState.duelA],o.models[socialState.duelB]].some(m=>!m||/^第\d+名$/.test(m.name));if(type==='leader')return !namesMissing.some(m=>m.rank<=2);return true}
function updateSocial(rewriteStory=true){if(researchStudioActive()){updateResearchStudio(rewriteStory);return;}const o=socialData();$('downloadAllCards').textContent='一键打包四张图 + 文案 + CSV';$('exportInsight').textContent='下载机型分析 CSV';$('exportBrands').hidden=false;$('contentColumn').disabled=false;updateDuelSelects(o);const safe=o.canPublish;const guard=$('qualityGuard');let flag='';if(o.d.archiveRows){if(!safe)flag='历史榜单的销量估算未达到发布条件，请核对归档标定数据。';else if(o.fit.fitMode==='single')flag='历史榜单仅一组标定，建议核实后发布。';else if(o.fit.fitMode==='robust')flag=`历史榜单原标定排除 ${rejectedCount(o)} 组，请核实后发布。`;}else if(!o.models.length){flag='当前未导入新榜单。请在上方导入截图并标定，或选择历史榜单生成图文。'}else if(o.fit.fitMode==='conflict'||o.fit.fitMode==='median'){flag='标定组之间存在显著冲突：已暂停正式图卡和打包导出。请核对异常值、销量单位及统计周期。'}else if(!o.fit.k){flag='尚未输入已知销量：以下仅能预览柱长比例，不能导出带绝对销量的正式图卡。请先在上方加入至少一组标定。'}else if(o.fit.fitMode==='robust'){flag=`可以导出，但检测到 ${o.fit.statuses.filter(v=>v==='outlier').length} 组异常标定并已暂时排除。请核对数据后再发布。`}else if(o.fit.fitMode==='single'){flag='当前仅有一组标定：可导出估算图卡，但尚不能通过其他已知销量交叉校验。建议增加至少一组。'}else if(!safe){flag='当前数据尚未达到正式图卡发布条件，请核对标定数据。'}
 const missingModels=missingPostModels(o),unknownModels=unclassifiedModels(o).filter(m=>!isMissingPostLabel(m)),missing=missingModels.length,unknown=unknownModels.length;
 if(missing)flag+=` 尚未补全 ${missing} 个机型名称：${formatModelRows(missingModels)}。`;
 if(unknown)flag+=` ${unknown} 个条目品牌无法识别：${formatModelRows(unknownModels)}。品牌分析及整套打包需先补全标准品牌前缀。`;
 guard.className='msg warn';
 guard.hidden=!flag.trim();
 $('copyChartNoteField').hidden=true;$('copyDisclaimerLabel').textContent='免责附注（支持换行↙）';$('exportChartData').hidden=true;$('studioSource').textContent=o.d.archiveRows?'图文数据源：历史榜单 · '+o.d.archiveDisplayLabel:'图文数据源：当前标定榜单 · '+o.d.label;syncStudioSourceActions();
 guard.textContent=flag;$('downloadCard').disabled=publicationJob.busy||!canDownloadSocial(o,socialState.template);$('downloadAllCards').disabled=publicationJob.busy||!canDownloadSocial(o,'bundle');
 $('duelSetup').hidden=socialState.template!=='versus';$('previewSize').textContent=socialState.ratio==='3:4'?'1080 × 1440':'1080 × 1920';
 $('insightSummary').innerHTML=renderInsightSummary(o);updateSafeLabels();syncPaletteChooser();syncPosterCopyUI(socialState.template,o);drawPoster(socialState.template,$('posterCanvas'),o,true);if(rewriteStory){const pack=generateHeadlinePack(socialState.template,o);$('storyText').value=generateStory(socialState.template,o);$('xhsTitle').value=pack.xhs;$('dyTitle').value=pack.dy;$('carouselText').value=pack.carousel;}
}
function renderInsightSummary(o){if(!o.models.length)return '<p>尚无数据。</p>';const p=o.models[0],two=o.models[1];let cards=[['上榜条目',o.models.length+' 条'],['榜首 / 第二名',displayTimes(o.ratio)],['TOP3样本占比',displayPct(o.top3)],['识别品牌',o.brands.length+' 个']];if(o.fit.k!==null)cards[0]=['上榜样本估算合计',displayWan(o.models.reduce((sum,m)=>sum+m.sale,0))+' 万台'];return '<div class="insight-grid">'+cards.map(c=>`<div class="insight-cell"><div class="lab">${e(c[0])}</div><b>${e(c[1])}</b></div>`).join('')+'</div><div class="insight-note">'+e(`${p.name} 的柱长为 ${p.pixels}px；${two?two.name+' 为 '+two.pixels+'px；':''}品牌系列仅统计当前入榜条目；小米/REDMI、一加/OPPO、vivo/iQOO分别归并，不能据此推算全市场份额。`)+'</div>'}
function generateStory(type,o){if(isResearchTemplate(type)&&socialResearchSnapshot){const p=publicResearchCopy(socialResearchSnapshot);return [p.title+'｜'+p.tagLabel,'【看点】\n'+p.subtitle,p.chartNote?'【阅读提示】\n'+p.chartNote:'','【来源与说明】\n'+p.disclaimer].filter(Boolean).join('\n\n');}if(o.models.length<2)return '请先导入至少两条有效柱状图数据。';if(!o.canPublish)return `【待标定 / 暂不可发布】\n${o.d.label} 已识别 ${o.models.length} 条柱长。第一名：${o.models[0].name}（${o.models[0].pixels} px）；第二名：${o.models[1].name}（${o.models[1].pixels} px）。柱长比为 ${displayTimes(o.ratio)}。\n\n请在上方输入同一榜单至少一组已知销量，解决可能存在的标定冲突后，再生成可发布的估算销量文案。\n\n注意：像素长度本身不是销量数值。`;
 const top=o.models[0],second=o.models[1],period=defaultPosterTag(o),share=`仅统计本期榜单的 ${o.models.length} 条上榜记录，不代表全市场销量或品牌份额。`,note=`来源：${socialSourceName(o)}手机销量榜；销量为估算值，非官方统计。`;
 const titleSuffix=' #手机销量 #数码观察 #手机排行';
 if(type==='top'){
  const rows=o.models.slice(0,10).map(m=>`第${m.rank}名：${m.name}，约${displaySale(m.sale)}`).join('\n');
  return `【标题】\n${period}手机销量TOP10：${top.name}排第一\n\n【正文】\n${period}手机销量上榜机型TOP10数据整理好了：\n${rows}\n\n榜首约${displaySale(top.sale)}，是第二名的 ${displayTimes(o.ratio)}；TOP3合计约占本次入榜样本估算销量的 ${displayPct(o.top3)}。\n\n${share}\n${note}\n\n${titleSuffix}`;
 }
 if(type==='versus'){
  const a=o.models[socialState.duelA]||top,b=o.models[socialState.duelB]||second,larger=a.sale>=b.sale?a:b,smaller=a.sale>=b.sale?b:a,ratio=larger.pixels/smaller.pixels,diff=Math.abs(a.sale-b.sale);
  return `【标题】\n${a.name} vs ${b.name}：同榜销量差距有多少？\n\n【正文】\n基于${period}排行榜截图的柱长估算：\n${a.name}：第${a.rank}名，约${displaySale(a.sale)}。\n${b.name}：第${b.rank}名，约${displaySale(b.sale)}。\n\n${larger.name} 的估算销量约是 ${smaller.name} 的 ${displayTimes(ratio)}，两者相差约 ${displaySale(diff)}。\n\n仅对比同一榜单、同一统计期的上榜记录，不代表两款产品的生命周期总销量。\n${share}\n${note}\n\n#手机PK #数码数据 #手机销量`;
 }
 if(type==='brands'){
  if(unclassifiedCount(o))return `【品牌资料未完整】\n本榜还有 ${unclassifiedCount(o)} 个条目无法从名称识别品牌：${formatModelRows(unclassifiedModels(o))}。请先补充完整机型名称，再生成品牌对比内容。\n\n${note}`;
  const list=o.brands.slice(0,7).map((b,i)=>`${i+1}. ${b.brand}：${b.count} 条上榜记录，样本估算合计约 ${displaySale(b.sale)}，占入榜样本 ${displayPct(b.share)}`).join('\n');
  return `【标题】\n${period}品牌上榜表现：哪些品牌入榜更集中？\n\n【正文】\n这份TOP榜有 ${o.models.length} 条记录，按品牌归类后，各品牌在“本榜单入榜机型样本”中的估算表现如下：\n${list}\n\n这里的“占比”仅是当前榜单入榜记录之间的估算销量占比；未入榜型号不计入，绝对不能写成国内手机市场份额。\n${note}\n\n#手机品牌 #手机销量 #数码数据`;
 }
 const lead=top.sale-second.sale,top5=o.top5;
 return `【标题】\n${period}榜首表现：${top.name}领先第二名多少？\n\n【正文】\n${top.name}以约 ${displaySale(top.sale)} 位居本榜第一；第二名 ${second.name} 约 ${displaySale(second.sale)}。\n\n第一名估算销量约是第二名的 ${displayTimes(o.ratio)}，领先约 ${displaySale(lead)}。\nTOP3占这份上榜样本估算销量的 ${displayPct(o.top3)}；TOP5占 ${displayPct(top5)}。\n\n这些比例描述的是“本次榜单中的头部集中程度”，不是全市场集中度。\n${note}\n\n#手机销量 #榜首分析 #数码观察`;
}
function studioExportLabel(o=socialData()){return researchStudioActive()?socialResearchSnapshot.range:o.d.label;}
function markStudioTemplate(){document.querySelectorAll('#templateChooser [data-template]').forEach(b=>b.classList.toggle('active',b.dataset.template===socialState.template));}
function leaveResearchStudio(next='top'){
 if(researchStudioActive()&&savedResearchHeader){
  for(const k of researchContentFields){socialCopyState[k]=savedResearchHeader[k].value;socialCopyDirty[k]=savedResearchHeader[k].dirty;}
 }
 socialResearchSnapshot=null;savedResearchHeader=null;socialState.template=next;markStudioTemplate();
}
function applyResearchTopicToStudio(snapshot){
 if(!snapshot?.ready||!Object.prototype.hasOwnProperty.call(publicResearchHeadings,snapshot.key))return false;
 if(!researchStudioActive()){
  savedResearchHeader=Object.fromEntries(researchContentFields.map(k=>[k,{value:socialCopyState[k],dirty:socialCopyDirty[k]}]));
 }
 socialResearchSnapshot=freezePublication(JSON.parse(JSON.stringify(snapshot)));socialState.template='research:'+snapshot.key;
 // Retain manually edited watermarks while rebuilding topic-specific copy.
 for(const k of researchContentFields)socialCopyDirty[k]=false;
 markStudioTemplate();updateSocial(true);return true;
}
function updateResearchStudio(rewriteStory){
 const s=socialResearchSnapshot,o=socialData();
 const guard=$('qualityGuard');guard.className='msg warn';guard.hidden=!!s.ready&&s.config?.masterStatus!=='unavailable';guard.textContent=!s.ready?'当前研究专题无有效数据，暂不能导出。':s.config?.masterStatus==='unavailable'?'当前快照使用未匹配身份，未取得机型主数据；请核对后发布。':'';
 $('copyChartNoteField').hidden=false;$('copyDisclaimerLabel').textContent='图卡底部附注（可清空，支持换行）';$('exportChartData').hidden=false;
 $('studioSource').textContent='图文数据源：冻结研究快照 · '+s.title+' · '+s.context;syncStudioSourceActions();
 $('downloadCard').disabled=publicationJob.busy||!s.ready;$('downloadAllCards').disabled=publicationJob.busy||!s.ready;
 $('downloadAllCards').textContent='打包专题 PNG + 文案 + 数据 + 清单';
 $('duelSetup').hidden=true;$('previewSize').textContent=socialState.ratio==='3:4'?'1080 × 1440':'1080 × 1920';
 $('exportInsight').textContent='下载完整专题统计 CSV';$('exportBrands').hidden=true;$('contentColumn').disabled=true;
 $('insightSummary').innerHTML='<div class="insight-note">'+e([s.context,s.summary,s.detail,s.note].filter(Boolean).join('；'))+'</div>';
 updateSafeLabels();syncPaletteChooser();syncPosterCopyUI(socialState.template,o);drawPoster(socialState.template,$('posterCanvas'),o,true);
 if(rewriteStory){const pack=generateHeadlinePack(socialState.template,o);$('storyText').value=generateStory(socialState.template,o);$('xhsTitle').value=pack.xhs;$('dyTitle').value=pack.dy;$('carouselText').value=pack.carousel;}
}

function freezePublication(value){
 if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freezePublication);Object.freeze(value);}
 return value;
}
// Exact displayed values (not the full analytical table), including zero and null distinctions.
function researchChartRows(s){
 const meta=['专题','图表类型','指标','单位','显示横轴/行','序列/列','图表数值','数据状态','对应自然周','所选区间','有效自然周','主数据版本'];
 const chart=s.chart,rows=[meta],base=[s.title,chart?.kind||(chart?'line':'table'),s.displayMetric];
 const tail=[s.config?.selectedRange||'',s.effectivePeriods.join(' / '),s.config?.masterRevision||''];
 if(!chart){
  const t=s.table;if(!t)return rows;
  const indices=[0,1,2,3,7],labels=['机型','观测周','最长连续','末周连续','上榜合计/万台'];
  return [['专题','图表类型','显示顺序',...labels,'所选区间','有效自然周','主数据版本'],...t.rows.slice(0,10).map((r,i)=>[s.title,'table',i+1,...indices.map(k=>r[k]??''),...tail])];
 }
 const trackerRank=['trackerRank','trackerMatrix'].includes(chart.kind),combined=chart.kind==='trackerBoth';
 if(trackerRank||combined)meta.push('原始榜单规模');
 if(chart.tail)meta.push('近期自然周窗口','近期上榜次数','近期可判定周数','近期有效销量周数','末周在榜状态','年龄层','入选理由','近期逐周观测');
 if(chart.kind==='brandGrowth')meta.push('品牌','环比数据状态','榜外变化下界/万台','榜外变化上界/万台');
 if(['coverageTrend','coverageLayers'].includes(chart.kind))meta.push('SKU约束启用','全市场趋势检查启用','市场总销量下界/万台','SKU总销量上界/万台','苹果推导入榜率下限/%','苹果推导入榜率上限/%','自动检查状态');
 const sets=combined?[{lines:chart.lines,metric:chart.salesLabel||'销量',unit:'万台',rank:false},{lines:chart.rankLines,metric:'原始榜单排名',unit:'名',rank:true}]:[{lines:chart.lines,metric:s.displayMetric,unit:chart.unit||'',rank:trackerRank}];
 for(const set of sets)for(let i=0;i<chart.periods.length;i++)for(const line of set.lines){
  const v=line.values[i],valid=Number.isFinite(v),sourcePeriod=line.sourcePeriods?.[i]||(/^\d{4}-W\d{2}$/.test(chart.periods[i])?chart.periods[i]:(chart.calendarPeriods?.length===1?chart.calendarPeriods[0]:''));
  const unit=['generationDualAxis','coverageLayers','brandGrowth'].includes(chart.kind)?line.unit:chart.kind==='scatter'?(line.name||''):set.unit;
  const row=[base[0],base[1],['generationDualAxis','brandGrowth'].includes(chart.kind)?line.metric:chart.kind==='coverageLayers'?(line.panel==='layers'?'销量分层':'市场规模'):set.metric,unit,chart.periods[i],line.name,valid?v:'',set.rank?(line.statuses?.[i]||(valid?'原始榜单观测':'无排名记录')):!valid?'缺失或不适用':line.imputed?.[i]?'含插补':'有效显示值',sourcePeriod,...tail];
  if(trackerRank||combined)row.push(set.rank?line.boardSizes?.[i]||'':'');
  if(chart.tail){const point=chart.tailPoints[i];row.push(chart.tailWindow.join(' / '),point.recentCount,point.recentKnown,point.meanCount,point.lastStatus,point.band,point.reason,JSON.stringify(point.observations));}
  if(chart.kind==='brandGrowth')row.push(line.brand,line.statuses?.[i]||'',line.lower?.[i]??'',line.upper?.[i]??'');
  if(['coverageTrend','coverageLayers'].includes(chart.kind)){
   const scenario=!!line.scenario;
   row.push(String(!!chart.skuEnabled),String(!!chart.trendEnabled),
    scenario&&Number.isFinite(chart.marketLower?.[i])?chart.marketLower[i]:'',
    scenario&&Number.isFinite(chart.marketUpper?.[i])?chart.marketUpper[i]:'',
    scenario&&Number.isFinite(chart.derivedCaptureLow?.[i])?chart.derivedCaptureLow[i]:'',
    scenario&&Number.isFinite(chart.derivedCaptureHigh?.[i])?chart.derivedCaptureHigh[i]:'',
    scenario?chart.alertReasons?.[i]||'':'');
  }
  rows.push(row);
 }
 return rows;
}
function researchManifest(s,pub){
 return {schema_version:1,snapshot_schema:s.schemaVersion,topic:s.key,title:s.title,subtitle:s.subtitle,display_metric:s.displayMetric,source:s.source,range:s.range,effective_periods:s.effectivePeriods,configuration:s.config,chart:s.chart?{kind:s.chart.kind||'line',axis:s.chart.axis||null,unit:s.chart.unit||null,periods:s.chart.periods,series:s.chart.lines.map(l=>l.name),...(s.chart.tail?{tail_window:s.chart.tailWindow,tail_points:s.chart.tailPoints,mean_definition:'observed_ranked_weeks_only',marker_area:'recent_count',marker_fill:'end_week_status'}:{}),...(['coverageTrend','coverageLayers'].includes(s.chart.kind)?{apple_anchor_scenario:{sku_enabled:s.chart.skuEnabled,trend_enabled:s.chart.trendEnabled,max_missing_apple_skus:s.chart.maxMissingAppleSkus,weekly_cutoff:'original-rank-30',market_trend_tolerance_pp:s.chart.trendTolerancePp,derived_capture_rate_min:s.chart.derivedCaptureLow,derived_capture_rate_max:s.chart.derivedCaptureHigh,market_lower:s.chart.marketLower,market_upper:s.chart.marketUpper,bands:s.chart.bands,alerts:s.chart.alerts,alert_reasons:s.chart.alertReasons,center:'arithmetic_midpoint_of_feasible_range_only',automatic_correction:false,confidence_interval:false}}:{}),...(s.chart.kind==='coverageLayers'?{panels:[{id:'scale',unit:'万台'},{id:'layers',unit:'%',denominator:'market-scenario-midpoint',missing_without_feasible_interval:true}],series_units:s.chart.lines.map(l=>({name:l.name,unit:l.unit,panel:l.panel}))}:{}),...(s.chart.kind==='brandGrowth'?{layout:'3-rows-2-columns',scale:'shared-signed',series_units:s.chart.lines.map(l=>({name:l.name,brand:l.brand,metric:l.metric,unit:l.unit,role:l.role,...(l.role==='tail'?{lower:l.lower,upper:l.upper}:{}),statuses:l.statuses}))}:{}),...(s.chart.kind==='generationDualAxis'?{metrics:s.chart.lines.map(l=>({label:l.metric,unit:l.unit})),right_axis:{min:0,max:100,references:[50,80],definition:'new_generation_weekly_volume / combined_weekly_volume * 100'}}:{}),...(s.chart.kind==='trackerBoth'?{metrics:[{label:s.chart.salesLabel,unit:'万台'},{label:'原始榜单排名',unit:'名'}]}:{})}:{kind:'table',rows_displayed:Math.min(10,s.table?.rows.length||0)},poster:{ratio:pub.state.ratio,width:pub.width,height:pub.height,theme:pub.state.theme,safe_enabled:pub.state.safeEnabled,safe_right:pub.state.safeRight,safe_bottom:pub.state.safeBottom},limitations:[s.note,s.chartNote],fingerprint:StudioPref.fingerprint([s.config,s.chart,s.csv])};
}
function capturePublication(types,o){
 const state=Object.fromEntries(['template','ratio','theme','duelA','duelB','safeEnabled','safeRight','safeBottom'].map(k=>[k,socialState[k]]));
 const active=state.template,research=researchStudioActive()?socialResearchSnapshot:null,width=getPosterExportWidth();
 const folder=slugName(research?research.range+'_'+research.title:o.d.label);
 const cards=types.map(type=>({type,ready:canDownloadSocial(o,type),copy:getPosterCopy(type,o),name:storyName(type),story:type===active?$('storyText').value:generateStory(type,o)}));
 const original=research?null:{insight:insightRows(o),brands:brandRows(o),calibrations:calibrationCount(o),source:socialSourceName(o)};
 const snapshot={state,width,height:getPosterExportHeight(width,state.ratio),folder,label:studioExportLabel(o),research,original,cards,data:o,palette:socialPalettes[state.theme],watermark:{...watermarkState},texts:StudioPref.values(publicationTextIds)};
 return freezePublication(JSON.parse(JSON.stringify(snapshot)));
}
const publicationJob=PosterExport.createJob({
 buttons:()=>[$('downloadCard'),$('downloadVersions'),$('downloadAllCards')],
 status:()=>$('posterExportStatus'),
 onIdle:()=>updateSocial(false)
});
function beginPublication(message){return publicationJob.begin(message)}
function endPublication(){publicationJob.end()}
function publicationResult(message,kind='success'){publicationJob.report(message,kind)}
async function saveResearchBundle(){
 if(publicationJob.busy){notify('已有图卡导出正在进行');return;}
 const o=safeExport(),s=socialResearchSnapshot;if(!o||!s?.ready)return;
 const pub=capturePublication([socialState.template],o),card=pub.cards[0],r=pub.research,folder=pub.folder;
 if(!beginPublication('正在生成研究专题 PNG…'))return;
 try{
  const png=await posterBlob(pub,card),enc=new TextEncoder();
   publicationJob.report('正在打包专题图文与 CSV…');
  const files=[{name:folder+'.png',bytes:new Uint8Array(await png.arrayBuffer())},{name:folder+'_文案.txt',bytes:enc.encode(card.story)},{name:folder+'_标题与轮播.txt',bytes:enc.encode(['【小红书标题】',pub.texts.xhsTitle,'【抖音标题】',pub.texts.dyTitle,'【轮播脚本】',pub.texts.carouselText].join('\n'))},{name:folder+'_完整统计.csv',bytes:enc.encode(toCSV(r.csv))},{name:folder+'_图表数据.csv',bytes:enc.encode(toCSV(researchChartRows(r)))},{name:'统计口径.txt',bytes:enc.encode([r.context,r.description,r.detail,r.note,r.chartNote,'有效自然周：'+r.effectivePeriods.join(' / '),'主数据版本：'+(r.config?.masterRevision||'不可用')].filter(Boolean).join('\n'))},{name:'发布清单.json',bytes:enc.encode(JSON.stringify(researchManifest(r,pub),null,2))}];
  downloadBlob(zipArchive(files),folder+'_图文发布包.zip');publicationResult('当前研究专题已打包');
 }catch(err){publicationResult('打包失败：'+err.message,'error')}finally{endPublication()}
}

function csvQuote(v){return '"'+String(v??'').replace(/"/g,'""')+'"'}
function toCSV(rows){return '\ufeff'+rows.map(a=>a.map(csvQuote).join(',')).join('\r\n')}
function insightRows(o=socialData()){const a=[['榜单','名次','品牌系列','机型','柱长像素','相对榜首柱长(%)','估算销量(台)','估算销量(万台)','入榜样本估算销量占比(%)','本机销量/榜首(%)','榜首/本机(倍)','领先下一名(台)','落后上一名(台)','标定状态']];o.models.forEach((m,i)=>{const next=o.models[i+1],prev=o.models[i-1];a.push([o.d.label,m.rank,m.brand,m.name,m.pixels,(m.rel*100).toFixed(3),m.sale===null?'':m.sale.toFixed(0),m.sale===null?'':(m.sale/10000).toFixed(4),(m.share*100).toFixed(3),(m.rel*100).toFixed(3),(1/m.rel).toFixed(3),m.sale===null||!next?'':(m.sale-next.sale).toFixed(0),m.sale===null||!prev?'':(prev.sale-m.sale).toFixed(0),o.fit.fitMode])});a.push([]);a.push(['注意','样本仅覆盖原榜上榜条目，不代表全市场销量或市场份额。未标定时绝对销量列留空。']);return a}
function brandRows(o=socialData()){const r=[['榜单','品牌系列','上榜条目数','入榜柱长像素合计','入榜样本估算销量(台)','入榜样本估算销量(万台)','入榜样本占比(%)','系列主力机型','统计范围']];o.brands.forEach(b=>r.push([o.d.label,b.brand,b.count,b.pixels,b.sale===null?'':b.sale.toFixed(0),b.sale===null?'':(b.sale/10000).toFixed(4),(b.share*100).toFixed(3),b.hero,'仅当前截图上榜样本，品牌系列合并统计']));r.push([]);r.push(['注意','形如“华为 畅享 100/100m”的合并条目视为一条记录，无法拆分机型销量。']);return r}
function slugName(s){return String(s).replace(/[\\/:*?"<>|\s]+/g,'_').slice(0,75)}
function downloadBlob(blob,name){PosterExport.downloadBlob(blob,name)}
function exportCSVBlob(rows,name){downloadBlob(new Blob([toCSV(rows)],{type:'text/csv;charset=utf-8'}),name)}
function getPosterExportWidth(){return PosterExport.widthOf($('posterExportWidth').value)}
function getPosterExportHeight(width,ratio=socialState.ratio){return PosterExport.dimensions(width,ratio).height}
function updatePosterExportOptions(){
 PosterExport.updateOptions($('posterExportWidth'),socialState.ratio);
}
async function posterBlob(publication,card){
 await PosterExport.waitForFonts();
 return PosterExport.canvasPNG(c=>{
  const quality=drawPoster(card.type,c,publication.data,false,publication.width/1080,{...publication,copy:card.copy,ready:card.ready});
  if(quality.errors.length)throw new Error(card.name+'：'+quality.errors.join('；')+'。请调整留白或附注。');
 });
}
function safeExport(type=socialState.template){const o=socialData();if(isResearchTemplate(type)){if(socialResearchSnapshot?.ready)return o;notify('请先生成有有效数据的研究专题');return null;}if(!canDownloadSocial(o,type)){notify('请先完成可靠标定，并补全对应图卡所需的机型名称/品牌信息');return null}return o}
async function saveCard(){
 if(publicationJob.busy){notify('已有图卡导出正在进行');return;}
 const o=safeExport();if(!o)return;
 const pub=capturePublication([socialState.template],o),card=pub.cards[0];
 if(!beginPublication('正在生成高清 PNG…'))return;
 try{const blob=await posterBlob(pub,card);downloadBlob(blob,slugName(pub.label)+'_'+card.name+'_'+pub.state.ratio.replace(':','x')+'.png');publicationResult('导出完成')}catch(err){publicationResult('PNG 导出失败：'+err.message,'error')}finally{endPublication()}
}
async function saveCardVersions(){
 if(publicationJob.busy){notify('已有图卡导出正在进行');return;}
 if(!socialState.safeEnabled)return;
 const o=safeExport();if(!o)return;
 if(!beginPublication('正在准备两种海报版本…'))return;
 try{
  const pub=capturePublication([socialState.template],o),card=pub.cards[0];
  const name=slugName(pub.label)+'_'+card.name+'_'+pub.state.ratio.replace(':','x')+'.png';
  await PosterExport.exportSafeVersions(publicationJob,name,
   enabled=>freezePublication({...pub,state:{...pub.state,safeEnabled:enabled}}),
   publication=>posterBlob(publication,card));
 }catch(err){publicationResult('多版本导出失败：'+err.message,'error')}finally{endPublication()}
}
function storyName(type){if(isResearchTemplate(type))return slugName(socialResearchSnapshot?.title||'研究专题');return {top:'01_TOP10榜单',versus:'02_双机对比',brands:'03_品牌样本',leader:'04_榜首领先'}[type]}
// 离线 ZIP（Store 模式，无外部依赖；含 UTF-8 文件名和 CRC32）。
let crcTable=null;function crc32(u8){if(!crcTable){crcTable=Array.from({length:256},(_,i)=>{let c=i;for(let j=0;j<8;j++)c=(c&1)?0xedb88320^(c>>>1):(c>>>1);return c>>>0})}let c=0xffffffff;for(const b of u8)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0}
function zipArchive(files){const enc=new TextEncoder(),chunks=[],directory=[];let pos=0;const le=(bytes,...vals)=>{const out=new Uint8Array(bytes),dv=new DataView(out.buffer);for(const [offset,size,val] of vals){if(size===2)dv.setUint16(offset,val,true);else dv.setUint32(offset,val>>>0,true)}return out};for(const f of files){const n=enc.encode(f.name),data=f.bytes,crc=crc32(data),local=le(30,[0,4,0x04034b50],[4,2,20],[6,2,0x800],[8,2,0],[10,2,0],[12,2,0],[14,4,crc],[18,4,data.length],[22,4,data.length],[26,2,n.length],[28,2,0]);chunks.push(local,n,data);directory.push({name:n,crc,size:data.length,start:pos});pos+=30+n.length+data.length}const centralStart=pos;for(const f of directory){const c=le(46,[0,4,0x02014b50],[4,2,20],[6,2,20],[8,2,0x800],[10,2,0],[12,2,0],[14,2,0],[16,4,f.crc],[20,4,f.size],[24,4,f.size],[28,2,f.name.length],[30,2,0],[32,2,0],[34,2,0],[36,2,0],[38,4,0],[42,4,f.start]);chunks.push(c,f.name);pos+=46+f.name.length}const end=le(22,[0,4,0x06054b50],[4,2,0],[6,2,0],[8,2,directory.length],[10,2,directory.length],[12,4,pos-centralStart],[16,4,centralStart],[20,2,0]);chunks.push(end);return new Blob(chunks,{type:'application/zip'})}
async function saveBundle(){
 if(publicationJob.busy){notify('已有图卡导出正在进行');return;}
 if(researchStudioActive()){await saveResearchBundle();return;}
 const o=safeExport('bundle');if(!o)return;
 let archiveRows;try{archiveRows=window.SalesEstimateArchive.buildRows(o)}catch(err){notify(err.message);return}
 const pub=capturePublication(['top','versus','brands','leader'],o);
 const standardCSV=toCSV([window.SalesEstimateArchive.header,...archiveRows]);
 const folder=pub.folder,enc=new TextEncoder(),ratio=pub.state.ratio;
 if(!beginPublication('正在生成图卡 1 / '+pub.cards.length+'…'))return;
 try{
  const files=[];
  for(const [index,card] of pub.cards.entries()){
   publicationJob.report('正在生成图卡 '+(index+1)+' / '+pub.cards.length+'…');
   const png=await posterBlob(pub,card);
   files.push({name:folder+'/图卡/'+card.name+'_'+ratio.replace(':','x')+'.png',bytes:new Uint8Array(await png.arrayBuffer())});
   files.push({name:folder+'/文案/'+card.name+'.txt',bytes:enc.encode(card.story)});
  }
  files.push({name:folder+'/数据/本期标准销量.csv',bytes:enc.encode(standardCSV)});
  files.push({name:folder+'/数据/机型派生分析.csv',bytes:enc.encode(toCSV(pub.original.insight))});
  files.push({name:folder+'/数据/品牌入榜样本分析.csv',bytes:enc.encode(toCSV(pub.original.brands))});
  const readme=['本压缩包由手机销量柱长像素标定器生成','榜单：'+pub.data.d.label,'图卡比例：'+ratio,'PNG 分辨率：'+pub.width+' × '+pub.height+' px','已知销量标定：'+pub.original.calibrations+'组','拟合系数：'+pub.data.fit.k+' 台/像素','状态：'+pub.data.fit.fitMode,'','【重要限制】','1. 所有绝对销量均根据'+pub.original.source+'截图与用户已知数据按像素比例估算，并非官方或全市场销量。','2. 品牌上榜样本占比只统计本图中有柱条的条目，不得解释为市场份额。','3. 合并行按一条记录处理，不能拆分机型销量。','4. 数值显示的小数精度不代表测算具有同等精度。','5. 如输入标定来自累计销量差值，应确保时间窗口与当前榜单一致。'].join('\n');
  files.push({name:folder+'/使用说明.txt',bytes:enc.encode(readme)});
  publicationJob.report('正在打包 ZIP 文件…');
  downloadBlob(zipArchive(files),folder+'_图文发布包.zip');publicationResult('四张图卡、文案及 CSV 已打包');
 }catch(err){publicationResult('打包失败：'+err.message,'error')}finally{endPublication()}
}
// Safe-area controls only affect drawing geometry, not the rest of the studio DOM.
function redrawSafeAreaPreview(){
 updateSafeLabels();
 const o=socialData();
 drawPoster(socialState.template,$('posterCanvas'),o,true);
}

const StudioPref=window.StudioPreferences;
const visualKeys=['ratio','theme','safeEnabled','safeRight','safeBottom','safeGuides'];
const publicationTextIds=['storyText','xhsTitle','dyTitle','carouselText'];
function getVisualPreferences(){return {state:Object.fromEntries(visualKeys.map(k=>[k,socialState[k]])),controls:StudioPref.values(['posterExportWidth','contentColumn']),watermark:{...watermarkState}};}
function setVisualPreferences(p){
 const state=p?.state||{};
 if(['3:4','9:16'].includes(state.ratio))socialState.ratio=state.ratio;
 if(Object.prototype.hasOwnProperty.call(socialPalettes,state.theme))socialState.theme=state.theme;
 for(const k of ['safeEnabled','safeGuides'])if(typeof state[k]==='boolean')socialState[k]=state[k];
 for(const [k,id] of [['safeRight','safeRight'],['safeBottom','safeBottom']])if(Number.isFinite(state[k]))socialState[k]=Math.max(0,Math.min(Number($(id).max),state[k]));
 for(const [id,key] of [['posterRatio','ratio'],['safeEnable','safeEnabled'],['safeGuides','safeGuides'],['safeRight','safeRight'],['safeBottom','safeBottom']])StudioPref.setControl($(id),socialState[key]);
 StudioPref.apply(p?.controls,['posterExportWidth','contentColumn']);
 if(p?.watermark)for(const k of Object.keys(watermarkDefaults))if(typeof p.watermark[k]===typeof watermarkDefaults[k])watermarkState[k]=p.watermark[k];
 if(watermarkState.diagonalEnabled&&watermarkState.centerEnabled)watermarkState.centerEnabled=false;
 updatePosterExportOptions();PosterWatermark.sync(watermarkState);updateSafeLabels();syncPaletteChooser();
}
function publicationIdentity(){const o=socialData();return StudioPref.fingerprint(researchStudioActive()?[socialResearchSnapshot.key,socialResearchSnapshot.config,socialResearchSnapshot.chart,socialResearchSnapshot.csv]:[o.d.label,o.models.map(m=>[m.rank,m.name,m.pixels,m.sale]),o.fit.k]);}
function savePublicationScheme(){
 const signature=publicationIdentity();
 const data={visual:getVisualPreferences(),template:socialState.template,signature,copy:{...socialCopyState},dirty:{...socialCopyDirty},texts:StudioPref.values(publicationTextIds),duel:[socialState.duelA,socialState.duelB]};
 if(StudioPref.write('publication',data))notify('发布方案已保存至本浏览器');else notify('本地存储不可用或空间不足，方案未保存');
}
async function restorePublicationScheme(){
 const saved=StudioPref.read('publication');if(!saved.template){notify('没有已保存的发布方案');return;}
 if(publicationJob.busy)return;
 if(isResearchTemplate(saved.template)){
  const key=saved.template.slice(9);
  if(!Object.prototype.hasOwnProperty.call(publicResearchHeadings,key)){notify('已保存的研究专题不再提供，请选择现有专题并重新保存发布方案');return;}
  if(!window.SalesEstimateArchive||!await window.SalesEstimateArchive.sendResearchToStudio(key)){notify('当前数据无法重建已保存的专题，请检查历史数据');return;}
 }else if(['top','versus','brands','leader'].includes(saved.template)){leaveResearchStudio(saved.template);updateSocial(true);}else return;
 setVisualPreferences(saved.visual);
 const same=publicationIdentity()===saved.signature;
 if(same){
  for(const k of Object.keys(socialCopyState)){if(typeof saved.copy?.[k]==='string')socialCopyState[k]=saved.copy[k];socialCopyDirty[k]=saved.dirty?.[k]===true;}
  // Preserve hand-edited chart headers from older schemes in the new controls.
  if(isResearchTemplate(saved.template)){
   for(const [oldKey,newKey] of [['chartHeader','tagLabel'],['chartSubheader','subtitle']])
    if(saved.dirty?.[oldKey]===true&&!saved.dirty?.[newKey]&&typeof saved.copy?.[oldKey]==='string'){
     socialCopyState[newKey]=saved.copy[oldKey];socialCopyDirty[newKey]=true;
    }
  }
  if(Array.isArray(saved.duel)){socialState.duelA=Number.isInteger(saved.duel[0])?saved.duel[0]:0;socialState.duelB=Number.isInteger(saved.duel[1])?saved.duel[1]:1;updateDuelSelects();}
 }else{
  for(const k of ['markLeft','markRight'])if(typeof saved.copy?.[k]==='string'&&saved.dirty?.[k]){socialCopyState[k]=saved.copy[k];socialCopyDirty[k]=true;}
 }
 updateSocial(!same);if(same)StudioPref.apply(saved.texts,publicationTextIds);
 StudioPref.write('visual',getVisualPreferences());notify(same?'已恢复发布方案及文案':'当前数据与保存时不同，仅恢复样式、选题和账号水印；统计文案按当前数据生成');
}
function initPublicationPreferences(){
 setVisualPreferences(StudioPref.read('visual'));
 const host=$('socialStudio'),controls=document.createElement('div');controls.style.cssText='display:flex;flex-wrap:wrap;gap:8px;margin:8px 0';
 for(const [label,action] of [['保存当前发布方案',savePublicationScheme],['恢复本地发布方案',restorePublicationScheme],['清除本地发布方案',()=>{StudioPref.remove('publication');notify('已清除本地发布方案，当前编辑内容不变');}]]){const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent=label;b.onclick=action;controls.append(b);}
 $('templateChooser').after(controls);
 const persist=()=>StudioPref.write('visual',getVisualPreferences());
 for(const name of ['input','change','click'])host.addEventListener(name,ev=>{if(ev.target.closest('#posterRatio,#posterExportWidth,#contentColumn,#safeEnable,#safeGuides,#safeRight,#safeBottom,#paletteChooser,[id^="wm"]'))queueMicrotask(persist);});
}

function initSocial(){PosterWatermark.mount(()=>watermarkState,()=>updateSocial(false));
 $('studioReturnSource').onclick=()=>window.SalesEstimateArchive?.returnToStudioSource();
 $('studioUseCurrent').onclick=()=>{if(researchStudioActive())leaveResearchStudio('top');setSocialArchiveDataset(null);};
 $('templateChooser').addEventListener('click',ev=>{const b=ev.target.closest('[data-template]');if(!b)return;if(isResearchTemplate(b.dataset.template)){window.SalesEstimateArchive?.sendResearchToStudio(b.dataset.template.slice(9));return;}leaveResearchStudio(b.dataset.template);updateSocial(true)});
 updatePosterExportOptions();
 $('posterRatio').onchange=ev=>{socialState.ratio=ev.target.value;updatePosterExportOptions();updateSocial(false)};
 $('paletteChooser')?.addEventListener('click',ev=>{const b=ev.target.closest('[data-theme]');if(!b)return;socialState.theme=b.dataset.theme;syncPaletteChooser();updateSocial(false)});
 $('safeEnable').onchange=ev=>{socialState.safeEnabled=ev.target.checked;redrawSafeAreaPreview()};
 $('safeGuides').onchange=ev=>{socialState.safeGuides=ev.target.checked;redrawSafeAreaPreview()};
 $('safeRight').oninput=ev=>{socialState.safeRight=Number(ev.target.value);redrawSafeAreaPreview()};
 $('safeBottom').oninput=ev=>{socialState.safeBottom=Number(ev.target.value);redrawSafeAreaPreview()};
 for(const key of ['A','B'])$('duel'+key).onchange=ev=>{socialState['duel'+key]=Number(ev.target.value);if(socialState.duelA===socialState.duelB){notify('请选择两个不同的机型');socialState['duel'+key]=(socialState['duel'+key]+1)%Math.max(2,socialData().models.length);$('duel'+key).value=String(socialState['duel'+key])}updateSocial(true)};
 [['copyTitle','title'],['copySubtitle','subtitle'],['copyTagLabel','tagLabel'],['copyMarkLeft','markLeft'],['copyMarkRight','markRight'],['copyDisclaimer','disclaimer'],['copyChartNote','chartNote']].forEach(([id,key])=>{$(id).addEventListener('input',ev=>{socialCopyState[key]=ev.target.value;socialCopyDirty[key]=true;updateSocial(false)})});
 $('resetPosterCopy').onclick=()=>{resetPosterCopy();notify('已恢复当前模板默认文案')};
 $('downloadCard').onclick=saveCard;$('downloadVersions').onclick=saveCardVersions;$('downloadAllCards').onclick=saveBundle;
 $('exportChartData').onclick=()=>{if(researchStudioActive())exportCSVBlob(researchChartRows(socialResearchSnapshot),slugName(studioExportLabel())+'_图表数据.csv');};
 $('exportInsight').onclick=()=>{if(researchStudioActive()){const s=socialResearchSnapshot;exportCSVBlob(s.csv,slugName(studioExportLabel())+'_专题数据.csv');return;}const o=socialData();exportCSVBlob(insightRows(o),slugName(o.d.label)+'_机型派生分析.csv')};$('exportBrands').onclick=()=>{const o=socialData();exportCSVBlob(brandRows(o),slugName(o.d.label)+'_品牌上榜样本分析.csv')};
 $('regenStory').onclick=()=>{$('storyText').value=generateStory(socialState.template,socialData());notify('文案已按当前数据重新生成')};
 $('regenHeadline').onclick=()=>{const pack=generateHeadlinePack(socialState.template,socialData());$('xhsTitle').value=pack.xhs;$('dyTitle').value=pack.dy;$('carouselText').value=pack.carousel;notify('标题与轮播脚本已按当前数据重新生成')};
 $('contentColumn').onchange=()=>{const pack=generateHeadlinePack(socialState.template,socialData());$('xhsTitle').value=pack.xhs;$('dyTitle').value=pack.dy;$('carouselText').value=pack.carousel;};
 $('copyStory').onclick=async()=>{const value=$('storyText').value;try{await navigator.clipboard.writeText(value);notify('发布文案已复制')}catch(err){$('storyText').focus();$('storyText').select();try{document.execCommand('copy');notify('发布文案已复制')}catch(e){notify('请选中文案后手动复制')}}};
 $('copyHeadline').onclick=async()=>{const value=`【小红书标题】
${$('xhsTitle').value}

【抖音封面标题】
${$('dyTitle').value}

【轮播脚本】
${$('carouselText').value}`;try{await navigator.clipboard.writeText(value);notify('标题与轮播脚本已复制')}catch(err){$('carouselText').focus();$('carouselText').select();try{document.execCommand('copy');notify('标题与轮播脚本已复制')}catch(e){notify('请手动复制标题与轮播脚本')}}};
 $('downloadStory').onclick=()=>downloadBlob(new Blob([$('storyText').value],{type:'text/plain;charset=utf-8'}),slugName(studioExportLabel())+'_'+storyName(socialState.template)+'.txt');
 $('downloadHeadline').onclick=()=>downloadBlob(new Blob([`【栏目模板】
${columnModeLabel()}

【小红书标题】
${$('xhsTitle').value}

【抖音封面标题】
${$('dyTitle').value}

【轮播脚本】
${$('carouselText').value}`],{type:'text/plain;charset=utf-8'}),slugName(studioExportLabel())+'_'+storyName(socialState.template)+'_标题与轮播.txt');
 initPublicationPreferences();updateSafeLabels();syncPaletteChooser();resetPosterCopy(true);updateSocial(true);if(document.fonts?.ready)document.fonts.ready.then(()=>updateSocial(false));
}

// 用 IBM Plex Mono 单独包装网页中的数字，不影响旁边中文和英文的字体。
initSocial();

