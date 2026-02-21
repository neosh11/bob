import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export function createDatabase(dbPath: string): Database.Database {
  const directory = path.dirname(dbPath);
  fs.mkdirSync(directory, { recursive: true });

  const database = new Database(dbPath);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  return database;
}
