/* Poster geometry, safety zones, watermark and template renderers. */
function posterHeading(type){const titles={top:'热销机型 TOP10',versus:'同榜机型 销量 PK',brands:'品牌上榜实力',leader:'榜首究竟有多强？'};const subs={top:'本榜单前十名 · 销量估算',versus:'同一榜单 · 销量差距',brands:'各品牌入榜销量与占比',leader:'榜首差距与样本销量占比'};return {title:titles[type],sub:subs[type]}}
// 与市场份额模块统一为浅灰蓝画布 + 白色圆角海报卡片。
// Theme-colored exterior + white editorial content card.
function drawPosterBackdrop(ctx,W,H,p){
 const {card:{x,y,width:w,height:h,rx:r},dotStep:step,dotOpacity}=PosterThemes.geometry(W,H);
 ctx.save();
 const gradient=ctx.createLinearGradient(0,0,0,H);
 gradient.addColorStop(0,p.bgTop);gradient.addColorStop(1,p.bgBottom);
 ctx.fillStyle=gradient;ctx.fillRect(0,0,W,H);
 ctx.shadowColor='rgba(34,60,96,0.11)';
 // Canvas 阴影参数不随坐标矩阵缩放，单独补偿像素倍率。
 const pixelRatio=ctx.getTransform().a;
 ctx.shadowBlur=21*pixelRatio;ctx.shadowOffsetY=7*pixelRatio;
 rounded(ctx,x,y,w,h,r,'#ffffff');
 ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetY=0;
 ctx.strokeStyle=p.hair;ctx.lineWidth=1.6;
 ctx.beginPath();ctx.roundRect(x+.8,y+.8,w-1.6,h-1.6,r);ctx.stroke();
 ctx.save();ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.clip();
 ctx.fillStyle=p.ink;ctx.globalAlpha=dotOpacity;
 for(let gy=y+2;gy<y+h;gy+=step){
  for(let gx=x+2;gx<x+w;gx+=step)ctx.fillRect(gx,gy,2,2);
 }
 ctx.restore();ctx.restore();
}
// Inner cards use the same white surface and themed border as module 2.
function drawDataCard(ctx,x,y,w,h,p,r=Math.round(1080*window.PosterThemes.layout.innerRadiusRatio)){
 ctx.save();
 const pixelRatio=ctx.getTransform().a;
 ctx.shadowColor='rgba(34,60,96,0.065)';ctx.shadowBlur=13*pixelRatio;ctx.shadowOffsetY=5*pixelRatio;
 rounded(ctx,x,y,w,h,r,'#ffffff');
 ctx.restore();
 ctx.strokeStyle=p.hair;ctx.lineWidth=1.6;
 ctx.beginPath();ctx.roundRect(x+.8,y+.8,w-1.6,h-1.6,r);ctx.stroke();
}

/* Independent-axis poster layout. All geometry remains in original 1080px
 * design coordinates; only output pixel density changes the Canvas transform.
 * Right reserve sets width, bottom reserve sets height independently. */
