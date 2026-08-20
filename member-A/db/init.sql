-- 中科大资源导航 · 数据信息库 schema v0.1
-- 成员 A · SQLite

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS categories (
    id          TEXT PRIMARY KEY,
    parent_id   TEXT REFERENCES categories(id),
    name        TEXT NOT NULL,
    level       INTEGER NOT NULL DEFAULT 1,
    path        TEXT NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    description TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS tags (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS resources (
    id              TEXT PRIMARY KEY,
    title           TEXT NOT NULL,
    summary         TEXT DEFAULT '',
    url             TEXT NOT NULL,
    category_id     TEXT REFERENCES categories(id),
    legacy_category TEXT DEFAULT '',
    source_type     TEXT NOT NULL DEFAULT 'crawl',
    source_name     TEXT DEFAULT '',
    access_type     TEXT NOT NULL DEFAULT 'public',
    cost            TEXT DEFAULT '',
    how_to          TEXT DEFAULT '',
    audience        TEXT DEFAULT '',
    published_at    TEXT DEFAULT '',
    updated_at      TEXT NOT NULL,
    crawled_at      TEXT DEFAULT '',
    relevance_score INTEGER DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'active',
    kind            TEXT DEFAULT 'crawl',
    url_hash        TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS resource_tags (
    resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    tag_id      INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (resource_id, tag_id)
);

CREATE TABLE IF NOT EXISTS sync_state (
    url          TEXT PRIMARY KEY,
    url_hash     TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    title        TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS import_batches (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    source_file  TEXT NOT NULL,
    imported_at  TEXT NOT NULL,
    total_rows   INTEGER NOT NULL,
    inserted     INTEGER NOT NULL,
    updated      INTEGER NOT NULL,
    skipped      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_resources_category ON resources(category_id);
CREATE INDEX IF NOT EXISTS idx_resources_status ON resources(status);
CREATE INDEX IF NOT EXISTS idx_resources_source_type ON resources(source_type);
CREATE INDEX IF NOT EXISTS idx_resources_updated ON resources(updated_at);
