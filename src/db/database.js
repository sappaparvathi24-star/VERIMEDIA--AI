import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'verimedia.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let dbInstance = null;

export function getDatabase() {
  if (!dbInstance) {
    dbInstance = new Database(DB_PATH);
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');
    runMigrations(dbInstance);
  }
  return dbInstance;
}

export function closeDatabase() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);

  const migrationsDir = path.join(__dirname, 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    return;
  }

  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const getApplied = db.prepare('SELECT version FROM schema_migrations');
  const appliedVersions = new Set(getApplied.all().map(r => r.version));

  for (const file of migrationFiles) {
    const match = file.match(/^(\d+)_/);
    if (!match) continue;
    const version = parseInt(match[1], 10);
    if (appliedVersions.has(version)) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    const applyMigration = db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(version, file);
    });
    applyMigration();
  }
}

export default getDatabase;
