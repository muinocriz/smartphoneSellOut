// Public publishing-copy defaults. The JSON file is the only source of default text.
(function(root){
'use strict';
const url=new URL('studio-copy.json',document.currentScript.src);
const commit=document.documentElement.dataset.siteCommit;
if(commit)url.searchParams.set('v',commit);
function validate(config){
 const string=value=>typeof value==='string';
 if(!string(config?.module1?.footer)||!string(config?.module3?.basic?.disclaimer)||!Array.isArray(config?.deepseek?.templates)){
  throw Error('文案配置结构无效');
 }
 const ids=new Set();
 for(const item of config.deepseek.templates){
  if(!item||!string(item.id)||!/^[-A-Za-z0-9_]+$/.test(item.id)||ids.has(item.id)||
     !string(item.label)||!item.label.trim()||!string(item.prompt)||!item.prompt.trim()||item.prompt.length>3000){
   throw Error('提示词模板 ID、名称或正文无效，或 ID 重复');
  }
  ids.add(item.id);
  Object.freeze(item);
 }
 Object.freeze(config.deepseek.templates);
 Object.freeze(config.deepseek);
 Object.freeze(config.module1);
 Object.freeze(config.module3.basic);
 Object.freeze(config.module3);
 return Object.freeze(config);
}
const ready=fetch(url,{cache:'no-cache'}).then(response=>{
 if(!response.ok)throw Error('文案配置读取失败（HTTP '+response.status+'）');
 return response.json();
}).then(validate);
root.StudioCopy=Object.freeze({ready});
})(window);
