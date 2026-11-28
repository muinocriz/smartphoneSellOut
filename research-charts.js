/* Shared chart rendering and typography. SVG line previews retain point tooltips; Canvas exports use identical point geometry. */
const CJK_FONT=ImageFonts.sans;
const NUM_FONT=ImageFonts.mono;
// Standalone and middle-dot-separated numeric values use the numeric font; prose retains the body font.
const CANVAS_NUMERIC_PATTERN=/^[+\-−]?\d[\d.,:/–-]*(?:\s*(?:%|％|pp|倍|万台|台|px))?(?:\s*[·•]\s*[+\-−]?\d[\d.,:/–-]*(?:\s*(?:%|％|pp|倍|万台|台|px))?)*$/;
function measureMixedCanvas(ctx,text,size,weight='600'){
 weight=posterBodyWeight(ctx,weight);const runs=PosterThemes.numericTextRuns(text,CANVAS_NUMERIC_PATTERN);let width=0;
 const measured=runs.map(run=>{ctx.font=posterFont(ctx,size,weight,run.number?NUM_FONT:CJK_FONT);const m=ctx.measureText(run.text),w=m.width;width+=w;return {...run,width:w,ascent:m.actualBoundingBoxAscent??size*.8,descent:m.actualBoundingBoxDescent??size*.2}});
 return {runs:measured,width};
}
function canvasText(ctx,text,x,y,size,color,weight='600',align='left',maxWidth=null){
 const original=String(text??'');weight=posterBodyWeight(ctx,weight);ctx.save();ctx.fillStyle=color;ctx.textBaseline='alphabetic';
 const measured=measureMixedCanvas(ctx,original,size,weight);
 const scale=maxWidth!==null&&measured.width>maxWidth?maxWidth/measured.width:1;
 if(original.trim()&&mobilePosterActive(ctx)&&size*scale<posterReadabilityMin(ctx))
  auditIssue(ctx,'部分文字低于当前手机阅读目标，建议精简重复信息或减少展示项目');
 let start=x-(align==='right'?measured.width*scale:align==='center'?measured.width*scale/2:0);
 PosterTypography.auditText(ctx,x,y,measured.width*scale,Math.max(0,...measured.runs.map(r=>r.ascent)),Math.max(0,...measured.runs.map(r=>r.descent)),align);
 // 独立数字行使用字形左边界做光学补偿（特别是数字 1）。
 if(align==='left'&&/^[+\-−]?\d[\d.,:%％×\s+\-−]*$/.test(original)){
  ctx.font=posterFont(ctx,size,weight,NUM_FONT);
  start-=Math.max(0,ctx.measureText(original).actualBoundingBoxLeft||0)*scale;
 }
 ctx.translate(start,y);ctx.scale(scale,1);ctx.textAlign='left';let offset=0;
 for(const run of measured.runs){ctx.font=posterFont(ctx,size,weight,run.number?NUM_FONT:CJK_FONT);ctx.fillText(run.text,offset,0);offset+=run.width}
 ctx.restore();
}
function rounded(ctx,x,y,w,h,r,color){if(w<=0||h<=0)return;ctx.beginPath();const rad=Math.min(r,w/2,h/2);ctx.roundRect(x,y,w,h,rad);ctx.fillStyle=color;ctx.fill()}
// Tail-only scatter: the same renderer serves preview and every PNG route.
function drawTailScatter(ctx,chart,box,p){
 const {left,right,top,bottom,width,height}=box,xx=chart.lines[0].values,yy=chart.lines[1].values,points=chart.tailPoints;
 const showWhisker=Boolean(chart.showWhisker);
 const f=Math.min(width/800,height/530,1.5),font=Math.max(12,15*f),small=Math.max(11,13*f);
 const legendExtra=mobilePosterActive(ctx)?Math.max(0,posterAxisLegendDistance(ctx,[chart.xLabel],font,['末周在榜','末周未上榜','末周未知'],small,4*f+Math.max(3,4.3*f)+Math.max(1.5,1.8*f)/2,'600','600')-24*f):0;
 const minX=84,maxX=Math.max(392,Math.ceil((Math.max(...xx)+20)/70)*70);
 const {ticks:yTicks,high:maxY}=SalesChartLayout.integerAxis(0,Math.max(1,...yy));
 const mobile=mobilePosterActive(ctx),step=Math.max(70,Math.ceil((maxX-minX)/6/70)*70),xTicks=[];for(let v=Math.ceil(minX/step)*step;v<=maxX;v+=step)xTicks.push(v);
 const xLayout=mobile?posterXAxisLayout(ctx,xTicks):null,extra=mobile?Math.max(0,xLayout.height+posterDp(4)+posterTypeSize('axisTitle',font)-40*f):0;
 const x0=left+(mobile?posterAxisGutter(ctx,yTicks):58*f),x1=right-24*f,y0=top+58*f,y1=bottom-106*f-legendExtra-extra;
 if(!auditPlot(ctx,x1-x0,y1-y0,'长尾韧性散点绘图区',260,160))return;
 const x=v=>x0+(v-minX)/(maxX-minX)*(x1-x0),y=v=>y1-v/maxY*(y1-y0);
 const color=p.bar||'#3167a4',ringAccent=p.accent||'#ea580c',bands=[[84,189,'W13–W26'],[189,371,'W27–W52'],[371,maxX,'W53及以上']];
 bands.forEach(([lo,hi,label],i)=>{ctx.save();ctx.fillStyle=color;ctx.globalAlpha=.045+i*.035;ctx.fillRect(x(lo),y0,x(hi)-x(lo),y1-y0);ctx.restore();posterRoleCanvas(ctx,'chartLabel',label,(x(lo)+x(hi))/2,y0-10*f,small,p.sub,'600','center',x(hi)-x(lo)-4);});
 for(const v of yTicks){
  ctx.strokeStyle=p.hair;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x0,y(v));ctx.lineTo(x1,y(v));ctx.stroke();if(mobile)posterYAxisTick(ctx,String(v),x0,y(v),p);else posterRoleCanvas(ctx,'axis',String(v),x0-8*f,y(v)+4*f,small,p.sub,'500','right');
 }
 for(const v of xTicks){ctx.strokeStyle=p.hair;ctx.beginPath();ctx.moveTo(x(v),y0);ctx.lineTo(x(v),y1);ctx.stroke();if(mobile)posterXAxisTick(ctx,String(v),x(v),y1,xLayout,p);else posterRoleCanvas(ctx,'axis',String(v),x(v),y1+20*f,small,p.sub,'500','center');}
 ctx.strokeStyle=p.sub;ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x0,y1);ctx.lineTo(x1,y1);ctx.stroke();
 posterRoleCanvas(ctx,'axisTitle',chart.yLabel,left,top+17*f,font,p.ink,'600');
 posterRoleCanvas(ctx,'axisTitle',chart.xLabel,right,y1+40*f+extra,font,p.sub,'600','right');
 const radius=n=>Math.max(3,4.3*f*Math.sqrt(n));
 const ringGap=Math.max(2.5,3.2*f);
 if(showWhisker){
  points.forEach((point,i)=>{
   if(!Number.isFinite(point.windowMeanLower)||!Number.isFinite(point.windowMeanUpper)||point.recentCount>=point.recentKnown)return;
   const px=x(xx[i]),pyMean=y(yy[i]),pyHi=y(point.windowMeanUpper),pyLo=y(point.windowMeanLower);
   ctx.save();
   ctx.strokeStyle=p.sub;ctx.globalAlpha=.72;ctx.lineWidth=Math.max(1.1,1.3*f);ctx.setLineDash([3*f,2.5*f]);
   ctx.beginPath();ctx.moveTo(px,pyMean);ctx.lineTo(px,pyLo);ctx.stroke();
   ctx.setLineDash([]);ctx.lineWidth=Math.max(1.6,2*f);
   ctx.beginPath();ctx.moveTo(px-5*f,pyHi);ctx.lineTo(px+5*f,pyHi);ctx.stroke();
   ctx.lineWidth=Math.max(1,1.2*f);
   ctx.beginPath();ctx.moveTo(px-3.2*f,pyLo);ctx.lineTo(px+3.2*f,pyLo);ctx.stroke();
   ctx.restore();
  });
 }
 function marker(px,py,n,status,rate){
  const r=radius(n);
  ctx.save();ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=Math.max(1.5,1.8*f);if(status==='unknown')ctx.setLineDash([3*f,2*f]);ctx.beginPath();ctx.arc(px,py,r,0,Math.PI*2);if(status==='in')ctx.fill();ctx.stroke();ctx.restore();
  if(Number.isFinite(rate)){
   const rr=r+ringGap,ratio=Math.max(0,Math.min(1,rate/100));
   ctx.save();ctx.strokeStyle=p.hair;ctx.lineWidth=Math.max(1.4,1.8*f);ctx.beginPath();ctx.arc(px,py,rr,0,Math.PI*2);ctx.stroke();
   ctx.strokeStyle=ratio>=0.99?color:ringAccent;ctx.lineWidth=Math.max(1.6,2*f);ctx.lineCap='round';
   ctx.beginPath();ctx.arc(px,py,rr,-Math.PI/2,-Math.PI/2+Math.PI*2*ratio);ctx.stroke();ctx.restore();
  }
 }
 const occupied=points.map((point,i)=>{const rr=radius(point.recentCount)+(Number.isFinite(point.recentRate)?ringGap+2*f:2);return {x:x(xx[i])-rr,y:y(yy[i])-rr,w:2*rr,h:2*rr};});
 points.forEach((point,i)=>marker(x(xx[i]),y(yy[i]),point.recentCount,point.lastStatus,point.recentRate));
 const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
 points.forEach((point,i)=>{
  const px=x(xx[i]),py=y(yy[i]),r=radius(point.recentCount)+(Number.isFinite(point.recentRate)?ringGap+f:0),label=chart.periods[i],w=Math.min(width*.28,posterRoleMeasure(ctx,'chartLabel',label,small,'600').width),h=posterTypeSize('chartLabel',small)*1.25;
  const candidates=[[r+4,-h-3],[-w-r-4,-h-3],[r+4,3],[-w-r-4,3],[-w/2,-r-h-3],[-w/2,r+3]];
  let best=null,score=Infinity;
  for(const [dx,dy] of candidates){const b={x:Math.max(x0,Math.min(x1-w,px+dx)),y:Math.max(y0,Math.min(y1-h,py+dy)),w,h};const s=occupied.filter(o=>overlaps(o,b)).length;if(s<score){score=s;best=b;}}
  if(best){occupied.push(best);posterRoleCanvas(ctx,'chartLabel',label,best.x,best.y+h*.85,small,p.ink,'600','left',w);}
 });
 const ly=y1+60*f+legendExtra+extra,legW=width/3;
 [['in','末周在榜'],['out','末周未上榜'],['unknown','末周未知']].forEach(([status,label],i)=>{const lx=left+12*f+i*legW;marker(lx,ly,1,status,100);posterRoleCanvas(ctx,'legend',label,lx+14*f,ly+4*f,small,p.sub,'600','left',legW-24*f);});
 const note='气泡面积 ∝ 近期上榜次数 · 外环弧长 = 近期在榜率'+(showWhisker?' · 向下须线 = 窗口均销区间（横杠为门槛上界）':'')+' · 年龄分区为近似界线';
 posterRoleCanvas(ctx,'chartNote',note,left,bottom-8*f,small,p.sub,'500','left',width);
}
function drawHeadStaticPoster(ctx,p,s,box){
 if(s.chart.tail){drawTailScatter(ctx,s.chart,box,p);return;}
 const {kind,periods,lines,unit,baseline}=s.chart;
 const {left,right,top,bottom,width,height}=box;
 const colors=['#2563eb','#ea580c','#059669','#9333ea','#db2777','#0891b2','#92400e','#64748b'];
 const noteY=bottom-12;
 if(!auditPlot(ctx,width,height,'品牌分析图',360,230))return;
 if(kind==='scatter'){
  const xx=lines[0].values,yy=lines[1].values;
  const cols=2,legendRows=Math.ceil(periods.length/cols);
  const legendStep=Math.min(29,height*.065),legendH=legendRows*legendStep;
  const legendSize=Math.min(20,legendStep*.77),legendExtra=mobilePosterActive(ctx)?Math.max(0,posterAxisLegendDistance(ctx,[s.chart.xLabel||'头部销量富集指数'],20,periods,legendSize,12,'600','600')-19):0;
  const minimum=s.chart.xLabel?0.01:1.25,mx=Math.max(minimum,...xx.filter(Number.isFinite))*1.1;
  const {ticks:yTicks,high:my}=SalesChartLayout.integerAxis(0,Math.max(1,...yy.filter(Number.isFinite)));
  const mobile=mobilePosterActive(ctx),xLayout=mobile?posterXAxisLayout(ctx,Array.from({length:5},(_,i)=>(mx*i/4).toFixed(2))):null,extra=mobile?Math.max(0,xLayout.height+posterDp(4)+posterTypeSize('axisTitle',20)-46):0;
  const x0=left+(mobile?posterAxisGutter(ctx,yTicks):62),x1=right-22,y0=top+28,y1=bottom-legendH-86-legendExtra-extra;
  if(!auditPlot(ctx,x1-x0,y1-y0,'四象限绘图区',260,160))return;
  const x=v=>x0+v/mx*(x1-x0),y=v=>y1-v/my*(y1-y0);
  posterRoleFit(ctx,'axisTitle','纵轴：'+(s.chart.yLabel||'单品销量强度指数'),left,top+17,22,p.sub,'600','left',width);
  for(let i=0;i<=4;i++){
   const a=mx*i/4;ctx.strokeStyle=p.hair;ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(x(a),y0);ctx.lineTo(x(a),y1);ctx.stroke();
   if(mobile)posterXAxisTick(ctx,a.toFixed(2),x(a),y1,xLayout,p,(x1-x0)/4);else posterRoleFit(ctx,'axis',a.toFixed(2),x(a),y1+22,18,p.sub,'550','center',54);
  }
  for(const b of yTicks){
   ctx.beginPath();ctx.moveTo(x0,y(b));ctx.lineTo(x1,y(b));ctx.stroke();
   if(mobile)posterYAxisTick(ctx,String(b),x0,y(b),p);else posterRoleFit(ctx,'axis',String(b),x0-8,y(b)+6,18,p.sub,'550','right',52);
  }
  if(!s.chart.xLabel){ctx.save();ctx.setLineDash([9,7]);ctx.strokeStyle=p.sub;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x(1),y0);ctx.lineTo(x(1),y1);ctx.moveTo(x0,y(1));ctx.lineTo(x1,y(1));ctx.stroke();ctx.restore();}
  periods.forEach((name,i)=>{if(!Number.isFinite(xx[i])||!Number.isFinite(yy[i]))return;ctx.fillStyle=window.BrandUtils.color(name)||colors[i%colors.length];ctx.beginPath();ctx.arc(x(xx[i]),y(yy[i]),6,0,Math.PI*2);ctx.fill();});
  posterRoleFit(ctx,'axisTitle','横轴：'+(s.chart.xLabel||'头部销量富集指数'),right,y1+46+extra,20,p.sub,'600','right',width);
  periods.forEach((name,i)=>{const lx=left+(i%cols)*width/cols,ly=y1+65+extra+legendExtra+Math.floor(i/cols)*legendStep;ctx.fillStyle=window.BrandUtils.color(name)||colors[i%colors.length];ctx.fillRect(lx,ly-12,15,7);posterRoleFit(ctx,'legend',name+'  '+(Number.isFinite(xx[i])&&Number.isFinite(yy[i])?xx[i].toFixed(2)+' / '+yy[i].toFixed(2):'—'),lx+22,ly,Math.min(20,legendStep*.77),p.ink,'600','left',width/cols-28);});
 }else{
  const labelW=Math.min(116,width*.20),numberW=Math.min(100,width*.17),x0=left+labelW,x1=right-numberW,y0=top+48,y1=bottom-40;
  const row=(y1-y0)/Math.max(1,periods.length),max=Math.max(1,...lines.flatMap(l=>l.values.filter(Number.isFinite)),baseline||0),maxV=max*1.08,x=v=>x0+v/maxV*(x1-x0);
  lines.forEach((l,i)=>{const lx=left+i*width/lines.length;ctx.fillStyle=l.color||colors[i];ctx.fillRect(lx,top+9,20,8);posterRoleFit(ctx,'legend',l.name,lx+26,top+20,22,p.ink,'600','left',width/lines.length-30);});
  if(baseline){ctx.save();ctx.strokeStyle=p.sub;ctx.setLineDash([8,6]);ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x(baseline),y0);ctx.lineTo(x(baseline),y1);ctx.stroke();ctx.restore();posterRoleFit(ctx,'chartLabel','1.00 基准',x(baseline),y0-6,16,p.sub,'550','center',95);}
  periods.forEach((name,i)=>{
   const cy=y0+(i+.5)*row;posterRoleFit(ctx,'chartLabel',name,x0-12,cy+5,Math.min(27,row*.48),p.ink,'700','right',labelW-14);
   lines.forEach((l,j)=>{const v=l.values[i],bh=Math.min(22,(row*.72)/lines.length),gap=Math.min(5,row*.08),yy=cy+(j-(lines.length-1)/2)*(bh+gap)-bh/2;
    if(Number.isFinite(v)){ctx.fillStyle=l.color||colors[j%colors.length];ctx.fillRect(x0,yy,Math.max(0,x(v)-x0),bh);posterRoleFit(ctx,'chartValue',v.toFixed(2)+(unit==='%'?'%':''),x(v)+6,yy+bh*.86,Math.min(22,bh*.98),p.ink,'600','left',Math.min(numberW,right-x(v)-6));}
    else posterRoleFit(ctx,'chartValue','—',x0+6,yy+bh*.86,Math.min(22,bh),p.sub,'600','left',numberW);
   });
  });
 }
 posterRoleFit(ctx,'chartNote',s.chartNote,left,noteY,21,p.sub,'550','left',width);
}


