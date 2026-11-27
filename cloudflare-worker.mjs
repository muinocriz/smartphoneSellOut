import { EditorError, editEditorSheet, readEditorSheet } from './sales-editor-database.mjs';
import { publishRanking } from './ranking-editor-database.mjs';
import { githubCSVAction } from './github-csv-sync.mjs';

const DATA_QUERIES = new Map([
  ['/api/models', `
    SELECT model_id, model_name, brand, brand_group, aliases, series,
           generation, variant, form_factor, sale_start_date, predecessor_id,
           launch_price, chip_vendor, chip_model, base_ram, base_rom,
           source_url, notes, verification, tracking_group
    FROM model_master
    ORDER BY rowid
  `],
  ['/api/tracking', `
    SELECT m.brand, m.model, m.category, m.date, s.period, s.metric,
           s.value_wan, s.operator
    FROM tracking_sales AS s
    JOIN tracking_models AS m ON m.tracking_id = s.tracking_id
    ORDER BY m.sort_order, s.period, s.metric
  `],
  ['/api/rankings', `
    SELECT d.dataset_id, d.source, d.series, d.period_type, d.period,
           d.period_start, d.period_end, NULLIF(d.top_n, 0) AS top_n, d.actual_count,
           e.rank, e.model, e.brand_group, e.pixels, e.estimated_units,
           e.estimated_wan, d.fit_k, d.fit_mode, d.calibration_count,
           d.accepted_count, d.outlier_threshold, d.algorithm_version, d.saved_at
    FROM ranking_datasets AS d
    JOIN ranking_entries AS e ON e.dataset_id = d.dataset_id
    ORDER BY d.rowid, e.rank
  `],
  ['/api/market-share', `
    SELECT period, trend, apple, huawei, osta, xiaomi, oppo, oneplus,
           realme, vivo, iqoo, honor
    FROM market_share_weekly
    ORDER BY period
  `]
]);

const COUNT_TABLES = [
  'model_master',
  'tracking_models',
  'tracking_sales',
  'ranking_datasets',
  'ranking_entries',
  'market_share_weekly'
];

async function readCounts(db) {
  return Promise.all(COUNT_TABLES.map(async tableName => {
    try {
      const rowCount = await db.prepare(`SELECT COUNT(*) AS row_count FROM ${tableName}`)
        .first('row_count');
      return { table_name: tableName, row_count: rowCount };
    } catch (error) {
      console.error('D1 count failed', tableName, error);
      throw error;
    }
  }));
}

function json(body, status = 200, headers = {}) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', ...headers }
  });
}

async function readPublicSnapshot(db) {
  const queries = [...DATA_QUERIES];
  const [versions, ...tables] = await db.batch([
    db.prepare(`
      SELECT r.sheet, r.revision, strftime('%Y-%m-%dT%H:%M:%SZ', r.published_at) AS published_at
      FROM sales_editor_releases AS r
      JOIN (SELECT sheet, MAX(revision) AS revision FROM sales_editor_releases GROUP BY sheet) AS latest
      ON latest.sheet = r.sheet AND latest.revision = r.revision
    `),
    ...queries.map(([, query]) => db.prepare(query))
  ]);
  const revisions = new Map(versions.results.map(({ sheet, revision, published_at }) =>
    [sheet, { revision, published_at }]
  ));
  return {
    schema_version: 1,
    captured_at: new Date().toISOString(),
    tables: Object.fromEntries(queries.map(([path], index) => {
      const sheet = path.slice('/api/'.length);
      return [sheet, {
        ...(revisions.get(sheet) ?? { revision: 0, published_at: null }),
        data: tables[index].results
      }];
    }))
  };
}

async function readData(request, env, pathname) {
  const countRequest = pathname === '/api/counts';
  const snapshotRequest = pathname === '/api/snapshot';
  const query = DATA_QUERIES.get(pathname);
  if (!countRequest && !snapshotRequest && !query) return json({ error: 'not_found' }, 404);
  if (request.method !== 'GET') {
    return json({ error: 'method_not_allowed' }, 405, { Allow: 'GET' });
  }

  try {
    if (countRequest) return json({ data: await readCounts(env.DB) });
    if (snapshotRequest) return json(await readPublicSnapshot(env.DB));

    const { results } = await env.DB.prepare(query).all();
    return json({ data: results });
  } catch (error) {
    console.error('D1 read failed', pathname, error);
    return json({ error: 'data_unavailable' }, 503);
  }
}

