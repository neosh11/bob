import type { MessageRecord, RunRecord, RunStatus, SystemMessageType } from "../types/domain.js";

import type { CodexThread, CodexThreadItem, CodexTurnStatus, CodexUserInput } from "./protocol.js";

function renderUserInput(input: CodexUserInput): string {
  switch (input.type) {
    case "text":
      return input.text;
    case "image":
      return `[image] ${input.url}`;
    case "localImage":
      return `[localImage] ${input.path}`;
    case "mention":
      return `[@${input.name}]`;
    case "skill":
      return `[$${input.name}]`;
    default:
      return "[unsupported-input]";
  }
}

function toRunStatus(status: CodexTurnStatus): RunStatus {
  if (status === "inProgress") {
    return "running";
  }
  if (status === "completed") {
    return "completed";
  }
  return "failed";
}

function computeTimestamps(count: number, startSeconds: number, endSeconds: number): string[] {
  if (count <= 0) {
    return [];
  }

  if (count === 1 || endSeconds <= startSeconds) {
    return [new Date(endSeconds * 1000).toISOString()];
  }

  const span = endSeconds - startSeconds;
  return Array.from({ length: count }, (_, index) => {
    const ratio = index / (count - 1);
    const seconds = Math.round(startSeconds + span * ratio);
    return new Date(seconds * 1000).toISOString();
  });
}

function extractRunOutput(items: CodexThreadItem[]): string {
  return items
    .map((item) => {
      if (item.type === "agentMessage") {
        return item.text;
      }
      if (item.type === "commandExecution") {
        return item.aggregatedOutput ?? "";
      }
      return "";
    })
    .join("");
}

export function mapThreadToMessagesAndRuns(thread: CodexThread): {
  messages: MessageRecord[];
  runs: RunRecord[];
} {
  const runTimes = computeTimestamps(thread.turns.length, thread.createdAt, thread.updatedAt);
  const runs = thread.turns.map((turn, index) => {
    const status = toRunStatus(turn.status);
    const output = extractRunOutput(turn.items);
    const createdAt = runTimes[index] ?? new Date(thread.updatedAt * 1000).toISOString();
    const startedAt = createdAt;
    const finishedAt = status === "running" ? null : createdAt;
    const defaultError =
      turn.status === "interrupted" ? "Run interrupted by user." : status === "failed" ? "Run failed." : null;

    return {
      id: turn.id,
      sessionId: thread.id,
      provider: thread.modelProvider,
      status,
      output,
      error: turn.error?.message ?? defaultError,
      createdAt,
      startedAt,
      finishedAt
    } satisfies RunRecord;
  });

  const messageItems: Array<{
    id: string;
    role: "user" | "assistant" | "system";
    systemMessageType?: SystemMessageType;
    runId: string | null;
    content: string;
  }> = [];

  for (const turn of thread.turns) {
    for (const item of turn.items) {
      if (item.type === "userMessage") {
        messageItems.push({
          id: item.id,
          role: "user",
          runId: null,
          content: item.content.map(renderUserInput).join("\n").trim()
        });
        continue;
      }

      if (item.type === "agentMessage") {
        messageItems.push({
          id: item.id,
          role: "assistant",
          runId: turn.id,
          content: item.text
        });
        continue;
      }

      if (item.type === "plan") {
        messageItems.push({
          id: item.id,
          role: "system",
          systemMessageType: "plan",
          runId: turn.id,
          content: item.text
        });
        continue;
      }

      if (item.type === "reasoning") {
        const reasoningText = [...item.summary, ...item.content].filter(Boolean).join("\n");
        messageItems.push({
          id: item.id,
          role: "system",
          systemMessageType: "reasoning",
          runId: turn.id,
          content: reasoningText
        });
      }
    }
  }

  const messageTimes = computeTimestamps(messageItems.length, thread.createdAt, thread.updatedAt);
  const messages = messageItems.map((item, index) => ({
    id: item.id,
    sessionId: thread.id,
    role: item.role,
    systemMessageType: item.systemMessageType,
    content: item.content,
    runId: item.runId,
    createdAt: messageTimes[index] ?? new Date(thread.updatedAt * 1000).toISOString()
  })) satisfies MessageRecord[];

  return { messages, runs };
}
