'use strict';
const FIELDS=["brand","model","category","date","period","metric","value_wan","operator"];
const records=[];
const metadata=Object.create(null);
function numberText(raw){let s=String(raw).trim().replace(/，/g,',');if(!s)return null;if(/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s))s=s.replace(/,/g,'');if(!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(s)||!Number.isFinite(Number(s))||Number(s)<0)throw Error('请输入非负数字（单位：万台）。');if(s.startsWith('.'))s='0'+s;if(s.endsWith('.'))s=s.slice(0,-1);return s;}
function parseCSV(text){const rows=[];let row=[],f='',q=false;const s=text.replace(/^\uFEFF/,'');for(let i=0;i<s.length;i++){const c=s[i];if(q){if(c==='"'){if(s[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}else if(c==='"'&&f===''){q=true;}else if(c===','){row.push(f);f='';}else if(c==='\r'||c==='\n'){if(c==='\r'&&s[i+1]==='\n')i++;row.push(f);if(row.some(x=>x.trim()!==''))rows.push(row);row=[];f='';}else f+=c;}if(q)throw Error('CSV 引号未闭合。');row.push(f);if(row.some(x=>x.trim()!==''))rows.push(row);return rows;}

const fmt=n=>Number(n.toFixed(4)).toLocaleString('zh-CN',{maximumFractionDigits:4});
function monday(period){
  const match=/^(\d{4})-W(\d{2})$/.exec(period);
  return match ? IsoSalesWeek.isoWeekMonday(+match[1],+match[2]) : null;
}
function isoWeekLabel(period,separator=' '){
  const date=new Date(monday(period));
  return period.replace('-W','W')+separator+(date.getUTCMonth()+1)+'/'+date.getUTCDate();
}
function iso(t){
  const year=new Date(t+259200000).getUTCFullYear();
  return year+'-W'+String(1+(t-monday(year+'-W01'))/604800000).padStart(2,'0');
}
const periods=[];
function display(point,format=fmt){return point?(point.op==='='?'':point.op==='>='?'≥':point.op)+format(point.value):'—'}

const byId=id=>document.getElementById(id);
function selectFilter(id,value){
  const group=byId(id);
  group.dataset.value=value;
  for(const button of group.querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.value===value));
}
function filterLabel(id){return byId(id).querySelector('[aria-pressed="true"]').textContent}
for(const id of ['brand','metric','axis','gap']){
  byId(id).onclick=event=>{
    const button=event.target.closest('button[data-value]');
    if(!button||button.disabled)return;
    const value=button.dataset.value;
    const resetRecent=id==='brand'&&value==='';
    if(id==='brand'&&activeEdit)return;
    if(!resetRecent&&byId(id).dataset.value===value)return;
    selectFilter(id,value);
    if(id==='brand')syncBrand();
    else draw({resetRange:id==='metric'||id==='axis'});
  };
}
const selected=new Set();
let savedLists=[];
try{savedLists=JSON.parse(localStorage.getItem('increments.lists')||'[]').filter(l=>typeof l.name==='string'&&Array.isArray(l.keys))}catch{}
const BRAND_HUE={"小米":24,"redmi":38,"华为":2,"osta":12,"星芒":12,"osta星芒":12,"星芒osta":12,"荣耀":344,"oppo":138,"一加":168,"vivo":214,"iqoo":234,"苹果":276};
// [色相偏移, 饱和度, 亮度]：相邻序号的亮度和色相尽量拉开
const SHADE=[[0,80,48],[-12,70,34],[12,78,62],[6,90,40],[-8,60,56],[14,65,30],[-14,85,66],[-4,55,44],[10,70,52],[-10,80,38]];
function hsl2hex(h,s,l){h=((h%360)+360)%360;s/=100;l/=100;const a=s*Math.min(l,1-l);
  const f=n=>{const k=(n+h/30)%12;return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1)))).toString(16).padStart(2,"0")};
  return "#"+f(0)+f(8)+f(4)}
function assignColors(rows){const n=new Map();let other=0;
  rows.forEach(r=>{const h=BRAND_HUE[r.brand]??BRAND_HUE[r.brand.toLowerCase()];
    if(h==null){r.cl=r.cd=PAL[other++%PAL.length];return}
    const k=n.get(r.brand)||0;n.set(r.brand,k+1);const [dh,sa,li]=SHADE[k%SHADE.length];
    r.cl=hsl2hex(h+dh,sa,li);r.cd=hsl2hex(h+dh,sa,Math.min(74,li+14))})} // 深色背景下整体提亮
const PAL=["#2f6fde","#e0592a","#1c9a6c","#b4489f","#d29a00","#0f9bb0","#7a5ae0","#c23b4e","#5d8a1f","#8a6a4a","#3b4fa0","#d06d9c"];


const styles=new Map();
let focused=null;
function themeColor(variable){return getComputedStyle(document.documentElement).getPropertyValue(variable).trim()}
window.addEventListener('site-theme-change',()=>{if(sourceText)draw()});

