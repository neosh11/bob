export interface Workspace {
  id: string;
  label: string;
  path: string;
}

export interface Session {
  id: string;
  ownerUserId: string;
  title: string;
  workspace: string;
  createdAt: string;
  updatedAt: string;
}

export type MessageRole = "user" | "assistant" | "system";

export interface Message {
  id: string;
  sessionId: string;
  role: MessageRole;
  systemMessageType?: "plan" | "reasoning";
  content: string;
  runId: string | null;
  createdAt: string;
}

export type RunStatus = "queued" | "running" | "completed" | "failed";

export interface Run {
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

export interface SessionDetail {
  session: Session;
  messages: Message[];
  runs: Run[];
}

export type RunEvent = {
  runId: string;
  sessionId: string;
  type: "queued" | "started" | "delta" | "stderr" | "completed" | "failed" | "lifecycle";
  payload?: string;
};
