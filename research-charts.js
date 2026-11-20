/* Shared chart rendering and typography. SVG line previews retain point tooltips; Canvas exports use identical point geometry. */
const CJK_FONT='"Source Han Sans SC","Source Han Sans CN","思源黑体","Noto Sans CJK SC","Noto Sans SC",sans-serif';
const NUM_FONT='"IBM Plex Mono",ui-monospace,Menlo,monospace';
const NUMERIC_TOKEN=/[+\-−]?\d+(?:[.,:/–-]\d+)*(?:[%％×])?/g;
function numericTextRuns(value){
 const raw=String(value??'');
 // 仅独立的销量、排名、百分比、倍数使用数字字体；
 // 日期、机型名称和包含说明文字的内容保留完整正文字体。
 if(!/^[+\-−]?\d[\d.,:/–-]*(?:\s*(?:%|％|pp|倍|万台|台|px))?$/.test(raw.trim()))
  return [{text:raw,number:false}];
 const runs=[];let last=0;
 for(const m of raw.matchAll(NUMERIC_TOKEN)){
  if(m.index>last)runs.push({text:raw.slice(last,m.index),number:false});
  runs.push({text:m[0],number:true});last=m.index+m[0].length;
 }
 if(last<raw.length)runs.push({text:raw.slice(last),number:false});
 return runs.length?runs:[{text:raw,number:false}];
}
function measureMixedCanvas(ctx,text,size,weight='600'){
 const runs=numericTextRuns(text);let width=0;
 const measured=runs.map(run=>{ctx.font=weight+' '+size+'px '+(run.number?NUM_FONT:CJK_FONT);const w=ctx.measureText(run.text).width;width+=w;return {...run,width:w}});
 return {runs:measured,width};
}
function canvasText(ctx,text,x,y,size,color,weight='600',align='left',maxWidth=null){
 const original=String(text??'');ctx.save();ctx.fillStyle=color;ctx.textBaseline='alphabetic';
 const measured=measureMixedCanvas(ctx,original,size,weight);
 const scale=maxWidth!==null&&measured.width>maxWidth?maxWidth/measured.width:1;
 let start=x-(align==='right'?measured.width*scale:align==='center'?measured.width*scale/2:0);
 // 独立数字行使用字形左边界做光学补偿（特别是数字 1）。
 if(align==='left'&&/^[+\-−]?\d[\d.,:%％×\s+\-−]*$/.test(original)){
  ctx.font=weight+' '+size+'px '+NUM_FONT;
  start-=Math.max(0,ctx.measureText(original).actualBoundingBoxLeft||0)*scale;
 }
 ctx.translate(start,y);ctx.scale(scale,1);ctx.textAlign='left';let offset=0;
 for(const run of measured.runs){ctx.font=weight+' '+size+'px '+(run.number?NUM_FONT:CJK_FONT);ctx.fillText(run.text,offset,0);offset+=run.width}
 ctx.restore();
}
function rounded(ctx,x,y,w,h,r,color){if(w<=0||h<=0)return;ctx.beginPath();const rad=Math.min(r,w/2,h/2);ctx.roundRect(x,y,w,h,rad);ctx.fillStyle=color;ctx.fill()}
function drawHeadStaticPoster(ctx,L,p,s,box){
 const {kind,periods,lines,unit,baseline}=s.chart;
 const {left,right,top,bottom,width,height}=box;
 const colors=['#2563eb','#ea580c','#059669','#9333ea','#db2777','#0891b2','#92400e','#64748b'];
 const noteY=bottom-12;
 if(!auditPlot(ctx,width,height,'品牌分析图',360,230))return;
 if(kind==='scatter'){
  const xx=lines[0].values,yy=lines[1].values;
  const cols=width>=680?2:2,legendRows=Math.ceil(periods.length/cols);
  const legendStep=Math.min(29,height*.065),legendH=legendRows*legendStep;
  const x0=left+62,x1=right-22,y0=top+28,y1=bottom-legendH-86;
  if(!auditPlot(ctx,x1-x0,y1-y0,'四象限绘图区',260,160))return;
  const mx=Math.max(1.25,...xx.filter(Number.isFinite))*1.1,my=Math.max(1.25,...yy.filter(Number.isFinite))*1.1;
  const x=v=>x0+v/mx*(x1-x0),y=v=>y1-v/my*(y1-y0);
  posterFitText(ctx,'纵轴：单品销量强度指数',left,top+17,22,p.sub,'600','left',width);
  for(let i=0;i<=4;i++){
   const a=mx*i/4,b=my*i/4;ctx.strokeStyle=p.hair;ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(x(a),y0);ctx.lineTo(x(a),y1);ctx.moveTo(x0,y(b));ctx.lineTo(x1,y(b));ctx.stroke();
   posterFitText(ctx,a.toFixed(2),x(a),y1+22,18,p.sub,'550','center',54);
   posterFitText(ctx,b.toFixed(2),x0-8,y(b)+6,18,p.sub,'550','right',52);
  }
  ctx.save();ctx.setLineDash([9,7]);ctx.strokeStyle=p.sub;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x(1),y0);ctx.lineTo(x(1),y1);ctx.moveTo(x0,y(1));ctx.lineTo(x1,y(1));ctx.stroke();ctx.restore();
  periods.forEach((name,i)=>{if(!Number.isFinite(xx[i])||!Number.isFinite(yy[i]))return;ctx.fillStyle=window.BrandUtils.color(name)||colors[i%colors.length];ctx.beginPath();ctx.arc(x(xx[i]),y(yy[i]),6,0,Math.PI*2);ctx.fill();});
  posterFitText(ctx,'横轴：头部销量富集指数',right,y1+46,20,p.sub,'600','right',width);
  periods.forEach((name,i)=>{const lx=left+(i%cols)*width/cols,ly=y1+65+Math.floor(i/cols)*legendStep;ctx.fillStyle=window.BrandUtils.color(name)||colors[i%colors.length];ctx.fillRect(lx,ly-12,15,7);posterFitText(ctx,name+'  '+(Number.isFinite(xx[i])&&Number.isFinite(yy[i])?xx[i].toFixed(2)+' / '+yy[i].toFixed(2):'—'),lx+22,ly,Math.min(20,legendStep*.77),p.ink,'600','left',width/cols-28);});
 }else{
  const labelW=Math.min(116,width*.20),numberW=Math.min(100,width*.17),x0=left+labelW,x1=right-numberW,y0=top+48,y1=bottom-40;
  const row=(y1-y0)/Math.max(1,periods.length),max=Math.max(1,...lines.flatMap(l=>l.values.filter(Number.isFinite)),baseline||0),maxV=max*1.08,x=v=>x0+v/maxV*(x1-x0);
  lines.forEach((l,i)=>{const lx=left+i*width/lines.length;ctx.fillStyle=l.color||colors[i];ctx.fillRect(lx,top+9,20,8);posterFitText(ctx,l.name,lx+26,top+20,22,p.ink,'600','left',width/lines.length-30);});
  if(baseline){ctx.save();ctx.strokeStyle=p.sub;ctx.setLineDash([8,6]);ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x(baseline),y0);ctx.lineTo(x(baseline),y1);ctx.stroke();ctx.restore();posterFitText(ctx,'1.00 基准',x(baseline),y0-6,16,p.sub,'550','center',95);}
  periods.forEach((name,i)=>{
   const cy=y0+(i+.5)*row;posterFitText(ctx,name,x0-12,cy+5,Math.min(27,row*.48),p.ink,'700','right',labelW-14);
   lines.forEach((l,j)=>{const v=l.values[i],bh=Math.min(22,(row*.72)/lines.length),gap=Math.min(5,row*.08),yy=cy+(j-(lines.length-1)/2)*(bh+gap)-bh/2;
    if(Number.isFinite(v)){ctx.fillStyle=l.color||colors[j%colors.length];ctx.fillRect(x0,yy,Math.max(0,x(v)-x0),bh);posterFitText(ctx,v.toFixed(2)+(unit==='%'?'%':''),x(v)+6,yy+bh*.86,Math.min(22,bh*.98),p.ink,'600','left',Math.min(numberW,right-x(v)-6));}
    else posterFitText(ctx,'—',x0+6,yy+bh*.86,Math.min(22,bh),p.sub,'600','left',numberW);
   });
  });
 }
 posterFitText(ctx,s.chartNote,left,noteY,21,p.sub,'550','left',width);
}

