(function(root){
'use strict';
const versions=Object.freeze({research:7,visual:2,publication:9}),prefix='smartphoneSellOut.module3.';
function read(name,fallback={}){try{const x=JSON.parse(localStorage.getItem(prefix+name)||'null');return x?.version===versions[name]&&x.data&&typeof x.data==='object'?x.data:fallback;}catch(_){return fallback;}}
function write(name,data){try{localStorage.setItem(prefix+name,JSON.stringify({version:versions[name],data}));return true;}catch(_){return false;}}
function remove(name){try{localStorage.removeItem(prefix+name);return true;}catch(_){return false;}}
function setControl(el,value){if(!el||value==null)return;if(el.type==='checkbox'){if(typeof value==='boolean')el.checked=value;return;}if(el.tagName==='SELECT'&&![...el.options].some(o=>o.value===String(value)))return;el.value=String(value);}
function values(ids){return Object.fromEntries(ids.map(id=>{const el=document.getElementById(id);return [id,el.type==='checkbox'?el.checked:el.value];}));}
function apply(obj,ids){for(const id of ids)setControl(document.getElementById(id),obj?.[id]);}
function fingerprint(value){let h=2166136261;const s=JSON.stringify(value);for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return (h>>>0).toString(16);}
root.StudioPreferences=Object.freeze({read,write,remove,setControl,values,apply,fingerprint});
})(window);
