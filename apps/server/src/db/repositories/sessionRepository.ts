import crypto from "node:crypto";
import type Database from "better-sqlite3";

import type { SessionRecord } from "../../types/domain.js";

type SessionRow = {
  id: string;
  owner_user_id: string;
  title: string;
  workspace: string;
  created_at: string;
  updated_at: string;
};

function mapSession(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    title: row.title,
    workspace: row.workspace,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class SessionRepository {
  constructor(private readonly db: Database.Database) {}

  createSession(input: { id?: string; ownerUserId: string; title: string; workspace: string }): SessionRecord {
    const now = new Date().toISOString();
    const session: SessionRecord = {
      id: input.id ?? crypto.randomUUID(),
      ownerUserId: input.ownerUserId,
      title: input.title,
      workspace: input.workspace,
      createdAt: now,
      updatedAt: now
    };

    this.db
      .prepare(
        `INSERT INTO sessions (id, owner_user_id, title, workspace, created_at, updated_at)
         VALUES (@id, @owner_user_id, @title, @workspace, @created_at, @updated_at)`
      )
      .run({
        id: session.id,
        owner_user_id: session.ownerUserId,
        title: session.title,
        workspace: session.workspace,
        created_at: session.createdAt,
        updated_at: session.updatedAt
      });

    return session;
  }

  listByOwner(ownerUserId: string): SessionRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM sessions WHERE owner_user_id = ? ORDER BY updated_at DESC")
      .all(ownerUserId) as SessionRow[];
    return rows.map(mapSession);
  }

  findByIdForOwner(sessionId: string, ownerUserId: string): SessionRecord | null {
    const row = this.db
      .prepare("SELECT * FROM sessions WHERE id = ? AND owner_user_id = ? LIMIT 1")
      .get(sessionId, ownerUserId) as SessionRow | undefined;
    return row ? mapSession(row) : null;
  }

  findById(sessionId: string): SessionRecord | null {
    const row = this.db
      .prepare("SELECT * FROM sessions WHERE id = ? LIMIT 1")
      .get(sessionId) as SessionRow | undefined;
    return row ? mapSession(row) : null;
  }

  deleteForOwner(sessionId: string, ownerUserId: string): boolean {
    const result = this.db
      .prepare("DELETE FROM sessions WHERE id = ? AND owner_user_id = ?")
      .run(sessionId, ownerUserId);
    return result.changes > 0;
  }

  touchUpdatedAt(sessionId: string): void {
    this.db
      .prepare("UPDATE sessions SET updated_at = ? WHERE id = ?")
      .run(new Date().toISOString(), sessionId);
  }
}
