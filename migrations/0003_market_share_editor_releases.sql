ALTER TABLE sales_editor_releases RENAME TO sales_editor_releases_previous;

CREATE TABLE sales_editor_releases (
  sheet TEXT NOT NULL CHECK (sheet IN ('tracking', 'models', 'market-share')),
  revision INTEGER NOT NULL CHECK (revision > 0),
  published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  editor TEXT NOT NULL,
  added INTEGER NOT NULL,
  updated INTEGER NOT NULL,
  removed INTEGER NOT NULL,
  PRIMARY KEY (sheet, revision)
);

INSERT INTO sales_editor_releases (sheet, revision, published_at, editor, added, updated, removed)
SELECT sheet, revision, published_at, editor, added, updated, removed
FROM sales_editor_releases_previous;

DROP TABLE sales_editor_releases_previous;