const weekMs=7*IsoSalesWeek.DAY;
function seriesRows(key){
  const date=metadata[key][3].split(/[/.\-]/).map(Number);
  const first=IsoSalesWeek.firstFullWeekMonday(date);
  const raw=new Map(records.filter(r=>r[0]===key).map(r=>[r[1]+r[2],{value:r[3],op:r[4]}]));
  const rows=periods.map((period,i)=>{
    const cumulative=raw.get(period+'cumulative'),previous=raw.get(periods[i-1]+'cumulative'),direct=raw.get(period+'weekly');
    const diff=cumulative?.op==='='&&previous?.op==='='?{value:cumulative.value-previous.value,op:'='}:null;
    const t=monday(period);
    return {period,cumulative,direct,weekly:diff||direct,life:IsoSalesWeek.lifecycleWeekIndex(t,first)};
  });
  if(byId('gap').dataset.value==='raw')return rows;
  let left=-1;
  for(let i=0;i<rows.length;i++){
    const right=rows[i].cumulative;
    if(!right)continue;
    const start=left;left=i;
    if(start<0||!['=','>='].includes(right.op))continue;
    const anchor=rows[start].cumulative;
    if(!['=','>='].includes(anchor.op)||right.value<anchor.value)continue;
    const lower=anchor.op==='>='||right.op==='>=';
    if(i-start===1&&!lower)continue;
    // A direct weekly record constrains the interval; leave the other weeks unestimated.
    if(rows.slice(start+1,i+1).some(r=>r.direct))continue;
    const slope=byId('gap').dataset.value==='fit'?trendSlope(rows,start):0;
    const count=i-start,total=right.value-anchor.value;
    const shift=Math.max(0,(count-1)*slope);
    const weights=Array.from({length:count},(_,j)=>Math.exp(j*slope-shift));
    const sum=weights.reduce((a,b)=>a+b,0);
    let cumulative=anchor.value;
    for(let j=0;j<count;j++){
      const row=rows[start+j+1],delta=total*weights[j]/sum;
      cumulative+=delta;
      row.weekly={value:delta,op:'≈',estimated:true,lowerBound:lower};
      if(j<count-1)row.cumulative={value:cumulative,op:'≈',estimated:true,lowerBound:lower};
    }
  }
  return rows;
}
function trendSlope(rows,left){
  const increments=[];
  for(let i=left;i>0&&increments.length<Number(byId('window').value);i--){
    const a=rows[i-1].cumulative,b=rows[i].cumulative;
    if(a?.op!=='='||b?.op!=='='||a.value>b.value)break;
    increments.unshift(b.value-a.value);
  }
  if(increments.filter(v=>v>0).length<3)return 0;
  const logs=increments.map(v=>Math.log(Math.max(.01,v)));
  const mean=logs.reduce((a,b)=>a+b)/logs.length,mid=(logs.length-1)/2;
  let xx=0,xy=0,yy=0;
  logs.forEach((v,i)=>{xx+=(i-mid)**2;xy+=(i-mid)*(v-mean);yy+=(v-mean)**2});
  if(!yy||xy*xy/(xx*yy)<.2)return 0;
  return Math.max(-Math.log(1.25),Math.min(Math.log(1.25),xy/xx));
}
function nameOf(key){return metadata[key].slice(0,2).join(' ')}
let milestoneStep=50;
function milestoneLists(){
  const latest=new Map(),history=new Map();
  for(const [key,week,kind,value,op] of records){
    const brand=metadata[key][0];
    if(!latest.has(brand)||latest.get(brand)<week)latest.set(brand,week);
    if(kind!=='cumulative'||!['=','>='].includes(op))continue;
    if(!history.has(key))history.set(key,[]);
    history.get(key).push({week,value,op});
  }
  const weekly=[],cross=[];
  for(const [key,items] of history){
    items.sort((a,b)=>a.week.localeCompare(b.week));
    const end=items.at(-1),prev=items.at(-2);
    if(end.week!==latest.get(metadata[key][0])||(!prev&&end.op==='='))continue;
    const peak=items.slice(0,-1).reduce((p,r)=>Math.max(p,r.value),0);
    if(Math.floor(end.value/milestoneStep)<=Math.floor(peak/milestoneStep))continue;
    const adjacent=prev?.op==='='&&monday(end.week)-monday(prev.week)===weekMs;
    (adjacent?weekly:cross).push(key);
  }
  return [weekly,cross];
}
function recentModelKeys(){
  const end=records.reduce((max,r)=>Math.max(max,monday(r[1])),-Infinity);
  const active=new Set(records.map(r=>r[0]));
  return Object.keys(metadata).filter(key=>{
    const t=IsoSalesWeek.isoMonday(metadata[key][3].split(/[/.\-]/).map(Number));
    return active.has(key)&&t!=null&&t<=end&&t>=end-11*weekMs;
  });
}
function presets(){
  const [weekly,cross]=milestoneLists();
  return [{name:'近12周新机',keys:recentModelKeys()},{name:'本周里程碑',keys:weekly},{name:'跨期里程碑',keys:cross},...savedLists];
}
function choiceKeys(){
  if(activeList===recentListIndex)return recentChoices;
  const brand=byId('brand').dataset.value;
  return Object.keys(metadata).filter(key=>!brand||metadata[key][0]===brand);
}
function choices(){
  const box=byId('choices');box.replaceChildren();
  const keys=choiceKeys();
  if(!keys.length&&activeList===recentListIndex)box.textContent='近12周暂无符合条件的新机';
  for(const key of keys){
    const label=document.createElement('label'),input=document.createElement('input');
    input.type='checkbox';input.checked=selected.has(key);
    input.onchange=()=>{if(input.checked)selected.add(key);else selected.delete(key);draw();drawEditor()};
    label.append(input,nameOf(key));box.append(label);
  }
}
function applyKeys(keys){
  if(activeEdit)return;
  if(keys.some(k=>metadata[k]&&byId('brand').dataset.value&&metadata[k][0]!==byId('brand').dataset.value)){
    selectFilter('brand','');
  }
  selected.clear();keys.filter(key=>metadata[key]).forEach(key=>selected.add(key));
  drawEditor();
  choices();draw();
}
const recentListIndex=0;
const presetCount=3;
let activeList=-1;
let recentChoices=[];
function selectList(index){
  activeList=index;
  for(const button of byId('lists').children){
    button.setAttribute('aria-pressed',String(Number(button.dataset.index)===index));
  }
  byId('deleteList').disabled=index<presetCount;
}
function renderLists(){
  const lists=byId('lists');
  const entries=presets();
  while(lists.children.length>entries.length)lists.lastElementChild.remove();
  entries.forEach((list,index)=>{
    const keys=list.keys.filter(key=>metadata[key]);
    const button=lists.children[index]??document.createElement('button');
    button.type='button';
    button.dataset.index=index;
    button.textContent=list.name+'（'+keys.length+'）';
    button.disabled=keys.length===0&&index<presetCount&&index!==recentListIndex;
    button.onclick=()=>{
      if(activeEdit)return;
      if(activeList===index){
        selectList(-1);
        choices();
        return;
      }
      if(index===recentListIndex){
        selectFilter('brand','');
        syncBrand();
        return;
      }
      selectList(index);
      if(keys.length)applyKeys(keys);
      else choices();
    };
    if(!button.parentNode)lists.append(button);
  });
  selectList(activeList);
}
function syncBrand(){
  if(byId('brand').dataset.value){
    selectList(-1);
  }else{
    recentChoices=recentModelKeys();
    selectList(recentListIndex);
  }
  applyKeys(choiceKeys());
}

byId('all').onclick=()=>{
  for(const key of choiceKeys())selected.add(key);
  choices();draw();drawEditor();
};
byId('brandTops').onclick=()=>{
  const best=new Map();
  for(const key of Object.keys(metadata)){
    const row=seriesRows(key).reverse().find(r=>r.weekly?.op==='=');
    if(!row)continue;
    const brand=metadata[key][0],prior=best.get(brand);
    if(!prior||row.period>prior.row.period||(row.period===prior.row.period&&row.weekly.value>prior.row.weekly.value))best.set(brand,{key,row});
  }
  selectList(-1);
  applyKeys([...best.values()].map(item=>item.key));
};
byId('none').onclick=()=>{if(activeList!==recentListIndex)selectList(-1);applyKeys([])};
byId('milestoneStep').onchange=event=>{
  const input=event.target,value=input.valueAsNumber;
  if(!Number.isSafeInteger(value)||value<1){
    alert('请输入大于 0 的整数，单位为万台。');
    input.value=milestoneStep;
    return;
  }
  milestoneStep=value;
  renderLists();
};
function saveLists(){try{localStorage.setItem('increments.lists',JSON.stringify(savedLists))}catch{}renderLists()}
byId('saveList').onclick=()=>{
  const name=byId('listName').value.trim();if(!name||!selected.size)return alert('请填写列表名称并选择机型');
  const index=savedLists.findIndex(l=>l.name===name);
  if(index>=0&&!confirm('更新同名列表？'))return;
  const list={name,keys:[...selected]};
  if(index>=0)savedLists[index]=list;else savedLists.push(list);
  activeList=presetCount+(index>=0?index:savedLists.length-1);
  saveLists();
  choices();
};
byId('deleteList').onclick=()=>{
  if(activeList<presetCount||!confirm('删除这个自建列表？'))return;
  savedLists.splice(activeList-presetCount,1);
  activeList=-1;
  saveLists();
};

