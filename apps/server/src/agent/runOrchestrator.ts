import PQueue from "p-queue";

import type { MessageRecord, RunRecord } from "../types/domain.js";

import { RunExecutor } from "./runExecutor.js";
import type { CancelRunResult, RunExecutionState, RunOrchestratorDependencies } from "./runOrchestratorTypes.js";

export type { CancelRunResult, RunOrchestratorDependencies } from "./runOrchestratorTypes.js";

export class RunOrchestrator {
  private readonly queue: PQueue;

  private readonly executor: RunExecutor;

  private readonly activeRuns = new Map<string, RunExecutionState>();

  private readonly queuedRuns = new Map<string, RunExecutionState>();

  private readonly terminalRuns = new Set<string>();

  constructor(private readonly deps: RunOrchestratorDependencies) {
    this.queue = new PQueue({ concurrency: deps.maxConcurrency });
    this.executor = new RunExecutor(deps);
  }

  queueRun(input: {
    userId: string;
    sessionId: string;
    workspace: string;
    prompt: string;
    history: MessageRecord[];
  }): { run: RunRecord; assistantMessage: MessageRecord } {
    const run = this.deps.runs.createRun({
      sessionId: input.sessionId,
      provider: this.deps.provider.id
    });

    const assistantMessage = this.deps.messages.createMessage({
      sessionId: input.sessionId,
      role: "assistant",
      content: "",
      runId: run.id
    });

    const executionState: RunExecutionState = {
      ...input,
      runId: run.id,
      assistantMessageId: assistantMessage.id,
      controller: new AbortController()
    };

    this.queuedRuns.set(run.id, executionState);

    this.deps.notify(input.userId, {
      runId: run.id,
      sessionId: input.sessionId,
      type: "queued"
    });
    this.deps.audit({
      eventType: "run.queued",
      targetType: "run",
      targetId: run.id,
      outcome: "success",
      actor: {
        userId: input.userId
      },
      metadata: {
        sessionId: input.sessionId
      }
    });

    this.deps.sessions.touchUpdatedAt(input.sessionId);

    void this.queue.add(async () => {
      await this.executeQueuedRun(run.id);
    });

    return { run, assistantMessage };
  }

  cancelRun(input: { userId: string; sessionId: string; runId: string }): CancelRunResult {
    const existingRun = this.deps.runs.findByIdForSession(input.runId, input.sessionId);
    if (!existingRun) {
      return "not-found";
    }

    if (existingRun.status === "completed" || existingRun.status === "failed") {
      return "not-active";
    }

    const activeRun = this.activeRuns.get(input.runId);
    if (activeRun) {
      activeRun.controller.abort();
      return "requested";
    }

    const queuedRun = this.queuedRuns.get(input.runId);
    if (queuedRun) {
      this.queuedRuns.delete(input.runId);
      this.terminalRuns.add(input.runId);
      queuedRun.controller.abort();
      this.executor.markCanceled(queuedRun, "Run canceled before execution.");
      return "requested";
    }

    return "not-active";
  }

  cancelRunsForSession(input: { userId: string; sessionId: string }): number {
    const runs = this.deps.runs.listBySession(input.sessionId);
    let requested = 0;

    for (const run of runs) {
      if (run.status !== "queued" && run.status !== "running") {
        continue;
      }

      const result = this.cancelRun({
        userId: input.userId,
        sessionId: input.sessionId,
        runId: run.id
      });

      if (result === "requested") {
        requested += 1;
      }
    }

    return requested;
  }

  onIdle(): Promise<void> {
    return this.queue.onIdle();
  }

  private async executeQueuedRun(runId: string): Promise<void> {
    const state = this.queuedRuns.get(runId);
    if (!state) {
      return;
    }

    this.queuedRuns.delete(runId);

    if (this.terminalRuns.has(runId)) {
      this.terminalRuns.delete(runId);
      return;
    }

    this.activeRuns.set(runId, state);
    try {
      await this.executor.execute(state);
    } finally {
      this.activeRuns.delete(runId);
      this.terminalRuns.delete(runId);
    }
  }
}