const BRAND_FOOTER_NOTE='品牌合并：小米/REDMI · OPPO/一加/realme · vivo/iQOO';
// A per-render audit uses the actual sizes and plot dimensions used by the renderer.
// It never alters the user's safety margins, chart data, or export resolution.
const posterAudits=new WeakMap();
// Reference coordinates preserve export sizes: 1080 units = 400 mobile CSS px.
const MOBILE_POSTER_TYPE=Object.freeze({title:72,subtitle:43,body:40,label:36,note:33,min:33,line:6,marker:7});
function mobilePosterActive(ctx){return posterAudits.has(ctx);}
function posterWrap(ctx,value,width,size,weight='550'){
 const lines=[];
 for(const raw of String(value??'').split(/\r?\n/)){
  let line='';
  for(const ch of raw){if(line&&measureMixedCanvas(ctx,line+ch,size,weight).width>width){lines.push(line.trim());line=ch;}else line+=ch;}
  if(line.trim())lines.push(line.trim());
 }
 return lines;
}
function posterWeekLabel(period,periods){
 const text=String(period);
 return /^\d{4}-W\d{2}$/.test(text)&&periods.every(v=>/^\d{4}-W\d{2}$/.test(String(v))&&String(v).slice(0,4)===text.slice(0,4))?text.slice(5):text;
}
function posterWeekTicks(ctx,periods,x,y,left,right,p){
 if(!periods.length)return;
 const labels=periods.map(v=>posterWeekLabel(v,periods)),size=MOBILE_POSTER_TYPE.label,n=labels.length;
 const widest=Math.max(...labels.map(v=>measureMixedCanvas(ctx,v,size,'550').width));
 const span=Math.max(1,x(n-1)-x(0)),count=Math.max(2,Math.min(7,Math.floor(span/(widest+15))+1));
 const stride=Math.max(1,Math.ceil((n-1)/(count-1)));
 labels.forEach((v,i)=>{
  if(i!==0&&i!==n-1&&(i%stride!==0||x(n-1)-x(i)<widest+10))return;
  const labelW=measureMixedCanvas(ctx,v,size,'550').width;
  const xx=Math.max(left+labelW/2,Math.min(right-labelW/2,x(i)));
  posterFitText(ctx,v,xx,y,size,p.sub,'550','center',right-left);
 });
}
function posterLineLegend(ctx,items,box,p){
 const {left,top,width}=box,T=MOBILE_POSTER_TYPE;
 const colors=['#2563eb','#ea580c','#059669','#9333ea','#7c3aed','#0891b2','#92400e','#64748b'];
 const cols=items.length>1?2:1,cell=width/cols,step=49;
 const rows=items.map((l,i)=>({...l,color:l.color||colors[i%colors.length],wrapped:posterWrap(ctx,l.name,cell-39,T.label,'600')}));
 const needed=rows.reduce((sum,l,i)=>i%cols===0?sum+Math.max(...rows.slice(i,i+cols).map(v=>Math.max(1,v.wrapped.length)))*step:sum,0);
 if(Number.isFinite(box.bottom)&&top+needed+160>box.bottom){auditIssue(ctx,'图例占用空间过多，请减少机型或切换9:16，完整数据仍可下载',true);return box.bottom;}
 let yy=top;
 for(let i=0;i<rows.length;i+=cols){
  const group=rows.slice(i,i+cols),height=Math.max(...group.map(l=>Math.max(1,l.wrapped.length)))*step;
  group.forEach((l,j)=>{
   const x=left+j*cell,base=yy+T.label;
   if(l.legendBand){ctx.save();ctx.fillStyle=l.color;ctx.globalAlpha=.45;ctx.fillRect(x,base-21,20,13);ctx.restore();}
   else if(l.marker)ResearchCharts.canvasMarker(ctx,l.marker,x+10,base-13,T.marker,l.color);
   else {ctx.fillStyle=l.color;ctx.fillRect(x,base-17,22,6);}
   l.wrapped.forEach((v,k)=>posterFitText(ctx,v,x+34,base+k*step,T.label,p.ink,'600','left',cell-39));
  });
  yy+=height;
 }
 return yy+12;
}
function auditIssue(ctx,message,blocking=false){
 const a=posterAudits.get(ctx);if(a)(blocking?a.errors:a.warnings).add(message);
}
function auditPlot(ctx,width,height,label,minWidth=180,minHeight=120){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0){auditIssue(ctx,label+'无有效绘制空间',true);return false;}
 if(width<minWidth||height<minHeight)auditIssue(ctx,label+'较紧凑，建议减少留白或切换 9:16');
 return true;
}
function auditPosterGeometry(ctx,L,type,research){
 if(!auditPlot(ctx,L.cardWidth,L.bodyHeight,'主体内容区',420,360))return false;
 if(L.footerY<0||L.bodyBottom<=L.bodyTop){auditIssue(ctx,'附注占用过多空间，主体或页脚无法完整排布',true);return false;}
 if(L.footerLines.length>5)auditIssue(ctx,'免责附注超过5行，建议精简');
 if(L.footerLines.length&&L.footSize<16)auditIssue(ctx,'附注字号偏小');
 if(type==='top'&&(L.bodyHeight-28)/10<75)auditIssue(ctx,'TOP10 行高偏小');
 if(research?.chart?.lines?.length>8&&!['brandStack','brandRibbon','bars','scatter','heatmap','brandGrowth','dualBrandShareComparison','brandContributionPair'].includes(research.chart.kind))auditIssue(ctx,'曲线较多，建议减少机型或分组');
 if(research?.chart?.kind==='heatmap'&&(research.chart.periods.length>8||research.chart.lines.length>8))auditIssue(ctx,'热力矩阵类别较多，建议降低每轴类别上限或使用9:16');
 return true;
}
function showPosterAudit(a){
 const node=$('posterLayoutQuality');if(!node)return;
 const errors=[...a.errors],warnings=[...a.warnings],issues=errors.length?errors:warnings;
 node.hidden=issues.length===0;
 const message=errors.length?'海报布局不可导出：'+issues.join('；')+'。请缩短附注、减少留白或切换比例。':warnings.length?'海报可读性提示：'+issues.join('；')+'。仍可导出，请核对预览。':'';
 const cls='msg studio-layout-warning '+(errors.length?'bad':'warn');
 if(node.className!==cls)node.className=cls;if(node.textContent!==message)node.textContent=message;
}
function posterFitText(ctx,value,x,y,size,color,weight='600',align='left',width=Infinity){
 const str=String(value??'');
 const measured=measureMixedCanvas(ctx,str,size,weight).width;
 const fit=measured>width?size*width/measured:size;
 if(str.trim()){
  if(!Number.isFinite(fit)||fit<=0){auditIssue(ctx,'文字区域无有效宽度',true);return;}
  if(mobilePosterActive(ctx)&&fit<MOBILE_POSTER_TYPE.min*(posterAudits.get(ctx).referenceWidth||1080)/1080)auditIssue(ctx,'部分文字低于手机阅读目标（400px宽时12px），建议减少项目或改用9:16');else if(fit<14||fit<size*.60)auditIssue(ctx,'部分文字因空间不足而缩小');
 }
 canvasText(ctx,str,x,y,Math.max(1,fit),color,weight,align);
}
function posterRule(ctx,x1,x2,y,p){
 ctx.strokeStyle=p.hair;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x1,y);ctx.lineTo(x2,y);ctx.stroke();
}
function getPosterLayout(ctx,W,H,type,o,right,bottom,copy=getPosterCopy(type,o)){
 const safeRight=W-Math.round(W*right),safeBottom=H-Math.round(H*bottom);
 const left=70,rightEdge=safeRight-Math.max(24,70-Math.round(W*right));
 const cardX=52,cardRight=rightEdge+18;
 const T=MOBILE_POSTER_TYPE,width=rightEdge-left;
 const footerLines=posterWrap(ctx,copy.disclaimer,width,T.note,'560');
 const brandNote=type==='brands'&&o.brands.length>0;
 const brandLines=brandNote?posterWrap(ctx,BRAND_FOOTER_NOTE,width,T.note,'530'):[];
 const lineStep=43,footSize=T.note;
 const footerHeight=(footerLines.length+brandLines.length)*lineStep+(footerLines.length?18:0);
 const footerY=safeBottom-34-footerHeight;
 const markLeft=String(copy.markLeft??'').trim(),markRight=String(copy.markRight??'').trim();
 const titleLines=posterWrap(ctx,copy.title,width,T.title,'850'),subtitleLines=posterWrap(ctx,copy.subtitle,width,T.subtitle,'550');
 const tagLines=posterWrap(ctx,copy.tagLabel,width-32,T.label,'760');
 const titleY=markLeft||markRight?142:90;
 const subtitleY=titleY+Math.max(1,titleLines.length)*82-19;
 const tagY=subtitleY+Math.max(1,subtitleLines.length)*52-8;
 const bodyTop=tagY+(tagLines.length?tagLines.length*44+27:5)+15;
 const bodyBottom=footerY-18;
 return {W,H,safeRight,safeBottom,left,right:rightEdge,width,cardX,cardRight,cardWidth:cardRight-cardX,bodyTop,bodyBottom,bodyHeight:bodyBottom-bodyTop,footerY,footerLines,brandNote,brandLines,lineStep,footSize,copy,markLeft,markRight,titleLines,subtitleLines,tagLines,titleY,subtitleY,tagY};
}
function posterFrame(ctx,L,o,p){
 const {left,right,width,markLeft,markRight,titleLines,subtitleLines,tagLines,titleY,subtitleY,tagY,bodyTop}=L,T=MOBILE_POSTER_TYPE;
 if(markLeft)posterFitText(ctx,markLeft,left,57,T.note,p.accent,'800','left',width*.47);
 if(markRight)posterFitText(ctx,markRight,right,57,T.note,p.sub,'600','right',width*.47);
 titleLines.forEach((v,i)=>posterFitText(ctx,v,left,titleY+i*82,T.title,p.ink,'850','left',width));
 subtitleLines.forEach((v,i)=>posterFitText(ctx,v,left,subtitleY+i*52,T.subtitle,p.sub,'550','left',width));
 if(tagLines.length){
  const tagW=Math.min(width,Math.max(...tagLines.map(v=>measureMixedCanvas(ctx,v,T.label,'760').width))+32);
  rounded(ctx,left,tagY-34,tagW,tagLines.length*44+10,15,p.panel2);
  tagLines.forEach((v,i)=>posterFitText(ctx,v,left+16,tagY+i*44,T.label,p.accent,'760','left',tagW-32));
 }
 posterRule(ctx,left,right,bodyTop-12,p);
}
function drawPosterFooter(ctx,L,p){
 const {left,right,width,footerY,footerLines,brandLines,lineStep,footSize}=L;
 if(!footerLines.length&&!brandLines.length)return;
 posterRule(ctx,left,right,footerY,p);
 [...brandLines,...footerLines].forEach((line,i)=>posterFitText(ctx,line,left,footerY+36+i*lineStep,footSize,p.sub,'560','left',width));
}
function paintBar(ctx,x,y,w,h,ratio,p,highlight=false,brandColor=null){
 if(w<=0||h<=0)return;
 rounded(ctx,x,y,w,h,h/2,p.track);
 rounded(ctx,x,y,Math.max(ratio>0?2:0,w*Math.min(1,Math.max(0,Number(ratio)||0))),h,h/2,brandColor||(highlight?p.bar2:p.bar));
}
function drawTop(ctx,L,o,p){
 const entries=o.models.slice(0,10);if(!entries.length)return;
 const {cardX,cardRight,cardWidth,bodyTop,bodyBottom}=L;
 drawDataCard(ctx,cardX,bodyTop,cardWidth,bodyBottom-bodyTop,p);
 const left=cardX+26,right=cardRight-26,rankW=Math.min(70,(right-left)*.12),nameX=left+rankW;
 const saleW=Math.min(280,(right-nameX)*.35),nameW=right-nameX-saleW-12;
 const step=(bodyBottom-bodyTop-28)/10,max=entries[0].pixels||1;
 if(!auditPlot(ctx,right-nameX,step,'榜单行',220,55))return;
 entries.forEach((m,i)=>{
  const y=bodyTop+14+i*step,base=y+step*.58;
  const font=Math.min(MOBILE_POSTER_TYPE.body,step*.55),barH=Math.min(13,step*.16);
  if(i===0)rounded(ctx,cardX+10,y-3,cardWidth-20,step-3,14,p.panel2);
  const ink=i===0?p.bar2:p.ink;
  posterFitText(ctx,String(m.rank).padStart(2,'0'),left,base,Math.min(MOBILE_POSTER_TYPE.label,font),p.accent,'850','left',rankW-8);
  posterFitText(ctx,m.name,nameX,base,font,ink,'680','left',nameW);
  posterFitText(ctx,o.fit.k===null?'待标定':displayWan(m.sale)+' 万台',right,base,Math.min(MOBILE_POSTER_TYPE.body,font),ink,'750','right',saleW);
  paintBar(ctx,nameX,y+step*.77,right-nameX,barH,m.pixels/max,p,i===0);
 });
}
function chooseDuelModelLabel(ctx,original,maxWidth,baseSize=43){
 const full=String(original||'').trim().replace(/\s+/g,' ');
 const short=full.replace(/^(?:华为|荣耀|小米|REDMI|OPPO|vivo|iQOO|一加|苹果|Apple)\s*(?:[·・:：—-]\s*)?/i,'').trim();
 const label=measureMixedCanvas(ctx,full,baseSize,'800').width<=maxWidth?full:(short||full);
 let size=baseSize;while(size>20&&measureMixedCanvas(ctx,label,size,'800').width>maxWidth)size--;
 return {text:label,size};
}
function drawDuel(ctx,L,o,p,state=socialState){
 const a=o.models[state.duelA]||o.models[0],b=o.models[state.duelB]||o.models[1];if(!a||!b)return;
 const {left,right,width,bodyTop,bodyHeight}=L;
 const ratio=Math.max(.00001,a.pixels)/Math.max(.00001,b.pixels);
 const gap=18,w=(width-gap)/2,panelH=bodyHeight*.56,y=bodyTop;
 [[a,0],[b,1]].forEach(([m,i])=>{
  const x=left+i*(w+gap),ix=x+22,iw=w-44;
  drawDataCard(ctx,x,y,w,panelH,p);
  posterFitText(ctx,(i?'对比机型':'参考机型')+' · 第 '+m.rank+' 名',ix,y+panelH*.13,Math.min(27,panelH*.085),p.accent,'800','left',iw);
  const model=chooseDuelModelLabel(ctx,m.name,iw,Math.min(43,panelH*.12));
  posterFitText(ctx,model.text,ix,y+panelH*.32,model.size,p.ink,'800','left',iw);
  posterRule(ctx,ix,ix+iw,y+panelH*.40,p);
  posterFitText(ctx,'估算销量',ix,y+panelH*.54,Math.min(25,panelH*.073),p.sub,'630','left',iw);
  posterFitText(ctx,o.fit.k!==null?displayWan(m.sale):'待标定',ix,y+panelH*.74,Math.min(68,panelH*.17),p.ink,'830','left',iw);
  posterFitText(ctx,o.fit.k!==null?'万台':'',ix,y+panelH*.86,Math.min(27,panelH*.07),p.sub,'620','left',iw);
  paintBar(ctx,ix,y+panelH*.91,iw,Math.min(15,panelH*.04),m.pixels/Math.max(1,a.pixels,b.pixels),p,i===0);
 });
 const y2=y+panelH+18,h=bodyHeight-panelH-18,high=a.pixels>=b.pixels?a:b;
 // Bottom summaries are laid out in their own vertical band, not a scaled image.
 posterFitText(ctx,'销量比例',left,y2+h*.13,Math.min(29,h*.115),p.sub,'720','left',width);
 posterFitText(ctx,'销量较高：'+high.name,left,y2+h*.28,Math.min(27,h*.105),p.sub,'620','left',width);
 posterFitText(ctx,displayTimes(Math.max(ratio,1/ratio)),left,y2+h*.58,Math.min(103,h*.26),p.accent,'900','left',width);
 posterFitText(ctx,'两款估算销量差值',left,y2+h*.75,Math.min(28,h*.10),p.sub,'700','left',width);
 posterFitText(ctx,o.fit.k===null?'待标定':displaySale(Math.abs(a.sale-b.sale)),left,y2+h*.96,Math.min(60,h*.19),p.ink,'830','left',width);
}
function drawBrands(ctx,L,o,p){
 const brands=o.brands.slice(0,7);if(!brands.length)return;
 const {left,right,width,cardX,cardWidth,bodyTop,bodyBottom}=L;
 const n=brands.length,first=brands[0].pixels||1;
 drawDataCard(ctx,cardX,bodyTop,cardWidth,bodyBottom-bodyTop,p);
 posterFitText(ctx,`品牌系列榜 · ${n} 组｜上榜合计 ${o.models.length} 条`,left,bodyTop+38,MOBILE_POSTER_TYPE.note,p.sub,'600','left',width);
 const top=bodyTop+55,step=(bodyBottom-top-12)/n;
 if(step<105)auditIssue(ctx,'品牌行高偏小，建议使用9:16');
 brands.forEach((b,i)=>{
  const y=top+i*step,hot=i===0,font=Math.min(MOBILE_POSTER_TYPE.body,step*.32),barH=Math.min(15,step*.11),salesW=width*.55;
  posterFitText(ctx,`${i+1}. ${b.brand}（${b.count}款）`,left,y+step*.28,font,p.ink,'760','left',width-salesW-12);
  posterFitText(ctx,`${displaySale(b.sale)}  ·  ${fmt(b.share*100,1)}%`,right,y+step*.28,Math.min(MOBILE_POSTER_TYPE.body,font),hot?p.bar2:p.ink,'750','right',salesW);
  paintBar(ctx,left,y+step*.40,width,barH,b.pixels/first,p,hot,window.BrandUtils.color(b.brand));
  posterFitText(ctx,'主力爆款：'+b.hero,left,y+step*.83,Math.min(MOBILE_POSTER_TYPE.note,step*.31),p.sub,'560','left',width);
 });
}
function drawLeader(ctx,L,o,p){
 const a=o.models[0],b=o.models[1];if(!a||!b)return;
 const {left,right,width,bodyTop:y,bodyHeight:h}=L;
 const heroH=h*.32,innerX=left+28,innerW=width-56;
 drawDataCard(ctx,left,y,width,heroH,p);
 posterFitText(ctx,'本榜第一名',innerX,y+heroH*.22,Math.min(28,heroH*.14),p.accent,'750','left',innerW);
 posterFitText(ctx,a.name,innerX,y+heroH*.51,Math.min(49,heroH*.24),p.ink,'850','left',innerW);
 posterFitText(ctx,o.fit.k===null?'待标定':displayWan(a.sale)+' 万台',innerX,y+heroH*.87,Math.min(83,heroH*.32),p.ink,'850','left',innerW);
 const midY=y+heroH+18,midH=h*.33-18;
 posterFitText(ctx,'第一名对比第二名',left,midY+midH*.13,Math.min(30,midH*.13),p.sub,'650','left',width);
 posterFitText(ctx,'约 '+displayTimes(o.ratio),left,midY+midH*.48,Math.min(76,midH*.32),p.accent,'900','left',width);
 posterFitText(ctx,'领先估算销量',left,midY+midH*.67,Math.min(28,midH*.13),p.sub,'650','left',width);
 posterFitText(ctx,o.fit.k===null?'待标定':displayWan(a.sale-b.sale)+' 万台',left,midY+midH*.95,Math.min(51,midH*.25),p.ink,'780','left',width);
 const lowY=y+h*.65+8,lowH=h*.35-8;
 posterRule(ctx,left,right,lowY,p);
 posterFitText(ctx,'样本内销量集中度',left,lowY+lowH*.19,Math.min(32,lowH*.16),p.ink,'760','left',width);
 [['TOP3占比',o.top3],['TOP5占比',o.top5]].forEach(([label,val],i)=>{
  const yy=lowY+lowH*(.40+i*.33);
  posterFitText(ctx,label,left,yy,Math.min(29,lowH*.13),p.sub,'650','left',width*.5);
  posterFitText(ctx,displayPct(val),right,yy,Math.min(38,lowH*.17),p.ink,'830','right',width*.45);
  paintBar(ctx,left,yy+lowH*.06,width,Math.min(16,lowH*.065),val,p,i===0);
 });
}