/* Shared ribbon geometry for every chronological multiweek stacked chart.
 * Each column supplies a left/right edge plus stable category keys; null columns
 * break the connection. This paints behind the bars without changing any values. */
function drawAdjacentStackRibbons(ctx,columns){
 for(let i=0;i<columns.length-1;i++){
  const previous=columns[i],next=columns[i+1];
  if(!previous||!next||!Number.isFinite(previous.right)||!Number.isFinite(next.left)||next.left<=previous.right)continue;
  const lhs=previous.right,rhs=next.left,c1=lhs+(rhs-lhs)*.43,c2=lhs+(rhs-lhs)*.57;
  const following=new Map(next.segments.map(s=>[s.key,s]));
  for(const seg of previous.segments){
   const target=following.get(seg.key);
   if(!target||!(seg.h>0||target.h>0))continue;
   if(![seg.top,seg.bottom,target.top,target.bottom].every(Number.isFinite))continue;
   ctx.save();ctx.fillStyle=seg.color;ctx.globalAlpha=.19;
   ctx.beginPath();ctx.moveTo(lhs,seg.top);ctx.bezierCurveTo(c1,seg.top,c2,target.top,rhs,target.top);
   ctx.lineTo(rhs,target.bottom);ctx.bezierCurveTo(c2,target.bottom,c1,seg.bottom,lhs,seg.bottom);
   ctx.closePath();ctx.fill();ctx.restore();
  }
 }
}

/* Stacked bands based on the retired Market Share page; shared by live research canvas and PNG poster.
 * Geometry derives from the independently reserved horizontal and vertical bounds. */
function drawBrandComposition(ctx,chart,box,p,note=''){
 const {left,right,top,bottom,width,height}=box;
 const {periods,lines,unit,limit}=chart,n=periods.length;
 if(!n||!lines.length)return;
 const fmt=v=>v.toFixed(1)+(unit==='%'?'%':'');
 const valid=i=>lines.every(l=>Number.isFinite(l.values[i]));
 const totals=periods.map((_,i)=>valid(i)?lines.reduce((a,l)=>a+l.values[i],0):null);
 const maximum=Math.max(1,...totals.filter(Number.isFinite));
 const {high:cap,ticks:yTicks}=SalesChartLayout.integerAxis(0,limit||maximum);
 const pct=unit==='%';
 const f=Math.min(width/780,height/466,1.4);
 const textSize=Math.max(10,14*f),small=Math.max(9,12*f);
 const cols=Math.max(1,Math.min(lines.length,Math.floor(width/(108*Math.max(.8,f)))));
 const mobile=mobilePosterActive(ctx),legend=mobile?posterLegendLayout(ctx,lines,left,width):null;
 if(mobile&&!legend)return;
 const legStep=Math.max(16,23*f),foot=note?Math.max(18,29*f):0;
 const legendTop=bottom-foot-(legend?.height??Math.ceil(lines.length/cols)*legStep);
 const legendY=legendTop+(legend?.size??legStep*.7);
 const drawText=(role,v,x,y,size,color=p.ink,weight='600',align='left',max=Infinity)=>posterRoleFit(ctx,role,v,x,y,size,color,weight,align,max);
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
  drawText('axisTitle','基准周',L-bw/2,top+textSize,textSize,p.ink,'800','center',bw+24);
  drawText('axis',periods[0],L-bw/2,top+textSize+small+3,small,p.sub,'600','center',bw+32);
  drawText('axisTitle','对比周',R+bw/2,top+textSize,textSize,p.ink,'800','center',bw+24);
  drawText('axis',periods[1],R+bw/2,top+textSize+small+3,small,p.sub,'600','center',bw+32);
  const c1=L+(R-L)*.45,c2=L+(R-L)*.55;
  base.forEach((s,i)=>{const t=comp[i];ctx.save();ctx.fillStyle=s.color;ctx.globalAlpha=.20;ctx.beginPath();ctx.moveTo(L,s.top);ctx.bezierCurveTo(c1,s.top,c2,t.top,R,t.top);ctx.lineTo(R,t.bottom);ctx.bezierCurveTo(c2,t.bottom,c1,s.bottom,L,s.bottom);ctx.closePath();ctx.fill();ctx.restore();});
  base.forEach((s,i)=>{
   const t=comp[i],d=t.v-s.v,delta=(d>0?'+':'')+(Math.abs(d)<.00005?'0.0':d.toFixed(1))+(pct?'pp':'万台');
   for(const [seg,x] of [[s,lx],[t,rx]]){
    if(seg.h>0){rounded(ctx,x,seg.top,bw,Math.max(0,seg.h-Math.min(1,seg.h*.1)),Math.min(4,seg.h/2),seg.color);if(mobile)posterStackSegmentValue(ctx,fmt(seg.v),x+bw/2,seg.mid,bw,seg.h,'#fff');else if(seg.h>=small+5)drawText('stackValue',fmt(seg.v),x+bw/2,seg.mid+small*.35,small,'#fff','800','center',bw-5);}
   }
   if(s.h>=small+2)drawText('stackLabel',s.name,lx-6,s.mid+small*.3,small,p.ink,'700','right',Math.max(10,lx-left-8));
   if(t.h>=small+2)drawText('chartValue',delta,rx+bw+6,t.mid+small*.3,small,d>0?'#c93630':d<0?'#265a87':p.sub,'750','left',Math.max(10,right-rx-bw-6));
  });
  if(!pct)drawText('axisTitle','共同销量轴 · 峰值 '+cap.toFixed(1)+' 万台',left,y0-4,small,p.sub,'550','left',width*.25);
 }else{
  const weekly=periods.every(v=>/^\d{4}-W\d{2}$/.test(String(v))),posterWeeks=weekly&&mobile;
  const axisLabels=periods.map(v=>weekly?posterWeekLabel(v,periods):String(v)),axisLayout=mobile?posterXAxisLayout(ctx,axisLabels):null;
  const axisBaselineOffset=mobile?axisLayout.baseline:small+6;
  const reserve=mobile?axisBaselineOffset+posterAxisLegendDistance(ctx,axisLabels,MOBILE_POSTER_TYPE.axis,lines.map(l=>l.name),legend.size,legend.size*.33+posterDp(3)):Math.max(35,48*f);
  const tickLabel=v=>String(v)+(pct?'%':'');
  const x0=left+(mobile?posterAxisGutter(ctx,yTicks,tickLabel):Math.max(36,57*f)),x1=right-Math.max(10,18*f),y0=top+(mobile?posterDp(19):Math.max(16,22*f)),y1=legendY-reserve;
  const plotH=y1-y0,slot=(x1-x0)/n,preferred=Math.min(slot*.72,92*Math.max(.8,f));
  const bw=mobile?posterStackBarWidth(ctx,slot,preferred,lines.flatMap(l=>l.values.filter(Number.isFinite).filter(v=>v>0).map(fmt))):preferred;
  if(!auditPlot(ctx,x1-x0,plotH,'多周堆叠图',260,180))return;
  if(bw<3){auditIssue(ctx,'堆叠柱过密，无法清楚区分各类别',true);return;}
  if(bw<25)auditIssue(ctx,'周次较多，堆叠柱或内部标签较密集');
  if(mobile){
   posterYTicks(ctx,yTicks,v=>y1-v/cap*plotH,x0,x1,p,tickLabel);
   researchPosterAxisText(ctx,unit,x0,y0-posterDp(5),'title',p.sub,'left',x1-x0);
  }else{
   for(const v of yTicks){const y=y1-v/cap*plotH;line(x0,y,x1,y);drawText('axis',tickLabel(v),x0-6,y+small*.3,small,p.sub,'550','right',x0-left-7);}
   drawText('axisTitle',unit,x0,top+small*.7,small,p.sub,'600');
  }
  const stride=Math.max(1,Math.ceil(n/Math.max(1,Math.floor((x1-x0)/(65*Math.max(.8,f))))));
  // Chronological category stacks (brands, price bands, chips, ages) use
  // exactly the same ribbon geometry as the cross-module dual multiweek view.
  // Non-time-axis matrices deliberately omit connectAdjacentBands.
  if(chart.kind==='brandStack'&&(chart.connectAdjacentBands||chart.connectAdjacentBrands)){
   const columns=periods.map((_,i)=>{
    if(!valid(i))return null;
    const cx=x0+slot*(i+.5);
    return {left:cx-bw/2,right:cx+bw/2,segments:segments(i,y1,plotH).map((seg,j)=>({...seg,key:lines[j].name}))};
   });
   drawAdjacentStackRibbons(ctx,columns);
  }
  periods.forEach((period,i)=>{
   const x=x0+slot*(i+.5);
   if(valid(i)){
    segments(i,y1,plotH).forEach(s=>{if(s.h<=0)return;rect(x-bw/2,s.top,bw,Math.max(0,s.h-Math.min(.65,s.h*.08)),s.color);if(mobile)posterStackSegmentValue(ctx,fmt(s.v),x,s.mid,bw,s.h,'#fff');else if(s.h>=small+4&&bw>=36)drawText('stackValue',fmt(s.v),x,s.mid+small*.3,small,'#fff','750','center',bw-3);});
   }else{
    ctx.save();ctx.strokeStyle=p.sub;ctx.setLineDash([3,4]);ctx.strokeRect(x-bw/2,y0,bw,plotH);ctx.restore();
    if(bw>=24)drawText('chartLabel','缺失',x,y0+plotH/2,small,p.sub,'600','center',bw);
   }
   if(!posterWeeks&&(i===0||i===n-1||(i%stride===0&&n-1-i>=stride*.65))){if(mobile)posterXAxisTick(ctx,axisLabels[i],x,y1,axisLayout,p,slot*stride*.9);else drawText('axis',axisLabels[i],x,y1+small+6,small,p.sub,'550','center',Math.min(105,slot*stride*.9));}
  });
   if(posterWeeks)posterWeekTicks(ctx,periods,i=>x0+slot*(i+.5),y1,x0,x1,p);
 }
 if(legend)drawPosterLegend(ctx,legend,legendTop,p,true);
 else lines.forEach((l,i)=>{const x=left+(i%cols)*width/cols,y=legendY+Math.floor(i/cols)*legStep;rect(x,y-small*.68,small*.85,small*.7,l.color);posterCompactLegendText(ctx,l.name,x+small+4,y,p.ink,small,'600','left',width/cols-small-7);});
 if(note)drawText('chartNote',note,left,bottom-3,small,p.sub,'550','left',width);
}



/* Multiweek TOP30 / market stacked columns with ribbons BETWEEN adjacent valid weeks.
 * Missing observations stay blank and sever ribbons; no pp column or extreme highlights. */
