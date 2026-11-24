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
 if(type==='top'&&(L.bodyHeight-28)/10<55)auditIssue(ctx,'TOP10 行高偏小');
 if(research?.chart?.lines?.length>12&&!['brandStack','brandRibbon','bars','scatter','heatmap','brandGrowth'].includes(research.chart.kind))auditIssue(ctx,'曲线较多，建议减少机型或分组');
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
  if(fit<14||fit<size*.60)auditIssue(ctx,'部分文字因空间不足而缩小');
 }
 canvasText(ctx,str,x,y,Math.max(1,fit),color,weight,align);
}
function posterRule(ctx,x1,x2,y,p){
 ctx.strokeStyle=p.hair;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x1,y);ctx.lineTo(x2,y);ctx.stroke();
}
function getPosterLayout(W,H,type,o,right,bottom,copy=getPosterCopy(type,o)){
 const safeRight=W-Math.round(W*right),safeBottom=H-Math.round(H*bottom);
 const left=70,rightEdge=safeRight-Math.max(24,70-Math.round(W*right));
 const cardX=52,cardRight=rightEdge+18;
 const footerLines=String(copy.disclaimer||'').split(/\r?\n/).filter(v=>v.trim());
 const brandNote=type==='brands'&&o.brands.length>0;
 // Retain every entered footer line; ordinary 1–4 line notes retain their normal sizes.
 const lineStep=Math.min(32,Math.max(12,Math.floor(142/Math.max(1,footerLines.length))));
 const footSize=Math.min(23,lineStep*.76);
 const footerHeight=footerLines.length?24+footerLines.length*lineStep+20:0;
 const footerY=safeBottom-Math.max(48,footerHeight);
 // Empty corner labels release the entire header row for the content below.
 const markLeft=String(copy.markLeft??'').trim(),markRight=String(copy.markRight??'').trim();
 const headerOffset=markLeft||markRight?0:72;
 const bodyTop=316-headerOffset,bodyBottom=footerLines.length||brandNote?footerY-(brandNote?44:20):safeBottom-64;
 return {W,H,safeRight,safeBottom,left,right:rightEdge,width:rightEdge-left,cardX,cardRight,cardWidth:cardRight-cardX,bodyTop,bodyBottom,bodyHeight:bodyBottom-bodyTop,footerY,footerLines,brandNote,lineStep,footSize,copy,markLeft,markRight,headerOffset};
}
function posterFrame(ctx,L,o,p){
 const {copy,left,right,width,markLeft,markRight,headerOffset}=L;
 const markW=markLeft?Math.min(162,width*.38):0;
 if(markLeft){
  rounded(ctx,left,55,markW,42,13,p.panel2);
  posterFitText(ctx,markLeft,left+17,84,25,p.accent,'800','left',markW-34);
 }
 if(markRight)posterFitText(ctx,markRight,right,84,22,p.sub,'600','right',width-(markLeft?markW+20:0));
 posterFitText(ctx,copy.title,left,178-headerOffset,72,p.ink,'850','left',width);
 posterFitText(ctx,copy.subtitle,left+2,230-headerOffset,29,p.sub,'550','left',width-2);
 const tag=String(copy.tagLabel||'').trim();
 if(tag){
  const tagWidth=Math.min(width,Math.max(250,Math.ceil(measureMixedCanvas(ctx,tag,26,'760').width+42)));
  rounded(ctx,left,247-headerOffset,tagWidth,43,15,p.panel2);
  posterFitText(ctx,tag,left+21,277-headerOffset,26,p.accent,'760','left',tagWidth-42);
 }
 posterRule(ctx,left,right,300-headerOffset,p);
}
function drawPosterFooter(ctx,L,p){
 const {left,right,width,footerY,footerLines,lineStep,footSize,brandNote}=L;
 if(!footerLines.length&&!brandNote)return;
 if(brandNote)posterFitText(ctx,BRAND_FOOTER_NOTE,left,footerY-12,21,p.sub,'530','left',width);
 if(!footerLines.length)return;
 posterRule(ctx,left,right,footerY,p);
 footerLines.forEach((line,i)=>posterFitText(ctx,line,left,footerY+24+i*lineStep,Math.min(footSize,i===2?21:23),p.sub,i===2?'500':'560','left',width));
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
 const saleW=Math.min(300,(right-nameX)*.36),nameW=right-nameX-saleW-12;
 const step=(bodyBottom-bodyTop-28)/10,max=entries[0].pixels||1;
 if(!auditPlot(ctx,right-nameX,step,'榜单行',220,55))return;
 entries.forEach((m,i)=>{
  const y=bodyTop+14+i*step,base=y+step*.45;
  const font=Math.min(31,step*.39),barH=Math.min(13,step*.17);
  if(i===0)rounded(ctx,cardX+10,y-3,cardWidth-20,step-3,14,p.panel2);
  const ink=i===0?p.bar2:p.ink;
  posterFitText(ctx,String(m.rank).padStart(2,'0'),left,base,Math.min(29,font),p.accent,'850','left',rankW-8);
  posterFitText(ctx,m.name,nameX,base,font,ink,'680','left',nameW);
  posterFitText(ctx,o.fit.k===null?'待标定':displayWan(m.sale)+' 万台',right,base,Math.min(30,font),ink,'750','right',saleW);
  paintBar(ctx,nameX,y+step*.68,right-nameX,barH,m.pixels/max,p,i===0);
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
 posterFitText(ctx,`品牌系列榜 · ${n} 组｜上榜合计 ${o.models.length} 条`,left,bodyTop+33,26,p.sub,'600','left',width);
 const top=bodyTop+46,step=Math.min(206,(bodyBottom-top-12)/n);
 brands.forEach((b,i)=>{
  const y=top+i*step,hot=i===0,font=Math.min(33,step*.28),barH=Math.min(22,step*.19),salesW=width*.43;
  posterFitText(ctx,`${i+1}. ${b.brand}（上榜 ${b.count} 款）`,left,y+step*.28,font,p.ink,'760','left',width-salesW-12);
  posterFitText(ctx,`${displaySale(b.sale)}  ·  ${fmt(b.share*100,1)}%`,right,y+step*.28,Math.min(31,font),hot?p.bar2:p.ink,'750','right',salesW);
  paintBar(ctx,left,y+step*.40,width,barH,b.pixels/first,p,hot,window.BrandUtils.color(b.brand));
  posterFitText(ctx,'主力爆款：'+b.hero,left,y+step*.83,Math.min(24,step*.24),p.sub,'560','left',width);
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
 const L=getPosterLayout(W,H,type,o,right,bottom,publication?.copy||getPosterCopy(type,o));
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
 if(showGuides)drawSafeGuides(ctx,W,H,p);
 posterAudits.delete(ctx);
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
 const cols=count<=2?count:count<=6?2:count<=12?3:4,rows=Math.ceil(count/cols),step=Math.min(34,height*.23/rows),cell=width/cols;
 lines.forEach((l,i)=>{const x=left+i%cols*cell,y=top+(Math.floor(i/cols)+.8)*step;ResearchCharts.canvasMarker(ctx,l.marker,x+8,y-6,6,l.color);posterFitText(ctx,l.name,x+22,y,Math.min(22,step*.75),p.ink,'600','left',cell-26);});
 const plotTop=top+rows*step+12,plotBottom=bottom-noteHeight,gap=both?32:0,part=(plotBottom-plotTop-gap)/(both?2:1);
 if(!auditPlot(ctx,width-100,part-55,'机型追踪绘图区',260,both?95:150))return;
 function plot(isRank,yStart){
  const x0=left+68,x1=right-32,y0=yStart+27,y1=yStart+part-34;
  const series=isRank?rankLines:lines;
  const scale=isRank?{x:i=>n===1?(x0+x1)/2:x0+i*(x1-x0)/(n-1),y:v=>span===0?(y0+y1)/2:y0+(v-min)*(y1-y0)/span}:ResearchCharts.lineScale(chart,{left:x0,right:x1,top:y0,bottom:y1});
  posterFitText(ctx,isRank?'原始榜单排名':(chart.salesLabel||'销量走势')+' / 万台',x0,y0-10,20,p.ink,'700','left',width-100);
  const rankStep=Math.max(1,Math.ceil(span/5)),ticks=isRank?(ranks.length?[...new Set([...Array.from({length:Math.floor(span/rankStep)+1},(_,i)=>min+i*rankStep),max])]:[]):Array.from({length:5},(_,i)=>scale.top*i/4);
  for(const v of ticks){const y=scale.y(v);ctx.strokeStyle=p.hair;ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(x0,y);ctx.lineTo(x1,y);ctx.stroke();posterFitText(ctx,String(Number(v.toFixed(2))),x0-9,y+5,18,p.sub,'550','right',56);}
  const tickCount=Math.max(2,Math.min(7,Math.floor((x1-x0)/88))),stride=Math.max(1,Math.ceil((n-1)/(tickCount-1)));
  chart.periods.forEach((v,i)=>{if(i===0||i===n-1||(i%stride===0&&n-1-i>=stride*.65))posterFitText(ctx,v,scale.x(i),y1+24,17,p.sub,'550','center',Math.min(100,(x1-x0)/Math.max(1,tickCount-1)));});
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
 const left=cardX+26,right=cardX+cardWidth-26,width=right-left;
 const start=bodyTop+16,bottom=bodyBottom-14;
 const notes=String(s.chartNote??'').split(/\r?\n/).filter(v=>v.trim());
 const noteHeight=notes.length?notes.length*25+10:0,chartBottom=bottom-noteHeight;
 const chartBox={left,right,top:start,bottom:chartBottom,width,height:chartBottom-start};
 const drawNotes=()=>notes.forEach((line,i)=>posterFitText(ctx,line,left,bottom-8-(notes.length-1-i)*25,20,p.sub,'550','left',width));
 if(notes.length>6)auditIssue(ctx,'图表内附注超过6行，建议精简');
 if(!auditPlot(ctx,width,chartBox.height,'研究图表内容区',360,230))return;
 if(['trackerBoth','trackerRank','trackerMatrix'].includes(s.chart?.kind)){drawTrackerTrendPoster(ctx,p,{...s,chartNote:''},chartBox);drawNotes();return;}
 if(s.chart?.kind==='coverageLayers'){drawCoverageLayers(ctx,s.chart,chartBox,p);drawNotes();return;}
 if(s.chart?.kind==='brandGrowth'){drawBrandGrowth(ctx,s.chart,chartBox,p);drawNotes();return;}
 if(s.chart?.kind==='generationDualAxis'){drawGenerationDualAxis(ctx,s.chart,chartBox,p);drawNotes();return;}
 if(s.chart?.kind==='heatmap'){drawResearchHeatmap(ctx,s.chart,chartBox,p,'');drawNotes();return;}
 if(s.chart?.kind==='dualBrandFlowMulti'){drawDualBrandFlowMulti(ctx,s.chart,chartBox,p,'');drawNotes();return;}
  if(s.chart?.kind==='dualBrandFlow'){drawDualBrandFlow(ctx,s.chart,chartBox,p,'');drawNotes();return;}
 if(s.chart?.kind==='brandStack'||s.chart?.kind==='brandRibbon'){drawBrandComposition(ctx,s.chart,chartBox,p,'');drawNotes();return;}
 if(s.chart?.kind==='bars'||s.chart?.kind==='scatter'){drawHeadStaticPoster(ctx,p,{...s,chartNote:''},chartBox);drawNotes();return;}
 if(s.chart){
  const {periods,lines,unit}=s.chart,n=periods.length,bands=s.chart.bands||[],legendItems=[...lines.map(l=>({...l,legendBand:false})),...bands.map(b=>({...b,legendBand:true}))],count=legendItems.length;
  const cols=count<=2?Math.max(1,count):count<=6?2:count<=12?3:4;
  const legendRows=Math.ceil(count/cols),legendStep=Math.min(36,chartBox.height*.29/Math.max(1,legendRows));
  const cellW=width/cols,colors=['#2563eb','#ea580c','#059669','#9333ea','#db2777','#0891b2','#92400e','#64748b','#be123c','#4d7c0f','#0369a1','#7c3aed'];
  legendItems.forEach((l,i)=>{const x=left+(i%cols)*cellW,y=start+(Math.floor(i/cols)+.77)*legendStep,color=l.color||colors[i%colors.length];if(l.legendBand){ctx.save();ctx.fillStyle=color;ctx.globalAlpha=.45;ctx.fillRect(x,y-15,17,10);ctx.restore();}else if(l.marker)ResearchCharts.canvasMarker(ctx,l.marker,x+8,y-8,6,color);else{ctx.fillStyle=color;ctx.fillRect(x,y-12,17,5);}posterFitText(ctx,l.name,x+23,y,Math.min(24,legendStep*.78),p.ink,'600','left',cellW-28);});
  const x0=left+68,x1=right-32,y0=start+legendRows*legendStep+34,y1=chartBottom-48;
  if(!auditPlot(ctx,x1-x0,y1-y0,'折线图绘图区',260,150))return;
  const scale=ResearchCharts.lineScale(s.chart,{left:x0,right:x1,top:y0,bottom:y1}),{top,x,y}=scale;
  posterFitText(ctx,unit,x0,y0-12,RESEARCH_POSTER_AXIS.title,p.sub,RESEARCH_POSTER_AXIS.titleWeight,'left',width-100);
  for(let i=0;i<=4;i++){const v=top*i/4;ctx.strokeStyle=p.hair;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x0,y(v));ctx.lineTo(x1,y(v));ctx.stroke();posterFitText(ctx,Number(v.toFixed(2)),x0-10,y(v)+5,RESEARCH_POSTER_AXIS.tick,p.sub,RESEARCH_POSTER_AXIS.tickWeight,'right',56);}
  const ticks=Math.max(2,Math.min(7,Math.floor((x1-x0)/88))),stride=Math.max(1,Math.ceil((n-1)/(ticks-1)));
  periods.forEach((period,i)=>{if(i===0||i===n-1||(i%stride===0&&n-1-i>=stride*.65))posterFitText(ctx,period,x(i),y1+26,RESEARCH_POSTER_AXIS.period,p.sub,RESEARCH_POSTER_AXIS.tickWeight,'center',Math.min(104,(x1-x0)/Math.max(1,ticks-1)));});
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