function drawSafeGuides(ctx,W,H,p){if(!socialState.safeEnabled||!socialState.safeGuides)return;const right=Math.max(0,Math.min(.35,socialState.safeRight/100)),bottom=Math.max(0,Math.min(.35,socialState.safeBottom/100));const rw=W*right,bh=H*bottom;ctx.save();ctx.fillStyle='rgba(255,80,110,0.12)';if(rw>0)ctx.fillRect(W-rw,0,rw,H);ctx.fillStyle='rgba(255,179,37,0.13)';if(bh>0)ctx.fillRect(0,H-bh,W,bh);ctx.setLineDash([12,10]);ctx.lineWidth=3;if(rw>0){ctx.strokeStyle='rgba(255,88,124,0.92)';ctx.beginPath();ctx.moveTo(W-rw,0);ctx.lineTo(W-rw,H);ctx.stroke();}if(bh>0){ctx.strokeStyle='rgba(255,176,31,0.95)';ctx.beginPath();ctx.moveTo(0,H-bh);ctx.lineTo(W,H-bh);ctx.stroke();}ctx.setLineDash([]);if(rw>0){rounded(ctx,W-rw-248,32,220,42,14,'rgba(255,88,124,0.92)');canvasText(ctx,'右侧交互安全区 '+Math.round(right*100)+'%',W-rw-138,60,20,'#ffffff','800','center',200)}if(bh>0){rounded(ctx,34,H-bh-56,236,42,14,'rgba(255,176,31,0.96)');canvasText(ctx,'底部文案安全区 '+Math.round(bottom*100)+'%',152,H-bh-28,20,'#12202f','900','center',220)}ctx.restore()}