function drawDualBrandFlowMulti(ctx,chart,box,p,note=''){
 const {left,right,top,bottom,width,height}=box,panels=chart.panels||[],periods=chart.periods||[];
 if(panels.length!==2||!periods.length)return;
 if(!auditPlot(ctx,width,height,'TOP30与全市场多周堆叠流向图',380,380))return;
 const f=Math.min(1.12,width/1050,height/1010),gap=Math.max(12,20*f),
       subtitleSize=Math.max(10,Math.min(17,15*f)),labelSize=Math.max(10,Math.min(19,17*f)),
       titleSize=Math.max(14,Math.min(27,23*f)),legendH=Math.max(28,39*f),
       noteH=note?Math.max(22,30*f):0,
       mobile=mobilePosterActive(ctx),axisLayout=mobile?posterWeekLayout(ctx,periods):null,
       axisBottomPad=mobile?axisLayout.height+POSTER_SPACE.xs:Math.max(33,42*f),axisBaselineOffset=mobile?axisLayout.baseline:Math.max(17,20*f),
       legendExtra=mobilePosterActive(ctx)?Math.max(0,posterAxisLegendDistance(ctx,periods.map(v=>posterWeekLabel(v,periods)),MOBILE_POSTER_TYPE.axis,window.BrandUtils.groups.filter(g=>g.id!=='other').map(g=>g.label),MOBILE_POSTER_TYPE.legend,Math.max(10,17*f)*.72)-(gap/2+axisBottomPad-axisBaselineOffset)):0,
       panelH=(height-legendH-noteH-gap*2-legendExtra)/2;
 if(panelH<165){auditIssue(ctx,'多周堆叠流向图空间不足，可使用9:16图卡',true);return;}
 const brands=window.BrandUtils.groups.filter(g=>g.id!=='other');
 const draw=(role,s,x,y,size,color=p.ink,weight='600',align='left',max=Infinity)=>
  posterRoleFit(ctx,role,s,x,y,size,color,weight,align,max);
 function drawPanel(panel,y){
  const x=left,w=width,h=panelH;
  rounded(ctx,x+1,y+1,w-2,h-2,Math.max(6,10*f),'#ffffff');
  ctx.save();ctx.strokeStyle=p.hair;ctx.lineWidth=Math.max(1,1.2*f);
  ctx.beginPath();ctx.roundRect(x+1,y+1,w-2,h-2,Math.max(6,10*f));ctx.stroke();ctx.restore();
  const chipW=Math.max(68,84*f),chipX=x+Math.max(9,17*f),chipY=y+Math.max(9,12*f),
        chipH=Math.max(21,28*f);
  rounded(ctx,chipX,chipY,chipW,chipH,chipH/2,'#3b82f6');
  draw('axisTitle',panel.key==='top'?'TOP30':'全市场',chipX+chipW/2,chipY+chipH*.73,labelSize,'#ffffff','800','center',chipW-6);
  draw('axisTitle',panel.title||'',chipX+chipW+Math.max(10,15*f),chipY+chipH*.75,titleSize,p.ink,'800','left',w-chipW-55);
  draw('chartLabel',panel.subtitle||'',chipX,y+Math.max(57,64*f),subtitleSize,p.sub,'500','left',w-30);
  const x0=x+(mobile?POSTER_SPACE.xs+posterAxisGutter(ctx,[0,25,50,75,100],v=>v+'%'):Math.max(54,62*f)),x1=x+w-Math.max(11,20*f),
        y0=y+Math.max(76,89*f),y1=y+h-axisBottomPad,
        plotW=x1-x0,plotH=y1-y0,slot=plotW/periods.length,
        preferred=Math.min(Math.max(30,88*f),slot*.62),
         bw=mobilePosterActive(ctx)?posterStackBarWidth(ctx,slot,preferred,panel.weeks.flatMap(week=>week.valid?week.series.filter(s=>Number.isFinite(s.share)&&s.share>0).map(s=>s.share.toFixed(1)+'%'):[])):preferred,
         barXs=periods.map((_,i)=>x0+slot*(i+.5));
  if(plotH<=80||slot<=8){auditIssue(ctx,'周次过多或图幅过窄，堆叠柱无法清晰显示',true);return;}
  if(slot<55)auditIssue(ctx,'多周数据较密集，可缩短统计区间或改用较宽的图卡');
  for(let k=0;k<=4;k++){
   const pct=k*25,gy=y1-plotH*pct/100;
   ctx.save();ctx.strokeStyle=p.hair;ctx.lineWidth=Math.max(.7,1*f);ctx.beginPath();ctx.moveTo(x0,gy);ctx.lineTo(x1,gy);ctx.stroke();ctx.restore();
   if(mobile)posterYAxisTick(ctx,pct+'%',x0,gy,p);else draw('axis',pct+'%',x0-Math.max(5,7*f),gy+subtitleSize*.33,subtitleSize,p.sub,'550','right',x0-x-9);
  }
  const geometries=panel.weeks.map(week=>{
   if(!week.valid)return null;
   let acc=0;
   return week.series.map(s=>{
    const bottomPct=acc;acc+=s.share;
    const sy1=y1-bottomPct/100*plotH,sy0=y1-acc/100*plotH;
    return {key:s.key,color:s.color,label:s.label,value:s.share,top:sy0,bottom:sy1,
      mid:(sy0+sy1)/2,h:sy1-sy0};
   });
  });
  // Identical ribbons for all multiweek stacks. Incomplete weeks are null,
  // so no colored band crosses a missing week or changes categories.
  drawAdjacentStackRibbons(ctx,geometries.map((segments,i)=>segments?{
   left:barXs[i]-bw/2,right:barXs[i]+bw/2,segments
  }:null));
  geometries.forEach((segs,i)=>{
   const cx=barXs[i],bx=cx-bw/2;
   if(!segs){
    ctx.save();ctx.strokeStyle=p.hair;ctx.lineWidth=Math.max(1,1.4*f);ctx.setLineDash([4,4]);
    ctx.strokeRect(bx,y0,bw,plotH);ctx.restore();
    draw('chartLabel','缺失',cx,y0+plotH/2,labelSize,p.sub,'650','center',bw-3);
   }else segs.forEach(seg=>{
    if(seg.h<=0)return;
    rounded(ctx,bx,seg.top,bw,Math.max(.1,seg.h-Math.min(.9,seg.h*.08)),
      Math.min(3*f,seg.h/2),seg.color);
    if(mobilePosterActive(ctx))posterStackSegmentValue(ctx,seg.value.toFixed(1)+'%',cx,seg.mid,bw,seg.h,'#fff');
     else if(seg.h>=labelSize+4&&bw>=37)
      draw('stackValue',seg.value.toFixed(1)+'%',cx,seg.mid+labelSize*.34,labelSize,'#fff','800','center',bw-3);
   });
   const label=posterWeekLabel(periods[i],periods);
   if(mobile)posterXAxisTick(ctx,label,cx,y1,axisLayout,p,Math.max(8,slot*.93));else draw('axis',label,cx,y1+axisBaselineOffset,subtitleSize,p.sub,'650','center',Math.max(8,slot*.93));
  });
 }
 drawPanel(panels[0],top);
 drawPanel(panels[1],top+panelH+gap);
 const legendY=top+panelH*2+gap*1.5+legendExtra,cellW=width/brands.length;
 brands.forEach((g,i)=>{
  const x=left+i*cellW,sw=Math.max(10,17*f);
  rounded(ctx,x,legendY-sw*.72,sw,sw*.69,2,g.color);
  posterCompactLegendText(ctx,g.label,x+sw+Math.max(3,5*f),legendY,p.ink,subtitleSize,'650','left',cellW-sw-6);
 });
 if(note)draw('chartNote',note,left,bottom-Math.max(4,7*f),subtitleSize,p.sub,'500','left',width);
}

/* Dual TOP30 / whole-market flow, sharing identical geometry in the preview and poster.
 * Only the far-right delta cells receive extreme-value backgrounds; ties use displayed 0.1pp. */
// A three-panel dumbbell chart. The outside panel uses hollow scenario
// markers, dashed connections and endpoint ranges; all panels share one scale.
// Pair contribution view: one zero axis; signed components stack only on the same side.
function drawBrandContributionPair(ctx,chart,box,p,preview=false){
 const {left,right,top,bottom,width,height}=box,rows=chart.contributions||[],n=rows.length;
 if(!n||!auditPlot(ctx,width,height,'品牌市场份额变化贡献',360,300))return;
 const f=Math.max(.52,Math.min(1.7,width/780,height/470)),font=23*f,small=15*f;
 const labelW=Math.min(width*.30,Math.max(110*f,width*.21)),x0=left+labelW+9*f,x1=right-27*f,mid=(x0+x1)/2;
 const cap=chart.scaleMax||2,step=chart.scaleStep||cap/2,x=v=>mid+v/cap*(x1-x0)/2;
 const mobile=!preview&&mobilePosterActive(ctx),xLayout=mobile?posterXAxisLayout(ctx,Array.from({length:2*Math.round(cap/step)+1},(_,i)=>String((i-Math.round(cap/step))*step))):null;
 const gridTop=top+48*f,gridBottom=bottom-(mobile?xLayout.height+posterDp(4)+MOBILE_POSTER_TYPE.axisTitle:39*f),rowH=(gridBottom-gridTop)/n;
 // Non-axis labels retain the existing UI typography; exported axes use the poster standard.
 const text=(role,ctx,value,x,y,size,color,weight='400',align='left',maxWidth=Infinity)=>posterAudits.get(ctx)?.bodyTypography?posterRoleFit(ctx,role,value,x,y,size,color,weight,align,maxWidth):crossAxisText(ctx,value,x,y,size,color,align,maxWidth,weight);
 const inColor='#4079D5',outColor='#A5C1E8',positive='#dc3535',negative='#15956f';
 const fmt=v=>Number.isFinite(v)?v.toFixed(1)+'%':'—';
 const pp=v=>{if(!Number.isFinite(v))return '—';const d=Math.round(v*10)/10;return (d>0?'+':'')+d.toFixed(1)+' pp';};
 const tick=v=>{const d=Number(v.toFixed(5));return (d>0?'+':'')+d;};
 function line(a,b,c,d,color,w=1){ctx.save();ctx.strokeStyle=color;ctx.lineWidth=w*f;ctx.beginPath();ctx.moveTo(a,b);ctx.lineTo(c,d);ctx.stroke();ctx.restore();}
 function diamond(cx,cy,r){ctx.save();ctx.beginPath();ctx.moveTo(cx,cy-r);ctx.lineTo(cx+r,cy);ctx.lineTo(cx,cy+r);ctx.lineTo(cx-r,cy);ctx.closePath();ctx.fillStyle=p.ink;ctx.fill();ctx.lineWidth=1.7*f;ctx.strokeStyle=p.card||'#fff';ctx.stroke();ctx.restore();}
 const legendY=top+18*f,legendStart=left+Math.max(0,(width-425*f)/2);
 for(const [i,color,label] of [[0,inColor,'榜内贡献'],[1,outColor,'榜外贡献']]){
  const lx=legendStart+i*135*f;ctx.fillStyle=color;ctx.fillRect(lx,legendY-9*f,16*f,12*f);text('legend',ctx,label,lx+22*f,legendY,small,p.sub,'600');
 }
 diamond(legendStart+278*f,legendY-3*f,7*f);text('legend',ctx,'总份额变化',legendStart+290*f,legendY,small,p.sub,'600');
 const ticks=Math.round(cap/step);
 for(let i=-ticks;i<=ticks;i++){const v=i*step,xx=x(v);line(xx,gridTop,xx,gridBottom,i===0?p.sub:p.hair,i===0?1.5:1);if(preview)text('axis',ctx,tick(v),xx,gridBottom+20*f,small,p.sub,'500','center',Math.max(25,(x1-x0)/(2*ticks+1)));else if(mobile)posterXAxisTick(ctx,tick(v),xx,gridBottom,xLayout,p,Math.max(25,(x1-x0)/(2*ticks+1)));else researchPosterAxisText(ctx,tick(v),xx,gridBottom+20*f,'tick',p.sub,'center',Math.max(25,(x1-x0)/(2*ticks+1)),small);}
 if(preview)text('axisTitle',ctx,'百分点（pp）',right,gridBottom+36*f,small*.85,p.sub,'500','right');else researchPosterAxisText(ctx,'百分点（pp）',right,mobile?bottom:gridBottom+36*f,'title',p.sub,'right',Infinity,small*.85);
 rows.forEach((g,i)=>{
  const yy=gridTop+(i+.5)*rowH,barH=Math.min(31*f,rowH*.45),a=g.inside.delta,b=g.outside.delta,d=g.market.delta;
  ctx.fillStyle=g.color;ctx.fillRect(left+2*f,yy-16*f,4*f,32*f);
  text('chartLabel',ctx,g.label,left+13*f,yy-5*f,font,p.ink,'700','left',labelW-16*f);
  text('chartValue',ctx,fmt(g.market.a.value)+' → '+fmt(g.market.b.value),left+13*f,yy+15*f,small,p.sub,'500','left',labelW-16*f);
  if(Number.isFinite(a)&&Number.isFinite(b)){
   let pos=0,neg=0;
   for(const [v,color] of [[a,inColor],[b,outColor]]){
    const origin=v>=0?pos:neg,end=origin+v;if(v>=0)pos=end;else neg=end;
    if(v!==0){ctx.fillStyle=color;ctx.fillRect(Math.min(x(origin),x(end)),yy-barH/2,Math.abs(x(end)-x(origin)),barH);}
   }
   if(g.inside.status==='估算方向不确定'||g.outside.status==='估算方向不确定'){
    text('chartLabel',ctx,'贡献方向不确定',mid,yy+barH/2+15*f,small*.85,p.sub,'500','center',x1-x0);
   }
  }else text('chartLabel',ctx,'贡献不可估算',mid,yy+barH/2+15*f,small,p.sub,'500','center',x1-x0);
  if(Number.isFinite(d)){
   const xx=x(d),r=Math.min(8*f,barH*.43),rounded=Math.round(d*10)/10;
   diamond(xx,yy,r);
   text('chartValue',ctx,pp(d),Math.max(x0+23*f,Math.min(x1-23*f,xx)),yy-barH/2-5*f,font*.85,rounded>0?positive:rounded<0?negative:p.sub,'700','center',75*f);
  }else text('chartLabel',ctx,'总变化缺失',mid,yy-barH/2-5*f,small,p.sub,'500','center',x1-x0);
 });
}

function drawDualBrandShareComparison(ctx,chart,box,p){
 const {left,right,top,bottom,width,height}=box,panels=chart.panels||[];
 if(panels.length!==3)return;
 const groups=window.BrandUtils.groups.filter(g=>g.id!=='other'),n=groups.length;
 if(!n||!auditPlot(ctx,width,height,'双周品牌市场份额对比',650,400))return;
 const f=Math.max(.65,Math.min(1.5,width/1050,height/560)),font=18*f,small=15*f;
 const cap=chart.scaleMax||100,labelW=Math.max(68,104*f),gap=18*f;
 const mobile=mobilePosterActive(ctx),xLayout=mobile?posterXAxisLayout(ctx,[0,cap/2,cap].map(v=>v+'%')):null;
 const colW=(width-labelW-gap*2)/3,headY=top+60*f,gridTop=headY+18*f,gridBottom=bottom-(mobile?xLayout.height+POSTER_SPACE.xs:38*f);
 const rowH=(gridBottom-gridTop)/n,rr=Math.min(6*f,rowH*.12);
 const positive='#dc3535',negative='#15956f',neutral=p.sub,baseColor='#9ca3af';
 const fmt=v=>Number.isFinite(v)?v.toFixed(1)+'%':'—';
 const pp=v=>{if(!Number.isFinite(v))return '—';const a=Math.round(v*10)/10;return (a>0?'+':'')+a.toFixed(1)+' pp';};
 function marker(x,y,color,hollow){ctx.save();ctx.beginPath();ctx.arc(x,y,rr,0,Math.PI*2);ctx.fillStyle=color;ctx.strokeStyle=color;ctx.lineWidth=2*f;if(hollow){ctx.fillStyle=p.card||'#ffffff';ctx.fill();ctx.stroke();}else ctx.fill();ctx.restore();}
 function line(xa,ya,xb,yb,color,dash=false,weight=2){ctx.save();ctx.strokeStyle=color;ctx.lineWidth=weight*f;if(dash)ctx.setLineDash([5*f,4*f]);ctx.beginPath();ctx.moveTo(xa,ya);ctx.lineTo(xb,yb);ctx.stroke();ctx.restore();}
 const legendX=left+width*.5-120*f;
 marker(legendX,top+16*f,baseColor,false);posterCompactLegendText(ctx,chart.periods[0],legendX+12*f,top+21*f,p.sub,small,'600','left',Math.max(1,130*f));
 marker(legendX+145*f,top+16*f,p.ink,false);posterCompactLegendText(ctx,chart.periods[1]+'（品牌色）',legendX+157*f,top+21*f,p.sub,small,'600','left',Math.max(20,right-legendX-157*f));
 groups.forEach((g,i)=>posterRoleCanvas(ctx,'chartLabel',g.label,left+labelW-10*f,gridTop+i*rowH+rowH*.44,font,p.ink,'650','right',labelW-12*f));
 panels.forEach((panel,j)=>{
  const estimated=panel.key==='outside',x0=left+labelW+j*(colW+gap)+8*f,x1=x0+colW-16*f;
  const x=v=>x0+v/cap*(x1-x0);
  posterRoleCanvas(ctx,'axisTitle',panel.title,(x0+x1)/2,headY,font,p.ink,'750','center',colW);
  for(const t of [0,cap/2,cap]){
   line(x(t),gridTop,x(t),gridBottom,p.hair,false,1);
   if(mobile)posterXAxisTick(ctx,t+'%',x(t),gridBottom,xLayout,p,colW/3);else posterRoleCanvas(ctx,'axis',t+'%',x(t),gridBottom+22*f,small,p.sub,'500','center',colW/3);
  }
  panel.series.forEach((d,i)=>{
   const yy=gridTop+i*rowH+rowH*.30,hasA=Number.isFinite(d.base),hasB=Number.isFinite(d.compare);
   if(estimated){
    for(const [lo,hi,color,offset] of [[d.baseLow,d.baseHigh,baseColor,-4*f],[d.compareLow,d.compareHigh,d.color,4*f]]){
     if(!Number.isFinite(lo)||!Number.isFinite(hi))continue;
     const y=yy+offset;
     line(x(lo),y,x(hi),y,color,false,1.25);
     line(x(lo),y-3*f,x(lo),y+3*f,color,false,1);
     line(x(hi),y-3*f,x(hi),y+3*f,color,false,1);
    }
   }
   if(hasA&&hasB)line(x(d.base),yy,x(d.compare),yy,d.color,estimated,2.5);
   if(hasA)marker(x(d.base),yy,baseColor,estimated);
   if(hasB)marker(x(d.compare),yy,d.color,estimated);
   const c=(x0+x1)/2,roundedDelta=Number.isFinite(d.delta)?Math.round(d.delta*10)/10:null;
   const uncertain=estimated&&d.deltaStatus==='估算方向不确定',deltaColor=uncertain||roundedDelta===null||roundedDelta===0?neutral:roundedDelta>0?positive:negative;
   posterRoleCanvas(ctx,'chartValue',fmt(d.base)+' → '+fmt(d.compare),c,yy+rowH*.29,small,p.sub,'500','center',colW-4*f);
   posterRoleCanvas(ctx,'chartValue',pp(d.delta)+(uncertain?' · 不确定':''),c,yy+rowH*.54,font,deltaColor,'700','center',colW-4*f);
  });
 });
}

