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

const COUNT_QUERY = `
  SELECT 'model_master' AS table_name, COUNT(*) AS row_count FROM model_master
  UNION ALL SELECT 'tracking_models', COUNT(*) FROM tracking_models
  UNION ALL SELECT 'tracking_sales', COUNT(*) FROM tracking_sales
  UNION ALL SELECT 'ranking_datasets', COUNT(*) FROM ranking_datasets
  UNION ALL SELECT 'ranking_entries', COUNT(*) FROM ranking_entries
  UNION ALL SELECT 'market_share_weekly', COUNT(*) FROM market_share_weekly
`;

function json(body, status = 200, headers = {}) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', ...headers }
  });
}

async function readData(request, env, pathname) {
  const query = pathname === '/api/counts' ? COUNT_QUERY : DATA_QUERIES.get(pathname);
  if (!query) return json({ error: 'not_found' }, 404);
  if (request.method !== 'GET') {
    return json({ error: 'method_not_allowed' }, 405, { Allow: 'GET' });
  }

  try {
    const { results } = await env.DB.prepare(query).all();
    return json({ data: results });
  } catch (error) {
    console.error('D1 read failed', pathname, error);
    return json({ error: 'data_unavailable' }, 503);
  }
}

export default {
  fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      return readData(request, env, url.pathname);
    }
    if (url.pathname === '/') {
      url.pathname = '/index.html';
      return env.ASSETS.fetch(new Request(url, request));
    }
    return env.ASSETS.fetch(request);
  }
};
