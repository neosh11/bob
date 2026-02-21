import dotenv from "dotenv";

import { loadConfig } from "../config/env.js";
import { createDatabase } from "./connection.js";
import { applyMigrations } from "./migrations.js";

dotenv.config();

export function runMigrations(databasePath: string): void {
  const db = createDatabase(databasePath);
  applyMigrations(db);
  db.close();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const config = loadConfig();
  runMigrations(config.dbPath);
  console.log(`Migrations applied at ${config.dbPath}`);
}