function drawDualBrandFlow(ctx,chart,box,p,note=''){
 const {left,right,top,bottom,width,height}=box,panels=chart.panels||[];
 if(panels.length!==2||!chart.periods?.length)return;
 if(!auditPlot(ctx,width,height,'TOP与全市场双流向图',380,380))return;
 const f=Math.min(1.1,width/960,height/990),textSize=Math.max(11,Math.min(19,17*f)),
       labelSize=Math.max(11,Math.min(20,18*f)),headingSize=Math.max(14,Math.min(26,23*f)),
       noteSize=Math.max(10,Math.min(17,15*f)),gap=Math.max(12,19*f),
       legendHeight=Math.max(32,38*f),noteHeight=note?Math.max(27,34*f):0,
       panelH=(height-legendHeight-noteHeight-gap*2)/2;
 if(panelH<160){auditIssue(ctx,'双流向图空间不足，建议改用9:16或缩短标题与注释',true);return;}
 const fixedGroups=window.BrandUtils.groups.filter(g=>g.id!=='other');
 const fmt=v=>v.toFixed(1)+'%';
 function drawText(role,str,x,y,size,color=p.ink,weight='650',align='left',max=Infinity){
  posterRoleFit(ctx,role,str,x,y,size,color,weight,align,max);
 }
 function drawOne(panel,boxY){
  const x=left,y=boxY,w=width,h=panelH;
  rounded(ctx,x+1,y+1,w-2,h-2,Math.max(6,11*f),'#ffffff');
  ctx.save();ctx.strokeStyle=p.hair;ctx.lineWidth=Math.max(1,1.3*f);
  ctx.beginPath();ctx.roundRect(x+1,y+1,w-2,h-2,Math.max(6,11*f));ctx.stroke();ctx.restore();
  rounded(ctx,x+Math.max(12,20*f),y+Math.max(10,14*f),Math.max(70,84*f),Math.max(22,29*f),16,'#3b82f6');
  drawText('axisTitle',panel.key==='top'?'TOP30':'全市场',x+Math.max(47,62*f),y+Math.max(28,34*f),labelSize,'#ffffff','800','center',Math.max(61,75*f));
  drawText('axisTitle',panel.title||'',x+Math.max(102,120*f),y+Math.max(29,35*f),headingSize,p.ink,'800','left',w-Math.max(130,155*f));
  drawText('chartLabel',panel.subtitle||'',x+Math.max(12,20*f),y+Math.max(54,67*f),noteSize,p.sub,'500','left',w-38);
  const labelW=Math.max(59,w*.092),barW=Math.min(240,w*.22),deltaW=Math.max(77,w*.108);
  const lx=x+labelW+Math.max(11,16*f),rx=x+w-deltaW-barW-Math.max(13,20*f),dx=rx+barW+Math.max(4,7*f);
  const yHead=y+Math.max(83,94*f),plotTop=yHead+Math.max(29,35*f),plotBottom=y+h-Math.max(14,22*f),plotH=plotBottom-plotTop;
  drawText('axisTitle','基准周',lx+barW/2,yHead,Math.max(12,17*f),p.ink,'750','center',barW+12);
  drawText('axis',chart.periods[0],lx+barW/2,yHead+Math.max(15,19*f),noteSize,p.sub,'600','center',barW+12);
  drawText('axisTitle','对比周',rx+barW/2,yHead,Math.max(12,17*f),p.ink,'750','center',barW+12);
  drawText('axis',chart.periods[1],rx+barW/2,yHead+Math.max(15,19*f),noteSize,p.sub,'600','center',barW+12);
  drawText('axisTitle','变化',dx+deltaW*.47,yHead,Math.max(12,17*f),p.ink,'750','center',deltaW-5);
  drawText('axisTitle','(pp)',dx+deltaW*.47,yHead+Math.max(15,19*f),noteSize,p.sub,'550','center',deltaW-5);
  if(panel.status!=='ok'){
   drawText('chartLabel',panel.message||'数据不完整，无法绘制',x+w/2,plotTop+plotH/2,headingSize,p.sub,'600','center',w-60);
   return;
  }
  const data=panel.series||[],diffs=data.map(row=>Math.round((row.compare-row.base)*10)/10);
  const maxUp=Math.max(0,...diffs),minDown=Math.min(0,...diffs);
  const segments=(field)=>{
   let cursor=plotBottom;
   return data.map(row=>{
    const val=row[field],length=Math.max(0,val/100*plotH);
    const seg={...row,v:val,top:cursor-length,bottom:cursor,h:length,mid:cursor-length/2};
    cursor-=length;return seg;
   });
  };
  const base=segments('base'),compare=segments('compare'),pathL=lx+barW,pathR=rx,
        c1=pathL+(pathR-pathL)*.43,c2=pathL+(pathR-pathL)*.57;
  base.forEach((a,i)=>{
   const b=compare[i];if(a.h<=0&&b.h<=0)return;
   ctx.save();ctx.globalAlpha=.18;ctx.fillStyle=a.color;
   ctx.beginPath();ctx.moveTo(pathL,a.top);ctx.bezierCurveTo(c1,a.top,c2,b.top,pathR,b.top);
   ctx.lineTo(pathR,b.bottom);ctx.bezierCurveTo(c2,b.bottom,c1,a.bottom,pathL,a.bottom);
   ctx.closePath();ctx.fill();ctx.restore();
  });
  base.forEach((a,i)=>{
   const b=compare[i],d=diffs[i],rise=maxUp>0&&d===maxUp,fall=minDown<0&&d===minDown,
         cy=b.mid,delta=(d>0?'+':'')+d.toFixed(1)+'pp';
   for(const [seg,bx] of [[a,lx],[b,rx]]){
    if(seg.h<=0)continue;
    rounded(ctx,bx,seg.top,barW,Math.max(.1,seg.h-Math.min(1,seg.h*.09)),Math.min(6,seg.h/2),seg.color);
    if(mobilePosterActive(ctx))posterStackSegmentValue(ctx,fmt(seg.v),bx+barW/2,seg.mid,barW,seg.h,'#ffffff');else if(seg.h>=textSize+3)drawText('stackValue',fmt(seg.v),bx+barW/2,seg.mid+textSize*.34,textSize,'#ffffff','800','center',barW-6);
   }
   if(a.h>=labelSize+1)drawText('stackLabel',a.label,lx-Math.max(5,7*f),a.mid+labelSize*.34,labelSize,p.ink,'700','right',labelW-5);
   // Highlight ONLY the numerical change field: no shading or callouts on the bars.
   if(rise||fall){
    const bg=rise?'rgba(239,68,68,0.13)':'rgba(34,197,94,0.13)';
    rounded(ctx,dx-2,cy-textSize*.82,Math.max(36,x+w-dx-7),textSize*1.55,Math.max(2,4*f),bg);
   }
   drawText('chartValue',delta,dx+Math.max(3,5*f),cy+textSize*.35,textSize,d>0?'#c93630':d<0?'#265a87':p.sub,'800','left',Math.max(24,x+w-dx-13));
  });
 }
 drawOne(panels[0],top);
 drawOne(panels[1],top+panelH+gap);
 const legendY=top+panelH*2+gap*1.5,cellW=width/fixedGroups.length;
 fixedGroups.forEach((g,i)=>{
  const xx=left+i*cellW;
  rounded(ctx,xx,legendY-Math.max(8,11*f),Math.max(10,17*f),Math.max(9,11*f),2,g.color);
  posterCompactLegendText(ctx,g.label,xx+Math.max(15,22*f),legendY,p.ink,noteSize,'650','left',cellW-Math.max(17,25*f));
 });
 if(note)drawText('chartNote',note,left,bottom-Math.max(4,7*f),noteSize,p.sub,'550','left',width);
}

