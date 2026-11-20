import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
const require=createRequire(import.meta.url);
require('../brand-utils.js');require('../iso-sales-week.js');
const Series=require('../sales-series.js');
const sha=value=>createHash('sha256').update(value).digest('hex');
const csv=rows=>'\uFEFF'+rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n')+'\r\n';
export async function generateSalesPanel(source,destination){
 const raw=await readFile(source),rows=Series.parseCSV(raw.toString('utf8'));
 const panel=Series.buildSalesPanel(rows,Series.DEFAULT_OPTIONS),output=csv(Series.versionedRows(panel));
 const manifest={schema_version:1,algorithm_version:Series.VERSION,source:'sales-estimates.csv',source_sha256:sha(raw),algorithm_sha256:sha(await readFile(new URL('../sales-series.js',import.meta.url))),brand_rules_sha256:sha(await readFile(new URL('../brand-utils.js',import.meta.url))),output_sha256:sha(output),parameters:Series.DEFAULT_OPTIONS,source_rows:rows.length,derived_rows:panel.rows.length,scopes:panel.scopes.map(s=>({source:s.source,series:s.series,first_week:s.weeks[0]?.period,last_week:s.weeks.at(-1)?.period,models:s.models.length}))};
 await mkdir(destination,{recursive:true});
 await writeFile(join(destination,'weekly-sales-panel.csv'),output,'utf8');
 await writeFile(join(destination,'weekly-sales-panel.meta.json'),JSON.stringify(manifest,null,2)+'\n','utf8');
 console.log('Generated weekly sales panel: '+panel.rows.length+' rows, '+Series.VERSION);
 return manifest;
}
const root=fileURLToPath(new URL('../',import.meta.url));
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await generateSalesPanel(join(root,'sales-estimates.csv'),process.argv[2]?resolve(process.argv[2]):join(root,'generated'));