function decodeBase64Url(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid base64url');
  return Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));
}

function decodeTokenPart(value) {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
}

async function verifyAdmin(request, env) {
  const issuer = env.CF_ACCESS_TEAM_DOMAIN?.trim().replace(/\/$/, '');
  const audience = env.CF_ACCESS_AUD?.trim();
  if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/i.test(issuer ?? '') || !audience) {
    return json({ error: 'access_not_configured' }, 503);
  }

  const unauthorized = () => json({ error: 'unauthorized' }, 401);
  const parts = request.headers.get('Cf-Access-Jwt-Assertion')?.split('.');
  if (parts?.length !== 3) return unauthorized();

  let header, claims, signature;
  try {
    header = decodeTokenPart(parts[0]);
    claims = decodeTokenPart(parts[1]);
    signature = decodeBase64Url(parts[2]);
  } catch {
    return unauthorized();
  }

  const now = Math.floor(Date.now() / 1000);
  if (header?.alg !== 'RS256' || typeof header.kid !== 'string' ||
      claims?.iss !== issuer || !Array.isArray(claims.aud) || !claims.aud.includes(audience) ||
      !Number.isFinite(claims.exp) || claims.exp <= now ||
      (claims.nbf !== undefined && (!Number.isFinite(claims.nbf) || claims.nbf > now)) ||
      typeof claims.email !== 'string' || !claims.email.trim()) {
    return unauthorized();
  }

  let stage = 'fetch_keys';
  try {
    const keysUrl = new URL('/cdn-cgi/access/certs', issuer);
    let response = await fetch(keysUrl, {
      redirect: 'manual',
      headers: { Accept: 'application/json' }
    });
    if (response.status >= 300 && response.status < 400 && response.headers.has('Location')) {
      const destination = new URL(response.headers.get('Location'), keysUrl);
      if (destination.origin === keysUrl.origin && destination.pathname === keysUrl.pathname + '/') {
        response = await fetch(destination, { redirect: 'manual' });
      }
    }
    if (!response.ok) {
      console.error('Access key endpoint returned HTTP', response.status);
      return json({ error: 'access_unavailable', stage, upstream_status: response.status }, 503);
    }
    stage = 'read_keys';
    const { keys } = await response.json();
    if (!Array.isArray(keys)) throw new Error('Invalid Access key set');
    const jwk = keys.find(key => key?.kid === header.kid && key.kty === 'RSA');
    if (!jwk) return unauthorized();
    stage = 'import_key';
    const key = await crypto.subtle.importKey(
      'jwk', { kty: 'RSA', n: jwk.n, e: jwk.e },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']
    );
    stage = 'verify_signature';
    const signed = new TextEncoder().encode(parts[0] + '.' + parts[1]);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, signed);
    return valid ? { email: claims.email } : unauthorized();
  } catch (error) {
    console.error('Access verification unavailable', stage, error);
    return json({ error: 'access_unavailable', stage }, 503);
  }
}

const DATA_PAGES = new Set([
  "/sales-increment.html",
  "/sales-data-editor.html",
  "/studio/sales-estimator.html"
]);

async function renderDataPage(request, env, admin = false) {
  const url = new URL(request.url);
  if (admin) url.pathname = '/sales-data-editor.html';
  const headers = new Headers(request.headers);
  headers.delete('If-None-Match');
  headers.delete('If-Modified-Since');
  const asset = await env.ASSETS.fetch(new Request(url, { headers }));
  if (!asset.ok) return asset;
  const response = new Response(asset.body, asset);
  response.headers.delete('ETag');
  response.headers.delete('Last-Modified');
  response.headers.set('Cache-Control', 'no-store');
  const rewriter = new HTMLRewriter().on('html', {
    element(element) {
      element.setAttribute('data-sales-source', 'd1');
      if (admin) element.setAttribute('data-sales-admin', 'true');
    }
  });
  if (admin) rewriter.on('head', { element(element) { element.prepend('<base href="/">', { html: true }); } });
  return rewriter.transform(response);
}