const svgNS='http://www.w3.org/2000/svg';
function svgNode(parent,tag,attrs={},content){
  const node=document.createElementNS(svgNS,tag);
  for(const [attr,value] of Object.entries(attrs))node.setAttribute(attr,value);
  if(content!=null)node.textContent=content;
  parent.append(node);return node;
}
let current;
let labelPreferenceChanged=false;
function draw({resetRange=false}={}){
  if(!periods.length)return;
  byId('editStatus').textContent=hasDraft()?'含临时数据，可导出长表保存。':'';
  const life=byId('axis').dataset.value==='life';
  const dark=document.documentElement.dataset.theme==='dark';
  const sets=[...selected].map(key=>({key,color:styles.get(key)[dark?'cd':'cl'],rows:seriesRows(key)}));
  if(!selected.has(focused))focused=null;
  const lifeWeeks=sets.flatMap(s=>s.rows.filter(r=>r.life!=null&&(r.cumulative||r.weekly)).map(r=>r.life));
  let axis=periods;
  if(life){
    const start=Math.min(...lifeWeeks),end=Math.max(...lifeWeeks);
    axis=lifeWeeks.length?Array.from({length:end-start+1},(_,i)=>start+i):[];
  }
  const rangeLabel=(v,separator=' ')=>life?'第'+v+'周':isoWeekLabel(v,separator);
  for(const id of ['from','to']){
    const input=byId(id),old=input.value,atEnd=id==='to'&&input.selectedIndex===input.length-1;
    input.replaceChildren(...axis.map(v=>new Option(rangeLabel(v),v)));
    if(!atEnd&&axis.some(t=>String(t)===old))input.value=old;
    else input.selectedIndex=id==='to'?axis.length-1:0;
  }
  const metric=byId('metric').dataset.value,log=byId('log').checked;
  for(const set of sets){
    set.lookup=new Map(set.rows.map(r=>[life?r.life:r.period,r[metric]]));
  }
  const hasVisiblePoint=week=>sets.some(set=>{
    const point=set.lookup.get(week);
    return point!=null&&(!log||point.value>0);
  });
  const dataStart=axis.findIndex(hasVisiblePoint);
  const dataEnd=axis.findLastIndex(hasVisiblePoint);
  const useDataRange=resetRange&&dataStart>=0;
  const from=useDataRange?dataStart:byId('from').selectedIndex;
  const to=useDataRange?dataEnd:Math.max(from,byId('to').selectedIndex);
  byId('from').selectedIndex=from;
  byId('to').selectedIndex=to;
  const ticks=axis.slice(from,to+1);
  for(const set of sets)set.points=ticks.map(t=>set.lookup.get(t));
  current={sets,ticks,rangeLabel,axis};
  byId('fullRange').disabled=dataStart<0;
  byId('hoverReadout').textContent='';
  const matrix=byId('matrix');matrix.replaceChildren();
  matrix.createCaption().textContent='多机对比 · '+filterLabel('metric')+'（万台）';
  const columns=[...ticks].reverse();
  const header=matrix.createTHead().insertRow();
  for(const name of ['机型',...columns.map(v=>rangeLabel(v))]){
    const th=document.createElement('th');th.textContent=name;header.append(th);
  }
  const matrixBody=matrix.createTBody();
  for(const s of sets){
    const row=matrixBody.insertRow(),name=row.insertCell();name.textContent=nameOf(s.key);name.style.color=s.color;
    for(const t of columns)row.insertCell().textContent=display(s.lookup.get(t));
  }
  const title=filterLabel('metric')+' · '+filterLabel('axis');
  byId('heading').textContent=title;
  const svg=document.getElementById('incrementChart');
  const w=Math.max(300,Math.round(svg.getBoundingClientRect().width)||800);
  if(!labelPreferenceChanged)byId('labels').checked=w>600;
  plot(svg,current,w,Math.max(260,Math.min(420,w*.42)),{mobile:w<=600,interactive:true});
  const legend=byId('legend');legend.replaceChildren();
  const ranked=[...sets].sort((a,b)=>lastVisible(b)-lastVisible(a));
  for(const s of ranked){
    const mark=document.createElement('i');mark.style.background=s.color;
    const el=document.createElement('button');el.type='button';el.setAttribute('aria-pressed',String(focused===s.key));
    el.append(mark,(w<=600&&Number.isFinite(lastVisible(s))?(ranked.indexOf(s)+1)+'. ':'')+legendText(s));el.onclick=()=>{focused=focused===s.key?null:s.key;draw()};legend.append(el);
  }
  byId('windowLabel').hidden=byId('gap').dataset.value!=='fit';
}
function lastVisible(s){return s.points.filter(p=>p&&(!byId('log').checked||p.value>0)).at(-1)?.value??-Infinity}
function legendValue(s){
  const point=s.points.filter(p=>p&&(!byId('log').checked||p.value>0)).at(-1);
  return display(point,SalesChartLayout.formatSales);
}
function legendText(s){return nameOf(s.key)+'  '+legendValue(s)}
const bodyFont='"Noto Sans SC", system-ui, sans-serif';
const numberFont='"IBM Plex Mono", ui-monospace, monospace';
function fitText(context,text,width){
  if(context.measureText(text).width<=width)return text;
  const chars=Array.from(text);
  while(chars.length&&context.measureText(chars.join('')+'…').width>width)chars.pop();
  return chars.length?chars.join('')+'…':'';
}
function segHitsBox(x1,y1,x2,y2,r){ // Liang–Barsky
  let t0=0,t1=1;const dx=x2-x1,dy=y2-y1;
  for(const [p,q] of [[-dx,x1-r.x0],[dx,r.x1-x1],[-dy,y1-r.y0],[dy,r.y1-y1]]){
    if(p===0){if(q<0)return false}else{const t=q/p;if(p<0){if(t>t1)return false;if(t>t0)t0=t}else{if(t<t0)return false;if(t<t1)t1=t}}}
  return true}
