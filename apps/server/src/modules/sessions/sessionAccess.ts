import type { Response } from "express";

import type { AppContext } from "../../appContext.js";
import type { SessionRecord } from "../../types/domain.js";

export function parseRouteParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export function resolveOwnedSession(
  context: AppContext,
  sessionId: string | null,
  ownerUserId: string,
  res: Response
): SessionRecord | null {
  if (!sessionId) {
    res.status(400).json({ error: "Session id is required." });
    return null;
  }

  const session = context.repos.sessions.findByIdForOwner(sessionId, ownerUserId);
  if (!session) {
    res.status(404).json({ error: "Session not found." });
    return null;
  }

  return session;
}