// Shared heatmap rendering for live canvas and poster. Cell values are already normalized by the research engine.
// Exported matrices use the shared mobile typography and content-driven label widths.
// Keep the original compact renderer for the research-page preview.
function drawMobileResearchHeatmap(ctx,chart,box,p,note=''){
 const {left,right,top,bottom,width}=box,rows=chart.periods,cols=chart.lines;
 if(!rows.length||!cols.length)return;
 const T=MOBILE_POSTER_TYPE,S=POSTER_DESIGN.weight,gap=posterDp(4),pad=posterDp(2),axis=T.axis;
 const wrap=(value,maxWidth)=>{
  const result=[];
  for(const raw of String(value??'').split(/\r?\n/)){
   let line='';
   for(const token of raw.match(/[A-Za-z0-9][A-Za-z0-9._/-]*|[ \t]+|[^\r\n]/gu)||[]){
    if(!line&&/^\s+$/.test(token))continue;
    if(line&&posterAxisMeasure(ctx,line+token,axis)>maxWidth){if(line.trim())result.push(line.trim());line=token.trimStart();}
    else line+=token;
   }
   if(line.trim())result.push(line.trim());
  }
  return result.length?result:[''];
 };
 const longest=Math.max(0,...rows.map(v=>posterAxisMeasure(ctx,v,axis)));
 // Only long labels pay the cost of wrapping; short labels do not reserve a fixed percentage.
 const labelW=Math.min(longest+gap,width*.34),x0=left+labelW,x1=right,cw=(x1-x0)/cols.length;
 if(labelW<=gap||cw<=2*pad){auditIssue(ctx,'热力矩阵横向空间不足，请减少属性类别数',true);return;}
 const rowLines=rows.map(v=>wrap(v,labelW-gap)),colLines=cols.map(v=>wrap(v.name,cw-2*pad));
 const lineMetrics=lines=>{
  let ascent=axis*.85,descent=axis*.2;
  ctx.save();for(const text of lines){ctx.font=posterFont(ctx,axis,S.axis,posterAxisFont(text),'axis');const m=ctx.measureText(text);ascent=Math.max(ascent,m.actualBoundingBoxAscent||0);descent=Math.max(descent,m.actualBoundingBoxDescent||0);}ctx.restore();
  return {ascent,descent,step:Math.max(axis*1.2,ascent+descent+pad)};
 };
 const metrics=lineMetrics([...rowLines.flat(),...colLines.flat()]),blockH=lines=>metrics.ascent+metrics.descent+(lines.length-1)*metrics.step;
 const heading=chart.rowLabel+' × '+chart.colLabel+' · '+chart.unit;
 const headingLines=posterRoleWrap(ctx,'axisTitle',heading,width,T.axisTitle,S.axisTitle),headingBlock=posterRoleBlock(ctx,'axisTitle',headingLines,T.axisTitle,S.axisTitle,top);
 const headerBottom=top+headingBlock.height+gap+Math.max(...colLines.map(blockH));
 const y0=headerBottom+gap,legendH=T.legend+2*gap;
 const noteLines=note?posterRoleWrap(ctx,'chartNote',note,width,T.caption,S.caption):[],noteBlock=posterRoleBlock(ctx,'chartNote',noteLines,T.caption,S.caption,0);
 const y1=bottom-legendH-(noteLines.length?noteBlock.height+gap:0),rh=(y1-y0)/rows.length;
 if(!auditPlot(ctx,x1-x0,y1-y0,'热力矩阵绘图区',220,150))return;
 if(rh<=2*pad||cw<=2*pad){auditIssue(ctx,'热力矩阵单元过小，请减少属性类别数',true);return;}
 const max=Math.max(0,...cols.flatMap(v=>v.values.filter(Number.isFinite))),fmt=v=>chart.unit==='项次'?String(Math.round(v)):v.toFixed(1)+(chart.unit==='%'?'%':'');
 const vals=cols.flatMap(v=>v.values.map(n=>Number.isFinite(n)?fmt(n):'—'));
 const widest=Math.max(1,...vals.map(v=>posterRoleMeasure(ctx,'chartValue',v,T.value,S.body).width));
 const valueSize=Math.min(T.value,T.value*(cw-2*pad)/widest,(rh-2*pad)/1.2);
 if(valueSize<T.value)auditIssue(ctx,'矩阵单元空间不足，数字统一缩小；建议减少属性类别数或使用更宽图幅');
 if(valueSize<posterDp(6)){auditIssue(ctx,'热力矩阵数字无法清晰显示，请减少属性类别数',true);return;}
 headingLines.forEach((v,i)=>posterRoleFitBounded(ctx,'axisTitle',v,left,headingBlock.y+i*headingBlock.step,T.axisTitle,p.sub,S.axisTitle,'left',width));
 colLines.forEach((lines,j)=>lines.forEach((v,k)=>posterAxisText(ctx,v,x0+(j+.5)*cw,headerBottom-blockH(lines)+metrics.ascent+k*metrics.step,p.ink,'center',cw-2*pad)));
 rows.forEach((name,i)=>{
  const y=y0+i*rh,lines=rowLines[i],scale=Math.min(1,(rh-2*pad)/blockH(lines));
  if(scale<1)auditIssue(ctx,'矩阵行标签空间不足，局部字号缩小');
  lines.forEach((v,k)=>posterAxisText(ctx,v,x0-gap,y+(rh-blockH(lines)*scale)/2+(metrics.ascent+k*metrics.step)*scale,p.ink,'right',labelW-gap,axis*scale));
  cols.forEach((col,j)=>{
   const v=col.values[i],x=x0+j*cw,valid=Number.isFinite(v),ratio=valid&&max>0?Math.max(0,Math.min(1,v/max)):0;
   ctx.fillStyle=valid?'rgb('+Math.round(240-205*ratio)+','+Math.round(246-133*ratio)+','+Math.round(253-72*ratio)+')':'#e5e7eb';
   ctx.fillRect(x+1,y+1,Math.max(0,cw-2),Math.max(0,rh-2));
   posterRoleFitBounded(ctx,'chartValue',valid?fmt(v):'—',x+cw/2,y+rh/2+valueSize*.32,valueSize,valid&&ratio>.65?'#ffffff':'#17263c',S.body,'center',cw-2*pad);
  });
 });
 const legendY=y1+gap+T.legend,zeroW=posterLegendMeasure(ctx,'0'),maxText='最大 '+fmt(max),maxW=posterLegendMeasure(ctx,maxText);
 const sw=Math.min(posterDp(12),(width-zeroW-maxW-2*gap)/5),barH=posterDp(4),barX=left+zeroW+gap;
 if(sw>0){
  posterCompactLegendText(ctx,'0',left,legendY,p.sub,T.legend,S.legend);
  for(let j=0;j<5;j++){const r=j/4;ctx.fillStyle='rgb('+Math.round(240-205*r)+','+Math.round(246-133*r)+','+Math.round(253-72*r)+')';ctx.fillRect(barX+j*sw,legendY-T.legend*.55,Math.max(0,sw-1),barH);}
  posterCompactLegendText(ctx,maxText,barX+5*sw+gap,legendY,p.sub,T.legend,S.legend);
 }else auditIssue(ctx,'矩阵色阶图例空间不足',true);
 if(noteLines.length)noteLines.forEach((v,i)=>posterCaption(ctx,v,left,bottom-noteBlock.height+noteBlock.y+i*noteBlock.step,p.sub,'left',width));
}
function drawResearchHeatmap(ctx,chart,box,p,note=''){
 if(mobilePosterActive(ctx))return drawMobileResearchHeatmap(ctx,chart,box,p,note);
 const {left,right,top,bottom,width,height}=box,rows=chart.periods,cols=chart.lines;
 if(!rows.length||!cols.length)return;
 const labelW=Math.min(width*.29,Math.max(100,width*.22)),headerH=Math.min(75,height*.14),footH=note?62:43;
 const x0=left+labelW,y0=top+headerH,x1=right-8,y1=bottom-footH,cw=(x1-x0)/cols.length,rh=(y1-y0)/rows.length;
 if(!auditPlot(ctx,x1-x0,y1-y0,'热力矩阵绘图区',220,150))return;
 if(cw<32||rh<20)auditIssue(ctx,'热力矩阵单元较密，请缩小属性类别数');
 if(cw<16||rh<12){auditIssue(ctx,'热力矩阵单元过小，无法完整显示',true);return;}
 const max=Math.max(0,...cols.flatMap(l=>l.values.filter(Number.isFinite))),font=Math.max(10,Math.min(20,cw*.27,rh*.43)),subFont=Math.max(10,Math.min(18,rh*.45));
 const fmt=v=>chart.unit==='项次'?String(Math.round(v)):v.toFixed(1)+(chart.unit==='%'?'%':'');
 posterRoleFit(ctx,'axisTitle',chart.rowLabel+' × '+chart.colLabel+' · '+chart.unit,left,top+17,Math.min(19,headerH*.33),p.sub,'650','left',width);
 cols.forEach((l,j)=>posterRoleFit(ctx,'axis',l.name,x0+(j+.5)*cw,y0-10,Math.min(17,headerH*.35),p.ink,'650','center',cw-5));
 rows.forEach((name,i)=>{
  const y=y0+i*rh;posterRoleFit(ctx,'axis',name,x0-8,y+rh*.58,subFont,p.ink,'650','right',labelW-12);
  cols.forEach((l,j)=>{
   const v=l.values[i],x=x0+j*cw,valid=Number.isFinite(v),ratio=valid&&max>0?Math.max(0,Math.min(1,v/max)):0;
   ctx.fillStyle=valid?'rgb('+Math.round(240-205*ratio)+','+Math.round(246-133*ratio)+','+Math.round(253-72*ratio)+')':'#e5e7eb';
   ctx.fillRect(x+1,y+1,Math.max(0,cw-2),Math.max(0,rh-2));
   if(cw>=26&&rh>=17)posterRoleFit(ctx,'chartValue',valid?fmt(v):'—',x+cw/2,y+rh*.59,font,valid&&ratio>.65?'#ffffff':'#17263c','650','center',cw-5);
  });
 });
 const ly=y1+13,sw=Math.min(26,width*.045);for(let j=0;j<5;j++){const r=j/4;ctx.fillStyle='rgb('+Math.round(240-205*r)+','+Math.round(246-133*r)+','+Math.round(253-72*r)+')';ctx.fillRect(left+45+j*sw,ly,sw-1,10);}
 posterRoleFit(ctx,'legend','0',left+37,ly+10,12,p.sub,'550','right',32);
 posterRoleFit(ctx,'legend','最大 '+fmt(max),left+48+5*sw,ly+10,12,p.sub,'550','left',width*.55);
 if(note)posterRoleFit(ctx,'chartNote',note,left,bottom-5,Math.min(16,font),p.sub,'550','left',width);
}
// Shared research-poster axis typography (the live preview uses its own UI scale).
// Getter avoids reading sales-poster.js design constants before its script is loaded.
const RESEARCH_POSTER_AXIS=Object.freeze({get title(){return MOBILE_POSTER_TYPE.axisTitle;},get tick(){return MOBILE_POSTER_TYPE.axis;},get period(){return MOBILE_POSTER_TYPE.axis;},get titleWeight(){return POSTER_DESIGN.weight.axisTitle;},get tickWeight(){return POSTER_DESIGN.weight.axis;}});
// Shared poster typography; dense panels may cap the nominal font size.
function researchPosterAxisText(ctx,value,x,y,role,color,align='left',maxWidth=Infinity,sizeLimit=Infinity){
 const axis=RESEARCH_POSTER_AXIS;
 const size=Math.min(axis[role],sizeLimit);
 if(role==='title')posterRoleFitBounded(ctx,'axisTitle',value,x,y,size,color,axis.titleWeight,align,maxWidth);
 else posterAxisText(ctx,value,x,y,color,align,maxWidth,size);
}
/* Dual-axis generation study. Bars and line share week centers; reference
 * guides use the percentage axis, not the dynamically scaled volume axis. */
function drawGenerationDualAxis(ctx,chart,box,p,preview=false){
 const {left,right,top,bottom,width,height}=box,{periods,lines}=chart;
 if(!periods.length||lines.length!==2)return;
 const [volume,rate]=lines,n=periods.length;
 const barColor=volume.color||'#2563eb',rateColor=rate.color||'#7c3aed';
 const f=Math.max(.65,Math.min(1.4,width/780,height/466));
 const font=preview?14*f:36;
 // Live previews keep UI typography; posters and direct PNG use shared axis typography.
 const axis=preview?{title:12,tick:12,period:12,titleWeight:'400',tickWeight:'400'}:RESEARCH_POSTER_AXIS;
 const axisFont=getComputedStyle(document.body).getPropertyValue('--ui-font-body').trim()||'system-ui,-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif';
 const axisText=(value,x,y,role,color,align,maxWidth)=>{
  if(!preview)return researchPosterAxisText(ctx,value,x,y,role,color,align,maxWidth);
  const size=axis[role],weight=role==='title'?axis.titleWeight:axis.tickWeight;
  const str=String(value??'');ctx.save();
  ctx.font=weight+' '+size+'px '+axisFont;
  const measured=ctx.measureText(str).width;
  if(measured>maxWidth&&maxWidth>0)ctx.font=weight+' '+Math.max(1,size*maxWidth/measured)+'px '+axisFont;
  ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='alphabetic';
  if(maxWidth>0)ctx.fillText(str,x,y);
  ctx.restore();
 };
 const legendStep=Math.max(22,30*f),legendY=top+font+3;
 const legendBottom=preview?top+legendStep:posterLineLegend(ctx,[{...volume,color:barColor},{...rate,color:rateColor,marker:'○'}],box,p);
 const y0=legendBottom+Math.max(axis.title+14,31*f),y1=bottom-(preview?Math.max(axis.period+14,36*f):posterWeekLayout(ctx,periods).height+POSTER_SPACE.xs);
 const volumeAxis=SalesChartLayout.integerAxis(0,Math.max(1,...volume.values.filter(Number.isFinite)));
 const rateTicks=SalesChartLayout.integerAxis(0,100).ticks;
 const previewRateTicks=[...rateTicks,50].sort((a,b)=>a-b);
 const x0=left+(preview?Math.max(45,62*f):posterAxisGutter(ctx,volumeAxis.ticks)),x1=right-(preview?Math.max(47,61*f):posterAxisGutter(ctx,rateTicks,v=>v+'%'));
 if(!auditPlot(ctx,x1-x0,y1-y0,'代际替代双轴绘图区',260,150))return;
 const slot=(x1-x0)/n,bw=Math.min(slot*.62,76*f);
 if(bw<3){auditIssue(ctx,'代际替代图周次过多，柱宽不足',true);return;}
 const {high:cap,ticks:volumeTicks}=volumeAxis,plotH=y1-y0;
 const x=i=>x0+(i+.5)*slot,y=v=>y1-v/cap*plotH,yp=v=>y1-v/100*plotH;
 const text=(v,a,b,size,color=p.sub,weight='550',align='left',maxWidth=width)=>posterFitText(ctx,String(v),a,b,size,color,weight,align,maxWidth);
 const rule=(a,b,c,d,color,lw=1,dash=[])=>{ctx.save();ctx.strokeStyle=color;ctx.lineWidth=lw;ctx.setLineDash(dash);ctx.beginPath();ctx.moveTo(a,b);ctx.lineTo(c,d);ctx.stroke();ctx.restore();};
 // Use the same typography, spacing and theme tokens as other research posters.
 const half=width/2;
 if(preview){
 ctx.fillStyle=barColor;ctx.fillRect(left,legendY-font*.75,16*f,9*f);
 text(volume.name,left+22*f,legendY,font,p.ink,'600','left',half-26*f);
 const lx=left+half;
 rule(lx,legendY-font*.4,lx+20*f,legendY-font*.4,rateColor,2.5*f);
 ResearchCharts.canvasMarker(ctx,'○',lx+10*f,legendY-font*.4,3.5*f,rateColor);
 text(rate.name,lx+26*f,legendY,font,p.ink,'600','left',half-28*f);
 }
 axisText('合计周增量 / 万台',x0,y0-12,'title',p.sub,'left',(x1-x0)/2);
 axisText('替代率 / %',x1,y0-12,'title',p.sub,'right',(x1-x0)/2);
 for(const v of preview?volumeTicks:posterSpacedTicks(volumeTicks,y)){
  const yy=y(v),fraction=v/cap;
  if(![.5,.8].some(ref=>Math.abs(fraction-ref)<1e-9))rule(x0,yy,x1,yy,p.hair,preview?1.2*f:posterDp(POSTER_DESIGN.chart.grid));
  if(preview)axisText(Number(v.toPrecision(12)),x0-10,yy+5,'tick',p.sub,'right',x0-left-12);
  else posterYAxisTick(ctx,posterAxisLabel(v),x0,yy,p);
 }
 for(const v of preview?previewRateTicks:posterSpacedTicks(rateTicks,yp)){
  if(preview)axisText(v+'%',x1+10,yp(v)+5,'tick',p.sub,'left',right-x1-12);
  else posterYAxisTick(ctx,v+'%',x1,yp(v),p,'left');
 }
 rule(x0,y0,x0,y1,p.hair,1.2*f);
 rule(x1,y0,x1,y1,p.hair,1.2*f);
 periods.forEach((period,i)=>{
  const v=volume.values[i];
  if(Number.isFinite(v)&&v>0){
   ctx.save();ctx.fillStyle=barColor;ctx.globalAlpha=volume.imputed?.[i] ? .55 : 1;
   ctx.fillRect(x(i)-bw/2,y(v),bw,y1-y(v));ctx.restore();
  }
 });
 // No reference labels or legend entries: the right-axis ticks suffice.
 for(const v of [50,80])rule(x0,yp(v),x1,yp(v),v===80?p.accent:p.sub,1.5*f,[6*f,5*f]);
 rate.values.forEach((v,i)=>{
  if(!Number.isFinite(v))return;
  if(i>0&&Number.isFinite(rate.values[i-1]))rule(x(i-1),yp(rate.values[i-1]),x(i),yp(v),rateColor,preview?2.8*f:MOBILE_POSTER_TYPE.line,rate.imputed?.[i]||rate.imputed?.[i-1]?[7*f,5*f]:[]);
 });
 rate.values.forEach((v,i)=>{
  if(Number.isFinite(v))ResearchCharts.canvasMarker(ctx,'○',x(i),yp(v),Math.min(preview?4.4*f:MOBILE_POSTER_TYPE.marker,slot*.23),rateColor,!!rate.imputed?.[i]);
 });
 if(!preview){posterWeekTicks(ctx,periods,x,y1,left,right,p);return;}
 const tickCount=Math.max(2,Math.floor((x1-x0)/Math.max(76*f,axis.period*4.8))),stride=Math.max(1,Math.ceil((n-1)/(tickCount-1)));
 periods.forEach((period,i)=>{
  if(i===0||i===n-1||(i%stride===0&&n-1-i>=stride*.65))
   axisText(period,x(i),y1+axis.period+8,'period',p.sub,'center',Math.min(Math.max(104*f,axis.period*5.8),slot*stride*.95));
 });
}