function boxesOverlap(a,b){
  return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
}
function plot(svg,{sets,ticks,rangeLabel},width,height,{mobile=false,interactive=false}={}){
  const paper=themeColor('--paper'),ink=themeColor('--ink'),grid=themeColor('--grid');
  const ranked=sets.filter(s=>Number.isFinite(lastVisible(s))).sort((a,b)=>lastVisible(b)-lastVisible(a));
  const labels=[],pointLabels=[],occupied=[],segments=[],markers=[];
  const showPointLabels=byId('labels').checked;
  const lineWidth=2,markerGap=1;
  const dotRadius=lineWidth*.8,ringRadius=lineWidth*.65,ringStroke=1,arrowSize=9;
  const markerArrow=point=>point.op==='>='?'↑':point.op==='<'?'↓':'';
  function markerClearance(point){
    const radius=markerArrow(point)?arrowSize/2:point.op==='='?dotRadius:ringRadius+ringStroke/2;
    return radius+markerGap;
  }
  const fontSize=12;
  const measure=document.createElement('canvas').getContext('2d');
  measure.font=fontSize+'px '+numberFont;
  svg.replaceChildren();delete svg.dataset.plot;svg.setAttribute('viewBox','0 0 '+width+' '+height);
  svg.setAttribute('font-family',bodyFont);svg.setAttribute('font-size',fontSize);svg.setAttribute('fill',ink);
  const log=byId('log').checked,visible=p=>p!=null&&(!log||p.value>0);
  const nums=sets.flatMap(s=>s.points.filter(visible).map(p=>p.value));
  if(!nums.length){svgNode(svg,'text',{x:width/2,y:height/2,'text-anchor':'middle'},sets.length?'当前范围没有可显示的数据':'请选择对比机型');return}
  const axis=log?SalesChartLayout.logAxis(nums):SalesChartLayout.integerAxis(
    nums.reduce((a,b)=>Math.min(a,b),0),nums.reduce((a,b)=>Math.max(a,b),0)
  );
  const tickText=log?String:SalesChartLayout.formatSales;
  const left=log?Math.max(52,...axis.ticks.map(v=>Math.ceil(measure.measureText(tickText(v)).width)+8)):52;
  const right=width-(mobile?36:Math.min(170,width*.22)),top=26,bottom=height-43;
  const x=i=>ticks.length===1?(left+right)/2:left+i*(right-left)/(ticks.length-1);
  const ratio=axis.ratio??(v=>(v-axis.low)/(axis.high-axis.low));
  const y=v=>bottom-ratio(v)*(bottom-top);
  for(const tick of axis.ticks){
    const pos=y(tick);
    svgNode(svg,'line',{x1:left,x2:right,y1:pos,y2:pos,stroke:grid});
    svgNode(svg,'text',{x:left-5,y:pos+4,'text-anchor':'end','font-family':numberFont},tickText(tick));
  }
  const step=Math.max(1,Math.ceil(ticks.length/Math.max(2,Math.floor((right-left)/85))));
  ticks.forEach((t,i)=>{
    if(i%step!==0&&(i!==ticks.length-1||i%step<=step/2))return;
    const lines=rangeLabel(t,'\n').split('\n');
    const label=svgNode(svg,'text',{x:x(i),y:bottom+15,'text-anchor':'middle'});
    lines.forEach((line,index)=>svgNode(label,'tspan',{x:x(i),dy:index===0?0:13},line));
  });
  for(const s of sets){
    const group=svgNode(svg,'g',{opacity:interactive&&focused&&focused!==s.key?0.18:1});
    const end=s.points.findLastIndex(visible);
    if(end>=0){
      const rank=ranked.indexOf(s),text=mobile?(rank<0?'':String(rank+1)):nameOf(s.key);
      if(text)labels.push({text,color:s.color,key:s.key,x:x(end),y:y(s.points[end].value)});
    }
    s.points.forEach((point,i)=>{
      if(!visible(point))return;
      const prev=s.points[i-1],cx=x(i),cy=y(point.value);
      const arrow=markerArrow(point);
      const clearance=markerClearance(point)-markerGap;
      markers.push({left:cx-clearance,right:cx+clearance,top:cy-clearance,bottom:cy+clearance});
      const estimated=point.estimated||prev?.estimated;
      if(visible(prev)&&(estimated||(point.op==='='&&prev.op==='='))){
        const px=x(i-1),py=y(prev.value),dx=cx-px,dy=cy-py;
        const length=Math.hypot(dx,dy);
        const startGap=markerClearance(prev),endGap=markerClearance(point);
        if(length>startGap+endGap){
          const segment={
            x1:px+dx*startGap/length,y1:py+dy*startGap/length,
            x2:cx-dx*endGap/length,y2:cy-dy*endGap/length
          };
          segments.push(segment);
          svgNode(group,'line',{...segment,stroke:s.color,'stroke-width':lineWidth,'stroke-dasharray':estimated?'5 3':'none'});
        }
      }
      const exact=point.op==='=';
      const node=arrow
        ? svgNode(group,'text',{x:cx,y:cy,fill:s.color,'font-size':arrowSize,'text-anchor':'middle','dominant-baseline':'central'},arrow)
        : svgNode(group,'circle',{
            cx,cy,r:exact?dotRadius:ringRadius,fill:exact?s.color:paper,
            stroke:s.color,'stroke-width':exact?0:ringStroke
          });
      svgNode(node,'title',{},nameOf(s.key)+' · '+rangeLabel(ticks[i])+' · '+display(point,SalesChartLayout.formatSales)+' 万台');
      if(showPointLabels)pointLabels.push({group,key:s.key,x:cx,y:cy-12,text:display(point,SalesChartLayout.formatSales)});
    });
  }
  function textBounds(text,x,y,align){
    measure.textAlign=align;
    const size=measure.measureText(text);
    return {
      left:x-(size.actualBoundingBoxLeft??(align==='center'?size.width/2:0))-2,
      right:x+(size.actualBoundingBoxRight??(align==='center'?size.width/2:size.width))+2,
      top:y-(size.actualBoundingBoxAscent??fontSize)-1,
      bottom:y+(size.actualBoundingBoxDescent??2)+1
    };
  }
  const labelFont=mobile?numberFont:bodyFont;
  measure.font=fontSize+'px '+labelFont;
  measure.textAlign='left';
  const placed=[];
  const labelHeight=fontSize+4,offset=mobile?6:8;
  labels.sort((a,b)=>Number(interactive&&b.key===focused)-Number(interactive&&a.key===focused)||b.x-a.x||a.y-b.y);
  for(const label of labels){
    const text=mobile?label.text:fitText(measure,label.text,width-right-offset-8);
    const labelWidth=Math.ceil(measure.measureText(text).width)+8;
    const rightX=label.x+offset,leftX=label.x-offset-labelWidth;
    let best;
    function consider(x,y,preference){
      const box={left:x,right:x+labelWidth,top:y-labelHeight/2,bottom:y+labelHeight/2};
      if(box.left<left||box.right>width-2||box.top<top-6||box.bottom>bottom+6)return;
      if(placed.some(item=>boxesOverlap(box,item.box)))return;
      const lineBox={x0:box.left,x1:box.right,y0:box.top,y1:box.bottom};
      let score=preference+Math.abs(y-label.y)/labelHeight+Math.abs(x-rightX)/100;
      if(markers.some(marker=>boxesOverlap(box,marker)))score+=30;
      if(segments.some(({x1,y1,x2,y2})=>segHitsBox(x1,y1,x2,y2,lineBox)))score+=40;
      if(!best||score<best.score)best={x,y,box,score};
    }
    // Start next to the endpoint, then try vertically offset slots and nearby alternatives.
    for(const [x,preference] of [[rightX,0],[leftX,8],[label.x-labelWidth/2,12]]){
      for(const dy of [0,-1,1,-2,2])consider(x,label.y+dy*labelHeight,preference);
    }
    if(!best||best.score>=20){
      const gutterX=Math.min(right+offset,width-labelWidth-2);
      for(let y=top+labelHeight/2;y<=bottom+3;y+=labelHeight+1){
        consider(rightX,y,5);
        consider(gutterX,y,18);
      }
    }
    if(best)placed.push({...best,label,text});
  }
  // Keep the tail labels and visible marks clear before placing numeric labels.
  measure.font=fontSize+'px '+numberFont;
  pointLabels.sort((a,b)=>Number(interactive&&b.key===focused)-Number(interactive&&a.key===focused)||b.x-a.x||a.y-b.y);
  for(const {group,x,y,text} of pointLabels){
    const box=textBounds(text,x,y,'center');
    if(box.left<left||box.right>width-2||box.top<2||box.bottom>bottom)continue;
    if(occupied.some(other=>boxesOverlap(box,other))||markers.some(marker=>boxesOverlap(box,marker))||
      placed.some(tail=>boxesOverlap(box,tail.box)))continue;
    const lineBox={x0:box.left-1,x1:box.right+1,y0:box.top-1,y1:box.bottom+1};
    if(segments.some(({x1,y1,x2,y2})=>segHitsBox(x1,y1,x2,y2,lineBox)))continue;
    svgNode(group,'text',{
      x,y,'text-anchor':'middle','font-family':numberFont,fill:ink,
      stroke:paper,'stroke-width':2,'stroke-linejoin':'round','paint-order':'stroke'
    },text);
    occupied.push(box);
  }
  // Put guides beneath label backgrounds so they cannot obscure text.
  for(const {label,x,y,box} of placed){
    if(Math.abs(y-label.y)<3&&Math.abs(x-(label.x+offset))<3)continue;
    const targetX=Math.max(box.left,Math.min(box.right,label.x));
    const dx=targetX-label.x,dy=y-label.y,distance=Math.hypot(dx,dy);
    if(distance<=5)continue;
    const startX=label.x+dx*5/distance,startY=label.y+dy*5/distance;
    const opacity=interactive&&focused&&focused!==label.key?0.15:.65;
    svgNode(svg,'line',{x1:startX,y1:startY,x2:targetX,y2:y,stroke:label.color,'stroke-width':.7,opacity});
  }
  for(const {label,text,x,y,box} of placed){
    const group=svgNode(svg,'g',{opacity:interactive&&focused&&focused!==label.key?0.2:1});
    svgNode(group,'rect',{x,y:box.top,width:box.right-box.left,height:labelHeight,rx:3,fill:paper,opacity:.9});
    svgNode(group,'text',{x:x+4,y:y+4,fill:label.color,'font-family':labelFont},text);
  }
  if(interactive)svg.dataset.plot=JSON.stringify({left,right,width});
}