/* Module 2 style stacked bands; shared by live research canvas and PNG poster.
 * Geometry derives from the independently reserved horizontal and vertical bounds. */
function drawBrandComposition(ctx,chart,box,p,note=''){
 const {left,right,top,bottom,width,height}=box;
 const {periods,lines,unit,limit}=chart,n=periods.length;
 if(!n||!lines.length)return;
 const fmt=v=>v.toFixed(1)+(unit==='%'?'%':'');
 const valid=i=>lines.every(l=>Number.isFinite(l.values[i]));
 const totals=periods.map((_,i)=>valid(i)?lines.reduce((a,l)=>a+l.values[i],0):null);
 const maximum=Math.max(1,...totals.filter(Number.isFinite));
 const tick=Math.pow(10,Math.floor(Math.log10(maximum)))/2;
 const cap=limit||Math.ceil(maximum/tick)*tick;
 const pct=unit==='%';
 const f=Math.min(width/780,height/466,1.4);
 const textSize=Math.max(10,14*f),small=Math.max(9,12*f);
 const cols=Math.max(1,Math.min(lines.length,Math.floor(width/(108*Math.max(.8,f)))));
 const legRows=Math.ceil(lines.length/cols),legStep=Math.max(16,23*f),legH=legRows*legStep;
 const foot=note?Math.max(18,29*f):0;
 const legendY=bottom-foot-legH+legStep*.7;
 const drawText=(v,x,y,size,color=p.ink,weight='600',align='left',max=Infinity)=>posterFitText(ctx,v,x,y,size,color,weight,align,max);
 function rect(x,y,w,h,color){if(w<=0||h<=0)return;ctx.fillStyle=color;ctx.fillRect(x,y,w,h);}
 function line(x1,y1,x2,y2){ctx.strokeStyle=p.hair;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
 function segments(i,bottomY,plotH){
  let acc=bottomY;
  return lines.map(l=>{const v=l.values[i],h=v/cap*plotH,seg={v,h,top:acc-h,bottom:acc,mid:acc-h/2,color:l.color,name:l.name};acc-=h;return seg;});
 }
 if(chart.kind==='brandRibbon'){
  const L=left+width*.24,R=right-width*.25,bw=Math.min(width*.16,130*Math.max(.8,f)),y0=top+Math.max(33,49*f),y1=legendY-Math.max(24,36*f);
  const plotH=y1-y0;if(!auditPlot(ctx,R-L,plotH,'双周流向图',120,180))return;
  const base=segments(0,y1,plotH),comp=segments(1,y1,plotH);
  const lx=L-bw,rx=R;
  drawText('基准周',L-bw/2,top+textSize,textSize,p.ink,'800','center',bw+24);
  drawText(periods[0],L-bw/2,top+textSize+small+3,small,p.sub,'600','center',bw+32);
  drawText('对比周',R+bw/2,top+textSize,textSize,p.ink,'800','center',bw+24);
  drawText(periods[1],R+bw/2,top+textSize+small+3,small,p.sub,'600','center',bw+32);
  const c1=L+(R-L)*.45,c2=L+(R-L)*.55;
  base.forEach((s,i)=>{const t=comp[i];ctx.save();ctx.fillStyle=s.color;ctx.globalAlpha=.20;ctx.beginPath();ctx.moveTo(L,s.top);ctx.bezierCurveTo(c1,s.top,c2,t.top,R,t.top);ctx.lineTo(R,t.bottom);ctx.bezierCurveTo(c2,t.bottom,c1,s.bottom,L,s.bottom);ctx.closePath();ctx.fill();ctx.restore();});
  base.forEach((s,i)=>{
   const t=comp[i],d=t.v-s.v,delta=(d>0?'+':'')+(Math.abs(d)<.00005?'0.0':d.toFixed(1))+(pct?'pp':'万台');
   for(const [seg,x] of [[s,lx],[t,rx]]){
    if(seg.h>0){rounded(ctx,x,seg.top,bw,Math.max(0,seg.h-Math.min(1,seg.h*.1)),Math.min(4,seg.h/2),seg.color);if(seg.h>=small+5)drawText(fmt(seg.v),x+bw/2,seg.mid+small*.35,small,'#fff','800','center',bw-5);}
   }
   if(s.h>=small+2)drawText(s.name,lx-6,s.mid+small*.3,small,p.ink,'700','right',Math.max(10,lx-left-8));
   if(t.h>=small+2)drawText(delta,rx+bw+6,t.mid+small*.3,small,d>0?'#c93630':d<0?'#265a87':p.sub,'750','left',Math.max(10,right-rx-bw-6));
  });
  if(!pct)drawText('共同销量轴 · 峰值 '+cap.toFixed(1)+' 万台',left,y0-4,small,p.sub,'550','left',width*.25);
 }else{
  const x0=left+Math.max(36,57*f),x1=right-Math.max(10,18*f),y0=top+Math.max(16,22*f),y1=legendY-Math.max(35,48*f);
  const plotH=y1-y0,slot=(x1-x0)/n,bw=Math.min(slot*.72,92*Math.max(.8,f));
  if(!auditPlot(ctx,x1-x0,plotH,'多周堆叠图',260,180))return;
  if(bw<25)auditIssue(ctx,'周次较多，堆叠柱或内部标签较密集');
  for(let i=0;i<=4;i++){const v=cap*i/4,y=y1-plotH*i/4;line(x0,y,x1,y);drawText(Number(v.toFixed(2))+(pct?'%':''),x0-6,y+small*.3,small,p.sub,'550','right',x0-left-7);}
  drawText(unit,x0,top+small*.7,small,p.sub,'600');
  const stride=Math.max(1,Math.ceil(n/Math.max(1,Math.floor((x1-x0)/(65*Math.max(.8,f))))));
  periods.forEach((period,i)=>{
   const x=x0+slot*(i+.5);
   if(valid(i)){
    segments(i,y1,plotH).forEach(s=>{if(s.h<=0)return;rect(x-bw/2,s.top,bw,Math.max(0,s.h-Math.min(.65,s.h*.08)),s.color);if(s.h>=small+4&&bw>=36)drawText(fmt(s.v),x,s.mid+small*.3,small,'#fff','750','center',bw-3);});
   }else{
    ctx.save();ctx.strokeStyle=p.sub;ctx.setLineDash([3,4]);ctx.strokeRect(x-bw/2,y0,bw,plotH);ctx.restore();
    if(bw>=24)drawText('缺失',x,y0+plotH/2,small,p.sub,'600','center',bw);
   }
   if(i===0||i===n-1||(i%stride===0&&n-1-i>=stride*.65))drawText(String(period),x,y1+small+6,small,p.sub,'550','center',Math.min(105,slot*stride*.9));
  });
 }
 lines.forEach((l,i)=>{const x=left+(i%cols)*width/cols,y=legendY+Math.floor(i/cols)*legStep;rect(x,y-small*.68,small*.85,small*.7,l.color);drawText(l.name,x+small+4,y,small,p.ink,'600','left',width/cols-small-7);});
 if(note)drawText(note,left,bottom-3,small,p.sub,'550','left',width);
}

const ResearchCharts=(()=>{
 const COLORS=['#2563eb','#ea580c','#059669','#9333ea','#db2777','#0891b2','#92400e','#64748b','#be123c','#4d7c0f','#0369a1','#7c3aed'];
 function lineScale(chart,box){
  const n=chart.periods.length,max=chart.lines.reduce((m,l)=>l.values.reduce((a,v)=>Number.isFinite(v)?Math.max(a,v):a,m),1);
  const step=Math.pow(10,Math.floor(Math.log10(max)))/2,top=chart.limit||Math.ceil(max/step)*step;
  return {top,x:i=>n===1?(box.left+box.right)/2:box.left+i*(box.right-box.left)/Math.max(1,n-1),y:v=>box.bottom-v/top*(box.bottom-box.top)};
 }
 function points(chart,scale,visit){
  chart.lines.forEach((l,j)=>{const color=l.color||COLORS[j%COLORS.length];l.values.forEach((v,i)=>{
   if(!Number.isFinite(v))return;
   const prev=i>0&&Number.isFinite(l.values[i-1]),estimated=!!l.imputed?.[i];
   visit({name:l.name,period:chart.periods[i],value:v,color,x:scale.x(i),y:scale.y(v),estimated,previous:prev?{x:scale.x(i-1),y:scale.y(l.values[i-1]),dashed:estimated||!!l.imputed?.[i-1]}:null});
  });});
 }
 function svgLine(host,legend,chart,label,precision=2){
  const n=chart.periods.length;if(!n||!chart.lines.length)return;
  const W=Math.max(720,n*48+110),H=310,L=56,R=W-55,T=25,B=265;
  const scale=lineScale(chart,{left:L,right:R,top:T,bottom:B}),{top,x,y}=scale;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let content='<text x="'+L+'" y="13" font-size="11" fill="currentColor">'+esc(chart.unit)+'</text>';
  for(let i=0;i<=4;i++){const v=top*i/4;content+='<line x1="'+L+'" x2="'+R+'" y1="'+y(v)+'" y2="'+y(v)+'" stroke="currentColor" opacity=".14"/><text x="'+(L-8)+'" y="'+(y(v)+4)+'" text-anchor="end" fill="currentColor" font-size="11">'+Number(v.toFixed(2))+'</text>';}
  const stride=Math.max(1,Math.ceil(n/15));chart.periods.forEach((w,i)=>{if(i%stride===0||i===n-1)content+='<text x="'+x(i)+'" y="'+(B+20)+'" text-anchor="middle" fill="currentColor" font-size="10">'+esc(w)+'</text>';});
  points(chart,scale,p=>{const color=esc(p.color);if(p.previous)content+='<line x1="'+p.previous.x+'" y1="'+p.previous.y+'" x2="'+p.x+'" y2="'+p.y+'" stroke="'+color+'" stroke-width="2.5" '+(p.previous.dashed?'stroke-dasharray="6 4"':'')+'/>';
   content+='<circle cx="'+p.x+'" cy="'+p.y+'" r="3.5" stroke="'+color+'" stroke-width="2" fill="'+(p.estimated?'white':color)+'"><title>'+esc(p.name+' · '+p.period+' · '+p.value.toFixed(precision)+' '+chart.unit+(p.estimated?'（含插补）':''))+'</title></circle>';
  });
  chart.lines.forEach((l,i)=>{const span=document.createElement('span');span.style.color=l.color||COLORS[i%COLORS.length];span.textContent='● '+l.name;legend.append(span);});
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 '+W+' '+H);svg.setAttribute('role','img');svg.setAttribute('aria-label',label);svg.style.cssText='width:100%;min-width:560px';svg.innerHTML=content;host.append(svg);
 }
 function canvasLine(ctx,chart,scale){
  points(chart,scale,p=>{if(p.previous){ctx.save();ctx.strokeStyle=p.color;ctx.lineWidth=4;ctx.setLineDash(p.previous.dashed?[11,8]:[]);ctx.beginPath();ctx.moveTo(p.previous.x,p.previous.y);ctx.lineTo(p.x,p.y);ctx.stroke();ctx.restore();}
   ctx.beginPath();ctx.arc(p.x,p.y,chart.periods.length>35?3.5:5,0,Math.PI*2);ctx.fillStyle=p.estimated?'#ffffff':p.color;ctx.strokeStyle=p.color;ctx.lineWidth=2.5;ctx.fill();ctx.stroke();
  });
 }
 function renderComposition(host,chart,label){
  const W=chart.kind==='brandStack'?Math.max(780,chart.periods.length*78+120):850,H=chart.kind==='scatter'?560:510;
  const canvas=document.createElement('canvas'),density=Math.min(2,window.devicePixelRatio||1);
  canvas.width=Math.round(W*density);canvas.height=Math.round(H*density);canvas.style.cssText='display:block;width:100%;min-width:620px;background:#fff;border-radius:10px';
  canvas.setAttribute('role','img');canvas.setAttribute('aria-label',label+'；完整数值见数据表');
  const ctx=canvas.getContext('2d');ctx.setTransform(density,0,0,density,0,0);ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);
  const box={left:16,right:W-16,top:16,bottom:H-16,width:W-32,height:H-32},p={ink:'#17263c',sub:'#64748b',hair:'#e4e9f0',accent:'#c93630',bar:'#265a87'};
  if(chart.kind==='scatter'||chart.kind==='bars')drawHeadStaticPoster(ctx,null,p,{chart,chartNote:''},box);else drawBrandComposition(ctx,chart,box,p,'');
  host.append(canvas);
 }
 return Object.freeze({lineScale,points,svgLine,canvasLine,renderComposition});
})();