// Cross-module composition views share the poster palette and line/band geometry.
// Live UI labels use the system font; exported axes use researchPosterAxisText.
function crossAxisText(ctx,value,x,y,size,color,align='left',maxWidth=Infinity,weight='400'){
 if(posterAudits.get(ctx)?.bodyTypography)return posterFitText(ctx,value,x,y,size,color,posterBodyWeight(ctx,weight),align,maxWidth);
 const font=getComputedStyle(document.body).getPropertyValue('--ui-font-body').trim()||'system-ui,sans-serif';
 const str=String(value??'');ctx.save();ctx.font=weight+' '+size+'px '+font;
 const measured=ctx.measureText(str).width;
 if(measured>maxWidth&&maxWidth>0)ctx.font=weight+' '+Math.max(1,size*maxWidth/measured)+'px '+font;
 ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='alphabetic';if(maxWidth>0)ctx.fillText(str,x,y);ctx.restore();
}
function crossRule(ctx,x0,y0,x1,y1,color,width=1){
 ctx.save();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.stroke();ctx.restore();
}
function crossPeriodTicks(ctx,periods,x,y,plotWidth,font,p,preview=false){
 if(!preview){const a=x(0),b=x(periods.length-1),edge=periods.length>1?(b-a)/(periods.length-1)/2:plotWidth/2;posterWeekTicks(ctx,periods,x,y-font-7,a-edge,b+edge,p,plotWidth<posterDp(160)?3:5);return;}
 const n=periods.length,maxTicks=Math.max(2,Math.floor(plotWidth/(font*6))),stride=Math.max(1,Math.ceil((n-1)/(maxTicks-1)));
 periods.forEach((period,i)=>{
  if(i===0||i===n-1||(i%stride===0&&n-1-i>=stride*.65)){
   const maxWidth=Math.min(font*6,plotWidth/Math.max(1,n)*stride*.93);
   if(preview)crossAxisText(ctx,period,x(i),y,font,p.sub,'center',maxWidth);
   else researchPosterAxisText(ctx,period,x(i),y,'period',p.sub,'center',maxWidth,font);
  }
 });
}
function drawMobileCoverageLayers(ctx,chart,box,p){
 const {left,right,top,bottom,width}=box,n=chart.periods.length;
 if(!n)return;
 const labels=chart.lines.filter(l=>l.panel==='scale'),layers=chart.lines.filter(l=>l.panel==='layers');
 const upper={...chart,lines:labels},T=MOBILE_POSTER_TYPE,titleH=posterDp(17),gap=posterDp(8),footerH=posterWeekLayout(ctx,chart.periods).height+POSTER_SPACE.xs;
 const legend1=[...labels,...(chart.bands||[]).map(b=>({...b,name:b.name||'区间范围',legendBand:true}))];
 researchPosterAxisText(ctx,'市场规模（万台）',left,top+T.label,'title',p.ink,'left',width);
 const upperTop=posterLineLegend(ctx,legend1,{left,right,width,top:top+titleH,bottom},p)+posterDp(4);
 // Measure the lower legend independently so both panels get equal plotting height.
 const lowerLegend=layers.map(l=>({...l,marker:null}));
 // Compute its exact wrapped-row height without leaving marks in the drawing.
 const scratch=document.createElement('canvas').getContext('2d');
 const lowerLegendH=posterLineLegend(scratch,lowerLegend,{left:0,right:width,width,top:0},p);
 const plotH=(bottom-upperTop-titleH-gap-lowerLegendH-footerH-posterDp(8))/2;
 if(plotH<posterDp(32)){auditIssue(ctx,'市场规模与销量分层绘图区不足，请精简图例或拆图',true);return;}
 const axis=ResearchCharts.lineAxis(upper),pctTicks=SalesChartLayout.integerAxis(0,100).ticks;
 const x0=left+Math.max(posterAxisGutter(ctx,axis.ticks),posterAxisGutter(ctx,pctTicks,v=>v+'%')),x1=right-posterDp(4),slot=(x1-x0)/n,x=i=>x0+(i+.5)*slot;
 if(!auditPlot(ctx,x1-x0,plotH,'市场销量分层绘图区',250,96))return;
 const upperBottom=upperTop+plotH,scale=ResearchCharts.lineScale(upper,{left:x0,right:x1,top:upperTop,bottom:upperBottom},axis);
 posterYTicks(ctx,axis.ticks,scale.y,x0,x1,p);
 ResearchCharts.canvasLine(ctx,upper,{...scale,x});
 const lowerTitleTop=upperBottom+gap;
 researchPosterAxisText(ctx,'市场销量分层（%）',left,lowerTitleTop+T.label,'title',p.ink,'left',width);
 const lowerTop=posterLineLegend(ctx,lowerLegend,{left,right,width,top:lowerTitleTop+titleH,bottom},p)+posterDp(4);
 const lowerBottom=lowerTop+plotH,yp=v=>lowerBottom-v/100*plotH;
 posterYTicks(ctx,pctTicks,yp,x0,x1,p,v=>v+'%');
 const bw=Math.min(slot*.63,posterDp(25));let count=0;
 chart.periods.forEach((_,i)=>{
  if(!layers.length||!layers.every(l=>Number.isFinite(l.values[i])))return;
  count++;let accumulated=0;
  layers.forEach((l,j)=>{const v=l.values[i];ctx.save();ctx.fillStyle=l.color;ctx.globalAlpha=j===3?.65:1;ctx.fillRect(x(i)-bw/2,yp(accumulated+v),bw,yp(accumulated)-yp(accumulated+v));ctx.restore();accumulated+=v;});
 });
 if(!count)posterRoleFit(ctx,'chartLabel','无可行市场区间，分层暂不绘制',(x0+x1)/2,(lowerTop+lowerBottom)/2,T.value,p.sub,'500','center',x1-x0);
 posterWeekTicks(ctx,chart.periods,x,lowerBottom,left,right,p);
}
function drawCoverageLayers(ctx,chart,box,p,preview=false){
 if(!preview&&mobilePosterActive(ctx))return drawMobileCoverageLayers(ctx,chart,box,p);
 const {left,right,top,bottom,width,height}=box,n=chart.periods.length;
 if(!n)return;
 const f=Math.max(.65,Math.min(1.25,width/850,height/750)),font=(preview?13:18)*f,head=(preview?17:23)*f;
 const x0=left+Math.max(44,62*f),x1=right-22*f,plotW=x1-x0,slot=plotW/n,x=i=>x0+(i+.5)*slot;
 const panelH=(height-18*f)/2,secondTop=top+panelH+18*f;
 const labels=chart.lines.filter(l=>l.panel==='scale'),layers=chart.lines.filter(l=>l.panel==='layers');
 const upper={...chart,lines:labels},topY=top+head+28*f,bottomY=top+panelH-33*f;
 const lowerY=secondTop+head+28*f,lowerBottom=bottom-33*f;
 if(!auditPlot(ctx,plotW,Math.min(bottomY-topY,lowerBottom-lowerY),'市场规模与销量分层绘图区',250,110))return;
 crossAxisText(ctx,'市场规模（万台）',left,top+head,head,p.ink,'left',width,'600');
 const bandItems=(chart.bands||[]).length?['区间范围']:[];
 const legend=[...labels.map(l=>({name:l.name,color:l.color})),...bandItems.map(name=>({name,color:'#a78bfa',band:true}))];
 legend.forEach((l,i)=>{const lx=left+i*width/legend.length,ly=top+head+15*f;ctx.save();ctx.fillStyle=l.color;ctx.globalAlpha=l.band?.25:1;ctx.fillRect(lx,ly-7*f,13*f,5*f);ctx.restore();crossAxisText(ctx,l.name,lx+18*f,ly,font,p.sub,'left',width/legend.length-21*f);});
 const scale=ResearchCharts.lineScale(upper,{left:x0,right:x1,top:topY,bottom:bottomY});
 const y=scale.y;
 for(const v of scale.axis.ticks){const yy=y(v);crossRule(ctx,x0,yy,x1,yy,p.hair);if(preview)crossAxisText(ctx,v,x0-8*f,yy+4*f,font,p.sub,'right',x0-left-9*f);else researchPosterAxisText(ctx,v,x0-8*f,yy+4*f,'tick',p.sub,'right',x0-left-9*f,font);}
 ResearchCharts.canvasLine(ctx,upper,{...scale,x});
 crossPeriodTicks(ctx,chart.periods,x,bottomY+font+7*f,plotW,font,p,preview);
 crossAxisText(ctx,'市场销量分层（%）',left,secondTop+head,head,p.ink,'left',width,'600');
 layers.forEach((l,i)=>{const lx=left+i*width/layers.length,ly=secondTop+head+15*f;ctx.save();ctx.fillStyle=l.color;ctx.globalAlpha=i===3?.65:1;ctx.fillRect(lx,ly-8*f,13*f,8*f);ctx.restore();crossAxisText(ctx,l.name,lx+18*f,ly,font,p.sub,'left',width/layers.length-21*f);});
 const yp=v=>lowerBottom-v/100*(lowerBottom-lowerY);
 for(const v of SalesChartLayout.integerAxis(0,100).ticks){const yy=yp(v);crossRule(ctx,x0,yy,x1,yy,p.hair);if(preview)crossAxisText(ctx,v+'%',x0-8*f,yy+4*f,font,p.sub,'right',x0-left-9*f);else researchPosterAxisText(ctx,v+'%',x0-8*f,yy+4*f,'tick',p.sub,'right',x0-left-9*f,font);}
 const bw=Math.min(slot*.63,76*f);
 let count=0;
 chart.periods.forEach((_,i)=>{
  if(!layers.length||!layers.every(l=>Number.isFinite(l.values[i])))return;
  count++;let accumulated=0;
  layers.forEach((l,j)=>{const v=l.values[i];ctx.save();ctx.fillStyle=l.color;ctx.globalAlpha=j===3?.65:1;ctx.fillRect(x(i)-bw/2,yp(accumulated+v),bw,yp(accumulated)-yp(accumulated+v));ctx.restore();accumulated+=v;});
 });
 if(!count)crossAxisText(ctx,'无可行市场区间，分层暂不绘制',x0+plotW/2,(lowerY+lowerBottom)/2,font,p.sub,'center',plotW-8*f);
 crossPeriodTicks(ctx,chart.periods,x,lowerBottom+font+7*f,plotW,font,p,preview);
}
// Weekly market-share changes: brands are rows, calendar weeks are columns.
function drawBrandCompetitionHeatmap(ctx,chart,box,p,preview=false){
 const {left,right,top,bottom,width,height}=box,n=chart.periods.length,lines=chart.lines;
 if(!n||!lines.length)return;
 const f=Math.max(.65,Math.min(1.35,width/800,height/400)),font=(preview?13:17)*f;
 const x0=left+Math.max(72,82*f),x1=right-8*f,y0=top+43*f,y1=bottom-62*f;
 const slot=(x1-x0)/n,rowH=Math.min(60*f,(y1-y0)/lines.length);
 if(!auditPlot(ctx,x1-x0,y1-y0,'品牌竞争热力图绘图区',240,125))return;
 const peak=lines.reduce((m,l)=>l.values.reduce((a,v)=>Number.isFinite(v)?Math.max(a,Math.abs(v)):a,m),0);
 const cap=Math.max(.1,Math.ceil(peak*10)/10);
 const color=v=>{
  const neutral=[241,245,249],target=v>=0?[185,28,28]:[29,78,216],t=Math.min(1,Math.abs(v)/cap);
  return 'rgb('+neutral.map((c,i)=>Math.round(c+(target[i]-c)*t)).join(',')+')';
 };
 const fmt=v=>{const rounded=Math.round(v*10)/10;return (rounded>0?'+':'')+rounded.toFixed(1);};
 const labelStep=Math.max(1,Math.ceil(52*f/slot));
 posterRoleCanvas(ctx,'axisTitle','全市场份额环比变化（pp）',left,top+font,font,p.ink,'600','left',width);
 chart.periods.forEach((period,i)=>{
  if(i%labelStep!==0&&i!==n-1)return;
  if(i!==n-1&&n-1-i<labelStep*.7)return;
  const label=posterWeekLabel(period,chart.periods);
  posterRoleCanvas(ctx,'axis',label,x0+(i+.5)*slot,y0-10*f,font,p.sub,'500','center',Math.max(slot,slot*labelStep)-3);
 });
 lines.forEach((l,j)=>{
  const y=y0+j*rowH;
  posterRoleCanvas(ctx,'chartLabel',l.name,x0-9*f,y+rowH/2+font*.32,font,p.ink,'600','right',x0-left-12*f);
  l.values.forEach((v,i)=>{
   const valid=Number.isFinite(v),x=x0+i*slot,gap=Math.min(3*f,slot*.12);
   rounded(ctx,x+gap/2,y+gap/2,slot-gap,rowH-gap,3*f,valid?color(v):'#d1d5db');
   const label=valid?fmt(v):'—',ink=valid&&Math.abs(v)/cap>.66?'#ffffff':'#17263c';
   if(slot>=15*f)posterRoleCanvas(ctx,'chartValue',label,x+slot/2,y+rowH/2+font*.32,font,ink,'600','center',Math.max(1,slot-gap-4));
  });
 });
 const legendW=Math.min(width*.48,300*f),lx=left+(width-legendW)/2,ly=y0+rowH*lines.length+15*f;
 const gradient=ctx.createLinearGradient(lx,ly,lx+legendW,ly);
 gradient.addColorStop(0,color(-cap));gradient.addColorStop(.5,color(0));gradient.addColorStop(1,color(cap));
 ctx.fillStyle=gradient;ctx.fillRect(lx,ly,legendW,9*f);
 posterRoleCanvas(ctx,'legend','−'+cap.toFixed(1),lx,ly+24*f,font,p.sub,'500','center');
 posterRoleCanvas(ctx,'legend','0',lx+legendW/2,ly+24*f,font,p.sub,'500','center');
 posterRoleCanvas(ctx,'legend','+'+cap.toFixed(1),lx+legendW,ly+24*f,font,p.sub,'500','center');
 posterRoleCanvas(ctx,'legend','蓝：下跌',left,ly+9*f,font,p.sub,'500','left',Math.max(1,lx-left-8*f));
 posterRoleCanvas(ctx,'legend','红：上涨',right,ly+9*f,font,p.sub,'500','right',Math.max(1,right-lx-legendW-8*f));
 posterRoleCanvas(ctx,'legend','— 缺失或不可比较',right,ly+24*f,font,p.sub,'500','right',Math.max(1,right-lx-legendW-8*f));
}

