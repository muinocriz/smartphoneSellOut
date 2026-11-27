CREATE TABLE github_csv_sync_runs (
  sequence INTEGER PRIMARY KEY,
  commit_sha TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  report TEXT NOT NULL,
  emailed_at TEXT
);