function changeRange(lo,hi){
  if(activeEdit||!current?.axis.length)return;
  const end=current.axis.length-1;
  byId('from').selectedIndex=Math.max(0,Math.min(lo,end));
  byId('to').selectedIndex=Math.max(byId('from').selectedIndex,Math.min(hi,end));
  draw();
}
byId('fullRange').onclick=()=>draw({resetRange:true});
const screenChart=document.getElementById('incrementChart');
// Keep page scrolling while preventing zoom gestures over the chart.
screenChart.addEventListener('wheel',event=>{
  if(event.ctrlKey||event.metaKey)event.preventDefault();
},{passive:false});
screenChart.addEventListener('touchmove',event=>{
  if(event.touches.length>1&&event.cancelable)event.preventDefault();
},{passive:false});
for(const type of ['gesturestart','gesturechange']){
  screenChart.addEventListener(type,event=>event.preventDefault(),{passive:false});
}
let drag=null;
function plotLocation(event){
  if(!screenChart.dataset.plot||!current?.ticks.length)return null;
  const {left,right,width}=JSON.parse(screenChart.dataset.plot);
  const rect=screenChart.getBoundingClientRect();
  const x=(event.clientX-rect.left)*width/rect.width;
  return {x,left,right};
}
screenChart.onpointerdown=e=>{
  const loc=plotLocation(e);
  if(activeEdit||!loc||e.pointerType!=='mouse'||e.button!==0||loc.x<loc.left||loc.x>loc.right)return;
  drag={x:loc.x,lo:byId('from').selectedIndex,hi:byId('to').selectedIndex};
  screenChart.setPointerCapture(e.pointerId);
};
screenChart.onpointermove=e=>{
  const loc=plotLocation(e);if(!loc||activeEdit)return;
  const {x,left,right}=loc,n=current.ticks.length;
  if(drag){
    const span=drag.hi-drag.lo;
    const lo=Math.max(0,Math.min(current.axis.length-1-span,drag.lo+Math.round((drag.x-x)*Math.max(1,span)/(right-left))));
    if(lo!==byId('from').selectedIndex)changeRange(lo,lo+span);
    return;
  }
  if(x<left||x>right){byId('hoverReadout').textContent='';return}
  const idx=Math.round((x-left)/(right-left)*Math.max(0,n-1));
  byId('hoverReadout').textContent=[current.rangeLabel(current.ticks[idx]),...current.sets.map(s=>nameOf(s.key)+' '+display(s.points[idx],SalesChartLayout.formatSales))].join(' · ');
};
screenChart.onpointerup=screenChart.onpointercancel=screenChart.onlostpointercapture=()=>{drag=null};
screenChart.onpointerleave=()=>{byId('hoverReadout').textContent=''};
let chartWidth=0;
new ResizeObserver(entries=>{
  const width=entries[0].contentRect.width;
  if(width>0&&Math.abs(width-chartWidth)>1){chartWidth=width;if(current&&!activeEdit)draw()}
}).observe(screenChart);
// Draw exported text with the loaded page fonts. SVG loaded as an image cannot use the page's font stylesheet.
function takeChartText(svg){
  return Array.from(svg.querySelectorAll('text'),node=>{
    const x=Number(node.getAttribute('x'));
    let y=Number(node.getAttribute('y'));
    const spans=Array.from(node.querySelectorAll('tspan'));
    const lines=spans.length?spans.map(span=>{
      y+=Number(span.getAttribute('dy'));
      return {text:span.textContent,x:Number(span.getAttribute('x')??x),y};
    }):[{text:Array.from(node.childNodes).filter(child=>child.nodeType===Node.TEXT_NODE).map(child=>child.textContent).join(''),x,y}];
    const font=(node.getAttribute('font-size')||svg.getAttribute('font-size'))+'px '+(node.getAttribute('font-family')||svg.getAttribute('font-family'));
    const fill=node.getAttribute('fill')||svg.getAttribute('fill');
    const stroke=node.getAttribute('stroke'),strokeWidth=Number(node.getAttribute('stroke-width'));
    const align={middle:'center',end:'right'}[node.getAttribute('text-anchor')]||'left';
    const baseline=node.hasAttribute('dominant-baseline')?'middle':'alphabetic';
    node.remove();
    return {lines,font,fill,align,baseline,stroke,strokeWidth};
  });
}
let exportChartLibrary;
function loadExportChartLibrary(){
  exportChartLibrary??=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src='https://cdnjs.cloudflare.com/ajax/libs/echarts/5.4.3/echarts.min.js';
    script.onload=()=>resolve(window.echarts);
    script.onerror=()=>{
      script.remove();
      exportChartLibrary=null;
      reject(new Error('图表库加载失败'));
    };
    document.head.append(script);
  });
  return exportChartLibrary;
}

function mobileExportSeries(set,name,theme,style,showSymbol){
  const {points,color}=set;
  const observed=SalesChartLayout.observedLine({
    name,data:points.map(point=>point?.op==='='?point.value:null),color,panel:theme.pn,style,showSymbol
  });
  // Follow visible category labels for both line types, independent of marker diameter.
  observed.showAllSymbol=false;
  const hollowStroke=1;
  // Match the visible diameter after the solid point's background outline and the hollow point's colored outline.
  const hollowSize=observed.symbolSize-observed.itemStyle.borderWidth-hollowStroke;
  const hollowStyle={color:theme.pn,borderColor:color,borderWidth:hollowStroke};
  const estimatedEdge=(left,right)=>left&&right&&(left.estimated||right.estimated);
  const series=[observed];
  // Keep estimated runs separate so unrelated or observed intervals aren't drawn twice.
  let start=-1;
  for(let i=1;i<=points.length;i++){
    if(estimatedEdge(points[i-1],points[i])){
      if(start<0)start=i-1;
      continue;
    }
    if(start<0)continue;
    // Inherit the solid line's category-label sampling for every estimated run.
    series.push({
      ...observed,silent:true,symbolSize:hollowSize,itemStyle:hollowStyle,
      data:points.map((point,j)=>{
        if(j<start||j>=i)return null;
        return point.op==='≈'?point.value:{value:point.value,symbol:'none'};
      }),
      lineStyle:{...observed.lineStyle,type:'dashed'}
    });
    start=-1;
  }

  const markers=points.flatMap((point,i)=>{
    if(!point)return [];
    const value=[i,point.value];
    if(point.op==='='){
      // A lone observation has no solid line segment to keep it visible between ticks.
      if(points[i-1]?.op==='='||points[i+1]?.op==='=')return [];
      return {value,symbolSize:style.sym,itemStyle:observed.itemStyle};
    }
    if(point.op==='≈'){
      if(estimatedEdge(points[i-1],point)||estimatedEdge(point,points[i+1]))return [];
      return {value,symbolSize:hollowSize,itemStyle:hollowStyle};
    }
    return {
      value,symbolSize:9,itemStyle:{color:'transparent'},
      label:{show:true,position:'inside',formatter:point.op==='>='?'↑':'↓',color,fontFamily:bodyFont,fontSize:9}
    };
  });
  if(markers.length)series.push({name,type:'scatter',silent:true,symbol:'circle',data:markers});
  return series;
}

function exportMobileChart(echarts,chart,log,footerText,filename){
  const size=SalesChartLayout.exportSize(true);
  const {W,H}=size;
  const theme={
    pn:themeColor('--paper'),fg:themeColor('--ink'),mu:themeColor('--sub'),ln:themeColor('--grid'),
    axisText:themeColor('--ink'),subtitle:themeColor('--ink')
  };
  const sel=chart.sets
    .map(set=>{
      const [brand,model]=metadata[set.key];
      return {brand,model,color:set.color,points:set.points.map(p=>p&&(!log||p.value>0)?p:null)};
    })
    .filter(set=>set.points.some(Boolean));
  const multiBrand=new Set(sel.map(set=>set.brand)).size>1;
  const label=set=>multiBrand||SalesChartLayout.needsBrand(set.model)?set.brand+' '+set.model:set.model;
  const layout=SalesChartLayout.create({
    font:()=>bodyFont,mono:numberFont,theme:()=>theme,colorOf:set=>set.color,label,
    flagPrefix:point=>point?.op==='='||!point?'':point.op==='>='?'≥':point.op
  });
  const footer=layout.exportFooter(W,footerText);
  const cats=chart.ticks.map(tick=>chart.rangeLabel(tick,'\n'));
  const o={
    exp:true,mobile:true,W,H,footerHeight:footer.height,lo:0,hi:cats.length-1,
    estFlags:sel.map(set=>set.points),preserveSeriesColors:true
  };
  const datas=sel.map(set=>set.points.map(point=>point?.value??null));
  layout.mobileRank(sel,datas,o);
  const style=layout.spec(o);
  // Keep one base series per model at the front for label coordinate conversion.
  const layers=sel.map(set=>mobileExportSeries(set,label(set),theme,style,sel.length<=12));
  const series=layers.map(layer=>layer[0]).concat(layers.flatMap(layer=>layer.slice(1)));
  const metric=byId('metric').dataset.value==='cumulative'?'累计销量（万台）':'周环比增量（万台）';
  const points=sel.flatMap(set=>set.points);
  const notes=[
    points.some(point=>point?.lowerBound)?'≈含里程碑估算':points.some(point=>point?.estimated)?'虚线/≈为估算':'',
    points.some(point=>point?.op==='≈'&&!point.estimated)?'≈含录入约数':'',
    points.some(point=>point?.op==='>=')?'↑为下限':'',
    points.some(point=>point?.op==='<')?'↓为上限':''
  ];
  const values=datas.flat().filter(Number.isFinite);
  if(log)o.logAxis=SalesChartLayout.logAxis(values);
  const opt=layout.chartOption(cats,series,o,log,metric);
  if(!log){
    const axis=SalesChartLayout.integerAxis(Math.min(0,...values),Math.max(0,...values));
    Object.assign(opt.yAxis,{min:axis.low,max:axis.high,interval:axis.step});
  }
  layout.setExportTitle(opt,cats,sel,o,log,metric,notes);
  const url=SalesChartLayout.renderPNG(echarts,size,footer.height,theme.pn,inst=>{
    inst.setOption(opt);
    layout.placeLabels(inst,{sel,datas,o,base:[...layout.mobileList(o),...footer.graphic]},o.lo,o.hi);
  });
  const link=document.createElement('a');link.download=filename;link.href=url;link.click();
}

