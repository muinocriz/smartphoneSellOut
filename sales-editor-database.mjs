import marketShareData from './market-share-data.js';

const MARKET_COLUMNS = 'period trend apple huawei osta xiaomi oppo oneplus realme vivo iqoo honor'.split(' ');
const MARKET_HEADER = 'ISO 周,趋势,苹果,华为,OSTA,小米,OPPO,一加,realme,vivo,iQOO,荣耀';
const TRACKING_COLUMNS = 'brand model category date period metric value_wan operator'.split(' ');
const MODEL_COLUMNS = (
  'model_id model_name brand brand_group aliases series generation variant form_factor ' +
  'sale_start_date predecessor_id launch_price chip_vendor chip_model base_ram base_rom ' +
  'source_url notes verification tracking_group'
).split(' ');

export class EditorError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function revisionQuery(db, sheet) {
  return db.prepare(
    'SELECT COALESCE(MAX(revision), 0) AS revision FROM sales_editor_releases WHERE sheet = ?'
  ).bind(sheet);
}

export async function readEditorSheet(db, sheet, query) {
  const [{ results: [version] }, { results: data }] = await db.batch([
    revisionQuery(db, sheet),
    db.prepare(query)
  ]);
  return { revision: version.revision, data };
}

function isoYearStart(year) {
  const january4 = new Date(Date.UTC(year, 0, 4));
  return +january4 - ((january4.getUTCDay() + 6) % 7) * 86400000;
}

function validWeek(period) {
  const parts = /^(\d{4})-W(\d{2})$/.exec(period);
  if (!parts) return false;
  const year = Number(parts[1]), week = Number(parts[2]);
  return year >= 1900 && week >= 1 && week <= (isoYearStart(year + 1) - isoYearStart(year)) / 604800000;
}

function modelKey(row) {
  return JSON.stringify(row.slice(0, 2));
}

function trackingKey(row) {
  return JSON.stringify([row[0], row[1], row[4], row[5]]);
}

function validateRows(rows, sheet, columns, key) {
  const indexed = new Map(), metadata = new Map();
  for (const [i, row] of rows.entries()) {
    const fail = message => { throw new EditorError(400, '第 ' + (i + 1) + ' 条记录：' + message); };
    if (!Array.isArray(row) || row.length !== columns.length ||
        row.some(value => typeof value !== 'string' || value.includes('\0'))) {
      fail('字段数量或格式无效。');
    }
    if (sheet !== 'market-share' && (!row[0].trim() || !row[1].trim())) fail('缺少机型标识或名称。');
    const id = key(row);
    if (indexed.has(id)) fail('同一记录重复出现。');
    if (sheet === 'tracking') {
      const [, , category, date, period, metric, value, operator] = row;
      if (!validWeek(period) || !['cumulative', 'weekly'].includes(metric) ||
          !['=', '>=', '<', '≈'].includes(operator) ||
          !/^\d+(?:\.\d+)?$/.test(value) || !Number.isFinite(Number(value))) {
        fail('ISO 周次、销量类型、数值或运算符无效。');
      }
      const model = modelKey(row), fields = JSON.stringify([category, date]);
      if (metadata.has(model) && metadata.get(model) !== fields) fail('同一机型的类别或开售日期不一致。');
      metadata.set(model, fields);
    }
    if (sheet === 'market-share') {
      if (!validWeek(row[0])) fail('ISO 周次无效。');
      if (row.slice(2).some(value => value !== '' && !/^\d+(?:\.\d+)?$/.test(value))) {
        fail('份额请填写百分比数值，例如 18.5。');
      }
    }
    indexed.set(id, row);
  }
  return indexed;
}

function validateMarketShares(rows) {
  const quote = value => '"' + value.replaceAll('"', '""') + '"';
  const csv = [
    MARKET_HEADER,
    ...rows.map(([period, ...fields]) => [period.replace('-W', 'W'), ...fields].map(quote).join(','))
  ].join('\n');
  try {
    marketShareData.parseMarketShareCSV(csv, (year, week) =>
      validWeek(year + '-W' + String(week).padStart(2, '0'))
        ? isoYearStart(year) + (week - 1) * 604800000 : null);
  } catch (error) {
    throw new EditorError(400, error.message);
  }
}

function upsertStatements(db, table, columns, changed, removed) {
  const key = columns[0];
  const update = columns.slice(1).map(column => column + ' = excluded.' + column);
  const upsert = db.prepare(`
    INSERT INTO ${table} (${columns.join(', ')})
    VALUES (${columns.map(() => '?').join(', ')})
    ON CONFLICT (${key}) DO UPDATE SET ${update.join(', ')}
  `);
  const remove = db.prepare(`DELETE FROM ${table} WHERE ${key} = ?`);
  return [...changed.map(row => upsert.bind(...row)), ...removed.map(row => remove.bind(row[0]))];
}

