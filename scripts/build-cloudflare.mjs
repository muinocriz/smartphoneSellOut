import { mkdir, rm, copyFile, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { publicFiles, studioFiles } from '../studio-assets.mjs';
import { generateSalesPanel } from './generate-sales-panel.mjs';
import { MANIFEST_FILE, SNAPSHOT_FILES, verifySnapshot } from './export-db-snapshot.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
const snapshot = process.env.SALES_SNAPSHOT_DIR;
if (snapshot) await verifySnapshot(snapshot);
const assetSource = file => join(snapshot && SNAPSHOT_FILES.has(file) ? snapshot : root, file);
// 只按白名单复制站点资源，绝不递归复制仓库根目录。
await rm(dist, {recursive:true, force:true});
await mkdir(join(dist, 'studio'), {recursive:true});
const siteShell = await readFile(join(root, 'site-shell.js'), 'utf8');
await writeFile(join(dist, 'site-shell.js'),siteShell.replace(
  "'sales-estimator.html'", "'studio/sales-estimator.html'"
));
for (const file of publicFiles) {
  if (file === 'index.html') {
    const html = await readFile(join(root, file), 'utf8');
    await writeFile(join(dist, file), html.replace("'sales-estimator.html'", "'studio/sales-estimator.html'"));
  } else await copyFile(assetSource(file), join(dist, file));
}
for (const file of studioFiles) {
  const destination = join(dist, 'studio', file);
  if(file.endsWith('.html')){
    const html=await readFile(join(root,file),'utf8');
    await writeFile(destination,html.replace('src="site-shell.js"','src="../site-shell.js"')
      .replace('href="site-shell.css"','href="../site-shell.css"'));
  }else await copyFile(join(root,file),destination);
}
if (snapshot) await copyFile(join(snapshot, MANIFEST_FILE), join(dist, MANIFEST_FILE));
await generateSalesPanel(join(dist, 'studio', 'sales-estimates.csv'), join(dist, 'studio'));
console.log('Site assets: three independent modules');
