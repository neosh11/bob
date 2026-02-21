import type { SessionDetail, RunEvent } from "./types";

export function applyRunEvent(current: SessionDetail | undefined, event: RunEvent): SessionDetail | undefined {
  if (!current) {
    return current;
  }

  let next = current;

  if (event.type === "delta" || event.type === "stderr") {
    next = {
      ...next,
      messages: next.messages.map((message) =>
        message.runId === event.runId ? { ...message, content: `${message.content}${event.payload ?? ""}` } : message
      ),
      runs: next.runs.map((run) =>
        run.id === event.runId ? { ...run, output: `${run.output}${event.payload ?? ""}` } : run
      )
    };
  }

  if (event.type === "started") {
    next = {
      ...next,
      runs: next.runs.map((run) => (run.id === event.runId ? { ...run, status: "running" } : run))
    };
  }

  if (event.type === "completed") {
    next = {
      ...next,
      runs: next.runs.map((run) => (run.id === event.runId ? { ...run, status: "completed" } : run))
    };
  }

  if (event.type === "failed") {
    next = {
      ...next,
      runs: next.runs.map((run) =>
        run.id === event.runId
          ? {
              ...run,
              status: "failed",
              error: event.payload ?? run.error
            }
          : run
      )
    };
  }

  if (event.type === "lifecycle" && event.payload) {
    next = {
      ...next,
      messages: [
        ...next.messages,
        {
          id: `lifecycle-${event.runId}-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
          sessionId: event.sessionId,
          role: "system",
          systemMessageType: "reasoning",
          content: event.payload,
          runId: event.runId,
          createdAt: new Date().toISOString()
        }
      ]
    };
  }

  return next;
}
