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
// Reference coordinates preserve export sizes: 1080 units = 360 logical design units.
// 360 logical design units; preserve the existing 1080-coordinate rendering API.
const POSTER_DESIGN=Object.freeze({baseWidth:360,referenceWidth:1080,spacing:Object.freeze({xs:4,sm:8,md:12,lg:16,xl:24,xxl:32}),type:Object.freeze({title:24,subtitle:14,body:13,label:13,value:12,stackValue:10,stackValueMin:8,rank:12,axis:12,axisTitle:13,legend:10,note:12,caption:8,min:12}),weight:Object.freeze({body:'500',stackValue:'400',axis:'400',axisTitle:'500',legend:'400',caption:'400'}),chart:Object.freeze({line:1.2,highlightLine:1.8,marker:1.7,markerStroke:.8,grid:.5,axisGap:4,axisLegendGap:8,maxWeekTicks:5,legendLine:15})});
const posterDp=v=>v*POSTER_DESIGN.referenceWidth/POSTER_DESIGN.baseWidth;
const POSTER_SPACE=Object.freeze(Object.fromEntries(Object.entries(POSTER_DESIGN.spacing).map(([k,v])=>[k,posterDp(v)])));
const MOBILE_POSTER_TYPE=Object.freeze({...Object.fromEntries(Object.entries(POSTER_DESIGN.type).map(([k,v])=>[k,posterDp(v)])),line:posterDp(POSTER_DESIGN.chart.line),marker:posterDp(POSTER_DESIGN.chart.marker)});
function posterBlock(ctx,lines,size,weight,top){
 let ascent=size*.85,descent=size*.15;
 ctx.save();
 for(const line of lines)for(const run of measureMixedCanvas(ctx,line,size,weight).runs){
  ctx.font=weight+' '+size+'px '+(run.number?NUM_FONT:CJK_FONT);
  const m=ctx.measureText(run.text);ascent=Math.max(ascent,m.actualBoundingBoxAscent||0);descent=Math.max(descent,m.actualBoundingBoxDescent||0);
 }
 ctx.restore();
 const step=Math.max(size*1.18,ascent+descent+posterDp(2));
 return {y:top+ascent,step,height:lines.length?ascent+descent+(lines.length-1)*step:0};
}
function mobilePosterActive(ctx){return posterAudits.has(ctx);}
// Shared captions use 8 logical units; legends use 10 and ordinary chart labels retain the 12-unit minimum.
function posterReadabilityMin(ctx){const audit=posterAudits.get(ctx);return (audit?.minTextSize??MOBILE_POSTER_TYPE.min)*(audit?.referenceWidth||1080)/1080;}
function posterBodyWeight(ctx,weight){return posterAudits.get(ctx)?.bodyTypography&&Number(weight)>500?POSTER_DESIGN.weight.body:weight;}
function withPosterBody(ctx,draw){const a=posterAudits.get(ctx),old=a?.bodyTypography;if(a)a.bodyTypography=true;try{return draw();}finally{if(a)a.bodyTypography=old;}}
function posterCaption(ctx,value,x,y,color,align='left',width=Infinity){const a=posterAudits.get(ctx),old=a?.minTextSize;if(a)a.minTextSize=MOBILE_POSTER_TYPE.caption;try{posterFitText(ctx,value,x,y,MOBILE_POSTER_TYPE.caption,color,POSTER_DESIGN.weight.caption,align,width);}finally{if(a){if(old===undefined)delete a.minTextSize;else a.minTextSize=old;}}}
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
// Fixed font axis labels: adjust the ticks and gutter rather than individual font sizes.
function posterAxisLabel(v){return String(Number(v.toPrecision(12)));}
// Reserve the full glyph extents (including marker height), not just a gap between baselines.
function posterAxisLegendDistance(ctx,axisLabels,axisSize,legendLabels,legendSize,symbolRise=0,axisWeight=POSTER_DESIGN.weight.axis,legendWeight=POSTER_DESIGN.weight.legend){
 let descent=axisSize*.25,ascent=legendSize;
 ctx.save();
 for(const label of axisLabels){ctx.font=axisWeight+' '+axisSize+'px '+posterAxisFont(label);descent=Math.max(descent,ctx.measureText(String(label??'')).actualBoundingBoxDescent||0);}
 for(const label of legendLabels){ctx.font=legendWeight+' '+legendSize+'px '+CJK_FONT;ascent=Math.max(ascent,ctx.measureText(String(label??'')).actualBoundingBoxAscent||0);}
 ctx.restore();
 return descent+posterDp(POSTER_DESIGN.chart.axisLegendGap)+Math.max(ascent,symbolRise);
}
// All calendar/numeric tick labels use the same explicit font, including W38 and 2026-W46.
function posterAxisFont(value){return /^[\x20-\x7e\u2212\u2013\u2014\uff05]+$/.test(String(value??''))?NUM_FONT:CJK_FONT;}
function posterAxisMeasure(ctx,value,size=MOBILE_POSTER_TYPE.axis){ctx.save();ctx.font=POSTER_DESIGN.weight.axis+' '+size+'px '+posterAxisFont(value);const w=ctx.measureText(String(value??'')).width;ctx.restore();return w;}
function posterAxisText(ctx,value,x,y,color,align='left',maxWidth=Infinity,size=MOBILE_POSTER_TYPE.axis){
 const str=String(value??''),w=posterAxisMeasure(ctx,str,size),fit=w>maxWidth?size*maxWidth/w:size;
 if(!Number.isFinite(fit)||fit<=0){auditIssue(ctx,'坐标轴文字区域无有效宽度',true);return;}
 if(fit<MOBILE_POSTER_TYPE.axis)auditIssue(ctx,'局部坐标轴空间不足，字号低于12逻辑单位');
 ctx.save();ctx.font=POSTER_DESIGN.weight.axis+' '+fit+'px '+posterAxisFont(str);ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='alphabetic';ctx.fillText(str,x,y);ctx.restore();
}
function posterAxisGutter(ctx,ticks,format=posterAxisLabel){
 return Math.max(0,...ticks.map(v=>posterAxisMeasure(ctx,format(v))))+posterDp(4);
}
function posterNiceStep(raw){
 const unit=Math.pow(10,Math.floor(Math.log10(Math.max(raw,1e-12))));
 return ([1,2,2.5,5,10].find(v=>v*unit>=raw*(1-1e-10))||10)*unit;
}
function posterTickCapacity(height){
 return Math.max(2,Math.min(5,Math.floor(height/(MOBILE_POSTER_TYPE.axis+posterDp(4)))+1));
}
function posterValueAxis(max,height){
 const peak=Math.max(.000001,Number.isFinite(max)?max:1),step=posterNiceStep(peak/(posterTickCapacity(height)-1)),count=Math.max(1,Math.ceil(peak/step-1e-10));
 return {low:0,high:count*step,ticks:Array.from({length:count+1},(_,i)=>i*step)};
}
function posterRankAxis(min,max,height){
 const low=Math.max(1,Number.isFinite(min)?Math.floor(min):1),target=Math.max(low+1,Number.isFinite(max)?Math.ceil(max):low+1);
 const step=Math.max(1,Math.ceil(posterNiceStep((target-low)/(posterTickCapacity(height)-1)))),high=Math.ceil(target/step)*step;
 const ticks=[low,...Array.from({length:Math.floor(high/step)-Math.floor(low/step)},(_,i)=>(Math.floor(low/step)+1+i)*step)];
 return {low,high,ticks:posterSpacedTicks(ticks,v=>(v-low)/(high-low)*height)};
}
function posterSpacedTicks(ticks,y){
 const gap=MOBILE_POSTER_TYPE.axis+posterDp(4),ordered=[...new Set(ticks)].sort((a,b)=>y(a)-y(b)),result=[];
 for(const v of ordered){
  if(!result.length||Math.abs(y(v)-y(result[result.length-1]))>=gap)result.push(v);
  else if(v===ordered[ordered.length-1]&&result.length>1&&Math.abs(y(v)-y(result[result.length-2]))>=gap)result[result.length-1]=v;
 }
 return result;
}
function posterLineAxis(chart,height){
 const values=chart.lines.flatMap(l=>l.values).concat((chart.bands||[]).flatMap(b=>b.upper||[]));
 return posterValueAxis(Math.max(1,Number.isFinite(chart.limit)?chart.limit:0,...values.filter(Number.isFinite)),height);
}
function posterLineScale(chart,box,axis){
 return {...ResearchCharts.lineScale(chart,box),top:axis.high,y:v=>box.bottom-v/axis.high*(box.bottom-box.top)};
}
function posterYTicks(ctx,ticks,y,x0,x1,p,format=posterAxisLabel){
 for(const v of posterSpacedTicks(ticks,y)){
  const yy=y(v);ctx.save();ctx.strokeStyle=p.hair;ctx.lineWidth=posterDp(POSTER_DESIGN.chart.grid);ctx.beginPath();ctx.moveTo(x0,yy);ctx.lineTo(x1,yy);ctx.stroke();ctx.restore();
  posterAxisText(ctx,format(v),x0-posterDp(4),yy+MOBILE_POSTER_TYPE.axis*.32,p.sub,'right');
 }
}
function posterWeekTicks(ctx,periods,x,y,left,right,p,maxCount=POSTER_DESIGN.chart.maxWeekTicks){
 if(!periods.length)return;
 const labels=periods.map(v=>posterWeekLabel(v,periods)),size=MOBILE_POSTER_TYPE.axis,n=labels.length,gap=posterDp(4);
 const items=labels.map((label,i)=>{const w=posterAxisMeasure(ctx,label,size);return {label,w,x:Math.max(left+w/2,Math.min(right-w/2,x(i)))};});
 let selected=[];
 for(let count=Math.min(maxCount,n);count>=1;count--){
  const ids=count===1?[n-1]:Array.from({length:count},(_,i)=>Math.round(i*(n-1)/(count-1)));
  const chosen=ids.map(i=>items[i]);
  if(chosen.every((v,i)=>v.w<=right-left&&(!i||v.x-v.w/2>=chosen[i-1].x+chosen[i-1].w/2+gap))){selected=chosen;break;}
 }
 if(!selected.length){auditIssue(ctx,'横轴周次空间不足，请调整安全区');return;}
 selected.forEach(v=>posterAxisText(ctx,v.label,v.x,y,p.sub,'center'));
}
function posterLegendWrap(ctx,value,width,size){
 const lines=[];
 for(const raw of String(value??'').split(/\r?\n/)){
  let line='';
  const tokens=raw.match(/[A-Za-z0-9][A-Za-z0-9._/-]*|[ \t]+|[^\r\n]/gu)||[];
  for(const token of tokens){
   if(!line&&/^\s+$/.test(token))continue;
   if(line&&posterLegendMeasure(ctx,line+token,size)>width){if(line.trim())lines.push(line.trim());line=token.trimStart();}
   else line+=token;
  }
  if(line.trim())lines.push(line.trim());
 }
 return lines;
}
function posterLegendMeasure(ctx,value,size=MOBILE_POSTER_TYPE.legend){ctx.save();ctx.font=POSTER_DESIGN.weight.legend+' '+size+'px '+CJK_FONT;const w=ctx.measureText(String(value??'')).width;ctx.restore();return w;}
function posterLegendText(ctx,value,x,y,p){
 const audit=posterAudits.get(ctx),old=audit?.minTextSize;
 if(audit)audit.minTextSize=MOBILE_POSTER_TYPE.legend;
 try{ctx.save();ctx.font=POSTER_DESIGN.weight.legend+' '+MOBILE_POSTER_TYPE.legend+'px '+CJK_FONT;ctx.fillStyle=p.ink;ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.fillText(String(value??''),x,y);ctx.restore();}
 finally{if(audit){if(old===undefined)delete audit.minTextSize;else audit.minTextSize=old;}}
}
function posterCompactLegendText(ctx,value,x,y,color,previewSize,previewWeight='600',align='left',width=Infinity){
 if(!mobilePosterActive(ctx))return posterFitText(ctx,value,x,y,previewSize,color,previewWeight,align,width);
 const str=String(value??''),size=MOBILE_POSTER_TYPE.legend,w=posterLegendMeasure(ctx,str,size),fit=w>width?size*width/w:size;
 if(!Number.isFinite(fit)||fit<=0){auditIssue(ctx,'图例文字区域无有效宽度',true);return;}
 if(fit<size)auditIssue(ctx,'局部图例空间不足，字号低于10逻辑单位');
 ctx.save();ctx.font=POSTER_DESIGN.weight.legend+' '+fit+'px '+CJK_FONT;ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='alphabetic';ctx.fillText(str,x,y);ctx.restore();
}
function posterLineLegend(ctx,items,box,p){
 const {left,top,width}=box,T=MOBILE_POSTER_TYPE,size=T.legend,step=posterDp(POSTER_DESIGN.chart.legendLine),symbol=posterDp(8),gap=posterDp(4),prefix=symbol+gap,itemGap=posterDp(8);
 const colors=['#2563eb','#ea580c','#059669','#9333ea','#db2777','#0891b2','#92400e','#64748b','#be123c','#4d7c0f','#0369a1','#7c3aed'];
 const rows=[];let row=[],used=0;
 for(const [i,l] of items.entries()){
  const text=String(l.name??''),w=posterLegendMeasure(ctx,text,size);
  const wrapped=w<=width-prefix&&!/[\r\n]/.test(text)?[text]:posterLegendWrap(ctx,text,width-prefix,size);
  const itemW=prefix+Math.max(0,...wrapped.map(v=>posterLegendMeasure(ctx,v,size)));
  if(itemW>width){auditIssue(ctx,'图例完整英文词或机型名称超出可用宽度，请调整安全区',true);return box.bottom??top;}
  if(row.length&&used+itemGap+itemW>width){rows.push(row);row=[];used=0;}
  if(row.length)used+=itemGap;
  row.push({...l,color:l.color||colors[i%colors.length],wrapped,x:left+used});used+=itemW;
 }
 if(row.length)rows.push(row);
 const needed=rows.reduce((sum,r)=>sum+Math.max(1,...r.map(l=>l.wrapped.length))*step,0);
 if(Number.isFinite(box.bottom)&&top+needed+posterDp(52)>box.bottom){auditIssue(ctx,'图例占用空间过多，请减少机型或拆分图卡',true);return box.bottom;}
 let yy=top;
 for(const group of rows){
  for(const l of group){
   const x=l.x,base=yy+size,mid=base-size*.33;
   if(l.legendBand){ctx.save();ctx.fillStyle=l.color;ctx.globalAlpha=.45;ctx.fillRect(x,mid-posterDp(2),symbol,posterDp(4));ctx.restore();}
   else if(l.marker)ResearchCharts.canvasMarker(ctx,l.marker,x+symbol/2,mid,T.marker,l.color);
   else {ctx.fillStyle=l.color;ctx.fillRect(x,mid-T.line/2,symbol,T.line);}
   l.wrapped.forEach((v,k)=>posterLegendText(ctx,v,x+prefix,base+k*step,p));
  }
  yy+=Math.max(1,...group.map(l=>l.wrapped.length))*step;
 }
 return yy+(rows.length?posterDp(4):0);
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
 const str=String(value??'');weight=posterBodyWeight(ctx,weight);
 const measured=measureMixedCanvas(ctx,str,size,weight).width;
 const fit=measured>width?size*width/measured:size;
 if(str.trim()){
  if(!Number.isFinite(fit)||fit<=0){auditIssue(ctx,'文字区域无有效宽度',true);return;}
  if(mobilePosterActive(ctx)&&fit<posterReadabilityMin(ctx))auditIssue(ctx,'部分文字低于手机阅读目标（360px宽时12px），建议精简重复信息或减少展示项目');else if(fit<14||fit<size*.60)auditIssue(ctx,'部分文字因空间不足而缩小');
 }
 canvasText(ctx,str,x,y,Math.max(1,fit),color,weight,align);
}
function posterRule(ctx,x1,x2,y,p){
 ctx.strokeStyle=p.hair;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x1,y);ctx.lineTo(x2,y);ctx.stroke();
}
function getPosterLayout(ctx,W,H,type,o,right,bottom,copy=getPosterCopy(type,o)){
 const safeRight=W-Math.round(W*right),safeBottom=H-Math.round(H*bottom),S=POSTER_SPACE,T=MOBILE_POSTER_TYPE;
 const outer=PosterThemes.geometry(W,H).card;
 const left=outer.x+S.md,rightEdge=Math.min(outer.x+outer.width-S.md,safeRight-S.sm),width=rightEdge-left;
 const cardX=left,cardRight=rightEdge;
 const footSize=T.caption;
 const disclaimer=String(copy.disclaimer??'').trim();
 const footerCopy=['top','versus','brands','leader'].includes(type)&&!disclaimer.includes('万台')?'销量单位：万台'+(disclaimer?' · '+disclaimer:''):disclaimer;
 const footerLines=posterWrap(ctx,footerCopy,width,footSize,'400');
 const brandNote=type==='brands'&&o.brands.length>0;
 const brandLines=brandNote?posterWrap(ctx,BRAND_FOOTER_NOTE,width,footSize,POSTER_DESIGN.weight.caption):[];
 const footerBlock=posterBlock(ctx,[...brandLines,...footerLines],footSize,'400',0);
 const footerEnd=Math.min(outer.y+outer.height-S.md,safeBottom-S.sm);
 const footerY=footerEnd-footerBlock.height-(footerBlock.height?S.xs:0);
 const markLeft=String(copy.markLeft??'').trim(),markRight=String(copy.markRight??'').trim();
 let cursor=outer.y+S.md;
 const markBlock=posterBlock(ctx,[markLeft,markRight].filter(Boolean),T.note,'600',cursor);
 if(markLeft||markRight)cursor+=T.note+S.xs;
 const titleLines=posterWrap(ctx,copy.title,width,T.title,'750'),subtitleLines=posterWrap(ctx,copy.subtitle,width,T.subtitle,'500');
 const tagLines=posterWrap(ctx,copy.tagLabel,width-S.md,T.note,'650');
 const titleBlock=posterBlock(ctx,titleLines,T.title,'750',cursor);cursor+=titleBlock.height+(titleLines.length?S.sm:0);
 const subtitleBlock=posterBlock(ctx,subtitleLines,T.subtitle,'500',cursor);cursor+=subtitleBlock.height+(subtitleLines.length?S.xs:0);
 const tagTop=cursor,tagBlock=posterBlock(ctx,tagLines,T.note,'650',tagTop+S.xs);
 if(tagLines.length)cursor+=tagBlock.height+2*S.xs;
 const ruleY=cursor+S.xs,bodyTop=ruleY+S.sm,bodyBottom=footerY-S.sm;
 return {W,H,safeRight,safeBottom,left,right:rightEdge,width,cardX,cardRight,cardWidth:cardRight-cardX,bodyTop,bodyBottom,bodyHeight:bodyBottom-bodyTop,footerY,footerLines,brandNote,brandLines,footSize,copy,markLeft,markRight,markBlock,titleLines,subtitleLines,tagLines,titleBlock,subtitleBlock,tagBlock,tagTop,ruleY,footerBlock};
}
function posterFrame(ctx,L,o,p){
 const {left,right,width,markLeft,markRight,titleLines,subtitleLines,tagLines,markBlock,titleBlock,subtitleBlock,tagBlock,tagTop,ruleY}=L,T=MOBILE_POSTER_TYPE,S=POSTER_SPACE;
 if(markLeft)posterFitText(ctx,markLeft,left,markBlock.y,T.note,p.accent,'600','left',width*.47);
 if(markRight)posterFitText(ctx,markRight,right,markBlock.y,T.note,p.sub,'600','right',width*.47);
 titleLines.forEach((v,i)=>posterFitText(ctx,v,left,titleBlock.y+i*titleBlock.step,T.title,p.ink,'750','left',width));
 subtitleLines.forEach((v,i)=>posterFitText(ctx,v,left,subtitleBlock.y+i*subtitleBlock.step,T.subtitle,p.sub,'500','left',width));
 if(tagLines.length){
  const tagW=Math.min(width,Math.max(...tagLines.map(v=>measureMixedCanvas(ctx,v,T.note,'650').width))+S.md);
  rounded(ctx,left,tagTop,tagW,tagBlock.height+2*S.xs,posterDp(6),p.panel2);
  tagLines.forEach((v,i)=>posterFitText(ctx,v,left+S.md/2,tagBlock.y+i*tagBlock.step,T.note,p.accent,'650','left',tagW-S.md));
 }
 posterRule(ctx,left,right,ruleY,p);
}
function drawPosterFooter(ctx,L,p){
 const {left,right,width,footerY,footerLines,brandLines,footSize,footerBlock}=L;
 if(!footerLines.length&&!brandLines.length)return;
 posterRule(ctx,left,right,footerY,p);
 const audit=posterAudits.get(ctx),previous=audit?.minTextSize;
 if(audit)audit.minTextSize=footSize;
 try{[...brandLines,...footerLines].forEach((line,i)=>posterFitText(ctx,line,left,footerY+POSTER_SPACE.xs+footerBlock.y+i*footerBlock.step,footSize,p.sub,'400','left',width));}
 finally{if(audit){if(previous===undefined)delete audit.minTextSize;else audit.minTextSize=previous;}}
}
function paintBar(ctx,x,y,w,h,ratio,p,highlight=false,brandColor=null){
 if(w<=0||h<=0)return;
 rounded(ctx,x,y,w,h,h/2,p.track);
 rounded(ctx,x,y,Math.max(ratio>0?2:0,w*Math.min(1,Math.max(0,Number(ratio)||0))),h,h/2,brandColor||(highlight?p.bar2:p.bar));
}
// TOP10 approved design, in 360 logical units. At zero safety reserve,
// the rank and name columns start at approximately x=36 and x=66.
const TOP10_DESIGN=Object.freeze({rank:POSTER_DESIGN.type.rank,name:POSTER_DESIGN.type.label,value:POSTER_DESIGN.type.value,weight:POSTER_DESIGN.weight.body,inset:16,rankColumn:30,valueGap:8,bar:4});
function drawTop(ctx,L,o,p){
 const entries=o.models.slice(0,10);if(!entries.length)return;
 const {cardX,cardRight,cardWidth,bodyTop,bodyBottom}=L,D=TOP10_DESIGN,S=POSTER_SPACE;
 const rankSize=posterDp(D.rank),nameSize=posterDp(D.name),valueSize=posterDp(D.value),weight=D.weight;
 const left=cardX+posterDp(D.inset),right=cardRight-posterDp(D.inset),rankW=posterDp(D.rankColumn),nameX=left+rankW;
 const values=entries.map(m=>o.fit.k===null?'待标定':displayWan(m.sale));
 const saleW=Math.max(...values.map(v=>measureMixedCanvas(ctx,v,valueSize,weight).width))+posterDp(1);
 const nameW=right-nameX-saleW-posterDp(D.valueGap);
 const step=(bodyBottom-bodyTop-2*S.sm)/entries.length,max=entries[0].pixels||1;
 if(!auditPlot(ctx,nameW,step,'榜单行',posterDp(70),posterDp(24)))return;
 if(step<posterDp(22)){auditIssue(ctx,'TOP10 行高不足以容纳文字及进度条，请精简文案或调整安全区',true);return;}
 drawDataCard(ctx,cardX,bodyTop,cardWidth,bodyBottom-bodyTop,p);
 entries.forEach((m,i)=>{
  const y=bodyTop+S.sm+i*step,base=y+step*.55,barH=posterDp(D.bar);
  if(i===0)rounded(ctx,cardX+S.xs,y,cardWidth-2*S.xs,step-posterDp(1),posterDp(4),p.panel2);
  const ink=i===0?p.bar2:p.ink;
  posterFitText(ctx,String(m.rank).padStart(2,'0'),left,base,rankSize,p.accent,weight,'left',rankW-S.xs);
  posterFitText(ctx,m.name,nameX,base,nameSize,ink,weight,'left',nameW);
  posterFitText(ctx,values[i],right,base,valueSize,ink,weight,'right',saleW);
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
 const gap=POSTER_SPACE.sm,w=(width-gap)/2,panelH=bodyHeight*.56,y=bodyTop,T=MOBILE_POSTER_TYPE;
 [[a,0],[b,1]].forEach(([m,i])=>{
  const x=left+i*(w+gap),ix=x+POSTER_SPACE.sm,iw=w-2*POSTER_SPACE.sm,seriesColor=i===0?p.bar2:p.bar;
  drawDataCard(ctx,x,y,w,panelH,p);
  posterFitText(ctx,(i?'对比机型':'参考机型')+' · 第 '+m.rank+' 名',ix,y+panelH*.13,Math.min(T.value,panelH*.105),seriesColor,'500','left',iw);
  const model=chooseDuelModelLabel(ctx,m.name,iw,Math.min(T.label,panelH*.12));
  posterFitText(ctx,model.text,ix,y+panelH*.32,model.size,p.ink,'500','left',iw);
  posterRule(ctx,ix,ix+iw,y+panelH*.40,p);
  posterFitText(ctx,'估算销量',ix,y+panelH*.54,Math.min(T.value,panelH*.105),p.sub,'500','left',iw);
  posterFitText(ctx,o.fit.k!==null?displayWan(m.sale):'待标定',ix,y+panelH*.74,Math.min(68,panelH*.17),p.ink,'830','left',iw);
  paintBar(ctx,ix,y+panelH*.91,iw,Math.min(15,panelH*.04),m.pixels/Math.max(1,a.pixels,b.pixels),p,i===0,seriesColor);
 });
 const y2=y+panelH+18,h=bodyHeight-panelH-18,high=a.pixels>=b.pixels?a:b;
 // Bottom summaries are laid out in their own vertical band, not a scaled image.
 posterFitText(ctx,'销量比例',left,y2+h*.13,Math.min(29,h*.115),p.sub,'720','left',width);
 posterFitText(ctx,'销量较高：'+high.name,left,y2+h*.28,Math.min(27,h*.105),p.sub,'620','left',width);
 posterFitText(ctx,displayTimes(Math.max(ratio,1/ratio)),left,y2+h*.58,Math.min(103,h*.26),p.accent,'900','left',width);
 posterFitText(ctx,'两款估算销量差值',left,y2+h*.75,Math.min(28,h*.10),p.sub,'700','left',width);
 posterFitText(ctx,o.fit.k===null?'待标定':displayWan(Math.abs(a.sale-b.sale)),left,y2+h*.96,Math.min(60,h*.19),p.ink,'830','left',width);
}
function drawBrands(ctx,L,o,p){
 const brands=o.brands.slice(0,7);if(!brands.length)return;
 const {cardX,cardRight,cardWidth,bodyTop,bodyBottom}=L,T=MOBILE_POSTER_TYPE,S=POSTER_SPACE;
 const left=cardX+S.md,right=cardRight-S.md,width=right-left,n=brands.length,first=brands[0].pixels||1;
 const heading=posterWrap(ctx,`品牌系列榜 · ${n} 组｜上榜合计 ${o.models.length} 条`,width,T.note,'500');
 const head=posterBlock(ctx,heading,T.note,'500',bodyTop+S.md);
 const top=bodyTop+S.md+head.height+S.xs;
 const rows=brands.map((b,i)=>{
  const name=`${i+1}. ${b.brand}（${b.count}款）`,sale=`${displayWan(b.sale)} · ${fmt(b.share*100,1)}%`;
  const labelWidth=measureMixedCanvas(ctx,name,T.label,'500').width,saleWidth=measureMixedCanvas(ctx,sale,T.value,'500').width;
  const stacked=labelWidth+saleWidth+S.xs>width;
  const hero=posterWrap(ctx,'主力爆款：'+b.hero,width,T.value,'500');
  const main=posterBlock(ctx,[name,sale],T.label,'600',0),extra=stacked?T.note+S.xs:0;
  const heroBlock=posterBlock(ctx,hero,T.value,'500',0);
  return {b,name,sale,stacked,hero,heroBlock,needed:Math.max(T.label,main.y+T.label*.15)+extra+posterDp(2+3+2)+heroBlock.height+posterDp(4)};
 });
 const totalNeeded=rows.reduce((sum,r)=>sum+r.needed,0),available=bodyBottom-S.md-top;
 if(available<totalNeeded){auditIssue(ctx,'品牌榜当前文案、安全区及行数无法同时满足手机字号与留白，请精简重复说明或减少安全区；必要时使用9:16',true);return;}
 drawDataCard(ctx,cardX,bodyTop,cardWidth,bodyBottom-bodyTop,p);
 heading.forEach((v,i)=>posterFitText(ctx,v,left,head.y+i*head.step,T.note,p.sub,'500','left',width));
 let rowTop=top;const extraGap=(available-totalNeeded)/n;
 rows.forEach(({b,name,sale,stacked,hero,heroBlock,needed},i)=>{
  const y=rowTop+extraGap/2,hot=i===0;rowTop+=needed+extraGap;
  posterFitText(ctx,name,left,y+T.label*.85,T.label,p.ink,'600','left',width);
  let baseline=y+T.label*.85;
  if(stacked)baseline+=T.note+S.xs;
  posterFitText(ctx,sale,right,baseline,T.value,hot?p.bar2:p.ink,'500','right',width);
  const barY=baseline+posterDp(4);paintBar(ctx,left,barY,width,posterDp(3),b.pixels/first,p,hot,window.BrandUtils.color(b.brand));
  hero.forEach((v,j)=>posterFitText(ctx,v,left,barY+posterDp(5)+heroBlock.y+j*heroBlock.step,T.value,p.sub,'500','left',width));
 });
}
function drawLeader(ctx,L,o,p){
 const a=o.models[0],b=o.models[1];if(!a||!b)return;
 const {left,right,width,bodyTop:y,bodyHeight:h}=L;
 const heroH=h*.32,innerX=left+28,innerW=width-56;
 drawDataCard(ctx,left,y,width,heroH,p);
 posterFitText(ctx,'本榜第一名',innerX,y+heroH*.22,Math.min(28,heroH*.14),p.accent,'750','left',innerW);
 posterFitText(ctx,a.name,innerX,y+heroH*.51,Math.min(MOBILE_POSTER_TYPE.label,heroH*.24),p.ink,'500','left',innerW);
 posterFitText(ctx,o.fit.k===null?'待标定':displayWan(a.sale),innerX,y+heroH*.87,Math.min(83,heroH*.32),p.ink,'850','left',innerW);
 const midY=y+heroH+18,midH=h*.33-18;
 posterFitText(ctx,'第一名对比第二名',left,midY+midH*.13,Math.min(30,midH*.13),p.sub,'650','left',width);
 posterFitText(ctx,'约 '+displayTimes(o.ratio),left,midY+midH*.48,Math.min(76,midH*.32),p.accent,'900','left',width);
 posterFitText(ctx,'领先估算销量',left,midY+midH*.67,Math.min(28,midH*.13),p.sub,'650','left',width);
 posterFitText(ctx,o.fit.k===null?'待标定':displayWan(a.sale-b.sale),left,midY+midH*.95,Math.min(51,midH*.25),p.ink,'780','left',width);
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
 withPosterBody(ctx,()=>{
 if(type==='top')drawTop(ctx,L,o,p);
 else if(type==='versus')drawDuel(ctx,L,o,p,state);
 else if(type==='brands')drawBrands(ctx,L,o,p);
 else if(isResearchTemplate(type)){const copy=publication?.copy||getPosterCopy(type,o);drawResearchPosterContent(ctx,L,p,{...research,chartNote:copy.chartNote??research?.chartNote??''});}
 else drawLeader(ctx,L,o,p);
 });
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
  chart.periods.forEach((v,i)=>posterFitText(ctx,posterWeekLabel(v,chart.periods),left+labelW+(i+.5)*cw,top+23,Math.min(18,cw*.45),p.sub,'400','center',cw-3));
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
 const plotTop=legendBottom,plotBottom=bottom-noteHeight,axisBottom=posterDp(20),titleH=posterDp(19),gap=both?posterDp(8):0;
 const plotH=(plotBottom-plotTop-axisBottom-gap-titleH*(both?2:1))/(both?2:1);
 if(plotH<posterDp(30)){auditIssue(ctx,'机型追踪绘图区不足，请减少图例或拆分图卡',true);return;}
 const salesAxis=posterLineAxis(chart,plotH),rankAxis=posterRankAxis(ranks.length?min:1,ranks.length?max:1,plotH);
 const gutter=Math.max(rankOnly?0:posterAxisGutter(ctx,salesAxis.ticks),both||rankOnly?posterAxisGutter(ctx,rankAxis.ticks):0),x0=left+gutter,x1=right-posterDp(4);
 if(!auditPlot(ctx,x1-x0,plotH,'机型追踪绘图区',260,95))return;
 function plot(isRank,yStart,showWeeks){
  const y0=yStart+titleH,y1=y0+plotH,series=isRank?rankLines:lines;
  const axis=isRank?rankAxis:salesAxis;
  const scale=isRank?{x:i=>n===1?(x0+x1)/2:x0+i*(x1-x0)/(n-1),y:v=>y0+(v-axis.low)*(y1-y0)/(axis.high-axis.low)}:posterLineScale(chart,{left:x0,right:x1,top:y0,bottom:y1},axis);
  researchPosterAxisText(ctx,isRank?'原始榜单排名':(chart.salesLabel||'销量走势')+' / 万台',x0,y0-posterDp(5),'title',p.ink,'left',x1-x0);
  if(isRank&&!ranks.length){posterFitText(ctx,'无原始排名记录',(x0+x1)/2,(y0+y1)/2,MOBILE_POSTER_TYPE.value,p.sub,'500','center',x1-x0);}
  else{posterYTicks(ctx,axis.ticks,scale.y,x0,x1,p);ResearchCharts.canvasLine(ctx,{...chart,lines:series},scale);}
  if(showWeeks)posterWeekTicks(ctx,chart.periods,scale.x,y1+posterDp(16),left,right,p);
 }
 if(both){plot(false,plotTop,false);plot(true,plotTop+titleH+plotH+gap,true);}else plot(rankOnly,plotTop,true);
 note();
}

function drawResearchPosterContent(ctx,L,p,s){
 if(!s)return;
 const {cardX,cardWidth,bodyTop,bodyBottom,bodyHeight}=L;
 drawDataCard(ctx,cardX,bodyTop,cardWidth,bodyHeight,p);
 const inset=POSTER_SPACE.md,left=cardX+inset,right=cardX+cardWidth-inset,start=bodyTop+inset,bottom=bodyBottom-inset;
 drawResearchChartContent(ctx,p,s,{left,right,top:start,bottom,width:right-left,height:bottom-start});
}

// Shared content renderer: the studio supplies its poster body, while direct PNG
// supplies a flexible chart-sized canvas with no social safe area or frame.
// Mobile two-period ribbons: measured columns, fixed readable fonts and collision-aware labels.
// Stack values are numeric labels, including the percent sign, not body copy.
function posterStackValueMetrics(ctx,value,size=MOBILE_POSTER_TYPE.stackValue){
 const weight=POSTER_DESIGN.weight.stackValue;
 ctx.save();ctx.font=weight+' '+size+'px '+NUM_FONT;const m=ctx.measureText(String(value??''));ctx.restore();
 return {width:m.width,ascent:Math.max(size*.8,m.actualBoundingBoxAscent||0),descent:Math.max(size*.2,m.actualBoundingBoxDescent||0)};
}
function posterStackValueText(ctx,value,x,y,color,size=MOBILE_POSTER_TYPE.stackValue){
 const m=posterStackValueMetrics(ctx,value,size);
 ctx.save();ctx.font=POSTER_DESIGN.weight.stackValue+' '+size+'px '+NUM_FONT;ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.fillStyle=color;ctx.fillText(String(value??''),x,y+(m.ascent-m.descent)/2);ctx.restore();
}
function posterStackValueFits(ctx,value,width,height){
 const m=posterStackValueMetrics(ctx,value),pad=posterDp(2);
 return width>=m.width+2*pad&&height>=m.ascent+m.descent+2*pad;
}
// Prefer the approved 10dp size, then reduce padding and adapt only the affected label.
function posterStackBarWidth(ctx,slot,preferred,labels){
 const needed=Math.max(0,...labels.map(v=>posterStackValueMetrics(ctx,v).width))+posterDp(4);
 return Math.min(slot*.9,Math.max(preferred,needed));
}
function posterStackSegmentValue(ctx,value,x,y,width,height,color){
 const T=MOBILE_POSTER_TYPE,base=T.stackValue,min=T.stackValueMin;
 const m=posterStackValueMetrics(ctx,value),fullPad=posterDp(2);
 let size=base;
 if(width<m.width+2*fullPad||height<m.ascent+m.descent+2*fullPad){
  const pad=posterDp(.5);
  size=Math.min(base,base*(width-2*pad)/Math.max(1,m.width),base*(height-2*pad)/Math.max(1,m.ascent+m.descent));
 }
 if(!Number.isFinite(size)||size<min){auditIssue(ctx,'部分堆叠色块过小，无法显示8号数值；可缩短区间或扩大图幅');return false;}
 if(size<base-.01)auditIssue(ctx,'部分堆叠色块数值因空间不足局部适配至8–10号');
 posterStackValueText(ctx,value,x,y,color,size);return true;
}
function drawPosterRibbon(ctx,chart,box,p){
 const {left,right,top,bottom,width}=box,{periods,lines,unit,limit}=chart,T=MOBILE_POSTER_TYPE,S=POSTER_SPACE,sz=T.value,label=T.label,pct=unit==='%';
 if(periods.length!==2||!lines.length||!lines.every(l=>l.values.slice(0,2).length===2&&l.values.slice(0,2).every(v=>Number.isFinite(v)&&v>=0))){auditIssue(ctx,'双周流向图数据不完整',true);return;}
 const fmt=v=>v.toFixed(1)+(pct?'%':'');
 const change=(a,b)=>{const d=b-a;return (d>=.05?'+':'')+(Math.abs(d)<.05?'0.0':d.toFixed(1))+(pct?'pp':'万台');};
 const measure=(v,font=sz,weight='600')=>measureMixedCanvas(ctx,v,font,weight).width;
 const weeks=periods.map(v=>posterWeekLabel(v,periods));
 const nw=Math.max(...lines.map(l=>measure(l.name,label,'550'))),dw=Math.max(measure('变化'),...lines.map(l=>measure(change(l.values[0],l.values[1]))));
 const bw=Math.max(posterDp(44),...lines.flatMap(l=>l.values.slice(0,2).map(v=>posterStackValueMetrics(ctx,fmt(v)).width+2*S.xs)),...weeks.map(v=>measure(v)+S.xs));
 const lx=left+nw+S.xs,rx=right-dw-S.xs-bw,L=lx+bw,R=rx,y0=top+posterDp(pct?36:52),y1=bottom,plotH=y1-y0;
 const max=Math.max(1,...[0,1].map(i=>lines.reduce((sum,l)=>sum+l.values[i],0))),tick=Math.pow(10,Math.floor(Math.log10(max)))/2,cap=limit||Math.ceil(max/tick)*tick;
 if(R-L<posterDp(8)||plotH<=0){auditIssue(ctx,'双周流向图空间不足，请精简文案或调整安全区',true);return;}
 const segments=i=>{let y=y1;return lines.map(l=>{const v=l.values[i],h=v/cap*plotH,seg={v,h,top:y-h,bottom:y,mid:y-h/2,color:l.color,name:l.name};y-=h;return seg;});};
 const base=segments(0),comp=segments(1),pitch=Math.max(label,sz)+posterDp(3);
 const place=segs=>{const order=segs.map((v,i)=>({i,y:v.mid})).sort((a,b)=>a.y-b.y);if(order.length*pitch>plotH)return null;order.forEach((v,i)=>v.y=Math.max(y0+pitch/2,v.y,i?order[i-1].y+pitch:-Infinity));for(let i=order.length-1;i>=0;i--)order[i].y=Math.min(order[i].y,i===order.length-1?y1-pitch/2:order[i+1].y-pitch);return Object.fromEntries(order.map(v=>[v.i,v.y]));};
 const ay=place(base),by=place(comp);
 if(!ay||!by){auditIssue(ctx,'双周流向图标签过密，无法保留完整数值，请减少分组或拆图',true);return;}
 for(const [x,h,w] of [[lx,'基准周',weeks[0]],[rx,'对比周',weeks[1]]]){posterFitText(ctx,h,x+bw/2,top+sz,sz,p.sub,'500','center',bw);posterFitText(ctx,w,x+bw/2,top+posterDp(28),sz,p.ink,'600','center',bw);}
 posterFitText(ctx,'变化',right,top+posterDp(28),sz,p.sub,'500','right',dw);
 if(!pct)posterFitText(ctx,'共同销量轴 · 峰值 '+cap.toFixed(1)+' 万台',left,y0-S.xs,sz,p.sub,'500','left',width);
 const c1=L+(R-L)*.45,c2=L+(R-L)*.55;
 base.forEach((s,i)=>{const t=comp[i];ctx.save();ctx.fillStyle=s.color;ctx.globalAlpha=.20;ctx.beginPath();ctx.moveTo(L,s.top);ctx.bezierCurveTo(c1,s.top,c2,t.top,R,t.top);ctx.lineTo(R,t.bottom);ctx.bezierCurveTo(c2,t.bottom,c1,s.bottom,L,s.bottom);ctx.closePath();ctx.fill();ctx.restore();for(const [seg,x] of [[s,lx],[t,rx]])if(seg.h>0)rounded(ctx,x,seg.top,bw,Math.max(0,seg.h-Math.min(1,seg.h*.08)),posterDp(2),seg.color);});
 const ink=color=>{const m=/^#([0-9a-f]{6})$/i.exec(color||'');if(!m)return '#17263c';const rgb=m[1].match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4));return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]>.179?'#000000':'#ffffff';};
 function lead(x1,y1,x2,y2){ctx.save();ctx.strokeStyle=p.sub;ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.restore();}
 base.forEach((s,i)=>{
  const t=comp[i],d=t.v-s.v;
  if(Math.abs(ay[i]-s.mid)>2)lead(lx-S.xs/2,ay[i],lx,s.mid);
  if(Math.abs(by[i]-t.mid)>2)lead(rx+bw,t.mid,rx+bw+S.xs/2,by[i]);
  posterFitText(ctx,s.name,lx-S.xs,ay[i]+label*.32,label,p.ink,'550','right',nw);
  posterFitText(ctx,change(s.v,t.v),right,by[i]+sz*.32,sz,d>=.05?'#b72f2a':d<=-.05?'#265a87':p.sub,'600','right',dw);
  for(const [seg,x,y,side] of [[s,lx,ay[i],1],[t,rx,by[i],-1]]){
   const val=fmt(seg.v),fits=seg.h>=pitch&&Math.abs(y-seg.mid)<=Math.max(0,(seg.h-pitch)/2);
   if(fits&&posterStackValueFits(ctx,val,bw,seg.h)){posterStackValueText(ctx,val,x+bw/2,y,ink(seg.color));continue;}
   // Prefer an outside callout in the ribbon, falling back to an opaque label in its column.
   const w=posterStackValueMetrics(ctx,val).width+S.xs,external=R-L>=2*(w+S.xs),cx=external?(side===1?L+S.xs+w/2:R-S.xs-w/2):x+bw/2;
   lead(side===1?x+bw:x,seg.mid,external?cx-side*w/2:cx+side*w/2,y);
   rounded(ctx,cx-w/2,y-pitch/2,w,pitch,posterDp(2),'#ffffff');
   posterStackValueText(ctx,val,cx,y,p.ink);
   auditIssue(ctx,'部分较小色块使用引导标注，已保留原始占比与数值');
  }
 });
}
function drawResearchChartContent(ctx,p,s,box){
 const {left,right,top:start,bottom,width}=box;
 const caption=MOBILE_POSTER_TYPE.caption,notes=posterWrap(ctx,s.chartNote,width,caption,'400');
 const noteBlock=posterBlock(ctx,notes,caption,'400',0),noteHeight=notes.length?noteBlock.height+POSTER_SPACE.xs:0,chartBottom=bottom-noteHeight;
 const chartBox={left,right,top:start,bottom:chartBottom,width,height:chartBottom-start};
 const drawNotes=()=>notes.forEach((line,i)=>posterCaption(ctx,line,left,chartBottom+POSTER_SPACE.xs+noteBlock.y+i*noteBlock.step,p.sub,'left',width));
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
 if(s.chart?.kind==='brandRibbon'){drawPosterRibbon(ctx,s.chart,chartBox,p);drawNotes();return;}
 if(s.chart?.kind==='brandStack'){drawBrandComposition(ctx,s.chart,chartBox,p,'');drawNotes();return;}
 if(s.chart?.kind==='bars'||s.chart?.kind==='scatter'){drawHeadStaticPoster(ctx,p,{...s,chartNote:''},chartBox);drawNotes();return;}
 if(s.chart){
  const {periods,lines,unit}=s.chart,n=periods.length,bands=s.chart.bands||[],legendItems=[...lines.map(l=>({...l,legendBand:false})),...bands.map(b=>({...b,legendBand:true}))],count=legendItems.length;
  const legendBottom=posterLineLegend(ctx,legendItems,chartBox,p);
    const y0=legendBottom+posterDp(19),y1=chartBottom-posterDp(20),axis=posterLineAxis(s.chart,y1-y0);
    const x0=left+posterAxisGutter(ctx,axis.ticks),x1=right-posterDp(4);
    if(!auditPlot(ctx,x1-x0,y1-y0,'折线图绘图区',260,220))return;
    const scale=posterLineScale(s.chart,{left:x0,right:x1,top:y0,bottom:y1},axis),{x,y}=scale;
    researchPosterAxisText(ctx,unit,x0,y0-posterDp(5),'title',p.sub,'left',x1-x0);
    posterYTicks(ctx,axis.ticks,y,x0,x1,p);
    posterWeekTicks(ctx,periods,x,y1+posterDp(16),left,right,p);
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
 if(kind==='brandStack'){width=Math.max(1080,n*78+160);height=Math.max(650,480+Math.ceil(count/3)*36);}
 if(kind==='brandRibbon'){width=1080;height=Math.max(820,108+count*posterDp(16)+posterDp(24));}
 if(kind==='heatmap'){width=Math.max(1080,count*posterDp(38)+220);height=Math.max(560,n*posterDp(20)+220);}
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
  const T=MOBILE_POSTER_TYPE,notes=[...new Set([snapshot.chartNote,snapshot.note].filter(Boolean))].flatMap(t=>posterWrap(measure,t,geometry.width,T.caption,'400'));
   const noteBlock=posterBlock(measure,notes,T.caption,'400',0);
   const headings=[...posterWrap(measure,snapshot.title,geometry.width,T.title,'700').map(v=>({v,size:T.title,weight:'700'})),...posterWrap(measure,snapshot.displayMetric+' · '+snapshot.range,geometry.width,T.subtitle,'500').map(v=>({v,size:T.subtitle,weight:'500'})),...posterWrap(measure,'来源：'+snapshot.source,geometry.width,T.caption,'400').map(v=>({v,size:T.caption,weight:'400'}))];
  const headerH=32+headings.reduce((h,v)=>h+v.size*1.3,0),footerH=noteBlock.height+40,logicalH=headerH+geometry.height+footerH;
  const scale=Math.min(width/logicalW,16000/logicalH,Math.sqrt(40000000/(logicalW*logicalH)));
  if(!Number.isFinite(scale)||scale<=0)throw Error('图表尺寸无效');
  canvas.width=Math.max(1,Math.floor(logicalW*scale));canvas.height=Math.max(1,Math.floor(logicalH*scale));outputWidth=canvas.width;
  const ctx=canvas.getContext('2d'),audit={warnings:new Set(),errors:new Set(),referenceWidth:logicalW};posterAudits.set(ctx,audit);
  ctx.scale(scale,scale);ctx.fillStyle=p.panel||'#ffffff';ctx.fillRect(0,0,logicalW,logicalH);
  let yy=15;headings.forEach(h=>{yy+=h.size;if(h.size===T.caption)posterCaption(ctx,h.v,padding,yy,p.sub,'left',geometry.width);else posterFitText(ctx,h.v,padding,yy,h.size,h.weight==='700'?p.ink:p.sub,h.weight,'left',geometry.width);yy+=h.size*.3;});
   const box={left:padding,right:logicalW-padding,top:headerH,bottom:headerH+geometry.height,width:geometry.width,height:geometry.height};
  withPosterBody(ctx,()=>{if(snapshot.chart)drawResearchChartContent(ctx,p,{...snapshot,chartNote:''},box);
  else if(snapshot.table)drawDirectResearchTable(ctx,p,snapshot.table,box);});
  notes.forEach((line,i)=>posterCaption(ctx,line,padding,box.bottom+POSTER_SPACE.sm+noteBlock.y+i*noteBlock.step,p.sub,'left',geometry.width));
  drawImageWatermark(ctx,logicalW,logicalH,0,0,watermark,{safeEnabled:false},p);
  warnings=[...audit.warnings];posterAudits.delete(ctx);
   if(audit.errors.size)throw Error([...audit.errors].join('；')+'，请缩短区间或减少展示项目');
 });
 return {blob,width:outputWidth,warnings};
}