function drawImageWatermark(ctx,W,H,right,bottom,wm=watermarkState,state=socialState,p=socialPalettes[state.theme]){
 const params=PosterWatermark.parameters(wm);
 if(!params)return;
 const {diagonal,text,opacity,size,gap}=params;
 const safeRight=state.safeEnabled?W*(1-right):W-22;
 const safeBottom=state.safeEnabled?H*(1-bottom):H-22;
 const left=25,top=25,usableWidth=Math.max(1,safeRight-left-8),usableHeight=Math.max(1,safeBottom-top-8);
 const cx=left+usableWidth/2,cy=top+usableHeight/2;
 ctx.save();ctx.beginPath();ctx.rect(left,top,usableWidth,usableHeight);ctx.clip();
 ctx.fillStyle=(p?.muted||'#425772');ctx.globalAlpha=opacity;ctx.font='700 '+size+'px '+CJK_FONT;
 ctx.textAlign='center';ctx.textBaseline='middle';
 if(diagonal){
  ctx.translate(cx,cy);ctx.rotate(-28*Math.PI/180);
  const span=Math.hypot(W,H)+gap*2;let row=0;
  for(let y=-span/2;y<span/2;y+=gap){
   for(let x=-span/2+(row%2?gap/2:0);x<span/2;x+=gap)ctx.fillText(text,x,y);
   row++;
  }
 }else{
  ctx.fillText(text,cx,cy,usableWidth*.86);
 }
 ctx.restore();
}


