import crypto from "node:crypto";
import type Database from "better-sqlite3";

import type { UserRecord, UserRole } from "../../types/domain.js";

type UserRow = {
  id: string;
  username: string;
  password_hash: string;
  role: UserRole;
  active: number;
  created_at: string;
  deactivated_at: string | null;
};

function mapUser(row: UserRow): UserRecord {
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    role: row.role,
    active: row.active === 1,
    createdAt: row.created_at,
    deactivatedAt: row.deactivated_at
  };
}

export class UserRepository {
  constructor(private readonly db: Database.Database) {}

  ensureUser(input: {
    id: string;
    username: string;
    passwordHash: string;
    role: UserRole;
  }): UserRecord {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO users (id, username, password_hash, role, active, created_at, deactivated_at)
         VALUES (@id, @username, @password_hash, @role, 1, @created_at, NULL)
         ON CONFLICT(id) DO UPDATE SET
           username = excluded.username,
           role = excluded.role,
           active = 1,
           deactivated_at = NULL`
      )
      .run({
        id: input.id,
        username: input.username,
        password_hash: input.passwordHash,
        role: input.role,
        created_at: now
      });

    const user = this.findById(input.id);
    if (!user) {
      throw new Error("Failed to ensure user record.");
    }
    return user;
  }

  createUser(input: { username: string; passwordHash: string; role: UserRole }): UserRecord {
    const user: UserRecord = {
      id: crypto.randomUUID(),
      username: input.username,
      passwordHash: input.passwordHash,
      role: input.role,
      active: true,
      createdAt: new Date().toISOString(),
      deactivatedAt: null
    };

    const statement = this.db.prepare(
      `INSERT INTO users (id, username, password_hash, role, active, created_at, deactivated_at)
       VALUES (@id, @username, @password_hash, @role, @active, @created_at, @deactivated_at)`
    );

    statement.run({
      id: user.id,
      username: user.username,
      password_hash: user.passwordHash,
      role: user.role,
      active: user.active ? 1 : 0,
      created_at: user.createdAt,
      deactivated_at: user.deactivatedAt
    });

    return user;
  }

  findByUsername(username: string): UserRecord | null {
    const statement = this.db.prepare("SELECT * FROM users WHERE username = ? LIMIT 1");
    const row = statement.get(username) as UserRow | undefined;
    return row ? mapUser(row) : null;
  }

  findById(userId: string): UserRecord | null {
    const statement = this.db.prepare("SELECT * FROM users WHERE id = ? LIMIT 1");
    const row = statement.get(userId) as UserRow | undefined;
    return row ? mapUser(row) : null;
  }

  countUsers(): number {
    const statement = this.db.prepare("SELECT COUNT(*) as total FROM users");
    const row = statement.get() as { total: number };
    return row.total;
  }

  listUsers(): UserRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM users ORDER BY created_at ASC")
      .all() as UserRow[];
    return rows.map(mapUser);
  }

  setUserActiveState(userId: string, active: boolean): boolean {
    const now = new Date().toISOString();
    const result = this.db
      .prepare(
        `UPDATE users
         SET active = @active,
             deactivated_at = @deactivated_at
         WHERE id = @id`
      )
      .run({
        id: userId,
        active: active ? 1 : 0,
        deactivated_at: active ? null : now
      });

    return result.changes > 0;
  }
}
