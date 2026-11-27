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
           d.period_start, d.period_end, d.top_n, d.actual_count,
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

async function readData(request, env, pathname) {
  const countRequest = pathname === '/api/counts';
  const query = DATA_QUERIES.get(pathname);
  if (!countRequest && !query) return json({ error: 'not_found' }, 404);
  if (request.method !== 'GET') {
    return json({ error: 'method_not_allowed' }, 405, { Allow: 'GET' });
  }

  try {
    if (countRequest) return json({ data: await readCounts(env.DB) });

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

async function readAdminSession(request, env) {
  if (request.method !== 'GET') {
    return json({ error: 'method_not_allowed' }, 405, { Allow: 'GET' });
  }

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

  try {
    const response = await fetch(issuer + '/cdn-cgi/access/certs', { redirect: 'error' });
    if (!response.ok) throw new Error('Access keys HTTP ' + response.status);
    const { keys } = await response.json();
    const jwk = keys.find(key => key.kid === header.kid && key.kty === 'RSA');
    if (!jwk) return unauthorized();
    const key = await crypto.subtle.importKey(
      'jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']
    );
    const signed = new TextEncoder().encode(parts[0] + '.' + parts[1]);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, signed);
    return valid ? json({ authenticated: true }) : unauthorized();
  } catch (error) {
    console.error('Access verification unavailable', error);
    return json({ error: 'access_unavailable' }, 503);
  }
}

const DATA_PAGES = new Set([
  "/sales-increment.html",
  "/sales-data-editor.html",
  "/studio/sales-estimator.html"
]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/admin/api/session') {
      return readAdminSession(request, env);
    }
    if (url.pathname.startsWith('/api/')) {
      return readData(request, env, url.pathname);
    }
    if (url.pathname === '/') {
      url.pathname = '/index.html';
      return env.ASSETS.fetch(new Request(url, request));
    }
    if (request.method === 'GET' && DATA_PAGES.has(url.pathname)) {
      const headers = new Headers(request.headers);
      headers.delete('If-None-Match');
      headers.delete('If-Modified-Since');
      const asset = await env.ASSETS.fetch(new Request(request, { headers }));
      if (!asset.ok) return asset;
      const response = new Response(asset.body, asset);
      response.headers.delete('ETag');
      response.headers.delete('Last-Modified');
      response.headers.set('Cache-Control', 'no-store');
      return new HTMLRewriter()
        .on('html', { element(element) { element.setAttribute('data-sales-source', 'd1'); } })
        .transform(response);
    }
    return env.ASSETS.fetch(request);
  }
};