function drawPoster(type,canvas,o=socialData(),showGuides=false,pixelRatio=1,publication=null){
 const state=publication?.state||socialState,research=publication?publication.research:socialResearchSnapshot;
 const H=state.ratio==='9:16'?1920:1440,W=1080;
 canvas.width=Math.round(W*pixelRatio);canvas.height=Math.round(H*pixelRatio);
 const ctx=canvas.getContext('2d',{alpha:false});
 ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);
 const p=publication?.palette||socialPalettes[state.theme];
 const right=state.safeEnabled?Math.max(0,Math.min(.35,state.safeRight/100)):0;
 const bottom=state.safeEnabled?Math.max(0,Math.min(.35,state.safeBottom/100)):0;
 const L=getPosterLayout(ctx,W,H,type,o,right,bottom,publication?.copy||getPosterCopy(type,o));
 const audit={errors:new Set(),warnings:new Set()};posterAudits.set(ctx,audit);
 const layoutOK=auditPosterGeometry(ctx,L,type,isResearchTemplate(type)?research:null);
 drawPosterBackdrop(ctx,W,H,p);
 ctx.save();
 // Clip content (not background) to independently computed safe boundaries.
 ctx.beginPath();ctx.rect(0,0,L.safeRight,L.safeBottom);ctx.clip();
 posterFrame(ctx,L,o,p);
 if(layoutOK){
 if(type==='top')drawTop(ctx,L,o,p);
 else if(type==='versus')drawDuel(ctx,L,o,p,state);
 else if(type==='brands')drawBrands(ctx,L,o,p);
 else if(isResearchTemplate(type)){const copy=publication?.copy||getPosterCopy(type,o);drawResearchPosterContent(ctx,L,p,{...research,chartNote:copy.chartNote??research?.chartNote??''});}
 else drawLeader(ctx,L,o,p);
 drawPosterFooter(ctx,L,p);
 }
 if(!layoutOK){posterFitText(ctx,'布局空间不足，请调整留白或附注',L.left,Math.min(L.safeBottom-20,360),32,p.warn,'800','left',L.width);}
 if(layoutOK&&!(publication?publication.ready:canDownloadSocial(o,type))){
  ctx.save();ctx.translate(L.left+L.width/2,L.bodyTop+L.bodyHeight/2);ctx.rotate(-.18);
  rounded(ctx,-L.width*.46,-58,L.width*.92,120,15,'#dfe7ef');ctx.globalAlpha=.96;
  posterFitText(ctx,isResearchTemplate(type)?'当前专题无可发布数据':o.canPublish?'名称待补全 · 暂勿发布':o.fit.k?'标定冲突 · 请核对':'待标定 · 不可发布',0,19,59,p.warn,'900','center',L.width*.85);
  ctx.restore();
 }
 ctx.restore();
 drawImageWatermark(ctx,W,H,right,bottom,publication?.watermark||watermarkState,state,p);
 posterAudits.delete(ctx);
 if(showGuides)drawSafeGuides(ctx,W,H,p);
 if(showGuides&&!publication){
  showPosterAudit(audit);
  const unavailable=publicationJob.busy||audit.errors.size>0;
  const singleDisabled=unavailable||!canDownloadSocial(o,type);
  $('downloadCard').disabled=singleDisabled;
  $('downloadVersions').disabled=singleDisabled||!socialState.safeEnabled;
  $('downloadAllCards').disabled=unavailable||!canDownloadSocial(o,isResearchTemplate(type)?type:'bundle');
 }
 return {errors:[...audit.errors],warnings:[...audit.warnings]};
}

