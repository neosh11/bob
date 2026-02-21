import crypto from "node:crypto";
import type Database from "better-sqlite3";

import type { AuditEventRecord, UserRole } from "../../types/domain.js";

interface AuditRow {
  id: string;
  actor_user_id: string | null;
  actor_username: string | null;
  actor_role: UserRole | null;
  event_type: string;
  target_type: string;
  target_id: string | null;
  outcome: "success" | "failure";
  ip_address: string | null;
  metadata_json: string | null;
  created_at: string;
}

function mapAuditRow(row: AuditRow): AuditEventRecord {
  return {
    id: row.id,
    actorUserId: row.actor_user_id,
    actorUsername: row.actor_username,
    actorRole: row.actor_role,
    eventType: row.event_type,
    targetType: row.target_type,
    targetId: row.target_id,
    outcome: row.outcome,
    ipAddress: row.ip_address,
    metadataJson: row.metadata_json,
    createdAt: row.created_at
  };
}

export class AuditRepository {
  constructor(private readonly db: Database.Database) {}

  createEvent(input: {
    actorUserId?: string | null;
    actorUsername?: string | null;
    actorRole?: UserRole | null;
    eventType: string;
    targetType: string;
    targetId?: string | null;
    outcome: "success" | "failure";
    ipAddress?: string | null;
    metadataJson?: string | null;
  }): AuditEventRecord {
    const event: AuditEventRecord = {
      id: crypto.randomUUID(),
      actorUserId: input.actorUserId ?? null,
      actorUsername: input.actorUsername ?? null,
      actorRole: input.actorRole ?? null,
      eventType: input.eventType,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      outcome: input.outcome,
      ipAddress: input.ipAddress ?? null,
      metadataJson: input.metadataJson ?? null,
      createdAt: new Date().toISOString()
    };

    this.db
      .prepare(
        `INSERT INTO audit_events (
          id,
          actor_user_id,
          actor_username,
          actor_role,
          event_type,
          target_type,
          target_id,
          outcome,
          ip_address,
          metadata_json,
          created_at
        ) VALUES (
          @id,
          @actor_user_id,
          @actor_username,
          @actor_role,
          @event_type,
          @target_type,
          @target_id,
          @outcome,
          @ip_address,
          @metadata_json,
          @created_at
        )`
      )
      .run({
        id: event.id,
        actor_user_id: event.actorUserId,
        actor_username: event.actorUsername,
        actor_role: event.actorRole,
        event_type: event.eventType,
        target_type: event.targetType,
        target_id: event.targetId,
        outcome: event.outcome,
        ip_address: event.ipAddress,
        metadata_json: event.metadataJson,
        created_at: event.createdAt
      });

    return event;
  }

  listRecent(limit: number): AuditEventRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM audit_events ORDER BY created_at DESC LIMIT ?")
      .all(limit) as AuditRow[];
    return rows.map(mapAuditRow);
  }
}
