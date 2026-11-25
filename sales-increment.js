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
function draw(){
  const lookup=new Map(records.filter(r=>r[0]===model.value).map(r=>[r[1]+r[2],{value:r[3],op:r[4]}]));
  const rows=periods.map((period,i)=>{
    const cumulative=lookup.get(period+'cumulative'), previous=lookup.get(periods[i-1]+'cumulative');
    const direct=lookup.get(period+'weekly');
    const diff=cumulative?.op==='='&&previous?.op==='='?{value:cumulative.value-previous.value,op:'='}:null;
    return {period,cumulative,weekly:diff||direct,source:diff?(direct?'累计差分（另录 '+display(direct)+'）':'相邻周累计差分'):direct?'直接记录':'—'};
  });
  document.querySelector('h2').textContent=model.selectedOptions[0].text+' · '+metric.selectedOptions[0].text;
  const body=document.querySelector('tbody');body.replaceChildren();
  for(const r of [...rows].reverse()){const tr=body.insertRow();for(const v of [r.period,display(r.cumulative),display(r.weekly),r.source])tr.insertCell().textContent=v}
  const vals=rows.map(r=>r[metric.value]), nums=vals.filter(Boolean).map(p=>p.value);
  const lo=Math.min(0,...nums),hi=Math.max(1,...nums);
  const y=v=>198-168*(v-lo)/(hi-lo),x=i=>65+700*i/Math.max(1,rows.length-1);
  let art='';
  for(let i=0;i<=4;i++){const v=lo+(hi-lo)*i/4;art+='<path d="M65 '+y(v)+'h700" stroke="#e1e6ed"/><text x="58" y="'+(y(v)+4)+'" text-anchor="end">'+fmt(v)+'</text>'}
  vals.forEach((p,i)=>{
    if(i%Math.max(1,Math.ceil(rows.length/8))===0||i===rows.length-1)art+='<text x="'+x(i)+'" y="226" text-anchor="middle">'+rows[i].period.slice(5)+'</text>';
    if(!p)return;
    const a=x(i),b=y(p.value),prev=vals[i-1];
    if(p.op==='='&&prev?.op==='=')art+='<path d="M'+x(i-1)+' '+y(prev.value)+' L'+a+' '+b+'" stroke="#1761ae" stroke-width="3"/>';
    art+=p.op==='='?'<circle cx="'+a+'" cy="'+b+'" r="4" fill="#1761ae"/>':'<circle cx="'+a+'" cy="'+b+'" r="5" fill="white" stroke="#1761ae" stroke-width="2"/><text x="'+(a+7)+'" y="'+(b+4)+'">'+(p.op==='>='?'↑':p.op==='<'?'↓':'≈')+'</text>';
  });
  if(!nums.length)art+='<text x="410" y="110" text-anchor="middle">当前指标暂无可显示的记录</text>';
  document.querySelector('svg').innerHTML='<g font-family="system-ui" font-size="13" fill="#52617a">'+art+'</g>';
}
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
          refresh();
        };
        input.onkeydown=e=>{if(e.key==='Enter'){e.stopPropagation();save.click()}if(e.key==='Escape')refresh()};
        cell.replaceChildren(op,input,save,cancel);input.focus();
      }
      cell.ondblclick=edit;cell.onkeydown=e=>{if(e.target===cell&&e.key==='Enter')edit()};
    }
  }
}
function refresh(){draw();drawEditor()}
document.querySelector('#addWeek').onclick=()=>{periods.push(iso(monday(periods.at(-1))+604800000));refresh()};
document.querySelector('#reset').onclick=()=>{if(confirm('清除临时修改，恢复项目长表？')){records.splice(0,records.length,...structuredClone(initial));periods.splice(0,periods.length,...initialPeriods);refresh()}};
document.querySelector('#download').onclick=()=>{
 const header=FIELDS;
 const lines=[header,...records.map(([name,week,kind,v,op])=>[...metadata[name],week,kind,v,op])];
 const quote=v=>'"'+String(v).replaceAll('"','""')+'"';
 const url=URL.createObjectURL(new Blob(['\uFEFF'+lines.map(row=>row.map(quote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
 const link=document.createElement('a');link.href=url;link.download='sales-long.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
model.onchange=metric.onchange=refresh;

async function start(){
  const response=await fetch('sales-long.csv',{cache:'no-cache'});
  if(!response.ok)throw Error('项目长表读取失败（HTTP '+response.status+'）');
  const [header,...rows]=parseCSV(await response.text());
  const columns=FIELDS.map(f=>header?.indexOf(f)??-1);
  if(header?.length!==FIELDS.length||columns.includes(-1))throw Error('长表字段不匹配');
  const seen=new Set();
  let first=Infinity,last=-Infinity;
  for(const [i,row] of rows.entries()){
    const [brand,name,category,date,week,kind,raw,op]=columns.map(c=>(row[c]??'').trim());
    const key=JSON.stringify([brand,name]), id=JSON.stringify([key,week,kind]);
    const time=monday(week);
    let value;
    try{value=numberText(raw)}catch{value=null}
    if(row.length!==header.length||!brand||!name||time==null||value===null||!['weekly','cumulative'].includes(kind)||!['=','>=','<','≈'].includes(op)||seen.has(id))
      throw Error('第 '+(i+2)+' 行无效或与已有记录重复');
    if(metadata[key]&&(metadata[key][2]!==category||metadata[key][3]!==date))throw Error('第 '+(i+2)+' 行的机型类别或日期不一致');
    if(!metadata[key])model.add(new Option(brand+' '+name,key));
    metadata[key]=[brand,name,category,date];
    records.push([key,week,kind,Number(value),op]);
    seen.add(id);
    first=Math.min(first,time); last=Math.max(last,time);
  }
  if(!records.length)throw Error('项目长表暂无记录');
  for(let t=first;t<=last;t+=604800000)periods.push(iso(t));
  initial=structuredClone(records);initialPeriods=periods.slice();
  refresh();
  document.querySelector('#content').hidden=false;
  document.querySelector('#loadState').hidden=true;
}
start().catch(error=>{document.querySelector('#loadState').textContent=error.message});