function drawTrackerTrendPoster(ctx,p,s,box){
 const {left,right,top,bottom,width,height}=box,chart=s.chart,n=chart.periods.length,lines=chart.lines,count=lines.length,kind=chart.kind;
 const rankOnly=kind==='trackerRank',matrix=kind==='trackerMatrix',both=kind==='trackerBoth';
 const rankLines=both?chart.rankLines:lines;
 const ranks=rankLines.flatMap(l=>l.values.filter(Number.isFinite));
 const min=ranks.length?Math.min(...ranks):0,max=ranks.length?Math.max(...ranks):0,span=max-min;
 const notes=String(s.chartNote??'').split(/\r?\n/).filter(v=>v.trim());
 const noteHeight=notes.length?notes.length*24+8:0;
 const note=()=>notes.forEach((v,i)=>posterFitText(ctx,v,left,bottom-8-(notes.length-1-i)*24,19,p.sub,'550','left',width));
 if(!n||!count)return;
 if(matrix){
  const labelW=Math.min(width*.31,210),cw=(width-labelW)/n,ch=Math.min(56,(height-42-noteHeight)/count);
  if(cw<20||ch<20){auditIssue(ctx,'排名矩阵过密，请缩短区间、减少机型或使用9:16图卡',true);return;}
  chart.periods.forEach((v,i)=>posterFitText(ctx,v,left+labelW+(i+.5)*cw,top+23,Math.min(18,cw*.45),p.sub,'600','center',cw-3));
  lines.forEach((l,j)=>{
   const y=top+34+j*ch;
   posterFitText(ctx,l.name,left+labelW-9,y+ch*.64,Math.min(22,ch*.52),p.ink,'650','right',labelW-12);
   l.values.forEach((v,i)=>{
    const valid=Number.isFinite(v),x=left+labelW+i*cw;
    const color=!valid?'#eef1f5':v===1?'#164e87':v<=3?'#327ab5':v<=5?'#83b6dc':v<=10?'#c6ddf0':'#e8f0f8';
    rounded(ctx,x+2,y+2,cw-4,ch-4,3,color);
    posterFitText(ctx,valid?String(v):l.statuses?.[i]==='榜单缺失'?'×':'—',x+cw/2,y+ch*.66,Math.min(23,ch*.56,cw*.53),valid&&v<=3?'#fff':'#334155','700','center',cw-6);
   });
  });
  note();return;
 }
 const legendBottom=posterLineLegend(ctx,lines,box,p);
 const plotTop=legendBottom,plotBottom=bottom-noteHeight,gap=both?42:0,part=(plotBottom-plotTop-gap)/(both?2:1);
 if(!auditPlot(ctx,width-138,part-105,'机型追踪绘图区',260,both?95:150))return;
 function plot(isRank,yStart){
  const x0=left+112,x1=right-26,y0=yStart+46,y1=yStart+part-59;
  const series=isRank?rankLines:lines;
  const scale=isRank?{x:i=>n===1?(x0+x1)/2:x0+i*(x1-x0)/(n-1),y:v=>span===0?(y0+y1)/2:y0+(v-min)*(y1-y0)/span}:ResearchCharts.lineScale(chart,{left:x0,right:x1,top:y0,bottom:y1});
  researchPosterAxisText(ctx,isRank?'原始榜单排名':(chart.salesLabel||'销量走势')+' / 万台',x0,y0-10,'title',p.ink,'left',width-100);
  const rankStep=Math.max(1,Math.ceil(span/5)),ticks=isRank?(ranks.length?[...new Set([...Array.from({length:Math.floor(span/rankStep)+1},(_,i)=>min+i*rankStep),max])]:[]):Array.from({length:5},(_,i)=>scale.top*i/4);
  for(const v of ticks){const y=scale.y(v);ctx.strokeStyle=p.hair;ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(x0,y);ctx.lineTo(x1,y);ctx.stroke();researchPosterAxisText(ctx,String(Number(v.toFixed(2))),x0-10,y+9,'tick',p.sub,'right',100);}
  posterWeekTicks(ctx,chart.periods,scale.x,y1+43,left,right,p);
   if(isRank&&!ranks.length){posterFitText(ctx,'无原始排名记录',(x0+x1)/2,(y0+y1)/2,20,p.sub,'600','center',x1-x0);return;}
  ResearchCharts.canvasLine(ctx,{...chart,lines:series},scale);
 }
 if(both){plot(false,plotTop);plot(true,plotTop+part+gap);}else plot(rankOnly,plotTop);
 note();
}

function drawResearchPosterContent(ctx,L,p,s){
 if(!s)return;
 const {cardX,cardWidth,bodyTop,bodyBottom,bodyHeight}=L;
 drawDataCard(ctx,cardX,bodyTop,cardWidth,bodyHeight,p);
 const left=cardX+26,right=cardX+cardWidth-26,start=bodyTop+16,bottom=bodyBottom-14;
 drawResearchChartContent(ctx,p,s,{left,right,top:start,bottom,width:right-left,height:bottom-start});
}

