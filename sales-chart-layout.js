/* 共用销量图排版，调用方提供数据、标记和主题。 */
(function(){
  "use strict";
  const needsBrand=m=>/^\d/.test(m)||[...m].length<=3;
  // 尺寸以设计画布为基准，图片还会按附注行数向下延伸。
  function exportSize(mobile){
    return mobile?{W:400,H:500,dpr:3}:{W:1200,H:675,dpr:2};
  }
  function observedLine({name,data,color,panel,style,showSymbol}){
    return {
      name,data,type:"line",connectNulls:false,smooth:false,symbol:"circle",
      symbolSize:style.sym,showSymbol,lineStyle:{width:style.lw,color},
      itemStyle:{color,borderColor:panel,borderWidth:1.5}
    };
  }
  function renderPNG(echarts,{W,H,dpr},footerHeight,background,render){
    const height=H+footerHeight;
    const div=document.createElement("div");
    div.style.cssText=`position:fixed;left:-10000px;top:0;width:${W}px;height:${height}px`;
    document.body.appendChild(div);
    let inst;
    try{
      inst=echarts.init(div,null,{renderer:"canvas",devicePixelRatio:dpr,width:W,height});
      render(inst);
      return inst.getDataURL({type:"png",pixelRatio:dpr,backgroundColor:background});
    }finally{
      inst?.dispose();
      div.remove();
    }
  }

  function create({font:FONT,mono:MONO,theme,colorOf,label,flagPrefix}){
    let MEAS=null;
    function textW(t,size,weight,fam){MEAS=MEAS||document.createElement("canvas").getContext("2d");MEAS.font=`${weight||400} ${size}px ${fam||FONT()}`;return MEAS.measureText(t).width}
    function fitText(t,max,size,weight){if(textW(t,size,weight)<=max)return t;
      while(t.length>1&&textW(t+"…",size,weight)>max)t=t.slice(0,-1);return t+"…"}
    // Export subtitle: wrap whole metadata phrases before falling back to character wrapping.
    // Do not truncate explanatory labels, including the milestone and estimate legend.
    function wrapExportSub(parts,max,size){
      const lines=[];let line="";
      for(const part of parts.filter(Boolean)){
        const joined=line?line+" · "+part:part;
        if(textW(joined,size)<=max){line=joined;continue;}
        if(line){lines.push(line);line="";}
        for(const ch of part){
          if(line&&textW(line+ch,size)>max){lines.push(line);line="";}
          line+=ch;
        }
      }
      if(line)lines.push(line);
      return lines;
    }
    // 各尺寸参数：mobile 以 400px 宽设计、3 倍导出，所有文字 ≥12px
    function spec(o){return o.mobile
      ?{ax:12,end:13,val:12,lw:2,lwH:3,sym:5,maxEnd:0.40}
      :{ax:11,end:12,val:11,lw:2,lwH:3,sym:o.exp?6:7,maxEnd:0.24}}

    function lastIdx(d,lo,hi){for(let k=Math.min(hi,d.length-1);k>=lo;k--)if(d[k]!=null)return k;return -1}


    // ===== 手机（网页与导出）：线尾只标序号，名字和数值放到图下方的排行列表 =====
    // 按最新值从高到低编号，顺序与线尾的上下位置基本一致。
    // 导出：最多 2 列 × 6 行，超出的不编号并注明数量；网页：单列、全部列出
    const ML={row:21,rows:6,pad:16,gapTop:10};
    function mobileRank(sel,datas,o){
      const items=sel.map((r,i)=>{const j=lastIdx(datas[i],o.lo,o.hi);return j<0?null:{i,r,v:datas[i][j],flag:o.estFlags?.[i]?.[j]}}).filter(Boolean)
        .sort((a,b)=>b.v-a.v);
      const cols=o.exp&&items.length>4?2:1,cap=o.exp?cols*ML.rows:Infinity; // 网页上列表可滚动，全部列出
      let shown=items;if(items.length>cap)shown=items.slice(0,cap-1);
      o.rank=shown;o.more=items.length-shown.length;o.cols=cols;
      const rows=Math.ceil((shown.length+(o.more?1:0))/cols);
      o.listH=rows*ML.row+ML.gapTop;
      o.names=sel.map(()=>null);shown.forEach((it,k)=>{o.names[it.i]=String(k+1)});
    }
    // 列表名字：完整名（含品牌）放得下就完整显示；放不下先去掉品牌，仍放不下再截断。
    // 需要品牌才能认出的机型（见 needsBrand）不去品牌，直接截断
    function listName(r,max){const nm=label(r);
      if(textW(nm,13)<=max)return nm;
      return fitText(needsBrand(r.model)?nm:r.model,max,13,400)}
    function mobileList(o){
      const t=theme();
      const g=[],W=o.W,H=o.H,colW=(W-ML.pad*2)/o.cols,top=H-30-o.listH+ML.gapTop;
      const cells=o.rank.map((it,k)=>({k,it}));if(o.more)cells.push({more:o.more});
      const nW=textW(String(o.rank.length),13,700)+8,sw=14;
      const rows=Math.ceil(cells.length/o.cols);
      cells.forEach((c,n)=>{const col=Math.floor(n/rows),row=n%rows; // 先竖后横，阅读顺序 1→6 再 7→12
        const x=ML.pad+col*colW,y=top+row*ML.row+ML.row/2;
        if(c.more){g.push({type:"text",x,y,silent:true,style:{text:`另有 ${c.more} 个机型未列出${o.preserveSeriesColors?"":"（灰线）"}`,fill:t.mu,font:`12px ${FONT()}`,textVerticalAlign:"middle"}});return}
        const {it,k}=c,num=String(k+1),vt=flagPrefix(it.flag)+formatSales(it.v),col_=colorOf(it.r);
        const vW=textW(vt,12,400,MONO);
        g.push({type:"text",x,y,silent:true,style:{text:num,fill:col_,font:`700 13px ${FONT()}`,textVerticalAlign:"middle"}});
        g.push({type:"line",silent:true,shape:{x1:x+nW,y1:y,x2:x+nW+sw,y2:y},style:{stroke:col_,lineWidth:3,lineCap:"round"}});
        const nmX=x+nW+sw+6,nmMax=colW-(nW+sw+6)-vW-10;
        g.push({type:"text",x:nmX,y,silent:true,style:{text:listName(it.r,nmMax),fill:t.fg,font:`13px ${FONT()}`,textVerticalAlign:"middle"}});
        g.push({type:"text",x:x+colW-8,y,silent:true,style:{text:vt,fill:t.mu,font:`12px ${MONO}`,textAlign:"right",textVerticalAlign:"middle"}});
      });
      return g;
    }
    function exportFooter(width,note){
      note=note.trim();
      if(!note)return {height:0,graphic:[]};
      const lines=[],pad=16,lineHeight=17;
      for(const paragraph of note.split("\n")){
        let line="";
        for(const char of paragraph){
          if(line&&textW(line+char,12)>width-2*pad){lines.push(line);line=""}
          line+=char;
        }
        lines.push(line);
      }
      return {height:lines.length*lineHeight+8,graphic:[{type:"text",left:pad,bottom:8,silent:true,
        style:{text:lines.join("\n"),lineHeight,fill:theme().mu,font:`12px ${FONT()}`}}]};
    }

    function chartOption(catT,series,o,log,metric){
      const t=theme(),f=spec(o);
      const endW=Math.max(0,...o.names.filter(Boolean).map(x=>textW(x,f.end,500)));
      return {
        animation:!o.exp,animationDuration:400,
        textStyle:{fontFamily:FONT()},
        grid:{left:o.mobile?8:12,right:Math.ceil(endW)+(o.mobile?18:22),
          top:o.exp?(o.mobile?78:80):36,bottom:o.exp?o.footerHeight+(o.mobile?36+o.listH:40):(o.mobile?50:84),containLabel:true},
        xAxis:{type:"category",data:catT,boundaryGap:false,
          axisLine:{lineStyle:{color:t.ln}},axisLabel:{color:t.axisText??t.mu,fontSize:f.ax,hideOverlap:true},axisTick:{show:false}},
        yAxis:{type:log?"log":"value",name:o.exp?"":metric,nameTextStyle:{color:t.mu,fontSize:f.ax},
          scale:!log,axisLabel:{formatter:formatSales,color:t.axisText??t.mu,fontFamily:MONO,fontSize:f.ax},splitLine:{lineStyle:{color:t.ln,type:"dashed"}}},
        series};
    }

    function setExportTitle(opt,catT,sel,o,log,metric,notes){
      const t=theme(),W=o.W;
      const rg=catT.length?catT[0].split("\n")[0]+" – "+catT[catT.length-1].split("\n")[0]:"";
      const bs=[...new Set(sel.map(r=>r.brand))];
      const meta=[bs.length===1?bs[0]:"",rg,metric,log?"对数纵轴":""];
      const titleLeft=o.mobile?16:20,titleTop=o.mobile?16:18,titleSize=o.mobile?18:20,subSize=o.mobile?12:13,subLineHeight=o.mobile?17:19,itemGap=6;
      const maxSubWidth=W-titleLeft*2-4;
      const lines=o.mobile?[...wrapExportSub(meta,maxSubWidth,subSize),...wrapExportSub(notes,maxSubWidth,subSize)]:wrapExportSub([...meta,...notes],maxSubWidth,subSize);
      opt.title={text:"新机周销量追踪",subtext:lines.join("\n"),left:titleLeft,top:titleTop,padding:0,itemGap,
        textStyle:{color:t.fg,fontSize:titleSize,lineHeight:titleSize+4,fontWeight:700,fontFamily:FONT()},
        subtextStyle:{color:t.subtitle??t.mu,fontSize:subSize,lineHeight:subLineHeight,fontFamily:FONT()}};
      opt.grid.top=Math.max(opt.grid.top,titleTop+titleSize+4+itemGap+lines.length*subLineHeight+12);
    }

    // 线尾标签避让：
    // 1) 末点在最右侧的线，标签放在右侧栏，彼此上下推开（先下推、再收回绘图区），被推开的用引导线连回线尾；
    // 2) 中途结束的线，在线尾周围试多个候选位置（右/右上/右下/上/下），按「与其他标签重叠、压到折线、超出绘图区」打分取最优；
    //    都不理想且线尾靠近右侧时退回右侧栏 + 引导线；离得远就取得分最高的位置（标签自带底色，压线也可读）。
    function stack(L,top,bottom,gap){
      L.sort((a,b)=>a.y0-b.y0);let prev=null;
      for(const l of L){l.y=Math.max(l.y0,prev?prev.y+(prev.h+l.h)/2+gap:-1e9);prev=l}
      let next=null;
      for(const l of [...L].reverse()){l.y=Math.min(l.y,next?next.y-(next.h+l.h)/2-gap:bottom-l.h/2);next=l}
      prev=null;for(const l of L){l.y=Math.max(l.y,top+l.h/2,prev?prev.y+(prev.h+l.h)/2+gap:-1e9);prev=l}
    }
    function segHitsBox(x1,y1,x2,y2,r){ // Liang–Barsky
      let t0=0,t1=1;const dx=x2-x1,dy=y2-y1;
      for(const [p,q] of [[-dx,x1-r.x0],[dx,r.x1-x1],[-dy,y1-r.y0],[dy,r.y1-y1]]){
        if(p===0){if(q<0)return false}else{const t=q/p;if(p<0){if(t>t1)return false;if(t>t0)t0=t}else{if(t<t0)return false;if(t<t1)t1=t}}}
      return true}
    function boxOf(l,x,y){return {x0:x,x1:x+l.w,y0:y-l.h/2,y1:y+l.h/2}}
    const boxHit=(a,b)=>a.x0<b.x1&&b.x0<a.x1&&a.y0<b.y1&&b.y0<a.y1;
    function placeLabels(inst,ctx,lo,hi){
      const {sel,datas,o}=ctx,t=theme(),f=spec(o);
      let rect;try{rect=inst.getModel().getComponent("grid").coordinateSystem.getRect()}catch(e){rect={x:0,y:0,width:inst.getWidth(),height:inst.getHeight()}}
      const W=inst.getWidth(),right=rect.x+rect.width,top=rect.y,bottom=rect.y+rect.height,off=o.mobile?6:8;
      // 每条线在可见窗口内的折线（像素），用于避让
      const segs=[];
      sel.forEach((r,i)=>{const d=datas[i];let p=null;
        for(let k=lo;k<=Math.min(hi,d.length-1);k++){if(d[k]==null){p=null;continue}
          const q=inst.convertToPixel({seriesIndex:i},[k,d[k]]);if(p)segs.push({i,x1:p[0],y1:p[1],x2:q[0],y2:q[1]});p=q}});
      // 数据标签（数值）也作为障碍物
      const vbox=[];
      if(ctx.valueLabel)sel.forEach((r,i)=>{const d=datas[i];
        for(let k=lo;k<=Math.min(hi,d.length-1);k++){if(d[k]==null)continue;
          const q=inst.convertToPixel({seriesIndex:i},[k,d[k]]),w=textW(ctx.valueLabel(d[k],o.estFlags?.[i]?.[k]),f.val)+2,yb=q[1]-f.sym/2-5;
          vbox.push({x0:q[0]-w/2,x1:q[0]+w/2,y0:yb-f.val-2,y1:yb})}});
      const L=[];
      sel.forEach((r,i)=>{const d=datas[i],j=lastIdx(d,lo,hi);if(j<0||!o.names[i])return;
        const pt=inst.convertToPixel({seriesIndex:i},[j,d[j]]);if(!pt||!isFinite(pt[1]))return;
        const text=o.names[i];
        L.push({i,text,color:colorOf(r),px:pt[0],py:pt[1],y0:pt[1],w:textW(text,f.end,500)+8,h:f.end+6,
          atEnd:pt[0]>=right-2})});
      const gap=o.mobile?1:2;
      // 右侧栏容量：放不下时优先保留数值高（位置靠上）的线，其余不标
      const cap=Math.max(1,Math.floor((bottom-top+8+gap)/((L[0]?L[0].h:20)+gap)));
      let gut=L.filter(l=>l.atEnd).sort((a,b)=>a.py-b.py);
      gut.slice(cap).forEach(l=>l.skip=true);gut=gut.slice(0,cap);
      gut.forEach(l=>{l.x=Math.min(right+off,W-2-l.w)});
      stack(gut,top-4,bottom+4,gap);
      const placed=gut.map(l=>boxOf(l,l.x,l.y));
      const mid=L.filter(l=>!l.atEnd).sort((a,b)=>b.px-a.px);
      for(const l of mid){
        const {px,py,w,h}=l;
        const cands=[[px+off,py,0],[px+off,py-h*.75,1],[px+off,py+h*.75,1],[px-w/2,py-h/2-6,2],[px-w/2,py+h/2+6,2],
          [px+off,py-h*1.5,3],[px+off,py+h*1.5,3],[px-w-off,py,4],[px-w+off,py-h/2-6,5],[px-w+off,py+h/2+6,5],
          [px-w/2,py-h*1.6,6],[px-w/2,py+h*1.6,6]];
        let best=null;
        for(const [x,y,pen] of cands){
          const bx=boxOf(l,x,y);let sc=pen;
          if(bx.x0<2||bx.x1>W-2||bx.y0<top-4||bx.y1>bottom+4)sc+=1000;else if(bx.x0<rect.x)sc+=40; // 压到纵轴刻度区：轻罚
          for(const pb of placed)if(boxHit(bx,pb))sc+=500;
          for(const vb of vbox)if(boxHit(bx,vb))sc+=25;
          for(const sg of segs){if(sg.i===l.i)continue;if(segHitsBox(sg.x1,sg.y1,sg.x2,sg.y2,bx))sc+=60}
          for(const sg of segs){if(sg.i!==l.i)continue;if(segHitsBox(sg.x1,sg.y1,sg.x2,sg.y2,{x0:bx.x0+2,x1:bx.x1-2,y0:bx.y0+2,y1:bx.y1-2}))sc+=30}
          if(!best||sc<best.sc)best={x,y,sc}}
        if(best.sc>=60&&right-px<rect.width*.2&&gut.length<cap){ // 压线或重叠且离右侧不远：退到右侧栏
          l.x=Math.min(right+off,W-2-l.w);l.atEnd=true;gut.push(l);stack(gut,top-4,bottom+4,gap);
          placed.length=0;L.forEach(m=>{if(m.x!=null&&m.y!=null)placed.push(boxOf(m,m.x,m.y))});
        }else if(best.sc>=500){l.skip=true // 无处可放（超出或与其他标签重叠）：不标
        }else{l.x=best.x;l.y=best.y;placed.push(boxOf(l,l.x,l.y))}
      }
      const g=[];
      ctx.skipped=L.filter(l=>l.skip).length+sel.filter((r,i)=>lastIdx(datas[i],lo,hi)>=0&&!o.names[i]).length;
      // 放不下的名字不再隐藏：留在线尾原位，按重要性（数值从高到低）逐级变淡；悬停该线时完全显出
      // 导出的静态图无法悬停，淡色名字只会叠成一团，因此导出时不画；手机网页下方列表已列全，也不画
      const faint=o.exp||o.mobile?[]:L.filter(l=>l.skip).sort((a,b)=>a.py-b.py);
      L.splice(0,L.length,...L.filter(l=>!l.skip));
      L.forEach(l=>{l.op=1;
        const lead=l.atEnd?Math.abs(l.y-l.y0)>2||l.x-l.px>off+4:Math.hypot(l.x-l.px,l.y-l.py)>off+h2(l);
        l.lead=lead;
        if(lead){const tx=l.x<l.px?l.x+l.w:l.x;
          g.push({type:"polyline",id:"eg"+l.i,z:99,silent:true,
            shape:{points:l.atEnd?[[l.px+3,l.py],[l.x-4,l.y],[l.x,l.y]]:[[l.px,l.py],[tx,l.y]]},
            style:{stroke:l.color,lineWidth:1,opacity:.7,fill:null}})}
        g.push({type:"rect",id:"eb"+l.i,z:100,silent:true,shape:{x:l.x,y:l.y-l.h/2,width:l.w,height:l.h,r:3},
          style:{fill:t.pn,opacity:.88}});
        g.push({type:"text",id:"et"+l.i,z:101,x:l.x+4,y:l.y,cursor:"default",
          style:{text:l.text,fill:l.color,font:`${o.mobile?700:500} ${f.end}px ${FONT()}`,textVerticalAlign:"middle"},
          onmouseover:()=>inst.dispatchAction({type:"highlight",seriesIndex:l.i}),
          onmouseout:()=>inst.dispatchAction({type:"downplay",seriesIndex:l.i})});
      });
      faint.forEach((l,k)=>{
        l.op=Math.max(.12,.42-k*.03);l.faint=true;l.lead=false;
        l.x=Math.min(l.px+off,W-2-l.w);l.y=Math.max(top+l.h/2,Math.min(bottom-l.h/2,l.py));
        g.push({type:"rect",id:"eb"+l.i,z:102,silent:true,shape:{x:l.x,y:l.y-l.h/2,width:l.w,height:l.h,r:3},
          style:{fill:t.pn,opacity:0}});
        g.push({type:"text",id:"et"+l.i,z:103-k*.001,x:l.x+4,y:l.y,cursor:"default",
          style:{text:l.text,fill:l.color,opacity:l.op,font:`${f.end}px ${FONT()}`,textVerticalAlign:"middle"},
          onmouseover:()=>inst.dispatchAction({type:"highlight",seriesIndex:l.i}),
          onmouseout:()=>inst.dispatchAction({type:"downplay",seriesIndex:l.i})});
        L.push(l);
      });
      const base=[...(ctx.base||[])];
      // 导出图：没有名字/序号的线改成浅灰细线，只表示「还有其他机型」，不用颜色误导；桌面导出在底部注明数量
      // （手机导出的数量写在下方列表末尾）
      if(o.exp&&!o.preserveSeriesColors){const done=new Set(L.map(l=>l.i));
        const un=sel.map((r,i)=>i).filter(i=>lastIdx(datas[i],lo,hi)>=0&&!done.has(i));
        if(un.length){const u=new Set(un);
          const updates=sel.map((r,i)=>u.has(i)?{z:1,showSymbol:false,label:{show:false},
            lineStyle:{color:t.mu,width:1,opacity:.35},itemStyle:{color:t.mu,opacity:.35}}:{z:3});
          if(o.overlayIndices)for(const [index,{i,virtual}] of o.overlayIndices)updates[index]=u.has(i)?(virtual?{z:1,showSymbol:true,label:{show:true,color:t.mu},itemStyle:{borderColor:t.mu}}:{z:1,showSymbol:false,label:{show:false},lineStyle:{type:"dashed",color:t.mu,width:1,opacity:.35}}):{z:3};
          inst.setOption({series:updates});
          if(!o.mobile)base.push({type:"text",right:20,bottom:14+o.footerHeight,silent:true,
            style:{text:`另有 ${un.length} 个机型未标注（灰线）`,fill:t.mu,font:`12px ${FONT()}`}})}}
      ctx.labels=L;
      inst.setOption({graphic:[...base,...g]},{replaceMerge:["graphic"]});
    }
    const h2=l=>l.h*0.75+2;

    return {textW,fitText,spec,lastIdx,mobileRank,listName,mobileList,exportFooter,chartOption,setExportTitle,placeLabels};
  }

  const formatSales=new Intl.NumberFormat("zh-CN",{maximumFractionDigits:2}).format;
  function exportFilename({weekly,subject,salesWeek,mobile}){
    const now=new Date();
    const time=[now.getHours(),now.getMinutes(),now.getSeconds()].map(n=>String(n).padStart(2,"0")).join("");
    const name=String(subject).replace(/[\\/:*?"<>|]/g,"_");
    return [weekly?"周增量":"总销量",name,salesWeek?"销售周":"自然周",mobile?"手机":"桌面",time].join("-")+".png";
  }

  window.SalesChartLayout={formatSales,exportFilename,create,needsBrand,observedLine,exportSize,renderPNG};
})();
