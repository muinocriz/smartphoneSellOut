/* Shared watermark settings and controls for the SVG and Canvas studios. */
(function(root){
  'use strict';
  const defaults=Object.freeze({diagonalEnabled:false,diagonalText:'归零return0',diagonalOpacity:8,diagonalSize:32,diagonalGap:220,centerEnabled:false,centerText:'归零return0',centerOpacity:12,centerSize:72});
  const markup=`
  <p>两种模式互斥，默认均关闭。水印会同时显示在预览和导出的图片中。</p>
  <div class="wm-section">
    <div class="wm-head"><div><strong>全屏倾斜水印</strong><small>斜向重复平铺在图表区域</small></div><input id="wmDiagonalEnabled" class="wm-toggle" type="checkbox" aria-label="开启全屏倾斜水印"></div>
    <div class="wm-field"><label for="wmDiagonalText">水印文案</label><input id="wmDiagonalText" type="text" value="归零return0" maxlength="80"></div>
    <div class="wm-grid">
      <div class="wm-field"><label for="wmDiagonalOpacity">透明度 <span id="wmDiagonalOpacityValue">8%</span></label><input id="wmDiagonalOpacity" type="range" min="0" max="30" step="1" value="8"></div>
      <div class="wm-field"><label for="wmDiagonalSize">字体大小 <span id="wmDiagonalSizeValue">32px</span></label><input id="wmDiagonalSize" type="range" min="16" max="72" step="1" value="32"></div>
    </div>
    <div class="wm-field"><label for="wmDiagonalGap">排版间距 <span id="wmDiagonalGapValue">220px</span></label><input id="wmDiagonalGap" type="range" min="110" max="420" step="10" value="220"></div>
  </div>
  <div class="wm-section">
    <div class="wm-head"><div><strong>中心水印模式</strong><small>仅在图表内容区域中心显示一个大号水印</small></div><input id="wmCenterEnabled" class="wm-toggle" type="checkbox" aria-label="开启中心水印"></div>
    <div class="wm-field"><label for="wmCenterText">水印文案</label><input id="wmCenterText" type="text" value="归零return0" maxlength="80"></div>
    <div class="wm-grid">
      <div class="wm-field"><label for="wmCenterOpacity">透明度 <span id="wmCenterOpacityValue">12%</span></label><input id="wmCenterOpacity" type="range" min="0" max="30" step="1" value="12"></div>
      <div class="wm-field"><label for="wmCenterSize">字体大小 <span id="wmCenterSizeValue">72px</span></label><input id="wmCenterSize" type="range" min="32" max="160" step="2" value="72"></div>
    </div>
  </div>
  `;
  const fields=[
    ['wmDiagonalEnabled','diagonalEnabled','check'],['wmDiagonalText','diagonalText','text'],
    ['wmDiagonalOpacity','diagonalOpacity','num'],['wmDiagonalSize','diagonalSize','num'],
    ['wmDiagonalGap','diagonalGap','num'],['wmCenterEnabled','centerEnabled','check'],
    ['wmCenterText','centerText','text'],['wmCenterOpacity','centerOpacity','num'],
    ['wmCenterSize','centerSize','num']
  ];
  const byId=id=>document.getElementById(id);
  function sync(wm){
    for(const [id,key,kind] of fields){
      const el=byId(id);
      if(kind==='check')el.checked=!!wm[key];else el.value=wm[key];
    }
    for(const [key,unit] of [['DiagonalOpacity','%'],['DiagonalSize','px'],['DiagonalGap','px'],['CenterOpacity','%'],['CenterSize','px']]){
      byId('wm'+key+'Value').textContent=wm[key[0].toLowerCase()+key.slice(1)]+unit;
    }
  }
  // Read the current object on every event: resetting module 2 replaces its state.
  function mount(getState,onChange){
    byId('watermarkControls').insertAdjacentHTML('beforeend',markup);
    for(const [id,key,kind] of fields){
      const el=byId(id);
      el.addEventListener(kind==='check'?'change':'input',()=>{
        const wm=getState(),value=kind==='check'?el.checked:kind==='num'?Number(el.value):el.value;
        wm[key]=value;
        if(key==='diagonalEnabled'&&value)wm.centerEnabled=false;
        if(key==='centerEnabled'&&value)wm.diagonalEnabled=false;
        sync(wm);onChange();
      });
    }
    sync(getState());
  }
  function parameters(wm){
    if(!wm?.diagonalEnabled&&!wm?.centerEnabled)return null;
    const diagonal=!!wm.diagonalEnabled;
    const text=String((diagonal?wm.diagonalText:wm.centerText)??'').slice(0,80);
    const opacity=Math.max(0,Math.min(.3,Number(diagonal?wm.diagonalOpacity:wm.centerOpacity)/100));
    if(!text.trim()||opacity<=0)return null;
    const size=Math.max(12,Math.min(180,Number(diagonal?wm.diagonalSize:wm.centerSize)));
    const gap=Math.max(110,Math.min(420,Number(wm.diagonalGap)||220));
    return {diagonal,text,opacity,size,gap};
  }
  root.PosterWatermark=Object.freeze({defaults,mount,sync,parameters});
})(window);
