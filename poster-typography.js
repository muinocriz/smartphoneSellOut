/* Popular Models and Ranking Research poster typography. Overrides are sparse: absence preserves the original adaptive design. */
const PosterTypography=(()=>{
 const common={
  markLeft:['左侧页眉',12,600],markRight:['右侧页眉',12,600],title:['主标题',24,750],subtitle:['副标题',14,500],tag:['标签',12,650],footer:['来源及免责声明（页脚）',8,400],watermark:['水印文字',null,700]
 };
 const groups={
  top:{rank:['排名',12,500],model:['机型名称',13,500],sale:['销量数值',12,500]},
  versus:{rank:['参考 / 对比机型及排名',null,500],model:['机型名称',13,500],metric:['指标名称',null,500],sale:['销量数值',null,500],ratio:['销量倍数',null,500],difference:['销量差值',null,500]},
  brands:{metric:['榜单概览',12,500],brand:['品牌名称',13,500],sale:['销量与样本占比',12,500],model:['主力机型',12,500]},
  leader:{rank:['榜首标识',null,500],model:['榜首机型名称',13,500],sale:['榜首销量',null,500],metric:['指标名称',null,500],ratio:['领先倍数',null,500],difference:['领先销量',null,500],share:['集中度占比',null,500]},
  research:{axisTitle:['坐标轴 / 子图标题',13,500],axis:['轴刻度 / 周次',8,400],legend:['图例',8,400],chartLabel:['图内名称 / 分类标签',null,500],chartValue:['图内数据标签',null,500],stackLabel:['堆叠 / 流向分组名称',13,500],stackValue:['堆叠区块数值',8,400],tableHead:['表头',null,500],tableBody:['表格内容',null,500],chartNote:['图表说明',8,400]}
 };
 const spacingFields=Object.freeze({xAxisGap:{label:'横轴标签轴距',default:8,max:20},yAxisGap:{label:'纵轴标签轴距',default:4,max:16},axisLegendGap:{label:'横轴标签与图例间距',default:8,max:24}});
 const families={default:'原始中英数字混排',sans:'黑体 / 无衬线',serif:'宋体 / 衬线',mono:'等宽字体'};
 const validScope=k=>['top','versus','brands','leader'].includes(k)||/^research:[A-Za-z0-9_-]+$/.test(k);
 const roles=k=>k==='common'?common:groups[k.startsWith('research:')?'research':k]||{};
 const isCommon=role=>Object.prototype.hasOwnProperty.call(common,role);
 const scope=(type,role)=>isCommon(role)?'common':type;
 const clean=raw=>{
  const out={};
  for(const [k,values] of Object.entries(raw||{})){
   if(k!=='common'&&!validScope(k)||!values||typeof values!=='object')continue;
   for(const [role,v] of Object.entries(values)){
    if(role==='spacing'&&k.startsWith('research:')&&v&&typeof v==='object'){
     const a={};for(const [key,d] of Object.entries(spacingFields))if(typeof v[key]==='number'&&Number.isFinite(v[key]))a[key]=Math.max(0,Math.min(d.max,v[key]));
     if(Object.keys(a).length)(out[k]??={}).spacing=a;
     continue;
    }
    if(!Object.prototype.hasOwnProperty.call(roles(k),role)||!v||typeof v!=='object')continue;
    const a={};
    if(typeof v.size==='number'&&Number.isFinite(v.size))a.size=Math.max(4,Math.min(60,v.size));
    if(typeof v.weight==='number'&&Number.isFinite(v.weight))a.weight=Math.max(100,Math.min(900,Math.round(v.weight)));
    if(Object.prototype.hasOwnProperty.call(families,v.family)&&v.family!=='default')a.family=v.family;
    if(v.style==='italic')a.style='italic';
    if(Object.keys(a).length)(out[k]??={})[role]=a;
   }
  }
  return out;
 };
 let profile=null,activeType='',activeRole='';
 function withProfile(config,type,draw){const old=[profile,activeType,activeRole];profile=config||{};activeType=type;activeRole='';try{return draw();}finally{[profile,activeType,activeRole]=old;}}
 function withRole(role,draw){const old=activeRole;activeRole=role;try{return draw();}finally{activeRole=old;}}
 function current(role=activeRole){return profile?.[scope(activeType,role)]?.[role]||{};}
 function size(role,fallback){
  const studioDefault=profile&&activeType.startsWith('research:')&&['axis','legend','stackValue'].includes(role)?groups.research[role][1]:null;
  const n=current(role).size??studioDefault;
  return n==null?fallback:n*3;
 }
 function spacing(key,fallback){return current('spacing')[key]??fallback;}
 function readabilityMin(fallback){return activeRole==='axis'||activeRole==='legend'?size(activeRole,fallback):fallback;}
 function font(size,weight,base,role=activeRole){
  const a=current(role),family=a.family==='sans'?CJK_FONT:a.family==='serif'?'"Source Han Serif SC","Noto Serif CJK SC","Songti SC",SimSun,serif':a.family==='mono'?NUM_FONT+','+CJK_FONT:base;
  return (a.style==='italic'?'italic ':'')+(a.weight??weight)+' '+size+'px '+family;
 }
 function has(role){return Object.keys(current(role)).length>0;}
 function hasAny(){return !!(profile&&(Object.keys(profile.common||{}).length||Object.keys(profile[activeType]||{}).length));}
 function auditText(ctx,x,y,width,ascent,descent,align,role=activeRole){
  if(!role||!hasAny()||![x,y,width,ascent,descent].every(Number.isFinite)||width<=0)return;
  const a=posterAudits.get(ctx);if(!a)return;
  const left=x-(align==='right'?width:align==='center'?width/2:0),b={l:left,r:left+width,t:y-ascent,b:y+descent,custom:has(role)};
  if(b.custom&&(b.l<-2||b.r>(a.safeRight??Infinity)+2||b.t<-2||b.b>(a.safeBottom??Infinity)+2))auditIssue(ctx,'自定义排版文字可能超出安全区域，请检查预览');
  const boxes=a.typographyBoxes??=[];
  if(boxes.some(v=>(b.custom||v.custom)&&Math.min(b.r,v.r)-Math.max(b.l,v.l)>3&&Math.min(b.b,v.b)-Math.max(b.t,v.t)>3))auditIssue(ctx,'自定义排版可能造成文字重叠，请缩小字号或调整图幅');
  if(boxes.length<600)boxes.push(b);
 }
 function exportConfig(config){
  const defaults=Object.fromEntries(Object.entries({common,...groups}).map(([scope,items])=>[scope,Object.fromEntries(Object.entries(items).map(([role,[label,size,weight]])=>[role,{label,size,weight,family:'default',style:'normal',bold:weight>=700}]))]));
  const overrides=clean(config);
  for(const values of Object.values(overrides))for(const v of Object.values(values))if(v.weight!=null)v.bold=v.weight>=700;
  return {schema_version:1,reference_width:360,unit:'logical_px',defaults,spacing_defaults:Object.fromEntries(Object.entries(spacingFields).map(([k,v])=>[k,v.default])),font_families:families,defaults_note:'Reference defaults; null or geometry-dependent values inherit the original adaptive renderer. Weight determines bold.',override_policy:'missing_property_inherits_original_renderer; common_shared; each_template_or_research_topic_independent',overrides};
 }
 function mount(host,getType,getConfig,setConfig,redraw,download,watermark){
  let selected='title',lastType='';
  const el=id=>host.querySelector('#'+id);
  const type=()=>getType();
  const available=()=>({...common,...roles(type())});
  const currentValue=()=>getConfig()?.[scope(type(),selected)]?.[selected]||{};
  function sync(){
   const t=type(),all=available();
   if(t!==lastType){
    if(!all[selected])selected='title';lastType=t;
    el('typoElements').replaceChildren(...Object.entries(all).map(([key,v])=>{const o=document.createElement('option');o.value=key;o.textContent=(isCommon(key)?'公共 · ':'当前图卡 · ')+v[0];return o;}));
   }
   el('typoElements').value=selected;
   const v=currentValue(),d=all[selected],wm=watermark(),defaultSize=selected==='watermark'?(wm.diagonalEnabled?wm.diagonalSize:wm.centerSize)/3:d[1];
   const defaultWeight=d[2],value=v.size??defaultSize;
   el('typoScope').textContent=(isCommon(selected)?'所有图卡共享':'仅当前图卡 / 研究专题')+'；参考默认字号：'+(defaultSize==null?'随布局自动':Number(defaultSize.toFixed(2))+' px')+'，参考默认字重：'+defaultWeight;
   el('typoSize').value=value==null?'':Number(value.toFixed(2));el('typoSize').placeholder='自动';el('typoSizeRange').value=value??12;
   el('typoFamily').value=v.family||'default';el('typoStyle').value=v.style||'normal';
   el('typoWeight').value=v.weight??defaultWeight;el('typoBold').checked=(v.weight??defaultWeight)>=700;
   el('typoWatermarkHint').hidden=selected!=='watermark';
   el('typoChartSpacing').hidden=!t.startsWith('research:');
   for(const [key,d] of Object.entries(spacingFields)){const input=el('typoSpacing-'+key);input.value=getConfig()?.[t]?.spacing?.[key]??d.default;}
  }
  function patch(patch){
   const config=clean(getConfig()),k=scope(type(),selected);
   const v={...currentValue(),...patch};(config[k]??={})[selected]=v;
   setConfig(clean(config));sync();redraw();
  }
  el('typoElements').onchange=e=>{selected=e.target.value;sync();};
  el('typoSizeRange').oninput=e=>patch({size:Number(e.target.value)});
  el('typoSize').oninput=e=>{const n=Number(e.target.value);if(e.target.value!==''&&n>=4&&n<=60)patch({size:n});};
  el('typoSize').onchange=e=>patch({size:e.target.value===''?null:Number(e.target.value)});
  el('typoFamily').onchange=e=>patch({family:e.target.value});
  el('typoStyle').onchange=e=>patch({style:e.target.value});
  el('typoWeight').oninput=e=>{const n=Number(e.target.value);if(e.target.value!==''&&n>=100&&n<=900)patch({weight:n});};
  el('typoWeight').onchange=e=>patch({weight:e.target.value===''?null:Number(e.target.value)});
  el('typoBold').onchange=e=>patch({weight:e.target.checked?700:400});
  function patchSpacing(key,value){
   const c=clean(getConfig()),k=type();if(!k.startsWith('research:'))return;
   const v={...c[k]?.spacing,[key]:value};(c[k]??={}).spacing=v;setConfig(clean(c));sync();redraw();
  }
  for(const [key,d] of Object.entries(spacingFields)){
   const input=el('typoSpacing-'+key);input.oninput=()=>{const n=input.valueAsNumber;if(Number.isFinite(n)&&n>=0&&n<=d.max)patchSpacing(key,n);};
   input.onchange=()=>patchSpacing(key,input.value===''?null:input.valueAsNumber);
  }
  el('typoSpacingReset').onclick=()=>{const c=clean(getConfig()),k=type();if(c[k]){delete c[k].spacing;if(!Object.keys(c[k]).length)delete c[k];}setConfig(c);sync();redraw();};
  el('typoResetOne').onclick=()=>{const c=clean(getConfig()),k=scope(type(),selected);if(c[k]){delete c[k][selected];if(!Object.keys(c[k]).length)delete c[k];}setConfig(c);sync();redraw();};
  el('typoResetAll').onclick=()=>{setConfig({});sync();redraw();};
  el('typoExport').onclick=()=>download(new Blob([JSON.stringify(exportConfig(getConfig()),null,2)],{type:'application/json;charset=utf-8'}),'module3-typography.json');
  sync();return sync;
 }
 return Object.freeze({clean,withProfile,withRole,size,spacing,readabilityMin,font,has,hasAny,auditText,exportConfig,mount});
})();
function posterFont(ctx,size,weight,base,role){return PosterTypography.font(size,weight,base,role);}
function posterTypeSize(role,size){return PosterTypography.size(role,size);}
function posterRoleFit(ctx,role,value,x,y,size,...rest){return PosterTypography.withRole(role,()=>posterFitText(ctx,value,x,y,posterTypeSize(role,size),...rest));}
function posterRoleFitBounded(ctx,role,value,x,y,size,...rest){return PosterTypography.withRole(role,()=>posterFitText(ctx,value,x,y,size,...rest));}
function posterRoleCanvas(ctx,role,value,x,y,size,...rest){return PosterTypography.withRole(role,()=>canvasText(ctx,value,x,y,posterTypeSize(role,size),...rest));}
function posterRoleMeasure(ctx,role,value,size,weight){return PosterTypography.withRole(role,()=>measureMixedCanvas(ctx,value,posterTypeSize(role,size),weight));}
function posterRoleWrap(ctx,role,value,width,size,weight){return PosterTypography.withRole(role,()=>posterWrap(ctx,value,width,posterTypeSize(role,size),weight));}
function posterRoleBlock(ctx,role,lines,size,weight,top){return PosterTypography.withRole(role,()=>posterBlock(ctx,lines,posterTypeSize(role,size),weight,top));}
