import { execFileSync, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import '../brand-utils.js';
import Iso from '../iso-sales-week.js';
import Series from '../sales-series.js';
import ModelMaster from '../model-master.js';
import MarketShare from '../market-share-data.js';
import CsvUtils from '../csv-utils.js';
import SalesLongData from '../sales-long-data.js';
import { SNAPSHOT_SCHEMAS } from './export-db-snapshot.mjs';

const env = process.env;
const worker = new URL(env.SALES_D1_ORIGIN);
const endpoint = new URL('/api/github-csv-sync', worker);
const repo = 'https://github.com/muinocriz/smartphoneSellOut';
const shaPattern = /^[a-f0-9]{40}$/;
const git = (...args) => execFileSync('git', args, {encoding:'utf8', maxBuffer:16 * 1024 * 1024});
const modelKey = row => SalesLongData.modelKey(row[0], row[1]);
const modelFields = ModelMaster.HEADER;
const { normalize, isOsta } = globalThis.BrandUtils;
const trackingBrand = brand => isOsta(brand) ? 'OSTA' :
  ({APPLE:'苹果', IPHONE:'苹果', XIAOMI:'小米', HONOR:'荣耀', HUAWEI:'华为', ONEPLUS:'一加'})[normalize(brand)] ?? normalize(brand);
const normalizedModelKey = row => SalesLongData.modelKey(trackingBrand(row[0]), normalize(row[1]));
const oneLine = value => String(value).replace(/[\r\n]+/g, ' ');

function normalizeWeek(value) {
  const parts = /^(\d{4})-?W(\d{1,2})$/i.exec(value.trim());
  if (!parts || Number(parts[1]) < 1900 || Iso.isoWeekMonday(Number(parts[1]), Number(parts[2])) === null) {
    throw new Error('无效 ISO 周次：' + value);
  }
  return parts[1] + '-W' + parts[2].padStart(2, '0');
}

function decimals(value, allowEmpty = false) {
  value = value.trim();
  if (!value && allowEmpty) return '';
  if (!SalesLongData.isDecimal(value)) {
    throw new Error('无效非负小数：' + value);
  }
  const [whole, fraction = ''] = value.split('.');
  const integral = whole.replace(/^0+(?=\d)/, '');
  const fractional = fraction.replace(/0+$/, '');
  return fractional ? integral + '.' + fractional : integral;
}

function trackingRow(row) {
  const [brand, model, category, date, period, metric, value, operator] = row.map(cell => cell.trim());
  const op = ({'≥':'>=', '＝':'='})[operator] ?? operator;
  if (!SalesLongData.hasModelIdentity(brand, model) || !SalesLongData.isRecordType(metric, op)) {
    throw new Error('销量记录的机型、类型或运算符无效：' + model + ' ' + period);
  }
  return [brand, model, category, date, normalizeWeek(period), metric, decimals(value), op];
}

function marketRow([period, trend, ...shares]) {
  return [normalizeWeek(period), trend.trim(), ...shares.map(share => decimals(share, true))];
}

function parseSource(sha, sheet, file, fields, headings) {
  const raw = git('show', sha + ':' + file);
  if (sheet === 'rankings') return Series.parseCSV(raw);
  if (sheet === 'models') ModelMaster.parse(raw);
  if (sheet === 'market-share') MarketShare.parseMarketShareCSV(raw, Iso.isoWeekMonday);
  const rows = Series.readCSV(raw), actual = rows.shift(), header = headings ? headings.split(',') : fields;
  if (!actual || actual.length !== header.length || actual.some((name, i) => name !== header[i]) ||
      rows.some(row => row.length !== header.length)) {
    throw new Error(file + ' 的列名或列数与扩展数据格式不匹配。');
  }
  return rows.map(row => {
    if (sheet === 'tracking') return trackingRow(row);
    if (sheet === 'market-share') return marketRow(row);
    return row.map(value => value.trim());
  });
}

function snapshotRows(sheet, fields, data) {
  return data.map(record => {
    const row = fields.map(field => String(record[field] ?? ''));
    if (sheet === 'tracking') return trackingRow(row);
    if (sheet === 'market-share') return marketRow(row);
    return row.map(value => value.trim());
  });
}

function indexRows(sheet, rows) {
  if (sheet === 'rankings') return Series.groups(rows);
  const indexed = new Map();
  for (const row of rows) {
    const key = sheet === 'tracking' ? SalesLongData.recordKey(row[0], row[1], row[4], row[5]) : row[0];
    if (!SalesLongData.addUniqueRecord(indexed, key, row)) throw new Error('来源有重复记录：' + key);
  }
  return indexed;
}

function trackingMetadata(rows) {
  const metadata = new Map();
  for (const row of rows) {
    const key = modelKey(row), fields = row.slice(2, 4), prior = metadata.get(key);
    if (prior && !SalesLongData.sameModelMetadata(prior, fields)) {
      throw new Error('同一机型的类别或开售日期不一致：' + key);
    }
    metadata.set(key, fields);
  }
  return metadata;
}

function sameEntry(sheet, a, b) {
  if (!a || !b) return a === b;
  if (sheet === 'rankings') {
    return a.length === b.length && a.every((row, i) =>
      row.every((value, j) => j === Series.col.saved_at || value === b[i][j]));
  }
  if (sheet === 'tracking') return a[6] === b[6] && a[7] === b[7];
  return a.every((cell, i) => cell === b[i]);
}

function planSheet(sheet, previous, incoming, current) {
  const before = indexRows(sheet, previous), after = indexRows(sheet, incoming), stored = indexRows(sheet, current);
  const report = {added:0, updated:0, same:0, ignoredDeletions:0, conflicts:[]};
  const patches = [];
  const existingMeta = sheet === 'tracking' ? trackingMetadata(current) : null;
  const ambiguous = new Set();
  if (existingMeta) {
    const oldMeta = trackingMetadata(previous), names = new Map();
    for (const row of [...current, ...incoming]) {
      const name = normalizedModelKey(row);
      if (!names.has(name)) names.set(name, new Set());
      names.get(name).add(modelKey(row));
    }
    for (const keys of names.values()) if (keys.size > 1) for (const key of keys) ambiguous.add(key);
    for (const [key, fields] of trackingMetadata(incoming)) {
      const dbFields = existingMeta.get(key);
      if (dbFields && !SalesLongData.sameModelMetadata(fields, oldMeta.get(key)) &&
          !SalesLongData.sameModelMetadata(fields, dbFields)) {
        report.conflicts.push(key + ' · 类别或开售日期仍使用 D1 的值');
      }
    }
  }

  for (const [id, source] of after) {
    const prior = before.get(id), dbValue = stored.get(id);
    if (sameEntry(sheet, source, prior) || sameEntry(sheet, source, dbValue)) {
      report.same++;
      continue;
    }
    if (existingMeta && ambiguous.has(modelKey(source))) {
      report.conflicts.push(id + ' · 品牌或机型名称需要先核对');
      continue;
    }
    if (!sameEntry(sheet, prior, dbValue)) {
      report.conflicts.push(id);
      continue;
    }
    let row = source;
    const metadata = existingMeta?.get(modelKey(source));
    if (metadata) row = [...source.slice(0, 2), ...metadata, ...source.slice(4)];
    patches.push(row);
    stored.set(id, row);
    report[dbValue ? 'updated' : 'added']++;
  }
  for (const key of before.keys()) if (!after.has(key)) report.ignoredDeletions++;
  if (sheet === 'models' && patches.length) {
    ModelMaster.parse(CsvUtils.stringifyCSV([modelFields, ...stored.values()], { eol: '\n' }));
  }
  return {patches, report};
}

async function requestWorker(payload) {
  const response = await fetch(endpoint, {
    method:'POST', redirect:'error', signal:AbortSignal.timeout(30000),
    headers:{Authorization:'Bearer ' + env.D1_SYNC_TOKEN, 'Content-Type':'application/json'},
    body:JSON.stringify(payload)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    const failure = new Error(data?.message || 'Worker 同步接口返回 HTTP ' + response.status + ' (' + (data?.error ?? '无详情') + ')。');
    failure.status = response.status;
    throw failure;
  }
  return data;
}

async function readStatus() {
  for (let attempt = 0; ; attempt++) {
    try { return await requestWorker({action:'status'}); }
    catch (error) {
      if (attempt === 3 || ![404, 503].includes(error.status)) throw error;
      await delay(15000);
    }
  }
}

async function snapshot() {
  const response = await fetch(new URL('/api/snapshot', worker), {redirect:'error', signal:AbortSignal.timeout(30000)});
  if (!response.ok) throw new Error('D1 快照请求返回 HTTP ' + response.status + '。');
  const result = await response.json();
  if (result.schema_version !== 1 || SNAPSHOT_SCHEMAS.some(([sheet]) =>
    !Array.isArray(result.tables?.[sheet]?.data) || !Number.isSafeInteger(result.tables[sheet].revision))) {
    throw new Error('正式数据快照格式不完整。');
  }
  return result.tables;
}

function changedSchemas(base, commit) {
  if (!base) return SNAPSHOT_SCHEMAS;
  if (!shaPattern.test(base)) throw new Error('D1 中的 GitHub 同步基线无效。');
  try { git('merge-base', '--is-ancestor', base, commit); }
  catch { throw new Error('GitHub 的 master 历史和上次同步基线不相连，请先核对分支历史。'); }
  const names = new Set(git(
    'diff', '--name-only', base, commit, '--', ...SNAPSHOT_SCHEMAS.map(([, file]) => file)
  ).trim().split('\n'));
  return SNAPSHOT_SCHEMAS.filter(([, file]) => names.has(file));
}

function reportText(commit, tables, appliedAt) {
  const lines = ['GitHub 提交 ' + commit, repo + '/commit/' + commit];
  if (appliedAt) lines.push('D1 同步时间 ' + appliedAt + ' UTC');
  lines.push('');
  for (const [sheet, file] of SNAPSHOT_SCHEMAS) {
    const report = tables[sheet];
    if (!report) continue;
    const {added, updated, same, conflicts, ignoredDeletions} = report;
    lines.push(file + '（' + (sheet === 'rankings' ? '按榜单期' : '按记录') + '）');
    lines.push('新增 ' + added + '，更新 ' + updated + '，GitHub 未变或已一致 ' + same +
      '，冲突保留 ' + conflicts.length + '，保留 CSV 中缺少的旧记录 ' + ignoredDeletions);
    lines.push(...conflicts.map(value => '  - ' + oneLine(value)), '');
  }
  if (env.GITHUB_RUN_ID) lines.push('Actions 日志 ' + repo + '/actions/runs/' + env.GITHUB_RUN_ID);
  return lines.join('\n');
}

function sendEmail(subject, text) {
  const { PATH, SYNC_ICLOUD_ADDRESS, SYNC_ICLOUD_APP_PASSWORD } = env;
  const script = fileURLToPath(new URL('./send-icloud-mail.py', import.meta.url));
  const result = spawnSync('python3', [script], {
    env:{PATH, SYNC_ICLOUD_ADDRESS, SYNC_ICLOUD_APP_PASSWORD},
    input:JSON.stringify({subject, text}), encoding:'utf8', timeout:60000
  });
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || '未能完成 iCloud SMTP 发信。');
  }
}

