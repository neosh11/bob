import type Database from "better-sqlite3";

import { migrationSql } from "./schema.js";

function hasColumn(db: Database.Database, tableName: string, columnName: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return rows.some((row) => row.name === columnName);
}

function applyUserColumnMigrations(db: Database.Database): void {
  if (!hasColumn(db, "users", "active")) {
    db.exec("ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1");
  }

  if (!hasColumn(db, "users", "deactivated_at")) {
    db.exec("ALTER TABLE users ADD COLUMN deactivated_at TEXT");
  }
}

export function applyMigrations(db: Database.Database): void {
  db.exec(migrationSql);
  applyUserColumnMigrations(db);
}