function drawBrandGrowth(ctx,chart,box,p,preview=false){
 const {left,right,top,bottom,width,height}=box,n=chart.periods.length;
 if(!n)return;
 const groups=window.BrandUtils.groups.filter(g=>g.id!=='other');
 const f=Math.max(.6,Math.min(1.2,width/850,height/760)),font=(preview?12:17)*f,head=(preview?17:23)*f;
 const gap=preview?18*f:posterDp(6),entries=[['榜内环比','#64748b','bar'],['榜外环比','#64748b','light'],['品牌总销量环比',p.ink,'line']];
 const legendH=preview?35*f:posterLineLegend(ctx,entries.map(([name,color,role])=>({name,color,legendBand:role==='light',marker:role==='line'?'○':null})),box,p)-top;
 const cellW=(width-gap)/2,cellH=(height-legendH-gap*2)/3;
 if(!auditPlot(ctx,cellW-45*f,cellH-head-35*f,'六品牌增长贡献子图',120,68))return;
 const peak=chart.lines.reduce((m,l)=>l.values.reduce((a,v)=>Number.isFinite(v)?Math.max(a,Math.abs(v)):a,m),1);
 const {high:cap,ticks:yTicks}=SalesChartLayout.integerAxis(-peak,peak);
 if(preview)entries.forEach(([label,color,role],i)=>{const lx=left+i*width/3,ly=top+font;ctx.save();ctx.fillStyle=color;ctx.globalAlpha=role==='light'?.34:1;if(role==='line')crossRule(ctx,lx,ly-4*f,lx+18*f,ly-4*f,color,2*f);else ctx.fillRect(lx,ly-9*f,16*f,10*f);ctx.restore();crossAxisText(ctx,label,lx+22*f,ly,font,p.sub,'left',width/3-24*f);});
 groups.forEach((g,j)=>{
  const lines=chart.lines.filter(l=>l.brandKey===g.key),listed=lines.find(l=>l.role==='listed'),tail=lines.find(l=>l.role==='tail'),total=lines.find(l=>l.role==='total');
  const xx=left+(j%2)*(cellW+gap),yy=top+legendH+Math.floor(j/2)*(cellH+gap);
  if(!posterAudits.get(ctx)?.bodyTypography)crossAxisText(ctx,g.label,xx,yy+head,head,p.ink,'left',cellW*.6,'600');else posterRoleFit(ctx,'axisTitle',g.label,xx,yy+head,head,p.ink,'600','left',cellW*.6);
  if(preview)crossAxisText(ctx,'万台',xx+cellW,yy+head,font,p.sub,'right',cellW*.3);else researchPosterAxisText(ctx,'万台',xx+cellW,yy+head,'title',p.sub,'right',cellW*.3,font);
  const ticks=yTicks;
   const x0=xx+(preview?Math.max(29,40*f):posterAxisGutter(ctx,ticks)),x1=xx+cellW-(preview?6*f:posterDp(2)),y0=yy+(preview?head+10*f:posterDp(17)),y1=yy+cellH-(preview?font+10*f:(j>=4?posterWeekLayout(ctx,chart.periods).height+POSTER_SPACE.xs:posterDp(5))),slot=(x1-x0)/n,bw=Math.min(slot*.28,18*f),x=i=>x0+(i+.5)*slot,y=v=>y1-(v+cap)/(2*cap)*(y1-y0);
   if(!preview&&(x1<=x0||y1-y0<posterDp(16))){auditIssue(ctx,'品牌增长子图空间不足，请减少安全区或拆图',true);return;}
  if(preview){for(const v of ticks){const ypos=y(v);crossRule(ctx,x0,ypos,x1,ypos,v===0?p.sub:p.hair,v===0?1.3:1);crossAxisText(ctx,Number(v.toPrecision(8)),x0-5*f,ypos+4*f,font,p.sub,'right',x0-xx-6*f);}}
   else posterYTicks(ctx,ticks,y,x0,x1,p);
  if(!listed||!tail||!total)return;
  for(let i=0;i<n;i++)for(const [l,offset,alpha] of [[listed,-bw*.55,1],[tail,bw*.55,.34]]){
   const v=l.values[i];if(!Number.isFinite(v)||v===0)continue;ctx.save();ctx.fillStyle=g.color;ctx.globalAlpha=alpha;ctx.fillRect(x(i)+offset-bw/2,Math.min(y(v),y(0)),bw,Math.abs(y(v)-y(0)));ctx.restore();
  }
  ResearchCharts.canvasLine(ctx,{periods:chart.periods,lines:[{...total,color:p.ink,marker:'○'}]},{x,y});
  if(!lines.some(l=>l.values.some(Number.isFinite))){if(posterAudits.get(ctx)?.bodyTypography)posterRoleFit(ctx,'chartLabel','无相邻有效周',(x0+x1)/2,(y0+y1)/2,font,p.sub,'500','center',x1-x0-4*f);else crossAxisText(ctx,'无相邻有效周',(x0+x1)/2,(y0+y1)/2,font,p.sub,'center',x1-x0-4*f);}
  if(preview)crossPeriodTicks(ctx,chart.periods,x,y1+font+5*f,x1-x0,font,p,true);else if(j>=4)posterWeekTicks(ctx,chart.periods,x,y1,xx,xx+cellW,p,3);
 });
}

