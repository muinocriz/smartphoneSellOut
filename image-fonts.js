/* Shared PNG-only font whitelist. Browser-local fonts are never selected for exported text. */
(function(root){
  'use strict';
  const sans='SalesImageSans',mono='SalesImageMono,SalesImageSans',serif='SalesImageSerif,SalesImageSans';
  const approved=new Set(['SalesImageSans','SalesImageMono','SalesImageSerif']);
  const base=new URL('image-fonts/',document.currentScript.src);
  let setup,manifest,faces=[];
  function init(){
    if(!setup)setup=(async()=>{
      if(!document.fonts||!root.FontFace)throw Error('当前浏览器不支持出图字体加载');
      const res=await fetch(new URL('manifest.json',base));
      if(!res.ok)throw Error('出图字体清单加载失败（HTTP '+res.status+'）');
      const data=await res.json();
      if(!Array.isArray(data.faces)||!data.coverage||[...approved].some(f=>!Array.isArray(data.coverage[f])))throw Error('出图字体清单无效');
      const entries=data.faces.map(entry=>{
        if(!approved.has(entry.family)||!/^[A-Za-z0-9.-]+\.ttf$/.test(entry.file))throw Error('出图字体清单无效');
        const face=new FontFace(entry.family,'url("'+new URL(entry.file,base).href+'")',{weight:entry.weight,style:'normal'});
        return {family:entry.family,face};
      });
      if([...approved].some(f=>!entries.some(e=>e.family===f)))throw Error('出图字体清单不完整');
      entries.forEach(e=>document.fonts.add(e.face));faces=entries;manifest=data;
    })().catch(err=>{setup=null;throw err;});
    return setup;
  }
  async function prepare({serif:includeSerif=false}={}){
    try{
      await init();
      await Promise.all(faces.filter(e=>includeSerif||e.family!=='SalesImageSerif').map(e=>e.face.load()));
    }catch(err){throw Error('开源出图字体未加载成功，无法导出图片。请确认网络和站点字体资源后刷新重试（'+err.message+'）');}
  }
  function covered(family,cp){
    const ranges=manifest?.coverage[family]||[];
    let lo=0,hi=ranges.length-1;
    while(lo<=hi){const i=(lo+hi)>>1,[a,b]=ranges[i];if(cp<a)hi=i-1;else if(cp>b)lo=i+1;else return true;}
    return false;
  }
  function parseFont(value){
    const match=/^(.*?\b(?:\d*\.?\d+)px\s+)(.+)$/.exec(value);
    if(!match)throw Error('无法核对图片文字字体：'+value);
    const families=match[2].split(',').map(v=>v.trim().replace(/^["']|["']$/g,'')).filter(v=>approved.has(v));
    if(!families.length)families.push(sans);
    return {families,font:match[1]+families.join(',')};
  }
  function assertLoaded(families){
    for(const family of families){
      const selected=faces.filter(e=>e.family===family);
      if(!selected.length||selected.some(e=>e.face.status!=='loaded'))throw Error('开源出图字体未加载：'+family);
    }
  }
  function assertText(text,families){
    for(const char of String(text)){
      const cp=char.codePointAt(0);
      if(cp===9||cp===10||cp===13)continue; // Canvas treats these as whitespace.
      // Reject variation sequences and emoji presentation rather than allowing platform emoji fallback.
      const unsafe=cp===0x200d||cp===0x200c||(cp>=0xfe00&&cp<=0xfe0f)||(cp>=0xe0100&&cp<=0xe01ef)||/\p{Emoji_Presentation}/u.test(char);
      if(unsafe||!families.some(f=>covered(f,cp)))throw Error('出图字体不支持字符「'+char+'」(U+'+cp.toString(16).toUpperCase()+')，请替换后再导出');
    }
  }
  // Scope the Canvas check to synchronous export drawing only. Includes ECharts' own
  // measurement/render contexts; previews, UI and OCR remain unaffected.
  function guard(draw){
    if(!manifest)throw Error('开源出图字体尚未加载');
    const proto=CanvasRenderingContext2D.prototype,methods=['measureText','fillText','strokeText'];
    const originals=Object.fromEntries(methods.map(name=>[name,proto[name]]));
    let failure;
    try{
      for(const name of methods)proto[name]=function(...args){
        const previous=this.font;
        try{
          const {families,font}=parseFont(previous);
          assertLoaded(families);
          if(name!=='measureText')assertText(args[0],families);
          if(font!==previous)this.font=font;
          return originals[name].apply(this,args);
        }catch(err){failure??=err;throw err;}
        finally{if(this.font!==previous)this.font=previous;}
      };
      const value=draw();
      if(value&&typeof value.then==='function')throw Error('图片字体校验仅支持同步绘制');
      if(failure)throw failure;
      return value;
    }finally{for(const name of methods)proto[name]=originals[name];}
  }
  // Warm the default families for previews; export retries the strict preparation.
  const ready=prepare().then(()=>true,()=>false);
  root.ImageFonts=Object.freeze({sans,mono,serif,ready,prepare,guard});
})(window);
