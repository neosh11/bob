import crypto from "node:crypto";
import type Database from "better-sqlite3";

import type { MessageRecord, MessageRole } from "../../types/domain.js";

type MessageRow = {
  id: string;
  session_id: string;
  role: MessageRole;
  content: string;
  run_id: string | null;
  created_at: string;
};

function mapMessage(row: MessageRow): MessageRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role,
    content: row.content,
    runId: row.run_id,
    createdAt: row.created_at
  };
}

export class MessageRepository {
  constructor(private readonly db: Database.Database) {}

  createMessage(input: {
    sessionId: string;
    role: MessageRole;
    content: string;
    runId?: string;
  }): MessageRecord {
    const message: MessageRecord = {
      id: crypto.randomUUID(),
      sessionId: input.sessionId,
      role: input.role,
      content: input.content,
      runId: input.runId ?? null,
      createdAt: new Date().toISOString()
    };

    this.db
      .prepare(
        `INSERT INTO messages (id, session_id, role, content, run_id, created_at)
         VALUES (@id, @session_id, @role, @content, @run_id, @created_at)`
      )
      .run({
        id: message.id,
        session_id: message.sessionId,
        role: message.role,
        content: message.content,
        run_id: message.runId,
        created_at: message.createdAt
      });

    return message;
  }

  listBySession(sessionId: string): MessageRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC")
      .all(sessionId) as MessageRow[];
    return rows.map(mapMessage);
  }

  updateMessageContent(messageId: string, content: string): void {
    this.db.prepare("UPDATE messages SET content = ? WHERE id = ?").run(content, messageId);
  }
}
