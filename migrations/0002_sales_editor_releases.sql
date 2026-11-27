CREATE TABLE sales_editor_releases (
  sheet TEXT NOT NULL CHECK (sheet IN ('tracking', 'models')),
  revision INTEGER NOT NULL CHECK (revision > 0),
  published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  editor TEXT NOT NULL,
  added INTEGER NOT NULL,
  updated INTEGER NOT NULL,
  removed INTEGER NOT NULL,
  PRIMARY KEY (sheet, revision)
);