async function adminRoute(request, env, url) {
  const page = url.pathname === '/admin' || url.pathname === '/admin/';
  const session = url.pathname === '/admin/api/session';
  const sheet = url.pathname === '/admin/api/tracking' ? 'tracking'
    : url.pathname === '/admin/api/models' ? 'models'
    : url.pathname === '/admin/api/market-share' ? 'market-share'
    : url.pathname === '/admin/api/rankings' ? 'rankings' : null;
  const allowed = sheet === 'rankings' ? ['POST'] : sheet ? ['GET', 'POST'] : ['GET'];
  if (!page && !session && !sheet) return json({ error: 'not_found' }, 404);
  if (!allowed.includes(request.method)) {
    return json({ error: 'method_not_allowed' }, 405, { Allow: allowed.join(', ') });
  }

  const access = await verifyAdmin(request, env);
  if (access instanceof Response) return access;
  if (page) return renderDataPage(request, env, true);
  if (session) return json({ authenticated: true });

  const query = DATA_QUERIES.get('/api/' + sheet);
  try {
    if (request.method === 'GET') return json(await readEditorSheet(env.DB, sheet, query));
    if (request.headers.get('Origin') !== url.origin ||
        !/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') ?? '')) {
      return json({ error: 'invalid_request', message: '请从本站数据库录入页面提交。' }, 403);
    }

    const input = await readEditorInput(request);
    const result = sheet === 'rankings'
      ? await publishRanking(env.DB, query, access.email, input)
      : await editEditorSheet(env.DB, sheet, query, access.email, input);
    return json(result);
  } catch (error) {
    if (error instanceof EditorError) return json({ error: 'editor_request', message: error.message }, error.status);
    console.error('D1 editor operation failed', sheet, error);
    return json({ error: 'data_unavailable', message: '数据库暂不可用，请检查 D1 配置及迁移状态后重试。' }, 503);
  }
}

async function readEditorInput(request) {
  const maxBytes = 4 * 1024 * 1024;
  if (Number(request.headers.get('Content-Length')) > maxBytes) throw new EditorError(413, '请求超过 4 MB。');
  const raw = await request.arrayBuffer();
  if (raw.byteLength > maxBytes) throw new EditorError(413, '请求超过 4 MB。');
  let input;
  try { input = JSON.parse(new TextDecoder().decode(raw)); }
  catch { throw new EditorError(400, '表格数据不是有效的 JSON。'); }
  return input;
}

async function githubSyncRoute(request, env) {
  if (request.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405, { Allow: 'POST' });
  }
  if (!env.D1_SYNC_TOKEN) return json({ error: 'sync_not_configured' }, 503);
  const encode = new TextEncoder();
  const supplied = encode.encode(request.headers.get('Authorization') ?? '');
  const expected = encode.encode('Bearer ' + env.D1_SYNC_TOKEN);
  if (supplied.length !== expected.length || !crypto.subtle.timingSafeEqual(supplied, expected)) {
    return json({ error: 'unauthorized' }, 401);
  }

  try {
    return json(await githubCSVAction(env.DB, await readEditorInput(request)));
  } catch (error) {
    if (error instanceof EditorError) return json({ error: 'sync_request', message: error.message }, error.status);
    console.error('GitHub CSV sync failed', error);
    return json({ error: 'sync_unavailable', message: 'D1 同步暂不可用，请检查数据库迁移及 Worker 日志。' }, 503);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) {
      return adminRoute(request, env, url);
    }
    if (url.pathname === '/api/github-csv-sync') return githubSyncRoute(request, env);
    if (url.pathname.startsWith('/api/')) {
      return readData(request, env, url.pathname);
    }
    if (url.pathname === '/') {
      url.pathname = '/index.html';
      return env.ASSETS.fetch(new Request(url, request));
    }
    if (request.method === 'GET' && DATA_PAGES.has(url.pathname)) {
      return renderDataPage(request, env);
    }
    return env.ASSETS.fetch(request);
  }
};