function trackingStatements(db, changed, removed) {
  const upsertModel = db.prepare(`
    INSERT INTO tracking_models (brand, model, category, date, sort_order)
    VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM tracking_models))
    ON CONFLICT (brand, model) DO UPDATE SET category = excluded.category, date = excluded.date
    WHERE tracking_models.category IS NOT excluded.category OR tracking_models.date IS NOT excluded.date
  `);
  const upsertSale = db.prepare(`
    INSERT INTO tracking_sales (tracking_id, period, metric, value_wan, operator)
    SELECT tracking_id, ?, ?, ?, ? FROM tracking_models WHERE brand = ? AND model = ?
    ON CONFLICT (tracking_id, period, metric) DO UPDATE
    SET value_wan = excluded.value_wan, operator = excluded.operator
    WHERE tracking_sales.value_wan IS NOT excluded.value_wan OR tracking_sales.operator IS NOT excluded.operator
  `);
  const removeSale = db.prepare(`
    DELETE FROM tracking_sales
    WHERE tracking_id = (SELECT tracking_id FROM tracking_models WHERE brand = ? AND model = ?)
      AND period = ? AND metric = ?
  `);
  const removeEmptyModel = db.prepare(`
    DELETE FROM tracking_models WHERE brand = ? AND model = ?
    AND NOT EXISTS (SELECT 1 FROM tracking_sales WHERE tracking_id = tracking_models.tracking_id)
  `);
  const changedModels = new Map(changed.map(row => [modelKey(row), row.slice(0, 4)]));
  const affectedModels = new Map(removed.map(row => [modelKey(row), row.slice(0, 2)]));
  return [
    ...Array.from(changedModels.values(), fields => upsertModel.bind(...fields)),
    ...changed.map(row => upsertSale.bind(...row.slice(4), ...row.slice(0, 2))),
    ...removed.map(row => removeSale.bind(...row.slice(0, 2), ...row.slice(4, 6))),
    ...Array.from(affectedModels.values(), fields => removeEmptyModel.bind(...fields))
  ];
}

export async function editEditorSheet(db, sheet, query, email, input) {
  if (!input || !['review', 'save'].includes(input.action) || !Array.isArray(input.rows) ||
      !Number.isSafeInteger(input.revision) || input.revision < 0) {
    throw new EditorError(400, '缺少有效的表格、版本或保存操作。');
  }

  const tracking = sheet === 'tracking';
  const market = sheet === 'market-share';
  const columns = tracking ? TRACKING_COLUMNS : market ? MARKET_COLUMNS : MODEL_COLUMNS;
  const key = tracking ? trackingKey : row => row[0];
  const next = validateRows(input.rows, sheet, columns, key);
  if (market) validateMarketShares(input.rows);
  const { revision, data } = await readEditorSheet(db, sheet, query);
  const conflict = () => new EditorError(409, '数据库已有新版本。请先导出草稿，再重新读取并核对改动。');

  const old = new Map(data.map(record => {
    const row = columns.map(column => record[column] ?? '');
    return [key(row), row];
  }));
  const changed = [], removed = [];
  const counts = { added: 0, updated: 0, removed: 0 };
  for (const [id, row] of next) {
    const prior = old.get(id);
    if (!prior) {
      counts.added++;
      changed.push(row);
    } else if (prior.some((value, i) => value !== row[i])) {
      counts.updated++;
      changed.push(row);
    }
  }
  for (const [id, row] of old) {
    if (!next.has(id)) removed.push(row);
  }
  counts.removed = removed.length;
  // An identical snapshot is also safe when the preceding save succeeded but its response was lost.
  if (!changed.length && !removed.length) return { revision, ...counts };
  if (input.revision !== revision) throw conflict();
  if (input.action === 'review') return { revision, ...counts };

  const statements = tracking ? trackingStatements(db, changed, removed) : upsertStatements(
    db, market ? 'market_share_weekly' : 'model_master', columns,
    market ? changed.map(row => row.map((value, i) => i >= 2 && value === '' ? null : value)) : changed,
    removed
  );
  const released = revision + 1;
  // Only one transaction can claim this revision. Failure rolls back the audit row and all edits.
  const audit = db.prepare(`
    INSERT INTO sales_editor_releases (sheet, revision, editor, added, updated, removed)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(sheet, released, email, counts.added, counts.updated, counts.removed);
  try {
    await db.batch([audit, ...statements]);
  } catch (error) {
    const latest = await revisionQuery(db, sheet).first('revision');
    if (latest !== revision) throw conflict();
    throw error;
  }
  return { revision: released, ...counts };
}
