declare global {
  var __BROWSECOMP_DB__: D1Database | undefined;
}

let schemaReady: Promise<void> | null = null;

export function getD1() {
  if (!globalThis.__BROWSECOMP_DB__) {
    throw new Error("The prompt database is unavailable.");
  }
  return globalThis.__BROWSECOMP_DB__;
}

export async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = initializeSchema().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

async function initializeSchema() {
  const db = getD1();
  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        slug TEXT NOT NULL UNIQUE,
        color TEXT NOT NULL DEFAULT '#809B75',
        status TEXT NOT NULL DEFAULT 'active',
        details TEXT NOT NULL DEFAULT '',
        dsp_enabled INTEGER NOT NULL DEFAULT 0,
        fanouts_enabled INTEGER NOT NULL DEFAULT 0,
        llm_share_links_enabled INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        archived_at TEXT
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS prompt_families (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        tags TEXT NOT NULL DEFAULT '',
        prompt_text TEXT NOT NULL DEFAULT '',
        source_urls TEXT NOT NULL DEFAULT '',
        logic_trace TEXT NOT NULL DEFAULT '',
        reference_answer TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        archived_at TEXT,
        archive_reason TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS variants (
        id TEXT PRIMARY KEY,
        prompt_id TEXT NOT NULL,
        project TEXT NOT NULL,
        project_slug TEXT NOT NULL,
        version INTEGER NOT NULL,
        based_on TEXT NOT NULL,
        prompt_text TEXT NOT NULL DEFAULT '',
        prompt_urls TEXT NOT NULL DEFAULT '',
        dsp_text TEXT NOT NULL DEFAULT '',
        fanouts_text TEXT NOT NULL DEFAULT '',
        llm_share_links_text TEXT NOT NULL DEFAULT '',
        logic_trace TEXT NOT NULL DEFAULT '',
        reference_answer TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(prompt_id, project_slug, version)
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS source_urls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL UNIQUE,
        tags TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        added_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        used_at TEXT,
        prompt_id TEXT,
        variant_id TEXT
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS variant_model_tests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        variant_id TEXT NOT NULL,
        model TEXT NOT NULL,
        result TEXT NOT NULL,
        tested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS prompt_model_tests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prompt_id TEXT NOT NULL,
        model TEXT NOT NULL,
        result TEXT NOT NULL,
        tested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prompt_id TEXT NOT NULL,
        variant_id TEXT NOT NULL UNIQUE,
        project TEXT NOT NULL,
        submitted_at TEXT NOT NULL,
        submission_ref TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS variants_prompt_idx ON variants(prompt_id)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS source_urls_used_idx ON source_urls(used_at)",
    ),
  ]);
  await ensureColumns(db, "projects", [
    ["details", "TEXT NOT NULL DEFAULT ''"],
    ["dsp_enabled", "INTEGER NOT NULL DEFAULT 0"],
    ["fanouts_enabled", "INTEGER NOT NULL DEFAULT 0"],
    ["llm_share_links_enabled", "INTEGER NOT NULL DEFAULT 0"],
  ]);
  await ensureColumns(db, "prompt_families", [
    ["tags", "TEXT NOT NULL DEFAULT ''"],
    ["source_urls", "TEXT NOT NULL DEFAULT ''"],
    ["logic_trace", "TEXT NOT NULL DEFAULT ''"],
    ["archived_at", "TEXT"],
    ["archive_reason", "TEXT"],
  ]);
  await ensureColumns(db, "variants", [
    ["prompt_urls", "TEXT NOT NULL DEFAULT ''"],
    ["dsp_text", "TEXT NOT NULL DEFAULT ''"],
    ["fanouts_text", "TEXT NOT NULL DEFAULT ''"],
    ["llm_share_links_text", "TEXT NOT NULL DEFAULT ''"],
    ["logic_trace", "TEXT NOT NULL DEFAULT ''"],
  ]);
  await db.batch([
    db.prepare(
      "INSERT OR IGNORE INTO projects (name, slug, color, status) VALUES ('Sample', 'sample', '#B9E8D0', 'active')",
    ),
  ]);
}

async function ensureColumns(
  db: D1Database,
  table: string,
  columns: Array<[string, string]>,
) {
  const existing = await db
    .prepare(`PRAGMA table_info(${table})`)
    .all<{ name: string }>();
  const names = new Set(existing.results.map((column) => column.name));
  for (const [name, definition] of columns) {
    if (!names.has(name)) {
      await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`).run();
    }
  }
}
