CREATE TABLE model_master (
  model_id TEXT PRIMARY KEY NOT NULL,
  model_name TEXT NOT NULL,
  brand TEXT, brand_group TEXT, aliases TEXT,
  series TEXT, generation TEXT, variant TEXT, form_factor TEXT,
  sale_start_date TEXT, predecessor_id TEXT, launch_price TEXT,
  chip_vendor TEXT, chip_model TEXT, base_ram TEXT, base_rom TEXT,
  source_url TEXT, notes TEXT, verification TEXT, tracking_group TEXT
);

CREATE TABLE tracking_models (
  tracking_id INTEGER PRIMARY KEY,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  category TEXT,
  date TEXT,
  sort_order INTEGER NOT NULL,
  UNIQUE (brand, model)
);

CREATE TABLE tracking_sales (
  tracking_id INTEGER NOT NULL REFERENCES tracking_models(tracking_id),
  period TEXT NOT NULL,
  metric TEXT NOT NULL CHECK (metric IN ('cumulative', 'weekly')),
  value_wan TEXT NOT NULL,
  operator TEXT NOT NULL CHECK (operator IN ('=', '>=', '<', '≈')),
  PRIMARY KEY (tracking_id, period, metric)
);

CREATE TABLE ranking_datasets (
  dataset_id TEXT PRIMARY KEY NOT NULL,
  source TEXT, series TEXT, period_type TEXT NOT NULL, period TEXT NOT NULL,
  period_start TEXT, period_end TEXT,
  top_n INTEGER NOT NULL, actual_count INTEGER NOT NULL,
  fit_k TEXT, fit_mode TEXT, calibration_count INTEGER,
  accepted_count INTEGER, outlier_threshold TEXT, algorithm_version TEXT,
  saved_at TEXT
);

CREATE TABLE ranking_entries (
  dataset_id TEXT NOT NULL REFERENCES ranking_datasets(dataset_id),
  rank INTEGER NOT NULL CHECK (rank > 0),
  model TEXT NOT NULL, brand_group TEXT, pixels TEXT,
  estimated_units TEXT NOT NULL, estimated_wan TEXT NOT NULL,
  PRIMARY KEY (dataset_id, rank)
);

CREATE TABLE market_share_weekly (
  period TEXT PRIMARY KEY NOT NULL,
  trend TEXT,
  apple TEXT, huawei TEXT, osta TEXT, xiaomi TEXT, oppo TEXT,
  oneplus TEXT, realme TEXT, vivo TEXT, iqoo TEXT, honor TEXT
);