// Shared content renderer: the studio supplies its poster body, while direct PNG
// supplies a flexible chart-sized canvas with no social safe area or frame.
function drawResearchChartContent(ctx,p,s,box){
 const {left,right,top:start,bottom,width}=box;
 const notes=posterWrap(ctx,s.chartNote,width,MOBILE_POSTER_TYPE.note,'550');
 const noteHeight=notes.length?notes.length*43+12:0,chartBottom=bottom-noteHeight;
 const chartBox={left,right,top:start,bottom:chartBottom,width,height:chartBottom-start};
 const drawNotes=()=>notes.forEach((line,i)=>posterFitText(ctx,line,left,bottom-8-(notes.length-1-i)*43,MOBILE_POSTER_TYPE.note,p.sub,'550','left',width));
 if(notes.length>6)auditIssue(ctx,'图表内附注超过6行，建议精简');
 if(!auditPlot(ctx,width,chartBox.height,'研究图表内容区',360,230))return;
 if(['trackerBoth','trackerRank','trackerMatrix'].includes(s.chart?.kind)){drawTrackerTrendPoster(ctx,p,{...s,chartNote:''},chartBox);drawNotes();return;}
 if(s.chart?.kind==='boardFlow'){ResearchCharts.canvasBoardFlow(ctx,s.chart,chartBox,p);drawNotes();return;}
 if(s.chart?.kind==='coverageLayers'){drawCoverageLayers(ctx,s.chart,chartBox,p);drawNotes();return;}
 if(s.chart?.kind==='brandContributionPair'){drawBrandContributionPair(ctx,s.chart,chartBox,p);drawNotes();return;}
 if(s.chart?.kind==='dualBrandShareComparison'){drawDualBrandShareComparison(ctx,s.chart,chartBox,p);drawNotes();return;}
 if(s.chart?.kind==='brandCompetitionHeatmap'){drawBrandCompetitionHeatmap(ctx,s.chart,chartBox,p);drawNotes();return;}
 if(s.chart?.kind==='brandGrowth'){drawBrandGrowth(ctx,s.chart,chartBox,p);drawNotes();return;}
 if(s.chart?.kind==='generationDualAxis'){drawGenerationDualAxis(ctx,s.chart,chartBox,p);drawNotes();return;}
 if(s.chart?.kind==='heatmap'){drawResearchHeatmap(ctx,s.chart,chartBox,p,'');drawNotes();return;}
 if(s.chart?.kind==='dualBrandFlowMulti'){drawDualBrandFlowMulti(ctx,s.chart,chartBox,p,'');drawNotes();return;}
  if(s.chart?.kind==='dualBrandFlow'){drawDualBrandFlow(ctx,s.chart,chartBox,p,'');drawNotes();return;}
 if(s.chart?.kind==='brandStack'||s.chart?.kind==='brandRibbon'){drawBrandComposition(ctx,s.chart,chartBox,p,'');drawNotes();return;}
 if(s.chart?.kind==='bars'||s.chart?.kind==='scatter'){drawHeadStaticPoster(ctx,p,{...s,chartNote:''},chartBox);drawNotes();return;}
 if(s.chart){
  const {periods,lines,unit}=s.chart,n=periods.length,bands=s.chart.bands||[],legendItems=[...lines.map(l=>({...l,legendBand:false})),...bands.map(b=>({...b,legendBand:true}))],count=legendItems.length;
  const legendBottom=posterLineLegend(ctx,legendItems,chartBox,p);
   const x0=left+112,x1=right-26,y0=legendBottom+48,y1=chartBottom-59;
   if(!auditPlot(ctx,x1-x0,y1-y0,'折线图绘图区',260,220))return;
   const scale=ResearchCharts.lineScale(s.chart,{left:x0,right:x1,top:y0,bottom:y1}),{top,x,y}=scale;
   researchPosterAxisText(ctx,unit,x0,y0-12,'title',p.sub,'left',width-112);
   for(let i=0;i<=4;i++){const v=top*i/4;ctx.strokeStyle=p.hair;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x0,y(v));ctx.lineTo(x1,y(v));ctx.stroke();researchPosterAxisText(ctx,Number(v.toFixed(2)),x0-10,y(v)+9,'tick',p.sub,'right',100);}
   posterWeekTicks(ctx,periods,x,y1+43,left,right,p);
   ResearchCharts.canvasLine(ctx,s.chart,scale);
  drawNotes();
 }else if(s.table){
  const rows=s.table.rows,indices=[0,1,2,3,7],labels=['机型','观测周','最长连续','末周连续','上榜合计/万台'];
  const widths=[.36,.14,.14,.14,.22].map(f=>f*width),headY=start+23;
  let off=left;labels.forEach((label,i)=>{posterFitText(ctx,label,off+(i?widths[i]-8:0),headY,22,p.sub,'650',i?'right':'left',widths[i]-12);off+=widths[i];});
  const maxRows=Math.min(10,rows.length),step=Math.min(78,(chartBottom-headY-22)/Math.max(1,maxRows));
  if(!auditPlot(ctx,width,step,'研究表格行',360,32))return;
  if(step<17){auditIssue(ctx,'研究表格行过小，无法完整显示',true);return;}
  rows.slice(0,maxRows).forEach((row,i)=>{const yy=headY+(i+1)*step;let xx=left;posterRule(ctx,left,right,yy+Math.min(10,step*.18),p);indices.forEach((k,j)=>{posterFitText(ctx,row[k]??'',xx+(j?widths[j]-8:0),yy,Math.min(24,step*.57),p.ink,j?'600':'700',j?'right':'left',widths[j]-12);xx+=widths[j];});});
  drawNotes();
 }
}




