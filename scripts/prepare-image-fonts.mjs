// Fixed, unmodified Google Fonts upstream assets; the original OFL notices travel with them.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

const revision = '5026800714d07231937d92eb4cceabf06e05d74e';
const directory = fileURLToPath(new URL('../image-fonts/', import.meta.url));
const source = 'https://raw.githubusercontent.com/google/fonts/' + revision + '/ofl/';
const mono = [
  [100,'Thin','44475c9d3e39e6f7e211ff7ce8a6fa711ab307ea'],
  [200,'ExtraLight','26877b8175e03ac26581afb2bf0eb4f7b9190594'],
  [300,'Light','61d43577842179cdffeb38b6c1928786981db0da'],
  [400,'Regular','0c9770d5183ba60dc4350d3e011b782a320761ae'],
  [500,'Medium','33c546f68b6007a45a3f10e845523abb2db25399'],
  [600,'SemiBold','8f8998a139d8f61d3b96bdd3b512fca501a1f6b9'],
  [700,'Bold','17b406d221e7f27179344707bd543fb8470728ac']
].map(([weight,style,sha])=>({family:'SalesImageMono',weight:String(weight),folder:'ibmplexmono',upstream:'IBMPlexMono-'+style+'.ttf',file:'IBMPlexMono-'+style+'.ttf',sha}));
const faces = [
  {family:'SalesImageSans',weight:'100 900',folder:'notosanssc',upstream:'NotoSansSC[wght].ttf',file:'NotoSansSC.ttf',sha:'fb0637bafbcd804fe32152370a1225990745b4bc'},
  {family:'SalesImageSerif',weight:'200 900',folder:'notoserifsc',upstream:'NotoSerifSC[wght].ttf',file:'NotoSerifSC.ttf',sha:'eab063faf229160a52d3760f5555150e4eb9e5bf'},
  ...mono
];
const licenses = [
  {folder:'notosanssc',file:'NotoSansSC-OFL.txt',sha:'1c9f43281b8f216c5461fe9ac729afbade7724e4'},
  {folder:'notoserifsc',file:'NotoSerifSC-OFL.txt',sha:'94d1bf7b52481343e2983fb7751e8b7abe1ea07b'},
  {folder:'ibmplexmono',file:'IBMPlexMono-OFL.txt',sha:'c35c4c618fab33da8695177b3a6cefe0810b7b28'}
].map(entry=>({...entry,upstream:'OFL.txt'}));
function blobSHA(bytes){
  return createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
}
async function acquire(entry){
  const path=join(directory,entry.file);
  let bytes=await readFile(path).catch(error=>{if(error.code!=='ENOENT')throw error;return null;});
  if(bytes&&blobSHA(bytes)===entry.sha)return bytes;
  const url=source+entry.folder+'/'+encodeURIComponent(entry.upstream);
  const response=await fetch(url,{signal:AbortSignal.timeout(120000)});
  if(!response.ok)throw Error('Font download failed: '+entry.file+' HTTP '+response.status);
  bytes=Buffer.from(await response.arrayBuffer());
  if(blobSHA(bytes)!==entry.sha)throw Error('Font checksum mismatch: '+entry.file);
  await writeFile(path,bytes);
  return bytes;
}
// Parse the actual Unicode cmap, not the declared CSS family or document.fonts.check().
function glyphs(bytes){
  const u16=i=>bytes.readUInt16BE(i),u32=i=>bytes.readUInt32BE(i);
  let cmap=-1;
  for(let i=0;i<u16(4);i++){
    const p=12+i*16;
    if(bytes.toString('ascii',p,p+4)==='cmap'){cmap=u32(p+8);break;}
  }
  if(cmap<0)throw Error('Font has no cmap');
  const set=new Set(),seen=new Set();
  for(let i=0;i<u16(cmap+2);i++){
    const p=cmap+4+i*8,platform=u16(p),encoding=u16(p+2),sub=cmap+u32(p+4);
    if(!(platform===0||(platform===3&&(encoding===1||encoding===10)))||seen.has(sub))continue;
    seen.add(sub);
    const format=u16(sub);
    if(format===12){
      for(let j=0;j<u32(sub+12);j++){
        const q=sub+16+j*12,start=u32(q),end=u32(q+4),first=u32(q+8);
        for(let c=start;c<=end&&c<=0x10ffff;c++)if(first+c-start!==0)set.add(c);
      }
    }else if(format===4){
      const n=u16(sub+6)/2,endBase=sub+14,startBase=endBase+n*2+2,deltaBase=startBase+n*2,rangeBase=deltaBase+n*2;
      for(let j=0;j<n;j++){
        const start=u16(startBase+j*2),end=u16(endBase+j*2),delta=u16(deltaBase+j*2),r=rangeBase+j*2,offset=u16(r);
        for(let c=start;c<=end&&c!==0xffff;c++){
          let id;
          if(!offset)id=(c+delta)&0xffff;
          else{const raw=u16(r+offset+2*(c-start));id=raw?(raw+delta)&0xffff:0;}
          if(id)set.add(c);
        }
      }
    }
  }
  if(!set.size)throw Error('No supported Unicode cmap format');
  return set;
}
function ranges(set){
  const out=[];
  for(const c of [...set].sort((a,b)=>a-b)){
    const last=out.at(-1);
    if(last&&last[1]+1===c)last[1]=c;else out.push([c,c]);
  }
  return out;
}
export async function prepareImageFonts(){
  await mkdir(directory,{recursive:true});
  const coverage={};
  // Sequential font acquisition bounds build memory and preserves the upstream bytes.
  for(const face of faces){
    const set=glyphs(await acquire(face)),prior=coverage[face.family];
    coverage[face.family]=prior?new Set([...prior].filter(c=>set.has(c))):set;
  }
  for(const license of licenses)await acquire(license);
  const manifest={
    revision,
    faces:faces.map(({family,weight,file})=>({family,weight,file})),
    coverage:Object.fromEntries(Object.entries(coverage).map(([family,set])=>[family,ranges(set)])),
    licenses:licenses.map(({file})=>file)
  };
  await writeFile(join(directory,'manifest.json'),JSON.stringify(manifest)+'\n');
  return directory;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  await prepareImageFonts();
  console.log('Open-licensed image fonts prepared');
}
