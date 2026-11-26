/* Module 3 calibration and raw estimate UI. */
'use strict';
let currentDataset={id:'custom',label:'未导入榜单',base:0,width:0,height:0,bars:[],calibrations:[]};
let mode='single', picked=[], timer;
function $(id){return document.getElementById(id)};
function e(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function fmt(v,d=2){return Number(v).toLocaleString('zh-CN',{minimumFractionDigits:d,maximumFractionDigits:d})}
function tf(v){return !Number.isFinite(v)?'—':fmt(v,Math.abs(v)>=100?1:Math.abs(v)>=10?2:Math.abs(v)>=1?3:4)}
// 只接受单个非负数或两个非负累计值相减；不执行任意 JavaScript 表达式。
function parseAmount(raw){const normalized=String(raw).trim().replace(/[－−–—]/g,'-').replace(/\s+/g,'');const match=normalized.match(/^(\d+(?:\.\d+)?|\.\d+)(?:-(\d+(?:\.\d+)?|\.\d+))?$/);if(!match)return null;const a=Number(match[1]),b=match[2]===undefined?null:Number(match[2]);const result=b===null?a:Number((a-b).toPrecision(12));return Number.isFinite(result)?{value:result,isDifference:b!==null,normalized}:null}
function previewAmount(){const raw=$('amount').value,parsed=parseAmount(raw),unit=$('inputUnit').selectedOptions[0].textContent,el=$('amountPreview');if(!raw.trim()){el.textContent='支持直接输入销量，或用“本期累计销量 - 上期累计销量”自动计算本期销量。';el.style.color='light-dark(#8d9cae,var(--site-muted))';return}if(!parsed){el.textContent='格式错误：请输入数字，或两个累计销量相减（例如 782.87-689.03）。';el.style.color='light-dark(#b43333,var(--red))';return}if(parsed.value<=0){el.textContent='差值必须大于 0，请确认累计销量的前后顺序。';el.style.color='light-dark(#b43333,var(--red))';return}el.textContent=parsed.isDifference?`差值 = ${fmt(parsed.value,Math.min(8,Math.max(2,(String(parsed.value).split('.')[1]||'').length)))} ${unit}，将作为本期销量参与标定`:`将以 ${fmt(parsed.value,2)} ${unit} 参与标定`;el.style.color='light-dark(#266943,var(--green))'}
function ds(){return currentDataset}
function notify(t){const q=$('toast');q.textContent=t;q.classList.add('show');clearTimeout(timer);timer=setTimeout(()=>q.classList.remove('show'),2700)}
function setInfo(msg,kind=''){let el=$('addInfo');el.className='msg'+(kind?' '+kind:'');el.textContent=msg}
function resetCalibrationInputs(){mode='single';picked=[];$('searchRows').value='';$('poolSearch').value='';$('amount').value='';previewAmount();$('modeSingle').classList.add('on');$('modeGroup').classList.remove('on');$('singlePane').hidden=false;$('groupPane').hidden=true;}
function renderOptions(){const bars=ds().bars;$('singleSelect').innerHTML=bars.map((m,i)=>`<option value="${i}">#${m.rank} ${e(m.name)} · ${m.pixels} px</option>`).join('');renderPool()}
function renderPool(){const term=$('poolSearch').value.trim().toLowerCase(), bars=ds().bars;$('pickedCount').textContent=`已选 ${picked.length} / 5 · ${picked.reduce((t,i)=>t+bars[i].pixels,0)} px`;$('pool').innerHTML=bars.map((m,i)=>({m,i})).filter(({m})=>!term||m.name.toLowerCase().includes(term)||String(m.rank).includes(term)).map(({m,i})=>`<label class="option"><input type="checkbox" value="${i}" ${picked.includes(i)?'checked':''}><span class="rank">#${m.rank}</span><span class="name">${e(m.name)}</span><span class="len">${m.pixels} px</span></label>`).join('')||'<div class="empty">没有匹配的机型</div>'; $('pool').querySelectorAll('input').forEach(x=>x.addEventListener('change',()=>{const i=Number(x.value);if(x.checked){if(picked.length>=5){x.checked=false;notify('每组最多选择 5 款机型');return}picked.push(i)}else picked=picked.filter(n=>n!==i);picked.sort((a,b)=>a-b);renderPool()}))}
function getFit(){const cs=ds().calibrations||[];let k=null, warn=[], statuses=[], fitMode='none', accepted=[];const th=+$('outlier').value;
 if(!cs.length)return {k,warn,statuses,fitMode,accepted};
 const rates=cs.map(x=>x.value/x.pixels),n=rates.length,sorted=[...rates].sort((a,b)=>a-b),med=n%2?sorted[(n-1)/2]:(sorted[n/2-1]+sorted[n/2])/2;
 const relative=rates.map(v=>Math.abs(v/med-1));
 if(n===1){accepted=[0]; statuses=['ok'];fitMode='single'}
 else if(n===2){accepted=[0,1];const gap=Math.abs(rates[0]-rates[1])/med; if(gap>th){statuses=['conflict','conflict'];warn.push(`两组标定比例相差 ${fmt(gap*100,1)}%，仅凭这两组无法判断哪一组有误，请核对输入。`);fitMode='conflict'}else{statuses=['ok','ok'];fitMode='fit'}}
 else {statuses=relative.map(v=>v>th?'outlier':'ok');accepted=statuses.map((s,i)=>s==='ok'?i:-1).filter(i=>i>=0);
   if(accepted.length<2){statuses=relative.map(v=>v>th?'suspicious':'ok');warn.push('多组标定无法形成至少两组一致的参考值，暂采用比例中位数估算；结果不可靠，请检查所有输入。');fitMode='median';accepted=[]}
   else if(accepted.length<n){warn.push(`已暂时排除 ${n-accepted.length} 组明显偏离的标定，请核对标红条目的销量、单位或机型选择。`);fitMode='robust'}else fitMode='fit';}
 if(fitMode==='median')k=med;
 else {let top=0,bot=0;accepted.forEach(i=>{top+=cs[i].pixels*cs[i].value;bot+=cs[i].pixels**2});k=bot>0?top/bot:null;}
 return {k,warn,statuses,fitMode,accepted,med,rates};
}
function renderCalibration(fit){const cs=ds().calibrations||[],b=ds().bars;
 if(!cs.length){$('calList').innerHTML='<div class="empty">还没有标定数据</div>'; $('fitInfo').className='msg'; $('fitInfo').textContent='添加一组已知销量后，即可推算全部机型。';return}
 $('calList').innerHTML=cs.map((a,i)=>{const status=fit.statuses[i],pct=fit.k?((a.value/a.pixels)/fit.k-1)*100:0;return `<div class="cal"><div class="calhead"><div class="calname">#${i+1} ${a.ids.map(idx=>e(b[idx].name)).join(' + ')} ${a.ids.length>1?`<span class="labelchip">合计 ${a.ids.length} 款</span>`:''}</div><div class="calval">${fmt(a.value/10000,a.value/10000<1?3:2)} 万台</div><button type="button" class="xbtn" data-rm="${i}" title="移除该组标定">×</button></div><div class="smallline">柱长合计 ${a.pixels} px · ${tf(a.value/a.pixels)} 台/px · 相对拟合 ${pct>=0?'+':''}${fmt(pct,1)}%</div>${a.isDifference?`<div class="smallline">累计销量差值：${e(a.rawInput)} ${e(a.unit)} = ${fmt(a.value/(a.unit==='万台'?10000:1),2)} ${e(a.unit)}</div>`:''}${status==='outlier'?'<div class="flag">⚠ 明显偏离其他数据；已暂时排除</div>':status==='conflict'?'<div class="flag">⚠ 与另一组冲突，无法判定哪组有误</div>':status==='suspicious'?'<div class="flag">⚠ 与中位数偏差较大，建议核对</div>':''}</div>`}).join('');
 document.querySelectorAll('[data-rm]').forEach(b=>b.addEventListener('click',()=>{ds().calibrations.splice(Number(b.dataset.rm),1);renderAll(false)}));
 let msg;if(fit.warn.length){msg=fit.warn.join(' ');$('fitInfo').className='msg warn'}else if(cs.length===1){msg='只有 1 组标定，已按比例推算；添加更多已知销量可以交叉校验。';$('fitInfo').className='msg'}else{msg=`${cs.length} 组标定比例在允许偏差内，当前拟合结果可供比较。`;$('fitInfo').className='msg good'}$('fitInfo').textContent=msg;
}
function renderRows(fit){const d=ds(),bars=d.bars,max=bars.length?bars[0].pixels:0,term=$('searchRows').value.trim().toLowerCase(),matched=bars.filter(m=>!term||m.name.toLowerCase().includes(term)||String(m.rank)===term);$('visibleCount').textContent=`显示 ${matched.length} / ${bars.length} 款`;
 $('rows').innerHTML=matched.map(m=>{const sale=fit.k!=null?displayWan(fit.k*m.pixels):'待标定',rel=m.pixels/max*100;return `<tr><td class="rankcell">${m.rank}</td><td class="namecol">${e(m.name)}</td><td class="num">${m.pixels.toLocaleString('zh-CN')}</td><td><div class="barline"><span style="width:${rel.toFixed(2)}%"></span></div><div class="relative">${fmt(rel,1)}%</div></td><td class="num ${fit.k!=null?'sale':'pending-sale'}">${sale}</td></tr>`}).join('')||'<tr><td colspan="5" class="empty">'+(bars.length?'没有匹配的机型':'请先导入新榜单截图')+'</td></tr>';
 $('mRows').textContent=bars.length+' 款';$('mMax').textContent=(max||0)+' px';$('mCal').textContent=d.calibrations.length+' 组';$('mRate').textContent=fit.k!=null?tf(fit.k)+' 台':'尚未标定';
 $('tableDesc').textContent=fit.k!=null?`${d.label} · 拟合系数 ${tf(fit.k)} 台/px · 每个机型的销量依据自身柱长推算`:`${d.label} · 已测量全部 ${bars.length} 条柱长，输入至少一组真实销量即可计算。`;
}
function renderCalibrationView(changeOptions=true){let d=ds();if(changeOptions)renderOptions();let fit=getFit();renderCalibration(fit);renderRows(fit);if(!d.bars.length)setInfo('导入截图后自动测量柱条。');else setInfo('确认输入的是当前榜单同一统计周期、同一口径的销量。')}
function renderAll(changeOptions=true,switched=false){
 if(switched)$('outlier').value='0.15';
 renderCalibrationView(changeOptions);
 if(!socialArchiveDataset&&!researchStudioActive())updateSocial(true);
 if(switched&&socialArchiveDataset)setSocialArchiveDataset(null);
 window.SalesEstimateArchive.updateControls(switched);
}
function addCal(){const d=ds(),ids=mode==='single'?[Number($('singleSelect').value)]:[...picked];const parsed=parseAmount($('amount').value);const q=parsed?.value;const factor=Number($('inputUnit').value);if(!ids.length||ids.some(i=>!d.bars[i])){setInfo('先选择至少一款机型。','bad');return}if(mode==='group'&&(ids.length<2||ids.length>5)){setInfo('合计标定需选 2–5 款机型。','bad');return}if(!Number.isFinite(q)||q<=0){setInfo('请输入大于 0 的销量，可填数字或“本期累计-上期累计”，例如 782.87-689.03。','bad');$('amount').focus();return}let pixels=ids.reduce((sum,i)=>sum+d.bars[i].pixels,0);if(pixels<=0){setInfo('像素长度不可为 0，请检查榜单。','bad');return}
 if(d.calibrations.length>=50){setInfo('单张榜单最多加入 50 组标定。','bad');return}
 d.calibrations.push({ids:[...ids],pixels,value:q*factor,rawInput:parsed.normalized,unit:$('inputUnit').selectedOptions[0].textContent,isDifference:parsed.isDifference});$('amount').value='';previewAmount();if(mode==='group'){picked=[];renderPool()};renderAll(false);notify('已加入计算列表，估算结果已更新')}
function exportCSV(){const d=ds(),f=getFit(),rows=[['榜单','排名','机型','柱长（像素）','估算销量（台）','估算销量（万台）','相对第一名柱长（%）']];for(const m of d.bars){const v=f.k===null?'':f.k*m.pixels;rows.push([d.label,m.rank,m.name,m.pixels,v===''?'':v.toFixed(0),v===''?'':(v/10000).toFixed(4),(m.pixels/d.bars[0].pixels*100).toFixed(2)])}rows.push([]);rows.push(['标定组别','机型','合计像素','输入已知销量（台）','原始输入（数字或累计差值）','输入单位','比例（台/px）','状态']);d.calibrations.forEach((c,i)=>rows.push([i+1,c.ids.map(idx=>d.bars[idx].name).join('+'),c.pixels,c.value,c.rawInput||'',c.unit||'',(c.value/c.pixels).toFixed(6),f.statuses[i]||'']));rows.push([]);rows.push(['拟合比例 台/px',f.k??'无']);const str='﻿'+rows.map(row=>row.map(val=>'"'+String(val).replace(/"/g,'""')+'"').join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([str],{type:'text/csv;charset=utf-8-sig'}));const a=document.createElement('a');a.href=url;a.download=(d.label.replace(/[^a-zA-Z0-9一-龥]+/g,'_')||'榜单')+'_销量像素推算.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);notify('CSV 已导出')}
function parseImage(image){const canvas=document.createElement('canvas'),w=image.naturalWidth,h=image.naturalHeight;canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);const data=ctx.getImageData(0,0,w,h).data;const y0=Math.floor(h*.07),y1=Math.floor(h*.97),x0=Math.floor(w*.08),x1=Math.floor(w*.96),minCount=Math.max(35,Math.floor(w*.025));let lines=[];
 for(let y=y0;y<y1;y++){let count=0,first=-1,last=-1;for(let x=x0;x<x1;x++){let p=(y*w+x)*4,r=data[p],g=data[p+1],b=data[p+2];if(b-r>23&&b-g>8&&r<175){count++;if(first<0)first=x;last=x}}if(count>=minCount)lines.push({y,first,last,count})}
 let groups=[];for(let line of lines){const last=groups.at(-1);if(!last||line.y>last.at(-1).y+1)groups.push([line]);else last.push(line)}groups=groups.filter(g=>g.length>=3&&g.length<=Math.max(22,Math.ceil(h*.025)));
 if(groups.length<2||groups.length>100)throw Error(`识别 ${groups.length} 条柱条，不符合常见排行榜格式。请确认蓝柱和白底样式。`);
 let starts=groups.map(g=>g[Math.floor(g.length/2)].first).sort((a,b)=>a-b),base=starts[Math.max(0,Math.floor(starts.length*.1))],bars=groups.map((g,i)=>{const m=g[Math.floor(g.length/2)];return {rank:i+1,name:`第${i+1}名`,pixels:m.last-base+1,left:m.first,right:m.last,centerY:m.y}});
 if(bars.some(a=>a.pixels<=0))throw Error('检测到异常柱长，截图可能包含其他蓝色装饰或颜色不符合预期。');return {base,bars,width:w,height:h};}
$('modeSingle').onclick=()=>{mode='single';$('singlePane').hidden=false;$('groupPane').hidden=true;$('modeSingle').classList.add('on');$('modeGroup').classList.remove('on')};
$('modeGroup').onclick=()=>{mode='group';$('singlePane').hidden=true;$('groupPane').hidden=false;$('modeSingle').classList.remove('on');$('modeGroup').classList.add('on')};
$('amount').addEventListener('input',previewAmount);$('inputUnit').addEventListener('change',previewAmount);$('poolSearch').addEventListener('input',renderPool);$('searchRows').addEventListener('input',()=>renderRows(getFit()));$('resetSearch').onclick=()=>{$('searchRows').value='';renderRows(getFit())};$('addCal').onclick=addCal;$('outlier').addEventListener('change',()=>renderAll(false));$('clearCal').onclick=()=>{ds().calibrations=[];renderAll(false)};$('exportCsv').onclick=exportCSV;
$('imageUpload').onchange=async ev=>{const file=ev.target.files[0];if(!file)return;const url=URL.createObjectURL(file);const img=new Image();try{await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url});const data=parseImage(img);currentDataset={id:'custom',label:file.name,base:data.base,width:data.width,height:data.height,bars:data.bars,calibrations:[]};$('uploadResult').textContent=`已识别 ${data.bars.length} 条蓝色柱条。起点 x ≈ ${data.base}px。请核对排名及柱长；可在下方粘贴机型名称。`;$('customNames').value='';$('nameImportStatus').hidden=true;resetCalibrationInputs();renderAll(true,true);notify(`识别完成：${data.bars.length} 条柱条`)}catch(err){$('uploadResult').textContent='识别失败：'+err.message;notify('图片识别失败，请核对蓝柱样式')}finally{URL.revokeObjectURL(url)}};
$('applyNames').onclick=()=>{
 const names=$('customNames').value.split(/\r?\n/).map(s=>s.trim()),bars=ds().bars,status=$('nameImportStatus');
 // Ignore trailing empty lines, but preserve interior blank lines so ranks never shift.
 while(names.length&&!names.at(-1))names.pop();
 status.hidden=false;
 if(!bars.length){status.className='msg warn';status.textContent='请先导入榜单图片并识别柱条。';return}
 const skipped=[],extra=[];
 for(let i=0;i<bars.length;i++){if(names[i])bars[i].name=names[i];else skipped.push(i+1)}
 for(let i=bars.length;i<names.length;i++)if(names[i])extra.push(i+1);
 renderAll();
 const o=derivedData(),missing=missingPostModels(o),unknown=unclassifiedModels(o).filter(m=>!isMissingPostLabel(m));
 const issues=[];
 if(names.length!==bars.length)issues.push(`输入行数 ${names.length}，识别柱条 ${bars.length} 条（按原始行号对应排名）。`);
 if(skipped.length)issues.push(`未填写的输入行：${skipped.join('、')}（保留原名称）。`);
 if(extra.length)issues.push(`超出榜单范围的输入行：${extra.join('、')}（未导入）。`);
 if(missing.length)issues.push(`仍缺少机型名称：${formatModelRows(missing)}。`);
 if(unknown.length)issues.push(`无法识别品牌：${formatModelRows(unknown)}。请核对品牌前缀。`);
 status.className='msg '+(issues.length?'warn':'good');
 status.textContent=issues.length?issues.join(' '):`已更新全部 ${bars.length} 条机型名称，品牌均已识别。`;
 notify(issues.length?'机型名称已应用，请检查下方详细提示':'机型名称已更新');
};
renderCalibrationView();previewAmount();

// --------------------------------------------
// 图文工作台：当前标定或已校验的历史快照，独立于上方标定编辑器。
// --------------------------------------------
