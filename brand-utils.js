/* Shared parent-brand identity and colors; raw historical CSV is never rewritten. */
(function(root){
  'use strict';
  const normalize=v=>String(v??'').normalize('NFKC').toUpperCase().replace(/[\s\u200B-\u200D\u2060\uFEFF]+/g,'');
  const groups=Object.freeze([
    Object.freeze({id:'apple',key:'Apple',label:'苹果',color:'#3b82f6'}),
    Object.freeze({id:'huawei',key:'华为',label:'华为系',color:'#ef4444'}),
    Object.freeze({id:'xiaomi',key:'小米系',label:'小米系',color:'#f97316'}),
    Object.freeze({id:'honor',key:'荣耀',label:'荣耀',color:'#06b6d4'}),
    Object.freeze({id:'oppo',key:'OPPO系',label:'OPPO系',color:'#10b981'}),
    Object.freeze({id:'vivo',key:'vivo系',label:'vivo系',color:'#6366f1'}),
    Object.freeze({id:'other',key:'其他',label:'其他',color:'#64748b'})
  ]);
  const aliases=new Map();
  for(const [key,names] of [
    ['Apple',['Apple','苹果','iPhone']],['华为',['华为','HUAWEI','华为系','OSTA','星芒','OSTA星芒','星芒OSTA']],['小米系',['小米','小米系','XIAOMI','REDMI','红米','MI']],
    ['荣耀',['荣耀','HONOR']],['OPPO系',['OPPO','OPPO系','OPPO主品牌','一加','ONEPLUS','REALME','真我']],
    ['vivo系',['vivo','vivo系','vivo主品牌','iQOO']],['其他',['其他','其它','OTHER','OTHERS']]
  ])for(const name of names)aliases.set(normalize(name),key);
  const isOsta=v=>['OSTA','星芒','OSTA星芒','星芒OSTA'].includes(normalize(v));
  const unknown=new Set(['','未识别品牌','未知','UNKNOWN','未分类']);
  function fromModel(name){
    const n=normalize(name);
    if(/^(IPHONE|APPLE|苹果)/.test(n))return 'Apple';
    if(/^(华为|HUAWEI|OSTA|星芒)/.test(n))return '华为';
    if(/^(荣耀|HONOR)/.test(n))return '荣耀';
    if(/^(REDMI|XIAOMI|小米|红米)/.test(n)||/^MI\s/i.test(String(name).trim()))return '小米系';
    if(/^(OPPO|ONEPLUS|一加|REALME|真我)/.test(n))return 'OPPO系';
    if(/^(VIVO|IQOO)/.test(n))return 'vivo系';
    if(/^(三星|SAMSUNG|魅族|MEIZU|努比亚|NUBIA|中兴|ZTE|MOTOROLA|摩托罗拉|索尼|SONY|NOTHING|联想|LENOVO|酷派|COOLPAD|传音|TECNO|INFINIX|ITEL|诺基亚|NOKIA|8848|黑鲨|BLACKSHARK|华硕|ASUS|ROG|谷歌|GOOGLE|PIXEL|夏普|SHARP)/.test(n))return '其他';
    return null;
  }
  function classify(name,declared=''){
    const key=normalize(declared);
    // Recognizable model prefixes repair legacy unknown or misclassified historical rows at read time.
    return fromModel(name)||aliases.get(key)||(!unknown.has(key)?'其他':null);
  }
  const byKey=Object.freeze(Object.fromEntries(groups.map(g=>[g.key,g])));
  const byLabel=Object.freeze(Object.fromEntries(groups.map(g=>[g.label,g])));
  // Preserve existing product-attribute keys (including Apple); only Huawei gains a group display suffix.
  const groupLabel=key=>aliases.get(normalize(key))==='华为'?'华为系':key;
  const byId=Object.freeze(Object.fromEntries(groups.map(g=>[g.id,g])));
  const colors=Object.freeze(Object.fromEntries(groups.map(g=>[g.key,g.color])));
  root.BrandUtils=Object.freeze({groups,colors,normalize,isOsta,classify,groupLabel,label:key=>byKey[key]?.label||key,color:key=>byKey[key]?.color||byId[key]?.color||byLabel[key]?.color||null});
})(typeof globalThis!=='undefined'?globalThis:this);
