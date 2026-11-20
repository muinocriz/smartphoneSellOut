import { mkdir, rm, copyFile, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { publicFiles, protectedFiles } from '../studio-assets.mjs';
import { generateSalesPanel } from './generate-sales-panel.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
// 只按白名单复制站点资源，绝不递归复制仓库根目录。
await rm(dist, {recursive:true, force:true});
await mkdir(join(dist, 'studio'), {recursive:true});
let home = await readFile(join(root, 'index.html'), 'utf8');
for (const [from, to] of [
  ['data-studio-access="local"', 'data-studio-access="required"'],
  ['data-src="market-share.html"', 'data-src="studio/market-share.html"'],
  ['data-src="sales-estimator.html"', 'data-src="studio/sales-estimator.html"']
]) {
  if (!home.includes(from)) throw new Error('首页部署标记缺失：' + from);
  home = home.replace(from, to);
}
await writeFile(join(dist, 'index.html'), home);
for (const file of publicFiles) await copyFile(join(root, file), join(dist, file));
for (const file of protectedFiles) await copyFile(join(root, file), join(dist, 'studio', file));
await generateSalesPanel(join(root,'sales-estimates.csv'),join(dist,'studio'));
console.log('Cloudflare assets: public module 1 + /studio/ (Access required)');
