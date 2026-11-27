import { EditorError, editorPatchStatements, editorReleaseStatement } from './sales-editor-database.mjs';
import { rankingPatchStatements } from './ranking-editor-database.mjs';

const SHEETS = ['tracking', 'models', 'rankings', 'market-share'];
const SHA = /^[a-f0-9]{40}$/;
const isSHA = value => typeof value === 'string' && SHA.test(value);
const isCount = value => Number.isSafeInteger(value) && value >= 0;
const latestSync = db => db.prepare(
  'SELECT sequence, commit_sha FROM github_csv_sync_runs ORDER BY sequence DESC LIMIT 1'
).first();

async function syncStatus(db) {
  const latest = await latestSync(db);
  const { results } = await db.prepare(`
    SELECT commit_sha, applied_at, report FROM github_csv_sync_runs
    WHERE emailed_at IS NULL ORDER BY sequence LIMIT 20
  `).all();
  return {
    commit: latest?.commit_sha ?? null,
    pending: results.map(row => ({
      commit: row.commit_sha, applied_at: row.applied_at, tables: JSON.parse(row.report)
    }))
  };
}

function validatePlan(input) {
  if (!isSHA(input.commit) || (input.base !== null && !isSHA(input.base)) ||
      !input.tables || !input.revisions || !input.patches) {
    throw new EditorError(400, '缺少 GitHub 提交、同步基线或版本信息。');
  }
  const sheets = Object.keys(input.tables);
  if (!sheets.length || sheets.some(sheet => !SHEETS.includes(sheet)) ||
      Object.keys(input.patches).some(sheet => !sheets.includes(sheet)) ||
      Object.keys(input.revisions).length !== SHEETS.length ||
      SHEETS.some(sheet => !isCount(input.revisions[sheet]))) {
    throw new EditorError(400, '同步表或正式数据版本无效。');
  }
  for (const sheet of sheets) {
    const report = input.tables[sheet], rows = input.patches[sheet];
    if (!report || !isCount(report.added) || !isCount(report.updated) || !isCount(report.same) ||
        !isCount(report.ignoredDeletions) || !Array.isArray(report.conflicts) ||
        report.conflicts.some(value => typeof value !== 'string') ||
        !Array.isArray(rows) || rows.length !== report.added + report.updated) {
      throw new EditorError(400, '同步差异与写入记录数量不一致：' + sheet);
    }
  }
  return sheets;
}

async function applyGitHubCSV(db, input) {
  const sheets = validatePlan(input);
  const current = await latestSync(db);
  const conflict = () => new EditorError(409, '数据或同步基线已有更新，请重新计算差异。');
  if (current?.commit_sha === input.commit) return { applied: false };
  if ((current?.commit_sha ?? null) !== input.base) throw conflict();

  const sequence = (current?.sequence ?? 0) + 1;
  // Guard both the GitHub baseline and all four D1 revisions inside the write transaction.
  const record = db.prepare(`
    INSERT INTO github_csv_sync_runs (sequence, commit_sha, report)
    VALUES (?, ?, CASE WHEN NOT EXISTS (
      SELECT 1 FROM json_each(?) AS expected
      WHERE expected.value != (
        SELECT COALESCE(MAX(revision), 0) FROM sales_editor_releases WHERE sheet = expected.key
      )
    ) THEN ? END)
  `).bind(sequence, input.commit, JSON.stringify(input.revisions), JSON.stringify(input.tables));

  const changes = sheets.flatMap(sheet => {
    const rows = input.patches[sheet];
    if (!rows.length) return [];
    const sql = sheet === 'rankings'
      ? rankingPatchStatements(db, rows)
      : editorPatchStatements(db, sheet, rows);
    const { added, updated } = input.tables[sheet];
    return [
      editorReleaseStatement(db, sheet, input.revisions[sheet], 'github-csv-sync', { added, updated, removed: 0 }),
      ...sql
    ];
  });

  try {
    await db.batch([record, ...changes]);
  } catch (error) {
    const latest = await latestSync(db);
    if (latest?.commit_sha === input.commit) return { applied: false };
    if ((latest?.commit_sha ?? null) !== input.base) throw conflict();
    const { results } = await db.prepare(
      'SELECT sheet, MAX(revision) AS revision FROM sales_editor_releases GROUP BY sheet'
    ).all();
    const revisions = new Map(results.map(({ sheet, revision }) => [sheet, revision]));
    if (SHEETS.some(sheet => input.revisions[sheet] !== (revisions.get(sheet) ?? 0))) throw conflict();
    throw error;
  }
  return { applied: true };
}

export async function githubCSVAction(db, input) {
  if (input?.action === 'status') return syncStatus(db);
  if (input?.action === 'apply') return applyGitHubCSV(db, input);
  if (input?.action === 'mark_emailed' && isSHA(input.commit)) {
    await db.prepare(`
      UPDATE github_csv_sync_runs SET emailed_at = CURRENT_TIMESTAMP
      WHERE commit_sha = ? AND emailed_at IS NULL
    `).bind(input.commit).run();
    return { marked: true };
  }
  throw new EditorError(400, '未知的 GitHub 同步操作。');
}