const ResearchCharts=(()=>{
 const COLORS=['#2563eb','#ea580c','#059669','#9333ea','#db2777','#0891b2','#92400e','#64748b','#be123c','#4d7c0f','#0369a1','#7c3aed'];
 const MARKERS=['○','▲','■','◆','▽','⬟','●','△','□','◇','▼','⬠','⬢','⬡','◀','▷','▶','◁'];
 function markerAt(i){return MARKERS[i%MARKERS.length];}
 function markerGeometry(marker,x,y,r){
  const m=marker||'●',hollow='○△□◇▽⬠⬡▷◁'.includes(m);
  const sides='▲△▼▽◀◁▶▷'.includes(m)?3:'■□◆◇'.includes(m)?4:'⬟⬠'.includes(m)?5:'⬢⬡'.includes(m)?6:0;
  const rotation='■□'.includes(m)?Math.PI/4:'▼▽'.includes(m)?Math.PI/2:'◀◁'.includes(m)?Math.PI:'▶▷'.includes(m)?0:-Math.PI/2;
  return {hollow,vertices:sides?Array.from({length:sides},(_,i)=>[x+r*Math.cos(rotation+i*2*Math.PI/sides),y+r*Math.sin(rotation+i*2*Math.PI/sides)]):null};
 }
 function svgMarker(marker,x,y,r,color,estimated=false,title=''){
  const {hollow,vertices}=markerGeometry(marker,x,y,r);
  const tag=vertices?'polygon':'circle',geometry=vertices?'points="'+vertices.map(v=>v.join(',')).join(' ')+'"':'cx="'+x+'" cy="'+y+'" r="'+r+'"';
  return '<'+tag+' '+geometry+' stroke="'+color+'" stroke-width="1.8" fill="'+(estimated||hollow?'white':color)+'">'+title+'</'+tag+'>';
 }
 function canvasMarker(ctx,marker,x,y,r,color,estimated=false){
  const {hollow,vertices}=markerGeometry(marker,x,y,r);
  ctx.save();ctx.beginPath();
  if(vertices){vertices.forEach(([a,b],i)=>i?ctx.lineTo(a,b):ctx.moveTo(a,b));ctx.closePath();}else ctx.arc(x,y,r,0,Math.PI*2);
  ctx.fillStyle=estimated||hollow?'#ffffff':color;ctx.strokeStyle=color;ctx.lineWidth=mobilePosterActive(ctx)?posterDp(POSTER_DESIGN.chart.markerStroke):1.8;ctx.fill();ctx.stroke();ctx.restore();
 }
 function lineAxis(chart){
  const values=chart.lines.flatMap(l=>l.values);
  if(chart.logY)return SalesChartLayout.logAxis(values);
  if(chart.limit)return SalesChartLayout.integerAxis(0,chart.limit);
  const highValues=values.concat((chart.bands||[]).flatMap(b=>b.upper||[])).filter(Number.isFinite);
  const lowValues=values.concat((chart.bands||[]).flatMap(b=>b.lower||[])).filter(Number.isFinite);
  return SalesChartLayout.integerAxis(Math.min(0,...lowValues),Math.max(0,...highValues));
 }
 function rankAxis(min,max){
  const low=Math.max(1,min),high=Math.max(low,max);
  const {step}=SalesChartLayout.integerAxis(low,high);
  const ticks=Array.from({length:Math.floor((high-low)/step)+1},(_,i)=>low+i*step);
  if(ticks.at(-1)!==high)ticks.push(high);
  return {ticks,ratio:v=>high===low?0.5:(v-low)/(high-low)};
 }
 function lineScale(chart,box,axis=lineAxis(chart)){
  const n=chart.periods.length;
  const x=i=>n===1?(box.left+box.right)/2:box.left+i*(box.right-box.left)/Math.max(1,n-1);
  const ratio=axis.ratio??(v=>(v-axis.low)/(axis.high-axis.low));
  const y=v=>box.bottom-ratio(v)*(box.bottom-box.top);
  return {x,y,axis};
 }
 function points(chart,scale,visit){
  chart.lines.forEach((l,j)=>{const color=l.color||COLORS[j%COLORS.length];l.values.forEach((v,i)=>{
   if(!Number.isFinite(v))return;
   const y=scale.y(v);if(!Number.isFinite(y))return;
   const prevY=i>0&&Number.isFinite(l.values[i-1])?scale.y(l.values[i-1]):NaN,estimated=!!l.imputed?.[i];
   visit({name:l.name,period:chart.periods[i],value:v,color,marker:l.marker,x:scale.x(i),y,estimated,previous:Number.isFinite(prevY)?{x:scale.x(i-1),y:prevY,dashed:estimated||!!l.imputed?.[i-1]}:null});
  });});
 }
 // Segment only adjacent valid weeks. A missing point never contributes to a band.
 function bandRuns(chart,band){
  const runs=[];let run=[];
  chart.periods.forEach((_,i)=>{
   const lo=band.lower?.[i],hi=band.upper?.[i];
   if(Number.isFinite(lo)&&Number.isFinite(hi)&&hi>=lo)run.push(i);
   else if(run.length){runs.push(run);run=[];}
  });
  if(run.length)runs.push(run);
  return runs;
 }
 function svgLine(host,legend,chart,label,precision=2){
  const n=chart.periods.length;if(!n||!chart.lines.length)return;
  const axis=lineAxis(chart);
  const L=chart.logY?Math.max(56,...axis.ticks.map(tick=>String(tick).length*7+10)):56;
  const W=Math.max(720,n*48+110),H=310,R=W-55,T=25,B=265;
  const scale=lineScale(chart,{left:L,right:R,top:T,bottom:B},axis),{x,y}=scale;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let content='<text x="'+L+'" y="13" font-size="11" fill="currentColor">'+esc((chart.unit??'')+(chart.logY?' · 对数':''))+'</text>';
  for(const tick of axis.ticks){
   const yy=y(tick);
   content+='<line x1="'+L+'" x2="'+R+'" y1="'+yy+'" y2="'+yy+'" stroke="currentColor" opacity=".14"/><text x="'+(L-8)+'" y="'+(yy+4)+'" text-anchor="end" fill="currentColor" font-size="11">'+tick+'</text>';
  }
  if(axis.hasValues===false)content+='<text x="'+(L+R)/2+'" y="'+(T+B)/2+'" text-anchor="middle" fill="currentColor" font-size="13">当前区间无正销量记录</text>';
  const stride=Math.max(1,Math.ceil(n/15));chart.periods.forEach((w,i)=>{if(i%stride===0||i===n-1)content+='<text x="'+x(i)+'" y="'+(B+20)+'" text-anchor="middle" fill="currentColor" font-size="10">'+esc(w)+'</text>';});
  for(const band of chart.bands||[])for(const run of bandRuns(chart,band)){
   const color=esc(band.color||'#7c3aed'),alpha=Number.isFinite(band.opacity)?Math.max(0,Math.min(1,band.opacity)):.18;
   if(run.length===1){
    const i=run[0];
    content+='<rect x="'+(x(i)-5)+'" y="'+y(band.upper[i])+'" width="10" height="'+(y(band.lower[i])-y(band.upper[i]))+'" fill="'+color+'" opacity="'+alpha+'"/>';
   }else{
    const upper=run.map((i,j)=>(j?'L':'M')+x(i)+','+y(band.upper[i])).join(' ');
    const lower=[...run].reverse().map(i=>'L'+x(i)+','+y(band.lower[i])).join(' ');
    content+='<path d="'+upper+' '+lower+' Z" fill="'+color+'" opacity="'+alpha+'"/>';
   }
  }
  points(chart,scale,p=>{const color=esc(p.color);if(p.previous)content+='<line x1="'+p.previous.x+'" y1="'+p.previous.y+'" x2="'+p.x+'" y2="'+p.y+'" stroke="'+color+'" stroke-width="2.5" '+(p.previous.dashed?'stroke-dasharray="6 4"':'')+'/>';
   content+=svgMarker(p.marker,p.x,p.y,4.5,color,p.estimated,'<title>'+esc(p.name+' · '+p.period+' · '+p.value.toFixed(precision)+' '+chart.unit+(p.estimated?'（含插补）':''))+'</title>');
  });
  if(chart.alerts&&chart.lines[1])chart.alerts.forEach((level,i)=>{
   const value=chart.lines[1].values[i];
   if(!level||!Number.isFinite(value))return;
   const color=level==='persistent'?'#b91c1c':'#c2410c';
   content+='<circle cx="'+x(i)+'" cy="'+y(value)+'" r="9" stroke="'+color+'" stroke-width="2" fill="none"><title>'+
    esc(chart.periods[i]+' · '+(chart.alertReasons?.[i]||'自动一致性警告'))+'</title></circle>';
  });
  chart.lines.forEach((l,i)=>{const span=document.createElement('span');span.style.color=l.color||COLORS[i%COLORS.length];span.textContent=(l.marker||'●')+' '+l.name;legend.append(span);});
  for(const band of chart.bands||[]){const span=document.createElement('span');span.style.color=band.color||'#7c3aed';span.textContent='▰ '+(band.name||'情景区间');legend.append(span);}
  if(chart.alerts?.some(Boolean)){const span=document.createElement('span');span.style.color='#c2410c';span.textContent='◉ 异常标记（详情见下表）';legend.append(span);}

  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 '+W+' '+H);svg.setAttribute('role','img');svg.setAttribute('aria-label',label);svg.style.cssText='width:100%;min-width:560px';svg.innerHTML=content;host.append(svg);
 }
 // Board flow: the retained count and movement counts share the same week
 // coordinates, but not the same vertical scale. Keep nullable observations.
 function boardFlowLayout(chart,box){
  const {left,right,top,bottom,width,height}=box,n=chart.periods.length;
  const x0=left+56,x1=right-55,x=i=>n===1?(x0+x1)/2:x0+i*(x1-x0)/Math.max(1,n-1);
  const y0=top+23,y1=bottom-29,gap=39,available=y1-y0-gap,upperH=available*.35;
  const panels=[{lines:chart.lines.slice(0,1),title:'留榜机型数 · 动态 Y 轴',top:y0,bottom:y0+upperH,offset:0},{lines:chart.lines.slice(1),title:'进入与退出榜单 · 机型数',top:y0+upperH+gap,bottom:y1,offset:1}];
  panels.forEach((panel,j)=>{
   const values=panel.lines.flatMap(l=>l.values.filter(Number.isFinite));
   let low=0,high=1;
   if(values.length){
    const min=Math.min(...values),max=Math.max(...values);
    const padding=j===0?Math.max(1,Math.ceil((max-min)*.1)):0;
    low=j===0?Math.max(0,min-padding):0;high=Math.max(low+1,max+padding);
   }
   const axis=SalesChartLayout.integerAxis(low,high);
   ({low,high}=axis);
   panel.ticks=axis.ticks;
   panel.scale={x,y:v=>panel.bottom-(v-low)/(high-low)*(panel.bottom-panel.top)};
   panel.hasValues=values.length>0;
  });
  const stride=Math.max(1,Math.ceil((n-1)/Math.max(1,Math.floor((x1-x0)/53))));
  const years=new Set(chart.periods.map(w=>String(w).slice(0,4)));
  const labels=chart.periods.map((period,i)=>({i,label:years.size===1&&/^\d{4}-W\d{2}$/.test(period)?period.slice(5):period})).filter(({i})=>i===0||i===n-1||(i%stride===0&&n-1-i>=stride*.65));
  return {x0,x1,x,panels,labels,width,height};
 }
 function boardFlowDash(i){return [[],[],[7,4],[3,3],[9,3,2,3],[5,3]][i]||[];}
 function svgBoardFlow(host,legend,chart,label){
  const n=chart.periods.length;if(!n||!chart.lines.length)return;
  const W=Math.max(720,n*48+110),H=400,layout=boardFlowLayout(chart,{left:0,right:W,top:0,bottom:H,width:W,height:H});
  const {x0,x1,x,panels,labels}=layout;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let content='<style>.board-flow-week:hover .board-flow-guide{opacity:.45}</style>';
  panels.forEach(panel=>{
   content+='<text x="'+x0+'" y="'+(panel.top-10)+'" font-size="12" font-weight="600" fill="currentColor">'+esc(panel.title)+'</text>';
   panel.ticks.forEach(v=>{const y=panel.scale.y(v);content+='<line x1="'+x0+'" x2="'+x1+'" y1="'+y+'" y2="'+y+'" stroke="currentColor" opacity=".14"/><text x="'+(x0-8)+'" y="'+(y+4)+'" text-anchor="end" fill="currentColor" font-size="11">'+v+'</text>';});
   if(!panel.hasValues)content+='<text x="'+((x0+x1)/2)+'" y="'+((panel.top+panel.bottom)/2)+'" text-anchor="middle" fill="currentColor" font-size="12">无相邻可比较周</text>';
   panel.lines.forEach((l,j)=>{
    const i=panel.offset+j,color=esc(l.color||COLORS[i%COLORS.length]),dash=boardFlowDash(i);
    points({...chart,lines:[l]},panel.scale,p=>{
     if(p.previous)content+='<line x1="'+p.previous.x+'" y1="'+p.previous.y+'" x2="'+p.x+'" y2="'+p.y+'" stroke="'+color+'" stroke-width="1.8" '+(dash.length?'stroke-dasharray="'+dash.join(' ')+'"':'')+'/>';
     content+=svgMarker(l.marker||markerAt(i),p.x,p.y,2.6,color);
    });
   });
  });
  labels.forEach(({i,label})=>{content+='<text x="'+x(i)+'" y="'+(panels[1].bottom+19)+'" text-anchor="middle" fill="currentColor" font-size="10">'+esc(label)+'</text>';});
  // A single hover target per week exposes all six values, even if points overlap.
  chart.periods.forEach((period,i)=>{
   const half=n===1?(x1-x0)/2:(x1-x0)/(n-1)/2,px=x(i),a=Math.max(x0,px-half),b=Math.min(x1,px+half);
   const tooltip=[period,...chart.lines.map(l=>l.name+'：'+(Number.isFinite(l.values[i])?l.values[i]+' 款':'—（缺失或不适用）'))].join('\n');
   content+='<g class="board-flow-week"><title>'+esc(tooltip)+'</title><line class="board-flow-guide" x1="'+px+'" x2="'+px+'" y1="'+panels[0].top+'" y2="'+panels[1].bottom+'" stroke="currentColor" stroke-dasharray="3 3" opacity="0" pointer-events="none"/><rect x="'+a+'" y="'+panels[0].top+'" width="'+(b-a)+'" height="'+(panels[1].bottom-panels[0].top)+'" fill="transparent"/></g>';
  });
  chart.lines.forEach((l,i)=>{const span=document.createElement('span');span.style.color=l.color||COLORS[i%COLORS.length];span.textContent=(l.marker||markerAt(i))+' '+l.name;legend.append(span);});
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 '+W+' '+H);svg.setAttribute('role','img');svg.setAttribute('aria-label',label+'；上下图共用周次，留榜使用动态纵轴');svg.style.cssText='width:100%;min-width:560px';host.append(svg);svg.innerHTML=content;
 }
 function canvasMobileBoardFlow(ctx,chart,box,p){
  if(!chart.periods.length||!chart.lines.length)return;
  const {left,right,top,bottom,width}=box,n=chart.periods.length,T=MOBILE_POSTER_TYPE;
  const legendItems=chart.lines.map((l,i)=>({...l,marker:l.marker||markerAt(i),color:l.color||COLORS[i%COLORS.length]}));
  const legendBottom=posterLineLegend(ctx,legendItems,box,p),titleH=posterDp(19),gap=posterDp(8);
  const available=bottom-legendBottom-2*titleH-gap-posterWeekLayout(ctx,chart.periods).height-POSTER_SPACE.xs,upperH=available*.42,lowerH=available-upperH;
  if(Math.min(upperH,lowerH)<posterDp(28)){auditIssue(ctx,'榜单流动双图绘图区不足，请减少图例或拆图',true);return;}
  const panels=[{lines:chart.lines.slice(0,1),title:'留榜机型数 · 动态 Y 轴',h:upperH,offset:0},{lines:chart.lines.slice(1),title:'进入与退出榜单 · 机型数',h:lowerH,offset:1}];
  panels.forEach((panel,j)=>{
   const values=panel.lines.flatMap(l=>l.values.filter(Number.isFinite)),min=values.length?Math.min(...values):0,max=values.length?Math.max(...values):1;
   const pad=j===0?Math.max(1,Math.ceil((max-min)*.1)):0;
   const low=j===0?Math.max(0,min-pad):0,high=Math.max(low+1,max+pad);
   panel.axis=SalesChartLayout.integerAxis(low,high);panel.hasValues=values.length>0;
  });
  const x0=left+Math.max(...panels.map(v=>posterAxisGutter(ctx,v.axis.ticks))),x1=right-posterDp(4),x=i=>n===1?(x0+x1)/2:x0+i*(x1-x0)/Math.max(1,n-1);
  if(!auditPlot(ctx,x1-x0,Math.min(upperH,lowerH),'榜单流动双图绘图区',260,84))return;
  let yy=legendBottom;
  panels.forEach(panel=>{
   const y0=yy+titleH,y1=y0+panel.h,{low,high,ticks}=panel.axis,scale={x,y:v=>y1-(v-low)/(high-low)*panel.h};
   researchPosterAxisText(ctx,panel.title,x0,y0-posterDp(5),'title',p.ink,'left',x1-x0);
   posterYTicks(ctx,ticks,scale.y,x0,x1,p);
   if(!panel.hasValues)posterRoleFit(ctx,'chartLabel','无相邻可比较周',(x0+x1)/2,(y0+y1)/2,T.value,p.sub,'500','center',x1-x0);
   panel.lines.forEach((l,j)=>{
    const i=panel.offset+j,color=l.color||COLORS[i%COLORS.length],dash=boardFlowDash(i);
    points({...chart,lines:[l]},scale,pt=>{
     if(pt.previous){ctx.save();ctx.strokeStyle=color;ctx.lineWidth=T.line;ctx.setLineDash(dash);ctx.beginPath();ctx.moveTo(pt.previous.x,pt.previous.y);ctx.lineTo(pt.x,pt.y);ctx.stroke();ctx.restore();}
     canvasMarker(ctx,l.marker||markerAt(i),pt.x,pt.y,T.marker,color);
    });
   });
   yy=y1+gap;
  });
  posterWeekTicks(ctx,chart.periods,x,yy-gap,left,right,p);
 }
 function canvasBoardFlow(ctx,chart,box,p){
  if(mobilePosterActive(ctx))return canvasMobileBoardFlow(ctx,chart,box,p);
  if(!chart.periods.length||!chart.lines.length)return;
  const {left,right,top,bottom,width,height}=box,cols=width>=850?3:2,rows=Math.ceil(chart.lines.length/cols),legendStep=28,legendH=rows*legendStep+8;
  if(!auditPlot(ctx,width-111,height-legendH-91,'榜单流动双图绘图区',260,145))return;
  const layout=boardFlowLayout(chart,{left,right,top:top+legendH,bottom,width,height:height-legendH});
  chart.lines.forEach((l,i)=>{const cell=width/cols,x=left+i%cols*cell,y=top+(Math.floor(i/cols)+.75)*legendStep,color=l.color||COLORS[i%COLORS.length];canvasMarker(ctx,l.marker||markerAt(i),x+8,y-5,4,color);canvasText(ctx,l.name,x+20,y,18,p.ink,'600','left',cell-24);});
  const {x0,x1,x,panels,labels}=layout;
  panels.forEach(panel=>{
   canvasText(ctx,panel.title,x0,panel.top-9,18,p.ink,'600','left',x1-x0);
   panel.ticks.forEach(v=>{const y=panel.scale.y(v);ctx.strokeStyle=p.hair;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x0,y);ctx.lineTo(x1,y);ctx.stroke();canvasText(ctx,String(v),x0-8,y+5,16,p.sub,'500','right',48);});
   if(!panel.hasValues)canvasText(ctx,'无相邻可比较周',(x0+x1)/2,(panel.top+panel.bottom)/2,18,p.sub,'500','center',x1-x0);
   panel.lines.forEach((l,j)=>{
    const i=panel.offset+j,color=l.color||COLORS[i%COLORS.length],dash=boardFlowDash(i);
    points({...chart,lines:[l]},panel.scale,pt=>{
     if(pt.previous){ctx.save();ctx.strokeStyle=color;ctx.lineWidth=2.5;ctx.setLineDash(dash);ctx.beginPath();ctx.moveTo(pt.previous.x,pt.previous.y);ctx.lineTo(pt.x,pt.y);ctx.stroke();ctx.restore();}
     canvasMarker(ctx,l.marker||markerAt(i),pt.x,pt.y,3.2,color);
    });
   });
  });
  // Export has larger labels than the SVG; thin the common axis accordingly.
  const stride=Math.max(1,Math.ceil((chart.periods.length-1)/Math.max(1,Math.floor((x1-x0)/85))));
  labels.filter(({i})=>i===0||i===chart.periods.length-1||(i%stride===0&&chart.periods.length-1-i>=stride*.65)).forEach(({i,label})=>canvasText(ctx,label,x(i),panels[1].bottom+22,16,p.sub,'500','center',83));
 }
 function canvasLine(ctx,chart,scale){
  for(const band of chart.bands||[])for(const run of bandRuns(chart,band)){
   ctx.save();ctx.fillStyle=band.color||'#7c3aed';ctx.globalAlpha=Number.isFinite(band.opacity)?Math.max(0,Math.min(1,band.opacity)):.18;
   if(run.length===1){
    const i=run[0];ctx.fillRect(scale.x(i)-6,scale.y(band.upper[i]),12,scale.y(band.lower[i])-scale.y(band.upper[i]));
   }else{
    ctx.beginPath();
    run.forEach((i,j)=>j?ctx.lineTo(scale.x(i),scale.y(band.upper[i])):ctx.moveTo(scale.x(i),scale.y(band.upper[i])));
    [...run].reverse().forEach(i=>ctx.lineTo(scale.x(i),scale.y(band.lower[i])));
    ctx.closePath();ctx.fill();
   }
   ctx.restore();
  }
  points(chart,scale,p=>{if(p.previous){ctx.save();ctx.strokeStyle=p.color;ctx.lineWidth=mobilePosterActive(ctx)?MOBILE_POSTER_TYPE.line:4;ctx.setLineDash(p.previous.dashed?[11,8]:[]);ctx.beginPath();ctx.moveTo(p.previous.x,p.previous.y);ctx.lineTo(p.x,p.y);ctx.stroke();ctx.restore();}
   canvasMarker(ctx,p.marker,p.x,p.y,mobilePosterActive(ctx)?(chart.periods.length>35?posterDp(1.2):MOBILE_POSTER_TYPE.marker):(chart.periods.length>35?3.5:5),p.color,p.estimated);
  });
  if(chart.alerts&&chart.lines[1])chart.alerts.forEach((level,i)=>{
   const v=chart.lines[1].values[i];
   if(!level||!Number.isFinite(v))return;
   ctx.save();ctx.strokeStyle=level==='persistent'?'#b91c1c':'#c2410c';ctx.lineWidth=2.5;
   ctx.beginPath();ctx.arc(scale.x(i),scale.y(v),11,0,Math.PI*2);ctx.stroke();ctx.restore();
  });
 }
 function renderComposition(host,chart,label){
  const W=chart.kind==='brandContributionPair'?820:chart.kind==='dualBrandShareComparison'?1120:chart.kind==='brandCompetitionHeatmap'?Math.max(850,chart.periods.length*78+120):['coverageLayers','brandGrowth'].includes(chart.kind)?Math.max(chart.kind==='brandGrowth'?1080:900,chart.periods.length*(chart.kind==='brandGrowth'?52:48)+130):chart.kind==='generationDualAxis'?Math.max(780,chart.periods.length*56+120):chart.kind==='dualBrandFlowMulti'?Math.max(1150,chart.periods.length*125+140):chart.kind==='dualBrandFlow'?1080:chart.kind==='heatmap'?Math.max(850,chart.lines.length*94+210):chart.kind==='brandStack'?Math.max(780,chart.periods.length*78+120):850,H=chart.kind==='brandContributionPair'?590:chart.kind==='dualBrandShareComparison'?690:chart.kind==='brandCompetitionHeatmap'?490:chart.kind==='brandGrowth'?1120:chart.kind==='coverageLayers'?920:chart.kind==='dualBrandFlowMulti'?1080:chart.kind==='dualBrandFlow'?1070:chart.kind==='heatmap'?Math.max(510,chart.periods.length*42+135):chart.kind==='scatter'?560:510;
  const canvas=document.createElement('canvas'),density=Math.min(2,window.devicePixelRatio||1);
  canvas.width=Math.round(W*density);canvas.height=Math.round(H*density);canvas.style.cssText='display:block;width:100%;min-width:620px;background:#fff;border-radius:10px';
  if(chart.kind==='brandContributionPair')canvas.style.minWidth='0';
  if(chart.kind==='dualBrandShareComparison')canvas.style.minWidth='820px';
  if(chart.kind==='brandCompetitionHeatmap')canvas.style.minWidth=Math.max(620,W*.7)+'px';
  canvas.setAttribute('role','img');canvas.setAttribute('aria-label',label+'；完整数值见数据表');
  const ctx=canvas.getContext('2d');ctx.setTransform(density,0,0,density,0,0);ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);
  const box={left:16,right:W-16,top:16,bottom:H-16,width:W-32,height:H-32},p={ink:'#17263c',sub:'#64748b',hair:'#e4e9f0',accent:'#c93630',bar:'#265a87'};
  if(chart.kind==='brandContributionPair')drawBrandContributionPair(ctx,chart,box,p,true);else if(chart.kind==='dualBrandShareComparison')drawDualBrandShareComparison(ctx,chart,box,p);else if(chart.kind==='brandCompetitionHeatmap')drawBrandCompetitionHeatmap(ctx,chart,box,p,true);else if(chart.kind==='coverageLayers')drawCoverageLayers(ctx,chart,box,p,true);else if(chart.kind==='brandGrowth')drawBrandGrowth(ctx,chart,box,p,true);else if(chart.kind==='generationDualAxis')drawGenerationDualAxis(ctx,chart,box,p,true);else if(chart.kind==='dualBrandFlowMulti')drawDualBrandFlowMulti(ctx,chart,box,p,'上图为TOP30样本，下图为全市场份额 · 色带只表示同品牌变化');else if(chart.kind==='dualBrandFlow')drawDualBrandFlow(ctx,chart,box,p,'上下图统计范围不同 · 色带只表示同品牌变化');else if(chart.kind==='heatmap')drawResearchHeatmap(ctx,chart,box,p);else if(chart.kind==='scatter'||chart.kind==='bars')drawHeadStaticPoster(ctx,p,{chart,chartNote:''},box);else drawBrandComposition(ctx,chart,box,p,'');
  host.append(canvas);
  // Canvas is not automatically repainted when web fonts finish loading.
  if(chart.kind==='generationDualAxis'&&document.fonts){
   document.fonts.ready.then(()=>{
    if(!canvas.isConnected)return;
    ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);
    drawGenerationDualAxis(ctx,chart,box,p,true);
   }).catch(()=>{});
  }
 }
 return Object.freeze({rankAxis,lineAxis,lineScale,svgLine,canvasLine,renderComposition,markerAt,svgMarker,canvasMarker,svgBoardFlow,canvasBoardFlow});
})();