async function deliverReports() {
  try {
    const {pending} = await requestWorker({action:'status'});
    for (const {commit, applied_at, tables} of pending) {
      const conflicts = Object.values(tables).some(report => report.conflicts.length);
      sendEmail('手机销量 CSV 同步' + (conflicts ? '完成，有冲突' : '完成') + ' · ' + commit.slice(0, 7), reportText(commit, tables, applied_at));
      await requestWorker({action:'mark_emailed', commit});
    }
  } catch (error) {
    // Committed D1 updates and the Pages build can proceed. The report stays pending.
    console.warn('::warning::邮件发送或回执登记未完成，下次运行时会重试：' + oneLine(error.message));
  }
}

async function sync(commit) {
  for (let attempt = 0; ; attempt++) {
    const {commit: base} = await readStatus();
    const sources = changedSchemas(base, commit);
    if (!sources.length) {
      console.log('四份 CSV 自上次同步以来没有文件变更。');
      return;
    }
    const current = await snapshot();
    const revisions = Object.fromEntries(SNAPSHOT_SCHEMAS.map(([sheet]) => [sheet, current[sheet].revision]));
    const tables = {}, patches = {};
    for (const [sheet, file, columns, headings] of sources) {
      const fields = columns.split(' ');
      const plan = planSheet(sheet, base ? parseSource(base, sheet, file, fields, headings) : [],
        parseSource(commit, sheet, file, fields, headings), snapshotRows(sheet, fields, current[sheet].data));
      tables[sheet] = plan.report;
      patches[sheet] = plan.patches;
    }
    try {
      await requestWorker({action:'apply', base, commit, revisions, tables, patches});
      console.log(reportText(commit, tables));
      return;
    } catch (error) {
      if (error.status !== 409 || attempt === 2) throw error;
    }
  }
}

const commit = git('rev-parse', 'HEAD').trim();
try {
  if (worker.protocol !== 'https:') throw new Error('生产 Worker 地址必须使用 HTTPS。');
  if (!shaPattern.test(commit)) throw new Error('无法识别待同步的 GitHub 提交。');
  await sync(commit);
  await deliverReports();
} catch (error) {
  console.error('CSV 同步失败：' + oneLine(error.message));
  try {
    sendEmail('手机销量 CSV 同步失败 · ' + commit.slice(0, 7), [
      '同步任务未确认完成。', error.message, repo + '/commit/' + commit,
      env.GITHUB_RUN_ID ? repo + '/actions/runs/' + env.GITHUB_RUN_ID : ''
    ].join('\n'));
  } catch (mailError) {
    console.warn('::warning::失败结果未能发送邮件：' + oneLine(mailError.message));
  }
  process.exitCode = 1;
}
