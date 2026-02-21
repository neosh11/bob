import type { MessageRecord } from "../types/domain.js";

export type AgentEvent =
  | { type: "status"; value: string }
  | { type: "delta"; text: string }
  | { type: "stderr"; text: string };

export interface AgentRunInput {
  runId: string;
  sessionId: string;
  workspace: string;
  prompt: string;
  history: MessageRecord[];
}

export interface AgentProvider {
  id: string;
  description: string;
  run(input: AgentRunInput, onEvent: (event: AgentEvent) => void, options?: { signal?: AbortSignal }): Promise<void>;
}

export interface RunNotification {
  runId: string;
  sessionId: string;
  type: "queued" | "started" | "delta" | "stderr" | "completed" | "failed" | "lifecycle";
  payload?: string;
}
