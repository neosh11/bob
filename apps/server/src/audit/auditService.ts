import type { Request } from "express";

import type { AuditRepository } from "../db/repositories/auditRepository.js";
import type { AuditEventRecord, UserRole } from "../types/domain.js";

interface ActorContext {
  userId?: string | null;
  username?: string | null;
  role?: UserRole | null;
  ipAddress?: string | null;
}

export interface AuditEventInput {
  eventType: string;
  targetType: string;
  targetId?: string | null;
  outcome: "success" | "failure";
  metadata?: Record<string, unknown>;
  actor?: ActorContext;
}

function getRequestIp(req: Request): string | null {
  return req.ip || req.socket.remoteAddress || null;
}

function actorFromRequest(req: Request): ActorContext {
  return {
    userId: req.auth?.userId ?? null,
    username: req.auth?.username ?? null,
    role: req.auth?.role ?? null,
    ipAddress: getRequestIp(req)
  };
}

export class AuditService {
  constructor(private readonly repository: AuditRepository) {}

  log(event: AuditEventInput): AuditEventRecord {
    const metadataJson = event.metadata ? JSON.stringify(event.metadata) : null;
    return this.repository.createEvent({
      actorUserId: event.actor?.userId ?? null,
      actorUsername: event.actor?.username ?? null,
      actorRole: event.actor?.role ?? null,
      eventType: event.eventType,
      targetType: event.targetType,
      targetId: event.targetId ?? null,
      outcome: event.outcome,
      ipAddress: event.actor?.ipAddress ?? null,
      metadataJson
    });
  }

  logFromRequest(req: Request, event: Omit<AuditEventInput, "actor">): AuditEventRecord {
    return this.log({
      ...event,
      actor: actorFromRequest(req)
    });
  }

  listRecent(limit: number): AuditEventRecord[] {
    return this.repository.listRecent(limit);
  }
}
