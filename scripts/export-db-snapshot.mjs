import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import CsvUtils from '../csv-utils.js';
import SalesLongData from '../sales-long-data.js';

export const SNAPSHOT_SCHEMAS = [
  ['tracking', 'sales-long.csv', SalesLongData.COLUMNS.join(' ')],
  ['models', 'model-master.csv', 'model_id model_name brand brand_group aliases series generation variant form_factor sale_start_date predecessor_id launch_price chip_vendor chip_model base_ram base_rom source_url notes verification tracking_group'],
  ['rankings', 'sales-estimates.csv', 'dataset_id source series period_type period period_start period_end top_n actual_count rank model brand_group pixels estimated_units estimated_wan fit_k fit_mode calibration_count accepted_count outlier_threshold algorithm_version saved_at'],
  ['market-share', 'market-share.csv', 'period trend apple huawei osta xiaomi oppo oneplus realme vivo iqoo honor', 'ISO 周,趋势,苹果,华为,OSTA,小米,OPPO,一加,realme,vivo,iQOO,荣耀']
];

export const SNAPSHOT_FILES = new Set(SNAPSHOT_SCHEMAS.map(([, name]) => name));
export const MANIFEST_FILE = 'sales-snapshot.json';
const sha256 = value => createHash('sha256').update(value).digest('hex');

export async function verifySnapshot(directory) {
  const manifest = JSON.parse(await readFile(join(directory, MANIFEST_FILE), 'utf8'));
  if (manifest.schema_version !== 1 || !Number.isFinite(Date.parse(manifest.captured_at))) {
    throw new Error('Invalid snapshot manifest.');
  }
  for (const name of SNAPSHOT_FILES) {
    if (sha256(await readFile(join(directory, name))) !== manifest.files?.[name]?.sha256) {
      throw new Error('Snapshot checksum mismatch: ' + name);
    }
  }
  return manifest;
}

function snapshotCSV(sheet, table, columns, headings) {
  if (!Array.isArray(table?.data) || !Number.isSafeInteger(table.revision) || table.revision < 0) {
    throw new Error('Invalid snapshot table: ' + sheet);
  }
  const keys = columns.split(' ');
  const rows = table.data.map((record, index) => keys.map(key => {
    if (!record || !Object.hasOwn(record, key)) throw new Error(sheet + ' row ' + (index + 1) + ' is missing ' + key);
    const value = record[key];
    if (value != null && typeof value !== 'string' && typeof value !== 'number') {
      throw new Error(sheet + ' row ' + (index + 1) + ' contains an invalid ' + key);
    }
    return sheet === 'market-share' && key === 'period' ? String(value).replace('-W', 'W') : value;
  }));
  return CsvUtils.stringifyCSV([headings ? headings.split(',') : keys, ...rows], {
    bom: true, trailingNewline: true
  });
}

async function exportSnapshot(origin, destination) {
  const url = new URL('/api/snapshot', origin);
  const response = await fetch(url, {redirect:'error', signal:AbortSignal.timeout(25000)});
  if (!response.ok) throw new Error('Cloudflare snapshot returned HTTP ' + response.status);
  const snapshot = await response.json();
  if (snapshot.schema_version !== 1 || !Number.isFinite(Date.parse(snapshot.captured_at))) {
    throw new Error('Cloudflare returned an invalid snapshot.');
  }

  const manifest = {schema_version:1, origin:url.origin, captured_at:snapshot.captured_at, files:{}};
  const output = new Map();
  for (const [sheet, name, columns, headings] of SNAPSHOT_SCHEMAS) {
    const table = snapshot.tables?.[sheet];
    const content = snapshotCSV(sheet, table, columns, headings);
    output.set(name, content);
    manifest.files[name] = {
      revision:table.revision, published_at:table.published_at, rows:table.data.length, sha256:sha256(content)
    };
  }

  await mkdir(dirname(destination), {recursive:true});
  const temporary = await mkdtemp(destination + '.tmp-');
  let backup = null;
  try {
    await Promise.all([...output].map(([name, content]) => writeFile(join(temporary, name), content, 'utf8')));
    await writeFile(join(temporary, MANIFEST_FILE), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    try {
      await rename(temporary, destination);
    } catch (error) {
      if (error?.code !== 'EEXIST' && error?.code !== 'ENOTEMPTY') throw error;
      backup = destination + '.old-' + process.pid + '-' + Date.now();
      await rename(destination, backup);
      try {
        await rename(temporary, destination);
      } catch (replaceError) {
        await rename(backup, destination).catch(() => {});
        backup = null;
        throw replaceError;
      }
    }
  } finally {
    await rm(temporary, {recursive:true, force:true});
    if (backup) await rm(backup, {recursive:true, force:true});
  }
  console.log('Saved D1 snapshot from ' + manifest.captured_at + ' to ' + destination);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [origin, destination] = process.argv.slice(2);
  try {
    if (!origin || !destination) throw new Error('Usage: npm run snapshot:d1 -- <cloudflare-origin> <output-directory>');
    await exportSnapshot(origin, resolve(destination));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
