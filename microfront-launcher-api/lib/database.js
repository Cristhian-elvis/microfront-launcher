import fs from 'node:fs';
import path from 'node:path';
import initSqlJs from 'sql.js';

import { storageRoot } from './core.js';

const databasePath = path.join(storageRoot, 'launcher.db');

let databasePromise;

function persistDatabase(database) {
  fs.mkdirSync(storageRoot, { recursive: true });
  fs.writeFileSync(databasePath, Buffer.from(database.export()));
}

export async function getDatabase() {
  if (!databasePromise) {
    databasePromise = initSqlJs().then((SQL) => {
      const database = fs.existsSync(databasePath)
        ? new SQL.Database(fs.readFileSync(databasePath))
        : new SQL.Database();

      database.run(`
        CREATE TABLE IF NOT EXISTS auth_user_profiles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cd_usuario TEXT NOT NULL,
          webapp TEXT NOT NULL,
          profiles TEXT NOT NULL,
          descripcion TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (cd_usuario, webapp)
        );
      `);
      database.run(`
        CREATE TABLE IF NOT EXISTS auth_tokens (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_profile_id INTEGER NOT NULL,
          webapp TEXT NOT NULL UNIQUE,
          access_token TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      const tokenColumns = database.exec('PRAGMA table_info(auth_tokens)');
      const existingTokenColumns = tokenColumns[0]?.values.map((column) => column[1]) ?? [];
      const requiresTokenMigration = existingTokenColumns.includes('refresh_token')
        || existingTokenColumns.includes('issued_at');

      if (requiresTokenMigration) {
        database.run(`
          CREATE TABLE auth_tokens_migrated (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_profile_id INTEGER NOT NULL,
            webapp TEXT NOT NULL UNIQUE,
            access_token TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `);
        database.run(`
          INSERT INTO auth_tokens_migrated (
            user_profile_id, webapp, access_token, created_at, updated_at
          )
          SELECT token.user_profile_id, token.webapp, token.access_token,
                 COALESCE(token.issued_at, token.created_at), token.updated_at
          FROM auth_tokens AS token
          WHERE token.id = (
            SELECT latest.id
            FROM auth_tokens AS latest
            WHERE latest.webapp = token.webapp
            ORDER BY latest.updated_at DESC, latest.id DESC
            LIMIT 1
          );
        `);
        database.run('DROP TABLE auth_tokens');
        database.run('ALTER TABLE auth_tokens_migrated RENAME TO auth_tokens');
      }

      persistDatabase(database);

      return database;
    });
  }

  return databasePromise;
}

export async function executeWrite(statement, parameters = []) {
  const database = await getDatabase();
  database.run(statement, parameters);
  persistDatabase(database);
  return database;
}

export async function queryAll(statement, parameters = []) {
  const database = await getDatabase();
  const result = database.exec(statement, parameters);
  if (!result.length) return [];

  const [{ columns, values }] = result;
  return values.map((value) =>
    Object.fromEntries(columns.map((column, index) => [column, value[index]])),
  );
}

export async function queryOne(statement, parameters = []) {
  return (await queryAll(statement, parameters))[0] ?? null;
}
