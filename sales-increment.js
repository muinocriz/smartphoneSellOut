'use strict';
const FIELDS=["brand","model","category","date","period","metric","value_wan","operator"];
const records=[];
const metadata=Object.create(null);
function numberText(raw){let s=String(raw).trim().replace(/，/g,',');if(!s)return null;if(/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s))s=s.replace(/,/g,'');if(!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(s)||!Number.isFinite(Number(s))||Number(s)<0)throw Error('请输入非负数字（单位：万台）。');if(s.startsWith('.'))s='0'+s;if(s.endsWith('.'))s=s.slice(0,-1);return s;}
function parseCSV(text){const rows=[];let row=[],f='',q=false;const s=text.replace(/^\uFEFF/,'');for(let i=0;i<s.length;i++){const c=s[i];if(q){if(c==='"'){if(s[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}else if(c==='"'&&f===''){q=true;}else if(c===','){row.push(f);f='';}else if(c==='\r'||c==='\n'){if(c==='\r'&&s[i+1]==='\n')i++;row.push(f);if(row.some(x=>x.trim()!==''))rows.push(row);row=[];f='';}else f+=c;}if(q)throw Error('CSV 引号未闭合。');row.push(f);if(row.some(x=>x.trim()!==''))rows.push(row);return rows;}

const model=document.querySelector('#model'), metric=document.querySelector('#metric');

const fmt=n=>Number(n.toFixed(4)).toLocaleString('zh-CN',{maximumFractionDigits:4});
function monday(period){
  const match=/^(\d{4})-W(\d{2})$/.exec(period);
  return match ? IsoSalesWeek.isoWeekMonday(+match[1],+match[2]) : null;
}
function iso(t){
  const year=new Date(t+259200000).getUTCFullYear();
  return year+'-W'+String(1+(t-monday(year+'-W01'))/604800000).padStart(2,'0');
}
const periods=[];
function display(point){return point?(point.op==='='?'':point.op==='>='?'≥':point.op)+fmt(point.value):'—'}

const byId=id=>document.getElementById(id);
const selected=new Set();
let savedLists=[];
try{savedLists=JSON.parse(localStorage.getItem('increments.lists')||'[]').filter(l=>typeof l.name==='string'&&Array.isArray(l.keys))}catch{}
const colors=['#1761ae','#cf6528','#488e49','#9354a5','#aa4056','#23898e','#705c36','#586ab4'];
const weekMs=7*IsoSalesWeek.DAY;
function seriesRows(key){
  const date=metadata[key][3].split(/[/.\-]/).map(Number);
  const first=IsoSalesWeek.firstFullWeekMonday(date), partial=IsoSalesWeek.partialWeek(date);
  const raw=new Map(records.filter(r=>r[0]===key).map(r=>[r[1]+r[2],{value:r[3],op:r[4]}]));
  const rows=periods.map((period,i)=>{
    const cumulative=raw.get(period+'cumulative'),previous=raw.get(periods[i-1]+'cumulative'),direct=raw.get(period+'weekly');
    const diff=cumulative?.op==='='&&previous?.op==='='?{value:cumulative.value-previous.value,op:'='}:null;
    const t=monday(period);
    return {period,cumulative,direct,weekly:diff||direct,life:IsoSalesWeek.lifecycleWeekIndex(t,first),partial:partial?.isoMonday===t?partial.days:0,
      source:diff?(direct?'累计差分（另录 '+display(direct)+'）':'相邻周累计差分'):direct?'直接记录':'—'};
  });
  if(byId('gap').value==='raw')return rows;
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
    const slope=byId('gap').value==='fit'?trendSlope(rows,start):0;
    const count=i-start,total=right.value-anchor.value;
    const shift=Math.max(0,(count-1)*slope);
    const weights=Array.from({length:count},(_,j)=>Math.exp(j*slope-shift));
    const sum=weights.reduce((a,b)=>a+b,0);
    let cumulative=anchor.value;
    for(let j=0;j<count;j++){
      const row=rows[start+j+1],delta=total*weights[j]/sum;
      cumulative+=delta;
      row.weekly={value:delta,op:'≈',estimated:true};
      row.source=(lower?'里程碑参考 · ':'')+(slope?'历史趋势约束':'线性估算');
      if(j<count-1)row.cumulative={value:cumulative,op:'≈',estimated:true};
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
    if(Math.floor(end.value/50)<=Math.floor(peak/50))continue;
    const adjacent=prev?.op==='='&&monday(end.week)-monday(prev.week)===weekMs;
    (adjacent?weekly:cross).push(key);
  }
  return [weekly,cross];
}
function presets(){
  const [weekly,cross]=milestoneLists();
  const end=records.reduce((max,r)=>Math.max(max,monday(r[1])),-Infinity);
  const active=new Set(records.map(r=>r[0]));
  const recent=Object.keys(metadata).filter(key=>{
    const t=IsoSalesWeek.isoMonday(metadata[key][3].split(/[/.\-]/).map(Number));
    return active.has(key)&&t!=null&&t<=end&&t>=end-11*weekMs;
  });
  return [{name:'近12周新机',keys:recent},{name:'本周里程碑',keys:weekly},{name:'跨期里程碑',keys:cross},...savedLists];
}
function choices(){
  const box=byId('choices');box.replaceChildren();
  for(const key of Object.keys(metadata)){
    if(byId('brand').value&&byId('brand').value!==metadata[key][0])continue;
    const label=document.createElement('label'),input=document.createElement('input');
    input.type='checkbox';input.checked=selected.has(key);
    input.onchange=()=>{if(input.checked)selected.add(key);else selected.delete(key);draw()};
    label.append(input,nameOf(key));box.append(label);
  }
}
function applyKeys(keys){
  selected.clear();keys.filter(key=>metadata[key]).forEach(key=>selected.add(key));
  choices();draw();
}
function listOptions(){
  const lists=byId('lists'),old=lists.value;lists.replaceChildren();
  presets().forEach((l,i)=>lists.add(new Option(l.name+'（'+l.keys.filter(k=>metadata[k]).length+'）',i)));
  if(old&&Number(old)<lists.length)lists.value=old;
}
byId('brand').onchange=choices;
byId('all').onclick=()=>{for(const k of Object.keys(metadata))if(!byId('brand').value||metadata[k][0]===byId('brand').value)selected.add(k);choices();draw()};
byId('brandTops').onclick=()=>{
  const best=new Map();
  for(const key of Object.keys(metadata)){
    const row=seriesRows(key).reverse().find(r=>r.weekly?.op==='=');
    if(!row)continue;
    const brand=metadata[key][0],prior=best.get(brand);
    if(!prior||row.period>prior.row.period||(row.period===prior.row.period&&row.weekly.value>prior.row.weekly.value))best.set(brand,{key,row});
  }
  applyKeys([...best.values()].map(item=>item.key));
};
byId('none').onclick=()=>applyKeys([]);
byId('applyList').onclick=()=>applyKeys(presets()[Number(byId('lists').value)].keys);
function saveLists(){try{localStorage.setItem('increments.lists',JSON.stringify(savedLists))}catch{}listOptions()}
byId('saveList').onclick=()=>{
  const name=byId('listName').value.trim();if(!name||!selected.size)return alert('请填写列表名称并选择机型');
  const index=savedLists.findIndex(l=>l.name===name);
  if(index>=0&&!confirm('更新同名列表？'))return;
  const list={name,keys:[...selected]};
  if(index>=0)savedLists[index]=list;else savedLists.push(list);
  saveLists();
};
byId('deleteList').onclick=()=>{const i=Number(byId('lists').value)-3;if(i>=0&&confirm('删除这个自建列表？')){savedLists.splice(i,1);saveLists()}};

const svgNS='http://www.w3.org/2000/svg';
function svgNode(parent,tag,attrs={},content){
  const node=document.createElementNS(svgNS,tag);
  for(const [attr,value] of Object.entries(attrs))node.setAttribute(attr,value);
  if(content!=null)node.textContent=content;
  parent.append(node);return node;
}
let current;
function draw(){
  if(!metadata[model.value])return;
  byId('editStatus').textContent=hasDraft()?'含临时数据，可导出长表保存。':'';
  const life=byId('axis').value==='life';
  const sets=[...selected].map((key,i)=>({key,color:colors[i%colors.length],rows:seriesRows(key)}));
  const lifeWeeks=sets.flatMap(s=>s.rows.filter(r=>r.life!=null&&(r.cumulative||r.weekly)).map(r=>r.life));
  let axis=periods;
  if(life){
    const start=Math.min(...lifeWeeks),end=Math.max(...lifeWeeks);
    axis=lifeWeeks.length?Array.from({length:end-start+1},(_,i)=>start+i):[];
  }
  const rangeLabel=v=>life?'第'+v+'周':v;
  for(const id of ['from','to']){
    const input=byId(id),old=input.value,atEnd=id==='to'&&input.selectedIndex===input.length-1;
    input.replaceChildren(...axis.map(v=>new Option(rangeLabel(v),v)));
    if(!atEnd&&axis.some(t=>String(t)===old))input.value=old;
    else input.selectedIndex=id==='to'?axis.length-1:0;
  }
  const from=byId('from').selectedIndex,to=Math.max(from,byId('to').selectedIndex);
  byId('to').selectedIndex=to;
  const ticks=axis.slice(from,to+1);
  for(const set of sets){
    const lookup=new Map(set.rows.map(r=>[life?r.life:r.period,r[metric.value]]));
    set.points=ticks.map(t=>lookup.get(t));
  }
  current={sets,ticks,rangeLabel};
  const title=metric.selectedOptions[0].text+' · '+byId('axis').selectedOptions[0].text;
  byId('heading').textContent=title;
  const svg=document.querySelector('svg');plot(svg,current,800,280);
  const legend=byId('legend');legend.replaceChildren();
  const ranked=[...sets].sort((a,b)=>lastVisible(b)-lastVisible(a));
  for(const s of ranked){
    const mark=document.createElement('i');mark.style.background=s.color;
    const el=document.createElement('span');el.append(mark,legendText(s));legend.append(el);
  }
  byId('detailTitle').textContent=nameOf(model.value)+' · 逐周明细';
  const body=document.querySelector('tbody');body.replaceChildren();
  for(const r of seriesRows(model.value).reverse()){
    const tr=body.insertRow();
    const age=r.partial?'P0 · '+r.partial+'天':r.life==null?'—':'W'+r.life;
    for(const v of [r.period,age,display(r.cumulative),display(r.weekly),r.source])tr.insertCell().textContent=v;
  }
  byId('windowLabel').hidden=byId('gap').value!=='fit';
}
function lastVisible(s){return s.points.filter(p=>p&&(!byId('log').checked||p.value>0)).at(-1)?.value??-Infinity}
function legendText(s){
  const point=s.points.filter(p=>p&&(!byId('log').checked||p.value>0)).at(-1);
  const value=point?(point.op==='='?'':point.op==='>='?'≥':point.op)+point.value.toLocaleString('zh-CN',{maximumSignificantDigits:4}):'—';
  return nameOf(s.key)+'  '+value;
}
function plot(svg,{sets,ticks,rangeLabel},width,height){
  svg.replaceChildren();svg.setAttribute('viewBox','0 0 '+width+' '+height);
  svg.setAttribute('font-family','Noto Sans SC, sans-serif');svg.setAttribute('font-size','12');svg.setAttribute('fill','#465369');
  const log=byId('log').checked,visible=p=>p!=null&&(!log||p.value>0);
  const nums=sets.flatMap(s=>s.points.filter(visible).map(p=>log?Math.log10(p.value):p.value));
  let low=nums.reduce((a,b)=>Math.min(a,b),log?Infinity:0),high=nums.reduce((a,b)=>Math.max(a,b),log?-Infinity:0);
  if(!nums.length){svgNode(svg,'text',{x:width/2,y:height/2,'text-anchor':'middle'},sets.length?'当前范围没有可显示的数据':'请选择对比机型');return}
  if(low===high)high+=1;
  const left=58,right=width-25,top=26,bottom=height-33;
  const x=i=>ticks.length===1?(left+right)/2:left+i*(right-left)/(ticks.length-1);
  const y=v=>bottom-((log?Math.log10(v):v)-low)*(bottom-top)/(high-low);
  for(let i=0;i<=4;i++){
    const pos=bottom-(bottom-top)*i/4,v=low+(high-low)*i/4;
    svgNode(svg,'line',{x1:left,x2:right,y1:pos,y2:pos,stroke:'#dee3ea'});
    svgNode(svg,'text',{x:left-5,y:pos+4,'text-anchor':'end'},fmt(log?10**v:v));
  }
  const step=Math.max(1,Math.ceil(ticks.length/Math.max(2,Math.floor((right-left)/85))));
  ticks.forEach((t,i)=>{if(i%step===0||i===ticks.length-1&&(i%step)>step/2)svgNode(svg,'text',{x:x(i),y:height-10,'text-anchor':'middle'},rangeLabel(t))});
  for(const s of sets)s.points.forEach((p,i)=>{
    if(!visible(p))return;
    const prev=s.points[i-1],cx=x(i),cy=y(p.value);
    if(visible(prev)&&(p.op==='='&&prev.op==='='||p.estimated||prev.estimated)){
      svgNode(svg,'line',{x1:x(i-1),y1:y(prev.value),x2:cx,y2:cy,stroke:s.color,'stroke-width':2,'stroke-dasharray':p.estimated||prev.estimated?'5 3':'none'});
    }
    const node=svgNode(svg,'circle',{cx,cy,r:3.6,fill:p.op==='='?s.color:'white',stroke:s.color,'stroke-width':2});
    svgNode(node,'title',{},nameOf(s.key)+' · '+rangeLabel(ticks[i])+' · '+display(p)+' 万台');
    const symbol=p.op==='>='?'↑':p.op==='<'?'↓':p.op==='≈'?'≈':'';
    if(symbol||byId('labels').checked)svgNode(svg,'text',{x:cx+3,y:cy-7,fill:s.color},symbol+(byId('labels').checked?fmt(p.value):''));
  });
}
async function exportChart(mobile){
  if(!current?.sets.some(s=>s.points.some(p=>p&&(!byId('log').checked||p.value>0))))return alert('当前范围没有可导出的销量');
  await document.fonts.ready;
  const width=mobile?400:1200,base=mobile?500:675,scale=mobile?3:2;
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d'),font='14px "Noto Sans SC", sans-serif';
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
  const footer=byId('footer').value.trim(),notes=footer?lines(footer):[];
  if(hasDraft())notes.push('含本标签页临时数据，仅供参考');
  const legend=[...current.sets].sort((a,b)=>lastVisible(b)-lastVisible(a)).flatMap(s=>lines(legendText(s)).map(text=>({text,color:s.color})));
  const height=Math.max(base,245+20*legend.length)+notes.length*20;
  canvas.width=width*scale;canvas.height=height*scale;ctx.scale(scale,scale);
  ctx.fillStyle='white';ctx.fillRect(0,0,width,height);
  ctx.fillStyle='#18243b';ctx.font='bold 22px sans-serif';ctx.fillText('销量增量追踪',18,34);
  ctx.font=font;
  const sub=byId('heading').textContent+' · 万台 · '+current.rangeLabel(current.ticks[0])+' 至 '+current.rangeLabel(current.ticks.at(-1));
  ctx.fillText(sub,18,61,width-36);
  const chartH=height-92-20*(legend.length+notes.length);
  const svg=document.createElementNS(svgNS,'svg');plot(svg,current,width,chartH);
  svg.setAttribute('width',width);svg.setAttribute('height',chartH);
  const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'}));
  try{
    const img=new Image();img.src=url;await img.decode();ctx.drawImage(img,0,67);
    let y=chartH+86;
    for(const item of legend){ctx.fillStyle=item.color;ctx.fillText(item.text,18,y);y+=20}
    ctx.fillStyle='#52617a';for(const line of notes){ctx.fillText(line,18,y);y+=20}
    const link=document.createElement('a');link.download='销量增量追踪-'+metric.selectedOptions[0].text+'-'+(mobile?'手机':'桌面')+'.png';link.href=canvas.toDataURL();link.click();
  }finally{URL.revokeObjectURL(url)}
}
for(const id of ['axis','gap','window','from','to','log','labels'])byId(id).onchange=()=>{
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
const editGrid=document.querySelector('#editGrid');
function drawEditor(){
  editGrid.replaceChildren();
  const recent=[...periods].reverse();
  const header=editGrid.createTHead().insertRow();
  for(const label of ['指标',...recent]){const th=document.createElement('th');th.textContent=label;header.append(th)}
  const editorBody=editGrid.createTBody();
  for(const [kind,label] of [['cumulative','累计销量'],['weekly','直接周增量']]){
    const row=editorBody.insertRow();row.insertCell().textContent=label;
    for(const week of recent){
      const cell=row.insertCell();
      const index=records.findIndex(r=>r[0]===model.value&&r[1]===week&&r[2]===kind);
      const rec=records[index];
      cell.tabIndex=0;cell.style.whiteSpace='nowrap';cell.textContent=rec?display({value:rec[3],op:rec[4]}):'—';
      function edit(){
        if(cell.querySelector('input'))return;
        const op=document.createElement('select');
        for(const [v,t] of [['=','='],['>=','≥'],['<','<'],['≈','≈']])op.add(new Option(t,v));
        op.value=rec?.[4]||'=';
        const input=document.createElement('input');input.type='number';input.min='0';input.step='any';input.style.width='7em';input.value=rec?.[3]??'';
        const save=document.createElement('button');save.textContent='保存';
        const cancel=document.createElement('button');cancel.textContent='取消';cancel.onclick=refresh;
        save.onclick=()=>{
          if(input.validity.badInput||!input.checkValidity()){input.reportValidity();return}
          if(input.value===''){if(index>=0)records.splice(index,1)}
          else{const updated=[model.value,week,kind,input.valueAsNumber,op.value];if(index>=0)records[index]=updated;else records.push(updated)}
          persistDraft();refresh();
        };
        input.onkeydown=e=>{if(e.key==='Enter'){e.stopPropagation();save.click()}if(e.key==='Escape')refresh()};
        cell.replaceChildren(op,input,save,cancel);input.focus();
      }
      cell.ondblclick=edit;cell.onkeydown=e=>{if(e.target===cell&&e.key==='Enter')edit()};
    }
  }
}
function refresh(){listOptions();draw();drawEditor()}
document.querySelector('#addWeek').onclick=()=>{if(periods.length-initialPeriods.length>=52)return alert('最多临时新增52周');periods.push(iso(monday(periods.at(-1))+604800000));persistDraft();refresh()};
document.querySelector('#reset').onclick=()=>{if(confirm('清除临时修改，恢复项目长表？')){records.splice(0,records.length,...structuredClone(initial));periods.splice(0,periods.length,...initialPeriods);persistDraft();refresh()}};
function longCSV(){
 const header=FIELDS;
 const lines=[header,...records.map(([name,week,kind,v,op])=>[...metadata[name],week,kind,v,op])];
 const quote=v=>'"'+String(v).replaceAll('"','""')+'"';
 return lines.map(row=>row.map(quote).join(',')).join('\r\n');
}
function hasDraft(){return periods.length!==initialPeriods.length||JSON.stringify(records)!==JSON.stringify(initial)}
window.getIncrementDraft=()=>sourceText&&hasDraft()?{csv:longCSV(),periods:periods.slice()}:null;
function notifyEditor(){if(parent!==window)parent.dispatchEvent(new Event('increment-data-change'))}
document.querySelector('#download').onclick=()=>{
 const url=URL.createObjectURL(new Blob(['\uFEFF'+longCSV()],{type:'text/csv;charset=utf-8'}));
 const link=document.createElement('a');link.href=url;link.download='sales-long.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
model.onchange=()=>{if(selected.size<=1)selected.clear();selected.add(model.value);choices();refresh()};
metric.onchange=draw;


let sourceText='',sourceKey='',loadSequence=0;
function persistDraft(){
  notifyEditor();
  try{
    const changed=periods.length!==initialPeriods.length||JSON.stringify(records)!==JSON.stringify(initial);
    if(changed)sessionStorage.setItem(sourceKey,JSON.stringify({sourceText,records,periods}));
    else sessionStorage.removeItem(sourceKey);
  }catch{}
}
function loadSource(text,key){
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
  sourceText=text;sourceKey='increments.draft.'+key;
  let draft;
  try{const saved=JSON.parse(sessionStorage.getItem(sourceKey));if(saved?.sourceText===text)draft=saved}catch{}
  records.length=0;for(const r of draft?.records??initial)records.push([...r]);
  periods.length=0;for(const w of draft?.periods??initialPeriods)periods.push(w);
  for(const k of Object.keys(metadata))delete metadata[k];
  model.replaceChildren();
  byId('brand').replaceChildren(new Option('全部品牌',''));
  const brands=new Set();
  for(const [id,meta] of nextMetadata){
    metadata[id]=meta;model.add(new Option(nameOf(id),id));brands.add(meta[0]);
  }
  for(const brand of brands)byId('brand').add(new Option(brand,brand));
  selected.clear();
  const recent=presets()[0].keys;
  for(const k of recent.length?recent:[model.value])selected.add(k);
  model.value=[...selected][0]; choices();refresh();
  byId('content').hidden=false;byId('loadState').hidden=true;notifyEditor();
}
async function start(file){
  const sequence=++loadSequence;
  try{
    let text;
    if(file){
      const bytes=await file.arrayBuffer();
      try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{text=new TextDecoder('gbk').decode(bytes)}
    }else{
      const response=await fetch('sales-long.csv',{cache:'no-cache'});
      if(!response.ok)throw Error('项目长表读取失败（HTTP '+response.status+'）');
      text=await response.text();
    }
    if(sequence===loadSequence)loadSource(text,file?'local.'+file.name:'project');
  }catch(error){if(sequence===loadSequence){byId('loadState').hidden=false;byId('loadState').textContent=error.message}}
}
byId('localFile').onchange=event=>{const file=event.target.files[0];if(file)start(file);event.target.value=''};
start();