// Direct research PNG: vector-style Canvas re-render from a frozen data snapshot,
// not a bitmap copy of the visible SVG/Canvas and not a social poster.
function researchDirectGeometry(s){
 const c=s.chart,n=c?.periods?.length||0,count=c?.lines?.length||0,kind=c?.kind||'line';
 let width=1080,height=690+Math.ceil((count+(c?.bands?.length||0))/2)*100;
 if(kind==='trackerBoth')height=1250+Math.ceil(count/2)*100;
 if(kind==='boardFlow')height=570;
 if(kind==='trackerMatrix'){width=Math.max(1080,n*56+280);height=Math.max(420,count*44+70);}
 if(kind==='trackerRank')height=690+Math.ceil(count/2)*100;
 if(kind==='generationDualAxis')height=900;
 if(kind==='coverageLayers')height=1000;
 if(kind==='brandContributionPair'){width=960;height=690;}
 if(kind==='dualBrandShareComparison'){width=1200;height=740;}
 if(kind==='brandCompetitionHeatmap'){width=Math.max(1080,n*90+160);height=600;}
 if(kind==='brandGrowth'){width=Math.max(1080,n*106+160);height=1120;}
 if(kind==='dualBrandFlowMulti'){width=Math.max(1150,n*125+140);height=1080;}
 if(kind==='dualBrandFlow'){width=1080;height=1070;}
 if(kind==='brandStack'||kind==='brandRibbon'){width=Math.max(1080,n*78+160);height=Math.max(650,480+Math.ceil(count/3)*36);}
 if(kind==='heatmap'){width=Math.max(1080,count*96+220);height=Math.max(560,n*44+150);}
 if(kind==='scatter'){width=1080;height=Math.max(660,420+Math.ceil(n/2)*29);}
 if(kind==='bars'){width=1080;height=Math.max(560,n*65+100);}
 if(!c&&s.table){
  const cols=s.table.headers.length;
  width=Math.max(1080,260+Math.max(0,cols-1)*150);
  height=Math.max(300,86+s.table.rows.length*60);
 }
 return {width,height};
}
function wrapDirectResearchText(ctx,value,width,size=19){
 const result=[];
 for(const raw of String(value??'').split(/\r?\n/)){
  let line='';
  for(const ch of raw){if(line&&measureMixedCanvas(ctx,line+ch,size,'400').width>width){result.push(line);line=ch;}else line+=ch;}
  if(line.trim())result.push(line);
 }
 return result;
}
function drawDirectResearchTable(ctx,p,table,box){
 const {left,top,width}=box,headers=table.headers,rows=table.rows;
 if(!headers.length||!rows.length)return;
 const first=Math.min(240,width*.26),cell=(width-first)/Math.max(1,headers.length-1),widths=headers.map((_,i)=>i===0?first:cell);
 const rowH=60;
 let x=left;
 headers.forEach((label,i)=>{posterFitText(ctx,label,x+9,top+36,MOBILE_POSTER_TYPE.note,p.sub,'600','left',widths[i]-18);x+=widths[i];});
 posterRule(ctx,left,left+width,top+54,p);
 rows.forEach((row,j)=>{
  const y=top+54+j*rowH;let x=left;
  if(j%2){ctx.save();ctx.fillStyle=p.hair;ctx.globalAlpha=.18;ctx.fillRect(left,y,width,rowH);ctx.restore();}
  row.forEach((value,i)=>{if(i>=widths.length)return;posterFitText(ctx,value??'',x+9,y+40,MOBILE_POSTER_TYPE.note,p.ink,'400','left',widths[i]-18);x+=widths[i];});
  posterRule(ctx,left,left+width,y+rowH,p);
 });
}
async function exportResearchChartPNG(snapshot,{palette,watermark,width}){
 await PosterExport.waitForFonts();
 let outputWidth=0,warnings=[];
 const blob=await PosterExport.canvasPNG(canvas=>{
  const p=palette,geometry=researchDirectGeometry(snapshot),padding=34,logicalW=geometry.width+padding*2;
  const measure=canvas.getContext('2d');
  const T=MOBILE_POSTER_TYPE,notes=[...new Set([snapshot.chartNote,snapshot.note].filter(Boolean))].flatMap(t=>posterWrap(measure,t,geometry.width,T.note,'400'));
   const headings=[...posterWrap(measure,snapshot.title,geometry.width,T.title,'700').map(v=>({v,size:T.title,weight:'700'})),...posterWrap(measure,snapshot.displayMetric+' · '+snapshot.range,geometry.width,T.subtitle,'500').map(v=>({v,size:T.subtitle,weight:'500'})),...posterWrap(measure,'来源：'+snapshot.source,geometry.width,T.note,'400').map(v=>({v,size:T.note,weight:'400'}))];
  const headerH=32+headings.reduce((h,v)=>h+v.size*1.3,0),footerH=notes.length*43+40,logicalH=headerH+geometry.height+footerH;
  const scale=Math.min(width/logicalW,16000/logicalH,Math.sqrt(40000000/(logicalW*logicalH)));
  if(!Number.isFinite(scale)||scale<=0)throw Error('图表尺寸无效');
  canvas.width=Math.max(1,Math.floor(logicalW*scale));canvas.height=Math.max(1,Math.floor(logicalH*scale));outputWidth=canvas.width;
  const ctx=canvas.getContext('2d'),audit={warnings:new Set(),errors:new Set(),referenceWidth:logicalW};posterAudits.set(ctx,audit);
  ctx.scale(scale,scale);ctx.fillStyle=p.panel||'#ffffff';ctx.fillRect(0,0,logicalW,logicalH);
  let yy=15;headings.forEach(h=>{yy+=h.size;posterFitText(ctx,h.v,padding,yy,h.size,h.weight==='700'?p.ink:p.sub,h.weight,'left',geometry.width);yy+=h.size*.3;});
   const box={left:padding,right:logicalW-padding,top:headerH,bottom:headerH+geometry.height,width:geometry.width,height:geometry.height};
  if(snapshot.chart)drawResearchChartContent(ctx,p,{...snapshot,chartNote:''},box);
  else if(snapshot.table)drawDirectResearchTable(ctx,p,snapshot.table,box);
  notes.forEach((line,i)=>posterFitText(ctx,line,padding,box.bottom+36+i*43,T.note,p.sub,'400','left',geometry.width));
  drawImageWatermark(ctx,logicalW,logicalH,0,0,watermark,{safeEnabled:false},p);
  warnings=[...audit.warnings];posterAudits.delete(ctx);
   if(audit.errors.size)throw Error([...audit.errors].join('；')+'，请缩短区间或减少展示项目');
 });
 return {blob,width:outputWidth,warnings};
}
