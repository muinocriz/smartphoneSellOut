import './iso-sales-week.js';
import './brand-utils.js';
import SalesSeries from './sales-series.js';
import { EditorError, readEditorSheet, saveEditorRelease } from './sales-editor-database.mjs';

const { HEADER, col, parseCSV } = SalesSeries;
const DATASET_FIELDS = [...HEADER.slice(0, col.rank), ...HEADER.slice(col.fit_k)];
const ENTRY_FIELDS = ['dataset_id', ...HEADER.slice(col.rank, col.fit_k)];
const DATASET_NUMBERS = new Set(['top_n', 'actual_count', 'calibration_count', 'accepted_count']);

function validateRanking(rows) {
  if (!Array.isArray(rows) || !rows.length || rows.some(row =>
    !Array.isArray(row) || row.length !== HEADER.length ||
    row.some(value => typeof value !== 'string' || value.includes('\0')))) {
    throw new EditorError(400, '需要完整的一期榜单。');
  }
  try {
    const quote = value => '"' + value.replaceAll('"', '""') + '"';
    const parsed = parseCSV([HEADER.join(','), ...rows.map(row => row.map(quote).join(','))].join('\n'));
    if (parsed.some(row => row[col.dataset_id] !== parsed[0][col.dataset_id])) {
      throw new Error('每次只能保存同一来源、系列和周期的一期榜单。');
    }
    return parsed;
  } catch (error) {
    throw new EditorError(400, error.message);
  }
}

function rankingStatements(db, rows) {
  const row = rows[0];
  const update = DATASET_FIELDS.slice(1).map(field => field + ' = excluded.' + field);
  const dataset = db.prepare(`
    INSERT INTO ranking_datasets (${DATASET_FIELDS.join(', ')})
    VALUES (${DATASET_FIELDS.map(() => '?').join(', ')})
    ON CONFLICT (dataset_id) DO UPDATE SET ${update.join(', ')}
  `).bind(...DATASET_FIELDS.map(field => {
    const value = row[col[field]];
    // The original schema requires an integer; the public query exposes an unspecified TOP as null.
    return DATASET_NUMBERS.has(field) ? Number(value) : value;
  }));
  const remove = db.prepare('DELETE FROM ranking_entries WHERE dataset_id = ?').bind(row[col.dataset_id]);
  const insert = db.prepare(`
    INSERT INTO ranking_entries (${ENTRY_FIELDS.join(', ')})
    VALUES (${ENTRY_FIELDS.map(() => '?').join(', ')})
  `);
  return [dataset, remove, ...rows.map(entry => insert.bind(
    ...ENTRY_FIELDS.map(field => field === 'rank' ? Number(entry[col[field]]) : entry[col[field]])
  ))];
}

export async function publishRanking(db, readQuery, email, input) {
  if (!input || !['review', 'save'].includes(input.action) ||
      (input.action === 'save' && (!Number.isSafeInteger(input.revision) || input.revision < 0))) {
    throw new EditorError(400, '缺少有效的保存操作或核对版本。');
  }

  const rows = validateRanking(input.rows);
  const id = rows[0][col.dataset_id];
  const { revision, data } = await readEditorSheet(
    db, 'rankings', `SELECT * FROM (${readQuery}) WHERE dataset_id = ? ORDER BY rank`, id
  );
  const unchanged = data.length === rows.length && rows.every((row, index) =>
    HEADER.every((field, column) => field === 'saved_at' || row[column] === String(data[index][field] ?? '')));
  const existingCount = data.length;
  if (input.action === 'review' || unchanged) return { revision, existingCount, unchanged };

  const conflict = () => new EditorError(409, '榜单历史已有更新，请重新核对这期榜单后再保存。');
  if (input.revision !== revision) throw conflict();

  const counts = { added: existingCount ? 0 : 1, updated: existingCount ? 1 : 0, removed: 0 };
  const saved = await saveEditorRelease(
    db, 'rankings', revision, email, counts, rankingStatements(db, rows), conflict
  );
  return { revision: saved.revision, existingCount, unchanged: false };
}
