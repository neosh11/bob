import type { MessageRepository } from "../db/repositories/messageRepository.js";
import type { RunRepository } from "../db/repositories/runRepository.js";
import type { SessionRepository } from "../db/repositories/sessionRepository.js";
import type { MessageRecord } from "../types/domain.js";

import type { AgentProvider, RunNotification } from "./types.js";

export interface RunExecutionState {
  userId: string;
  sessionId: string;
  runId: string;
  assistantMessageId: string;
  workspace: string;
  prompt: string;
  history: MessageRecord[];
  controller: AbortController;
}

export type CancelRunResult = "requested" | "not-found" | "not-active";

export interface RunAuditEvent {
  eventType: string;
  targetType: string;
  targetId?: string | null;
  outcome: "success" | "failure";
  actor?: {
    userId?: string | null;
    username?: string | null;
    role?: "admin" | "member" | null;
    ipAddress?: string | null;
  };
  metadata?: Record<string, unknown>;
}

export interface RunOrchestratorDependencies {
  provider: AgentProvider;
  messages: MessageRepository;
  runs: RunRepository;
  sessions: SessionRepository;
  maxConcurrency: number;
  audit: (event: RunAuditEvent) => void;
  notify: (userId: string, event: RunNotification) => void;
}
