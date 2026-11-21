/* Shared export infrastructure; poster rendering and publication data remain module-specific. */
(function(root){
  'use strict';
  const presets=Object.freeze([
    Object.freeze({width:1080,label:'标准'}),
    Object.freeze({width:1620,label:'高清'}),
    Object.freeze({width:2160,label:'超清'}),
    Object.freeze({width:3240,label:'极清'})
  ]);
  const defaultWidth=2160;
  function widthOf(value){
    const w=Number(value);
    return presets.some(p=>p.width===w)?w:defaultWidth;
  }
  function dimensions(value,ratio='3:4'){
    const width=widthOf(value);
    return {width,height:Math.round(width*(ratio==='9:16'?16/9:4/3))};
  }
  function updateOptions(select,ratio='3:4'){
    const selected=widthOf(select.value);
    select.replaceChildren(...presets.map(p=>{
      const option=document.createElement('option'),{width,height}=dimensions(p.width,ratio);
      option.value=String(width);
      option.textContent=p.label+' · '+width+' × '+height+(width===defaultWidth?'（推荐）':'');
      return option;
    }));
    select.value=String(selected);
    return dimensions(selected,ratio);
  }
  function createJob({buttons,status,onIdle=()=>{}}){
    let busy=false;
    function report(message,kind='working'){
      const el=status();
      if(el){el.textContent=message;el.dataset.state=kind;el.hidden=!message}
    }
    function begin(message='正在生成高清 PNG…'){
      if(busy)return false;
      busy=true;
      for(const button of buttons()){
        button.disabled=true;
        button.setAttribute('aria-busy','true');
      }
      report(message);
      return true;
    }
    function end(){
      if(!busy)return;
      busy=false;
      for(const button of buttons())button.removeAttribute('aria-busy');
      onIdle();
    }
    function offerDownloads(files,message){
      report(message,'success');
      const el=status();
      if(!el)return;
      const actions=document.createElement('span');
      actions.className='ui-export-downloads';
      for(const file of files){
        const button=document.createElement('button');
        button.type='button';
        button.className='ui-export-retry';
        button.textContent='下载'+file.label;
        button.addEventListener('click',()=>downloadBlob(file.blob,file.name));
        actions.appendChild(button);
      }
      el.appendChild(actions);
    }
    return Object.freeze({get busy(){return busy},begin,report,end,offerDownloads});
  }
  async function waitForFonts(){if(document.fonts?.ready)await document.fonts.ready}
  async function canvasPNG(draw){
    const canvas=document.createElement('canvas');
    try{
      await draw(canvas);
      return await new Promise((resolve,reject)=>{
        canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('图像导出失败，请尝试降低导出分辨率')),'image/png');
      });
    }finally{canvas.width=0;canvas.height=0}
  }
  function downloadBlob(blob,name){
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    try{a.href=url;a.download=name;document.body.appendChild(a);a.click()}
    finally{a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000)}
  }
  // Capture both versions synchronously, then render serially to bound canvas memory.
  async function exportSafeVersions(job,filename,capture,render){
    const stem=filename.replace(/\.png$/i,'');
    const versions=[
      {enabled:true,label:'规避版'},
      {enabled:false,label:'完整版'}
    ].map(v=>({...v,name:stem+'_'+v.label+'.png',publication:capture(v.enabled)}));
    const files=[];
    for(const [index,version] of versions.entries()){
      job.report('正在生成'+version.label+'（'+(index+1)+' / '+versions.length+'）…');
      files.push({label:version.label,name:version.name,blob:await render(version.publication)});
    }
    let initiated=0;
    for(const file of files){
      try{downloadBlob(file.blob,file.name);initiated++}
      catch(err){console.warn('自动下载未能启动：',err)}
    }
    job.offerDownloads(files,initiated===files.length?'两张 PNG 已生成':'两张 PNG 已生成，请分别下载');
  }
  root.PosterExport=Object.freeze({presets,defaultWidth,widthOf,dimensions,updateOptions,createJob,waitForFonts,canvasPNG,downloadBlob,exportSafeVersions});
})(window);
