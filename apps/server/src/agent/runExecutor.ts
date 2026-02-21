import { isRunCanceledError, throwIfAborted } from "./errors.js";
import type { RunExecutionState, RunOrchestratorDependencies } from "./runOrchestratorTypes.js";

export class RunExecutor {
  constructor(private readonly deps: RunOrchestratorDependencies) {}

  async execute(input: RunExecutionState): Promise<void> {
    let assembled = "";

    try {
      throwIfAborted(input.controller.signal);

      this.deps.runs.updateRunStatus(input.runId, "running");
      this.deps.notify(input.userId, {
        runId: input.runId,
        sessionId: input.sessionId,
        type: "started"
      });

      await this.deps.provider.run(
        {
          runId: input.runId,
          sessionId: input.sessionId,
          workspace: input.workspace,
          prompt: input.prompt,
          history: input.history
        },
        (event) => {
          if (event.type === "delta") {
            assembled += event.text;
            this.deps.messages.updateMessageContent(input.assistantMessageId, assembled);
            this.deps.runs.appendOutput(input.runId, event.text);
            this.deps.notify(input.userId, {
              runId: input.runId,
              sessionId: input.sessionId,
              type: "delta",
              payload: event.text
            });
            return;
          }

          if (event.type === "stderr") {
            this.deps.runs.appendOutput(input.runId, event.text);
            this.deps.notify(input.userId, {
              runId: input.runId,
              sessionId: input.sessionId,
              type: "stderr",
              payload: event.text
            });
            return;
          }

          this.deps.notify(input.userId, {
            runId: input.runId,
            sessionId: input.sessionId,
            type: "delta",
            payload: `[status:${event.value}]\n`
          });
        },
        { signal: input.controller.signal }
      );

      this.deps.runs.updateRunStatus(input.runId, "completed");
      this.deps.sessions.touchUpdatedAt(input.sessionId);
      this.deps.notify(input.userId, {
        runId: input.runId,
        sessionId: input.sessionId,
        type: "completed"
      });
      this.deps.audit({
        eventType: "run.completed",
        targetType: "run",
        targetId: input.runId,
        outcome: "success",
        actor: {
          userId: input.userId
        },
        metadata: {
          sessionId: input.sessionId
        }
      });
    } catch (error) {
      if (isRunCanceledError(error)) {
        this.markCanceled(input, assembled ? null : "Run canceled by user.");
        return;
      }

      const message = error instanceof Error ? error.message : "Unknown run failure";
      this.deps.runs.updateRunStatus(input.runId, "failed", message);

      if (!assembled) {
        const fallbackText = `Run failed: ${message}`;
        this.deps.messages.updateMessageContent(input.assistantMessageId, fallbackText);
      }

      this.deps.notify(input.userId, {
        runId: input.runId,
        sessionId: input.sessionId,
        type: "failed",
        payload: message
      });
      this.deps.audit({
        eventType: "run.failed",
        targetType: "run",
        targetId: input.runId,
        outcome: "failure",
        actor: {
          userId: input.userId
        },
        metadata: {
          sessionId: input.sessionId,
          error: message
        }
      });
    }
  }

  markCanceled(input: RunExecutionState, fallbackMessage: string | null): void {
    const cancelMessage = "Run canceled by user.";
    this.deps.runs.updateRunStatus(input.runId, "failed", cancelMessage);

    if (fallbackMessage) {
      this.deps.messages.updateMessageContent(input.assistantMessageId, fallbackMessage);
    }

    this.deps.sessions.touchUpdatedAt(input.sessionId);
    this.deps.notify(input.userId, {
      runId: input.runId,
      sessionId: input.sessionId,
      type: "failed",
      payload: cancelMessage
    });
    this.deps.audit({
      eventType: "run.canceled",
      targetType: "run",
      targetId: input.runId,
      outcome: "success",
      actor: {
        userId: input.userId
      },
      metadata: {
        sessionId: input.sessionId
      }
    });
  }
}
