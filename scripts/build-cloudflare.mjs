import { mkdir, rm, copyFile, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { publicFiles, studioFiles } from '../studio-assets.mjs';
import { generateSalesPanel } from './generate-sales-panel.mjs';
import { MANIFEST_FILE, SNAPSHOT_FILES, verifySnapshot } from './export-db-snapshot.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
const gitHead = spawnSync('git', ['rev-parse', 'HEAD'], {cwd:root, encoding:'utf8'});
const sha = gitHead.stdout?.trim();
const commit = gitHead.status === 0 && /^[0-9a-f]{40}$/.test(sha) ? sha : '';

function prepareModulePage(html, prefix = '') {
  const version = commit ? '?v=' + commit : '';
  const page = html.replace('src="site-shell.js"', `src="${prefix}site-shell.js${version}"`)
    .replace('href="site-shell.css"', `href="${prefix}site-shell.css${version}"`);
  return commit ? page.replace('<html ', `<html data-site-commit="${commit}" `) : page;
}
const snapshot = process.env.SALES_SNAPSHOT_DIR;
if (snapshot) await verifySnapshot(snapshot);
const assetSource = file => join(snapshot && SNAPSHOT_FILES.has(file) ? snapshot : root, file);
// 只按白名单复制站点资源，绝不递归复制仓库根目录。
await rm(dist, {recursive:true, force:true});
await mkdir(join(dist, 'studio'), {recursive:true});
const siteShell = await readFile(join(root, 'site-shell.js'), 'utf8');
const configuredOrigin = process.env.SALES_PAGES_API_ORIGIN;
const pagesOrigin = configuredOrigin ? new URL(configuredOrigin) : null;
if (pagesOrigin && (pagesOrigin.protocol !== 'https:' || pagesOrigin.username || pagesOrigin.password)) {
  throw Error('SALES_PAGES_API_ORIGIN must be a public HTTPS origin');
}
await writeFile(join(dist, 'site-shell.js'),siteShell.replace(
  "'sales-estimator.html'", "'studio/sales-estimator.html'"
).replace("const projectAPIOrigin = '';", `const projectAPIOrigin = ${JSON.stringify(pagesOrigin?.origin || '')};`));
for (const file of publicFiles) {
  if (file === 'index.html') {
    const html = await readFile(join(root, file), 'utf8');
    await writeFile(join(dist, file), html.replace("'sales-estimator.html'", "'studio/sales-estimator.html'"));
  } else if (file.endsWith('.html')) {
    const html = await readFile(join(root, file), 'utf8');
    await writeFile(join(dist, file), prepareModulePage(html));
  } else await copyFile(assetSource(file), join(dist, file));
}
for (const file of studioFiles) {
  const destination = join(dist, 'studio', file);
  if(file.endsWith('.html')){
    const html=await readFile(join(root,file),'utf8');
    await writeFile(destination,prepareModulePage(html, '../'));
  }else await copyFile(assetSource(file),destination);
}
if (snapshot) await copyFile(join(snapshot, MANIFEST_FILE), join(dist, MANIFEST_FILE));
await generateSalesPanel(join(dist, 'studio', 'sales-estimates.csv'), join(dist, 'studio'));
console.log('Site assets: three independent modules');