async function exportChart(mobile){
  if(!current?.sets.some(s=>Number.isFinite(lastVisible(s))))return alert('当前范围没有可导出的销量');
  const fonts=Promise.allSettled([
    document.fonts.load('400 12px "Noto Sans SC"',current.sets.map(s=>nameOf(s.key)).join('')+'销量增量追踪新机↑↓'),
    document.fonts.load('700 18px "Noto Sans SC"','销量增量追踪新机0123456789'),
    document.fonts.load('400 12px "IBM Plex Mono"','0123456789.≥<≈'),
    document.fonts.ready
  ]);
  const [library]=await Promise.all([mobile?loadExportChartLibrary():null,fonts]);
  if(activeEdit)return alert('请先保存或取消当前编辑');
  const log=byId('log').checked;
  if(!current?.sets.some(s=>Number.isFinite(lastVisible(s))))return alert('当前范围没有可导出的销量');
  const list=activeList>=0?presets()[activeList]:null;
  const filename=SalesChartLayout.exportFilename({
    weekly:byId('metric').dataset.value==='weekly',subject:list?.name||byId('brand').dataset.value||'全部',
    salesWeek:byId('axis').dataset.value==='life',mobile
  });
  const footer=byId('footer').value.trim();
  //const draftNote=hasDraft()?'含本标签页临时数据，仅供参考':'';
  if(mobile){
    //exportMobileChart(library,current,log,[footer,draftNote].filter(Boolean).join('\n'),filename);
    exportMobileChart(library,current,log,footer || '',filename);
    return;
  }
  const width=1200,base=675,scale=2;
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d'),font='14px '+bodyFont;
  ctx.font=font;
  const lines=text=>{
    const result=[];
    for(const paragraph of text.split('\n')){
      let line='';
      for(const c of paragraph){if(line&&ctx.measureText(line+c).width>width-44){result.push(line);line=''}line+=c}
      result.push(line);
    }
    return result;
  };
  const notes=footer?lines(footer):[];
  //if(draftNote)notes.push(draftNote);
  const ranked=current.sets.filter(s=>Number.isFinite(lastVisible(s))).sort((a,b)=>lastVisible(b)-lastVisible(a));
  const height=base+notes.length*20;
  canvas.width=width*scale;canvas.height=height*scale;ctx.scale(scale,scale);
  ctx.fillStyle=themeColor('--paper');ctx.fillRect(0,0,width,height);
  ctx.fillStyle=themeColor('--ink');ctx.font='700 22px '+bodyFont;ctx.fillText('销量增量追踪',18,34);
  ctx.font=font;
  const sub=byId('heading').textContent+' · 万台 · '+current.rangeLabel(current.ticks[0])+' 至 '+current.rangeLabel(current.ticks.at(-1));
  ctx.fillText(sub,18,61,width-36);
  const chartH=height-92-20*notes.length;
  const svg=document.createElementNS(svgNS,'svg');plot(svg,{...current,sets:ranked},width,chartH);
  svg.setAttribute('width',width);svg.setAttribute('height',chartH);
  const chartText=takeChartText(svg);
  const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'}));
  try{
    const img=new Image();img.src=url;await img.decode();ctx.drawImage(img,0,67);
    for(const label of chartText){
      ctx.font=label.font;ctx.fillStyle=label.fill;ctx.textAlign=label.align;ctx.textBaseline=label.baseline;
      if(label.stroke){
        ctx.strokeStyle=label.stroke;ctx.lineWidth=label.strokeWidth;ctx.lineJoin='round';
      }
      for(const line of label.lines){
        if(label.stroke)ctx.strokeText(line.text,line.x,67+line.y);
        ctx.fillText(line.text,line.x,67+line.y);
      }
    }
    ctx.textBaseline='alphabetic';
    let y=chartH+86;
    ctx.textAlign='left';ctx.font=font;ctx.fillStyle=themeColor('--sub');for(const line of notes){ctx.fillText(line,18,y);y+=20}
    const link=document.createElement('a');link.download=filename;link.href=canvas.toDataURL();link.click();
  }finally{URL.revokeObjectURL(url)}
}
for(const id of ['window','from','to','log','labels'])byId(id).onchange=()=>{
  if(id==='labels')labelPreferenceChanged=true;
  if(id==='to'&&byId('to').selectedIndex<byId('from').selectedIndex)byId('from').selectedIndex=byId('to').selectedIndex;
  draw();
};
for(const [id,mobile] of [['desktopPNG',false],['mobilePNG',true]])byId(id).onclick=()=>exportChart(mobile).catch(()=>alert('图片导出失败'));
byId('defaultFooter').onclick=()=>{byId('footer').value=byId('footer').defaultValue;byId('footer').oninput()};
try{byId('footer').value=localStorage.getItem('increments.footer')??byId('footer').value}catch{}
byId('footer').oninput=()=>{try{localStorage.setItem('increments.footer',byId('footer').value)}catch{}};

