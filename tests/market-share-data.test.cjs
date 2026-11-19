const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const iso=require('../iso-sales-week.js');
const {parseMarketShareCSV,pairIndices,buildBrandState}=require('../market-share-data.js');
const read=s=>parseMarketShareCSV(s,iso.isoWeekMonday);
const csv=fs.readFileSync(path.join(__dirname,'..','market-share.csv'),'utf-8');
const rows=read(csv);

test('parses 4 ISO weeks and derives non-duplicated group shares',()=>{
  assert.deepEqual(rows.map(r=>r.week),['2026W42','2026W43','2026W44','2026W45']);
  assert.deepEqual(rows.map(r=>r.other),[3.7,2.8,2.6,2.6]);
  assert.equal(rows[2].brands.oppoMain,8.8);
  assert.equal(rows[2].brands.vivoMain,8.1);
  assert.equal(rows[3].brands.oppo,12.3);
  assert.equal(rows[3].trend,'下降约5%');
  assert.deepEqual(pairIndices(rows),[1,2,3]);
});

test('maps both official lower-case vivo and legacy VIVO safely',()=>{
  const old=csv.replace(',vivo,',',VIVO,');
  assert.deepEqual(read(old),rows);
  const dup=csv.replace(',vivo,',',vivo,VIVO,').replace(/(\d+\.\d+,\d+\.\d+,\d+\.\d+)\r?\n/g,'$1,0\n');
  assert.throws(()=>read(dup),/字段重复/);
});

test('maps combined OPPO/vivo without double-counting subbrands',()=>{
  const defaults=()=>[
    {id:'apple'}, {id:'huawei'}, {id:'xiaomi'},
    {id:'oppo',subBrands:[{},{},{}]}, {id:'vivo',subBrands:[{},{}]}, {id:'honor'}
  ];
  const brands=buildBrandState(rows[2],rows[3],defaults);
  assert.deepEqual(brands[3].subBrands.map(s=>[s.w1,s.w2]),[[8.8,8.2],[3.5,3.9],[0.2,0.2]]);
  assert.deepEqual(brands[4].subBrands.map(s=>[s.w1,s.w2]),[[8.1,8.1],[3.7,3.3]]);
  assert.deepEqual([brands[0].w1,brands[0].w2],[28.7,29.3]);
});

test('rejects invalid source: missing columns, oversize subs, over 100%, bad weeks',()=>{
  assert.throws(()=>read(csv.replace(',iQOO,',',badIQOO,')),/缺少字段：iQOO/);
  assert.throws(()=>read(csv.replace('12.3,3.9,0.2','12.3,15.9,0.2')),/子品牌份额超过集团份额/);
  assert.throws(()=>read(csv.replace('29.3,20.8,13,12.3','49.3,20.8,13,12.3')),/超过 100%/);
  assert.throws(()=>read(csv.replace('2026W45','2026W54')),/ISO 周不存在/);
});
