export type UserRole = "admin" | "member";

export interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
  deactivatedAt: string | null;
}

export interface SessionRecord {
  id: string;
  ownerUserId: string;
  title: string;
  workspace: string;
  createdAt: string;
  updatedAt: string;
}

export type MessageRole = "user" | "assistant" | "system";
export type SystemMessageType = "plan" | "reasoning";

export interface MessageRecord {
  id: string;
  sessionId: string;
  role: MessageRole;
  systemMessageType?: SystemMessageType;
  content: string;
  runId: string | null;
  createdAt: string;
}

export type RunStatus = "queued" | "running" | "completed" | "failed";

export interface RunRecord {
  id: string;
  sessionId: string;
  provider: string;
  status: RunStatus;
  output: string;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface AuditEventRecord {
  id: string;
  actorUserId: string | null;
  actorUsername: string | null;
  actorRole: UserRole | null;
  eventType: string;
  targetType: string;
  targetId: string | null;
  outcome: "success" | "failure";
  ipAddress: string | null;
  metadataJson: string | null;
  createdAt: string;
}