byId('exportLists').onclick=()=>{
 const url=URL.createObjectURL(new Blob([JSON.stringify(savedLists,null,2)],{type:'application/json'}));
 const link=document.createElement('a');link.href=url;link.download='销量增量追踪-机型列表.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
byId('importLists').onchange=async event=>{
 const file=event.target.files[0];if(!file)return;
 try{
   const lists=JSON.parse(await file.text());
   if(!Array.isArray(lists))throw Error();
   const imported=lists.map(l=>{
     if(typeof l.name!=='string'||!(Array.isArray(l.keys)||Array.isArray(l.models)))throw Error();
     const keys=l.keys??l.models.map(s=>{const i=s.indexOf('|');if(i<1)throw Error();return JSON.stringify([s.slice(0,i),s.slice(i+1)])});
     if(!keys.every(k=>typeof k==='string'))throw Error();
     return {name:l.name,keys};
   });
   savedLists.push(...imported);saveLists();
 }catch{alert('无法导入机型列表')}finally{event.target.value=''}
};
let initial=[],initialPeriods=[];
const editGrid=byId('editGrid');
const editMetric=byId('editMetric');
const specialDialog=byId('specialEdit');
const specialValue=byId('specialValue');
const editHistory=[];
let activeEdit=null;

function recordLabel(record){
  return record?display({value:record[3],op:record[4]},String):'—';
}
function setEditRecord(slot,record){
  const index=records.findIndex(r=>r[0]===slot.key&&r[1]===slot.week&&r[2]===slot.kind);
  if(index>=0){
    if(record)records[index]=record.slice();
    else records.splice(index,1);
  }else if(record){
    records.splice(slot.index??records.length,0,record.slice());
  }
}
function saveEdit(slot,next){
  const {key,week,kind,record}=slot;
  if(record?.[3]===next?.[3]&&record?.[4]===next?.[4])return true;
  if(next&&kind==='cumulative'){
    const exact=records.filter(r=>r[0]===key&&r[2]===kind&&r[4]==='=').sort((a,b)=>a[1].localeCompare(b[1]));
    const before=exact.filter(r=>r[1]<week).at(-1),after=exact.find(r=>r[1]>week);
    const [, , ,value,op]=next;
    const tooLow=before&&(op==='='?value<before[3]:op==='<'&&value<=before[3]);
    const tooHigh=after&&['=','>='].includes(op)&&value>after[3];
    if((tooLow||tooHigh)&&!confirm('该累计值与前后精确累计记录倒挂，仍然保存？'))return false;
  }
  editHistory.push({key,week,kind,record,index:records.indexOf(record)});
  setEditRecord(slot,next);
  slot.record=next;
  persistDraft();
  renderLists();
  draw();
  drawEditCell(slot);
  byId('undoEdit').disabled=false;
  return true;
}
function openSpecialEdit(slot){
  activeEdit=slot;
  byId('specialContext').textContent=nameOf(slot.key)+' · '+isoWeekLabel(slot.week)+' · '+editMetric.selectedOptions[0].textContent;
  byId('specialOriginal').textContent='原值：'+recordLabel(slot.original);
  byId('specialOp').value=slot.record?.[4]==='='||!slot.record?'≈':slot.record[4];
  specialValue.value=slot.record?.[3]??'';
  specialValue.setCustomValidity('');
  byId('restoreRecord').disabled=!slot.cell.classList.contains('changed');
  byId('deleteRecord').disabled=!slot.record;
  specialDialog.showModal();
  specialValue.focus();
}
function editButton(label,description,action){
  const button=document.createElement('button');
  button.type='button';
  button.textContent=label;
  button.setAttribute('aria-label',description);
  button.onclick=action;
  return button;
}
function drawEditCell(slot){
  const {cell,key,week,kind,record,original}=slot;
  const description=nameOf(key)+' '+week+' '+editMetric.selectedOptions[0].textContent;
  const changed=record?.[3]!==original?.[3]||record?.[4]!==original?.[4];
  cell.classList.toggle('changed',changed);
  cell.title=(changed?'临时修改 · ':'')+'原值：'+recordLabel(original);
  if(record&&record[4]!=='='){
    const button=editButton(recordLabel(record),description+' '+recordLabel(record)+'，编辑特殊数据',()=>openSpecialEdit(slot));
    button.className='special-value';
    cell.replaceChildren(button);
    return;
  }
  let input=cell.querySelector('input');
  if(!input){
    input=document.createElement('input');
    input.type='text';
    input.inputMode='decimal';
    input.placeholder='—';
    input.setAttribute('aria-label',description+'（万台）');
    input.onchange=()=>{
      let value;
      try{value=numberText(input.value)}
      catch(error){
        alert(error.message+' 特殊数据请使用弹窗录入。');
        input.value=slot.record?.[3]??'';
        return;
      }
      const next=value===null?slot.original:[key,week,kind,Number(value),'='];
      saveEdit(slot,next);
      input.value=slot.record?.[3]??'';
    };
    input.onkeydown=event=>{
      if(event.key==='Enter'){event.preventDefault();input.blur()}
      if(event.key==='Escape'){input.value=slot.record?.[3]??'';input.blur()}
    };
    const button=editButton('特殊',description+'，编辑特殊数据',()=>openSpecialEdit(slot));
    button.className='cell-action';
    cell.replaceChildren(input,button);
  }
  input.value=record?.[3]??'';
}
function drawEditor(){
  editGrid.replaceChildren();
  byId('editCount').textContent='（已选 '+selected.size+' 款）';
  byId('undoEdit').disabled=!editHistory.length;
  const weeks=[...periods].reverse(),kind=editMetric.value;
  const header=editGrid.createTHead().insertRow();
  for(const label of ['机型',...weeks.map(week=>isoWeekLabel(week))]){
    const th=document.createElement('th');
    th.scope='col';
    th.textContent=label;
    header.append(th);
  }
  const body=editGrid.createTBody();
  if(!selected.size){
    body.insertRow().insertCell().textContent='请选择对比机型';
    return;
  }
  for(const key of selected){
    const row=body.insertRow();
    const name=document.createElement('th');
    name.scope='row';
    name.textContent=nameOf(key);
    row.append(name);
    const match=r=>r[0]===key&&r[2]===kind;
    const baseline=new Map(initial.filter(match).map(r=>[r[1],r]));
    const live=new Map(records.filter(match).map(r=>[r[1],r]));
    for(const week of weeks){
      drawEditCell({cell:row.insertCell(),key,week,kind,record:live.get(week),original:baseline.get(week)});
    }
  }
}
editMetric.onchange=drawEditor;
specialDialog.onclose=()=>{if(!specialDialog.open)activeEdit=null};
specialValue.oninput=()=>specialValue.setCustomValidity('');
byId('specialForm').onsubmit=event=>{
  event.preventDefault();
  if(!activeEdit)return;
  let value;
  try{value=numberText(specialValue.value);if(value===null)throw Error('请输入销量数值。')}
  catch(error){
    specialValue.setCustomValidity(error.message);
    specialValue.reportValidity();
    return;
  }
  const {key,week,kind}=activeEdit;
  if(saveEdit(activeEdit,[key,week,kind,Number(value),byId('specialOp').value]))specialDialog.close();
};
byId('cancelSpecial').onclick=()=>specialDialog.close();
byId('restoreRecord').onclick=()=>{
  if(activeEdit&&saveEdit(activeEdit,activeEdit.original))specialDialog.close();
};
byId('deleteRecord').onclick=()=>{
  if(activeEdit&&confirm('删除这一条销量记录？')&&saveEdit(activeEdit,null))specialDialog.close();
};
function refresh(){renderLists();draw();drawEditor()}
byId('addWeek').onclick=()=>{
  if(periods.length-initialPeriods.length>=52)return alert('最多临时新增52周');
  editHistory.push({addedWeek:true});
  periods.push(iso(monday(periods.at(-1))+weekMs));
  persistDraft();refresh();
};
byId('undoEdit').onclick=()=>{
  const prior=editHistory.pop();
  if(!prior)return;
  if(prior.addedWeek)periods.pop();
  else setEditRecord(prior,prior.record);
  persistDraft();refresh();
};
byId('reset').onclick=()=>{
  if(!confirm('清除临时修改，恢复项目长表？'))return;
  editHistory.length=0;
  records.splice(0,records.length,...structuredClone(initial));
  periods.splice(0,periods.length,...initialPeriods);
  persistDraft();refresh();
};

function longCSV(){
 const header=FIELDS;
 const lines=[header,...records.map(([name,week,kind,v,op])=>[...metadata[name],week,kind,v,op])];
 const quote=v=>'"'+String(v).replaceAll('"','""')+'"';
 return lines.map(row=>row.map(quote).join(',')).join('\r\n');
}
function hasDraft(){return periods.length!==initialPeriods.length||JSON.stringify(records)!==JSON.stringify(initial)}
const incrementImportKey='phoneSales.incrementImport';
function updateIncrementImport(){
  const draft=hasDraft()?{csv:longCSV(),periods:periods.slice()}:null;
  if(!SalesSite.sessionWrite(incrementImportKey,draft))alert('浏览器无法保存销量增量草稿。切换模块前请先导出 CSV。');
}
document.querySelector('#download').onclick=()=>{
 if(activeEdit)return alert('请先保存或取消当前编辑');
 const url=URL.createObjectURL(new Blob(['\uFEFF'+longCSV()],{type:'text/csv;charset=utf-8'}));
 const link=document.createElement('a');link.href=url;link.download='sales-long.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};



let sourceText='',sourceKey='',loadSequence=0,currentSourcePeriods=[];
function persistDraft(){
  updateIncrementImport();
  try{
    const changed=periods.length!==initialPeriods.length||JSON.stringify(records)!==JSON.stringify(initial);
    if(changed)sessionStorage.setItem(sourceKey,JSON.stringify({sourceText,records,periods,sourcePeriods:currentSourcePeriods}));
    else sessionStorage.removeItem(sourceKey);
  }catch{}
}
const incrementViewKey='phoneSales.incrementView';
const localSourceKey='phoneSales.incrementLocalSource';
const viewFilters=['metric','axis','brand','gap'];
window.addEventListener('pagehide',()=>{
  if(!sourceText)return;
  SalesSite.sessionWrite(incrementViewKey,{sourceKey,selected:[...selected],recentList:activeList===recentListIndex,filters:Object.fromEntries(
    viewFilters.filter(id=>byId(id)).map(id=>[id,byId(id).dataset.value])
  )});
});
function loadSource(text,key,sourcePeriods=[]){
  const [header,...rows]=parseCSV(text);
  const columns=FIELDS.map(f=>header?.indexOf(f)??-1);
  if(header?.length!==FIELDS.length||columns.includes(-1))throw Error('长表字段不匹配');
  const seen=new Set(),nextMetadata=new Map(),nextRecords=[];
  let first=Infinity,last=-Infinity;
  for(const [i,row] of rows.entries()){
    const [brand,name,category,date,week,kind,raw,op]=columns.map(c=>(row[c]??'').trim());
    const id=JSON.stringify([brand,name]),slot=JSON.stringify([id,week,kind]),time=monday(week);
    let value;try{value=numberText(raw)}catch{value=null}
    if(row.length!==header.length||!brand||!name||time==null||value===null||!['weekly','cumulative'].includes(kind)||!['=','>=','<','≈'].includes(op)||seen.has(slot))
      throw Error('第 '+(i+2)+' 行无效或与已有记录重复');
    const prior=nextMetadata.get(id);
    if(prior&&(prior[2]!==category||prior[3]!==date))throw Error('第 '+(i+2)+' 行的机型类别或日期不一致');
    nextMetadata.set(id,[brand,name,category,date]);nextRecords.push([id,week,kind,Number(value),op]);
    seen.add(slot);first=Math.min(first,time);last=Math.max(last,time);
  }
  if(!nextRecords.length)throw Error('长表暂无记录');
  initial=nextRecords;initialPeriods=[];
  for(let t=first;t<=last;t+=weekMs)initialPeriods.push(iso(t));
  initialPeriods=[...new Set([...initialPeriods,...sourcePeriods.filter(period=>monday(period)!=null)])].sort();
  currentSourcePeriods=sourcePeriods;
  sourceText=text;sourceKey='increments.draft.'+key;
  let draft;
  try{const saved=JSON.parse(sessionStorage.getItem(sourceKey));if(saved?.sourceText===text&&JSON.stringify(saved.sourcePeriods??[])===JSON.stringify(sourcePeriods))draft=saved}catch{}
  records.length=0;for(const r of draft?.records??initial)records.push([...r]);
  periods.length=0;for(const w of draft?.periods??initialPeriods)periods.push(w);
  for(const k of Object.keys(metadata))delete metadata[k];
  editHistory.length=0;
  if(activeEdit){activeEdit=null;specialDialog.close()}
  byId('brand').replaceChildren();
  const brands=new Set();
  for(const [id,meta] of nextMetadata){
    metadata[id]=meta;brands.add(meta[0]);
  }
  styles.clear();
  const styleRows=[...nextMetadata].map(([id,meta])=>({id,brand:meta[0]}));
  assignColors(styleRows);for(const r of styleRows)styles.set(r.id,r);
  focused=null;
  for(const brand of ['',...brands]){
    const button=document.createElement('button');
    button.type='button';button.dataset.value=brand;button.textContent=brand||'全部品牌';
    byId('brand').append(button);
  }
  selectFilter('brand','');
  selected.clear();
  recentChoices=recentModelKeys();
  activeList=recentListIndex;
  for(const key of recentChoices)selected.add(key);
  const view=SalesSite.sessionRead(incrementViewKey);
  if(view?.sourceKey===sourceKey&&Array.isArray(view.selected)){
    const restored=view.selected.filter(id=>Object.hasOwn(metadata,id));
    if(restored.length||!view.selected.length){
      selected.clear();
      activeList=view.recentList?recentListIndex:-1;
      const visibleKeys=activeList===recentListIndex?new Set(recentChoices):null;
      for(const id of restored)if(!visibleKeys||visibleKeys.has(id))selected.add(id);
    }
    for(const id of viewFilters){
      const value=view.filters?.[id];
      if(byId(id)&&[...byId(id).querySelectorAll('button')].some(button=>button.dataset.value===value))selectFilter(id,value);
    }
  }
  choices();refresh();
  byId('chartControls').hidden=false;
  byId('content').hidden=false;byId('loadState').hidden=true;
  updateIncrementImport();
}
const editorImportKey='phoneSales.editorImport';
function pendingEditorDraft(){
  const draft=SalesSite.sessionRead(editorImportKey);
  return typeof draft?.csv==='string'&&Array.isArray(draft.periods)&&!draft.imported?draft:null;
}
function refreshEditorImport(){
  const button=byId('importEditorDraft');
  button.disabled=!pendingEditorDraft();
  byId('editorImportStatus').textContent=button.disabled?'销量数据处理暂无可导入的更新。':'销量数据处理有可导入的更新。';
}
function applySource(source){
  const {text,name,kind,periods:sourcePeriods}=source;
  const key=kind==='editor'?'editor':kind==='local'?'local.'+name:'project';
  loadSource(text,key,sourcePeriods);
  const label=kind==='editor'?'销量数据处理':kind==='local'?'本地 · '+name:'项目 · sales-long.csv';
  byId('currentSource').textContent='当前来源：'+label;
  byId('currentSource').hidden=false;
}
async function start(kind,file){
  const sequence=++loadSequence;
  try{
    let source,draft;
    if(kind==='restore'){
      const saved=SalesSite.sessionRead(localSourceKey);
      if(typeof saved?.text==='string'&&typeof saved?.name==='string'){
        source={...saved,kind:saved.kind==='editor'?'editor':'local'};
      }
    }else if(kind==='local'){
      const bytes=await file.arrayBuffer();
      let text;
      try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{text=new TextDecoder('gbk').decode(bytes)}
      source={kind,name:file.name,text};
    }else if(kind==='editor'){
      draft=pendingEditorDraft();
      if(!draft)return refreshEditorImport();
      source={kind,name:'sales-long.csv',text:draft.csv,periods:draft.periods};
    }
    if(!source){
      const response=await fetch('sales-long.csv',{cache:'no-cache'});
      if(!response.ok)throw Error('项目长表读取失败（HTTP '+response.status+'）');
      source={kind:'project',text:await response.text()};
    }
    if(sequence!==loadSequence)return;
    if(kind!=='restore'&&activeEdit)return alert('请先保存或取消当前编辑。');
    if(kind!=='restore'&&sourceText&&hasDraft()&&!confirm('切换数据来源将替换当前显示的临时修改。继续导入？'))return;
    applySource(source);
    if(kind!=='restore'){
      const saved=SalesSite.sessionWrite(localSourceKey,source.kind==='project'?null:source);
      if(draft&&saved)SalesSite.sessionWrite(editorImportKey,{...draft,imported:true});
      if(!saved)alert('浏览器无法记住本次导入。切换模块前请先导出 CSV。');
    }
  }catch(error){
    if(sequence===loadSequence){byId('loadState').hidden=false;byId('loadState').textContent=error.message}
  }finally{
    if(sequence===loadSequence)refreshEditorImport();
  }
}
byId('reloadProject').onclick=()=>start('project');
byId('openLocalFile').onclick=()=>byId('localFile').click();
byId('importEditorDraft').onclick=()=>start('editor');
byId('localFile').onchange=event=>{const file=event.target.files[0];if(file)start('local',file);event.target.value=''};
window.addEventListener('pageshow',refreshEditorImport);
refreshEditorImport();
start('restore');
document.fonts?.addEventListener('loadingdone',()=>{if(current&&!activeEdit)draw()});

