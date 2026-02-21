import type { Logger } from "pino";

import type { AppConfig } from "../config/env.js";
import type { SessionRepository } from "../db/repositories/sessionRepository.js";
import type { MessageRecord, RunRecord, SessionRecord } from "../types/domain.js";
import type { RunNotification } from "../agent/types.js";

import { CodexJsonRpcClient } from "./jsonRpcClient.js";
import { isCodexResumeUnsupportedError, isCodexThreadMissingError, isCodexThreadNotMaterializedError } from "./errorMatchers.js";
import { mapThreadToMessagesAndRuns } from "./threadMapper.js";
import type {
  AccountLoginCompletedNotification,
  AccountResponse,
  AgentMessageDeltaNotification,
  CodexThread,
  CommandOutputDeltaNotification,
  ItemStartedNotification,
  LoginAccountResponse,
  ThreadForkResponse,
  ThreadListResponse,
  ThreadReadResponse,
  ThreadResumeResponse,
  ThreadStartResponse,
  ItemCompletedNotification,
  TurnCompletedNotification,
  TurnStartResponse,
  TurnStartedNotification
} from "./protocol.js";

function toIsoFromSeconds(seconds: number): string {
  return new Date(seconds * 1000).toISOString();
}

function toTurnInput(content: string) {
  return [
    {
      type: "text" as const,
      text: content,
      text_elements: []
    }
  ];
}

function toRunNotificationFromCompletion(params: TurnCompletedNotification): RunNotification {
  const status = params.turn.status;
  if (status === "completed") {
    return {
      runId: params.turn.id,
      sessionId: params.threadId,
      type: "completed"
    };
  }

  return {
    runId: params.turn.id,
    sessionId: params.threadId,
    type: "failed",
    payload: params.turn.error?.message ?? (status === "interrupted" ? "Run interrupted." : "Run failed.")
  };
}

export interface CodexSessionDetail {
  session: SessionRecord;
  messages: MessageRecord[];
  runs: RunRecord[];
}

interface CodexServiceOptions {
  config: AppConfig;
  logger: Logger;
  sessions: SessionRepository;
  onRunEvent: (userId: string, event: RunNotification) => void;
}

export class CodexService {
  private readonly client: CodexJsonRpcClient;

  private readonly loginCompletionListeners = new Set<(event: AccountLoginCompletedNotification) => void>();

  private readonly activeTurnsByThread = new Map<string, Set<string>>();

  private readonly seenAgentDeltaByTurn = new Set<string>();

  private readonly seenCommandDeltaByTurn = new Set<string>();

  private readonly resumedThreadIds = new Set<string>();

  constructor(private readonly options: CodexServiceOptions) {
    this.client = new CodexJsonRpcClient({
      codexBin: options.config.codexBin,
      listenUrl: options.config.codexAppServerListen,
      logger: options.logger
    });

    this.client.onNotification((method, params) => {
      this.handleNotification(method, params);
    });
  }

  async close(): Promise<void> {
    await this.client.close();
  }

  onLoginCompleted(listener: (event: AccountLoginCompletedNotification) => void): () => void {
    this.loginCompletionListeners.add(listener);
    return () => {
      this.loginCompletionListeners.delete(listener);
    };
  }

  async listThreads(): Promise<Map<string, CodexThread>> {
    const byId = new Map<string, CodexThread>();
    let cursor: string | null = null;

    do {
      const response: ThreadListResponse = await this.client.request("thread/list", {
        cursor,
        limit: 200,
        archived: false
      });
      for (const thread of response.data) {
        byId.set(thread.id, thread);
      }
      cursor = response.nextCursor;
    } while (cursor);

    return byId;
  }

  async startThread(input: { title: string; workspace: string }): Promise<SessionRecord> {
    const response = await this.client.request<ThreadStartResponse>("thread/start", {
      cwd: input.workspace,
      model: process.env.BOB_CODEX_MODEL ?? this.options.config.codexModel,
      approvalPolicy: this.options.config.codexApprovalPolicy,
      sandbox: this.options.config.codexSandboxMode,
      experimentalRawEvents: false,
      persistExtendedHistory: false
    });

    await this.client.request<Record<string, never>>("thread/name/set", {
      threadId: response.thread.id,
      name: input.title
    });

    return {
      id: response.thread.id,
      ownerUserId: "",
      title: input.title,
      workspace: response.thread.cwd,
      createdAt: toIsoFromSeconds(response.thread.createdAt),
      updatedAt: toIsoFromSeconds(response.thread.updatedAt)
    };
  }

  async forkThread(input: { threadId: string; title?: string }): Promise<SessionRecord> {
    const response = await this.client.request<ThreadForkResponse>("thread/fork", {
      threadId: input.threadId
    });

    const title = input.title?.trim() || `Fork of ${input.threadId}`;
    await this.client.request<Record<string, never>>("thread/name/set", {
      threadId: response.thread.id,
      name: title
    });

    return {
      id: response.thread.id,
      ownerUserId: "",
      title,
      workspace: response.thread.cwd,
      createdAt: toIsoFromSeconds(response.thread.createdAt),
      updatedAt: toIsoFromSeconds(response.thread.updatedAt)
    };
  }

  async readSession(session: SessionRecord): Promise<CodexSessionDetail> {
    await this.resumeThreadIfSupported(session.id);

    let response: ThreadReadResponse;
    let messages: MessageRecord[];
    let runs: RunRecord[];

    try {
      response = await this.client.request<ThreadReadResponse>("thread/read", {
        threadId: session.id,
        includeTurns: true
      });
      ({ messages, runs } = mapThreadToMessagesAndRuns(response.thread));
      runs = runs.map((run) => this.toLiveRunStatus(run));
    } catch (error) {
      if (!isCodexThreadNotMaterializedError(error)) {
        throw error;
      }

      response = await this.client.request<ThreadReadResponse>("thread/read", {
        threadId: session.id,
        includeTurns: false
      });
      messages = [];
      runs = [];
    }

    const mergedSession: SessionRecord = {
      ...session,
      workspace: response.thread.cwd,
      updatedAt: toIsoFromSeconds(response.thread.updatedAt)
    };

    return {
      session: mergedSession,
      messages,
      runs: runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    };
  }

  async startTurn(input: { session: SessionRecord; content: string }): Promise<{
    userMessage: MessageRecord;
    assistantMessage: MessageRecord;
    run: RunRecord;
  }> {
    await this.resumeThreadIfSupported(input.session.id);

    const turnResponse = await this.client.request<TurnStartResponse>("turn/start", {
      threadId: input.session.id,
      input: toTurnInput(input.content),
      model: process.env.BOB_CODEX_MODEL ?? this.options.config.codexModel,
      effort: process.env.BOB_CODEX_REASONING_EFFORT ?? this.options.config.codexReasoningEffort,
      approvalPolicy: this.options.config.codexApprovalPolicy,
      cwd: input.session.workspace
    });

    const now = new Date().toISOString();
    const runStatus = turnResponse.turn.status === "inProgress" ? "running" : turnResponse.turn.status === "completed" ? "completed" : "failed";
    const runError =
      runStatus === "failed"
        ? turnResponse.turn.error?.message ?? (turnResponse.turn.status === "interrupted" ? "Run interrupted." : "Run failed.")
        : null;

    const run: RunRecord = {
      id: turnResponse.turn.id,
      sessionId: input.session.id,
      provider: "codex-app-server",
      status: runStatus,
      output: "",
      error: runError,
      createdAt: now,
      startedAt: now,
      finishedAt: runStatus === "running" ? null : now
    };

    if (run.status !== "failed") {
      this.markTurnActive(input.session.id, turnResponse.turn.id);
    }

    return {
      userMessage: {
        id: `user-${turnResponse.turn.id}`,
        sessionId: input.session.id,
        role: "user",
        content: input.content,
        runId: null,
        createdAt: now
      },
      assistantMessage: {
        id: `assistant-${turnResponse.turn.id}`,
        sessionId: input.session.id,
        role: "assistant",
        content: "",
        runId: turnResponse.turn.id,
        createdAt: now
      },
      run
    };
  }

  async interruptTurn(input: { threadId: string; turnId: string }): Promise<void> {
    await this.client.request<Record<string, never>>("turn/interrupt", input);
  }

  async steerTurn(input: { threadId: string; turnId: string; content: string }): Promise<void> {
    await this.client.request<Record<string, never>>("turn/steer", {
      threadId: input.threadId,
      expectedTurnId: input.turnId,
      input: toTurnInput(input.content)
    });
  }

  async archiveThread(threadId: string): Promise<void> {
    await this.client.request<Record<string, never>>("thread/archive", { threadId });
  }

  async loginWithChatGpt(): Promise<LoginAccountResponse> {
    return this.client.request<LoginAccountResponse>("account/login/start", { type: "chatgpt" });
  }

  async cancelLogin(loginId: string): Promise<void> {
    await this.client.request<Record<string, never>>("account/login/cancel", { loginId });
  }

  async getAccount(): Promise<AccountResponse> {
    return this.client.request<AccountResponse>("account/read", { refreshToken: false });
  }

  async logoutAccount(): Promise<void> {
    await this.client.request<Record<string, never>>("account/logout", undefined);
  }

  private handleNotification(method: string, params: unknown): void {
    if (!params || typeof params !== "object") {
      return;
    }

    if (method === "item/agentMessage/delta") {
      const payload = params as AgentMessageDeltaNotification;
      this.seenAgentDeltaByTurn.add(this.turnKey(payload.threadId, payload.turnId));
      this.emitToSessionOwner(payload.threadId, {
        runId: payload.turnId,
        sessionId: payload.threadId,
        type: "delta",
        payload: payload.delta
      });
      return;
    }

    if (method === "item/commandExecution/outputDelta") {
      const payload = params as CommandOutputDeltaNotification;
      this.seenCommandDeltaByTurn.add(this.turnKey(payload.threadId, payload.turnId));
      this.emitToSessionOwner(payload.threadId, {
        runId: payload.turnId,
        sessionId: payload.threadId,
        type: "stderr",
        payload: payload.delta
      });
      return;
    }

    if (method === "item/started") {
      const payload = params as ItemStartedNotification;
      if (!payload.threadId || !payload.turnId || !payload.item) {
        return;
      }

      this.emitToSessionOwner(payload.threadId, {
        runId: payload.turnId,
        sessionId: payload.threadId,
        type: "lifecycle",
        payload: `Started ${payload.item.type}`
      });
      return;
    }

    if (method === "item/completed") {
      const payload = params as ItemCompletedNotification;
      if (!payload.threadId || !payload.turnId || !payload.item) {
        return;
      }

      if (payload.item.type === "agentMessage" && "text" in payload.item && payload.item.text) {
        const key = this.turnKey(payload.threadId, payload.turnId);
        if (!this.seenAgentDeltaByTurn.has(key)) {
          this.emitToSessionOwner(payload.threadId, {
            runId: payload.turnId,
            sessionId: payload.threadId,
            type: "delta",
            payload: payload.item.text
          });
        }
        this.emitToSessionOwner(payload.threadId, {
          runId: payload.turnId,
          sessionId: payload.threadId,
          type: "lifecycle",
          payload: "Completed agent output"
        });
        return;
      }

      if (
        payload.item.type === "commandExecution" &&
        "aggregatedOutput" in payload.item &&
        payload.item.aggregatedOutput
      ) {
        const key = this.turnKey(payload.threadId, payload.turnId);
        if (!this.seenCommandDeltaByTurn.has(key)) {
          this.emitToSessionOwner(payload.threadId, {
            runId: payload.turnId,
            sessionId: payload.threadId,
            type: "stderr",
            payload: payload.item.aggregatedOutput
          });
        }
        this.emitToSessionOwner(payload.threadId, {
          runId: payload.turnId,
          sessionId: payload.threadId,
          type: "lifecycle",
          payload: "Completed command execution"
        });
        return;
      }

      this.emitToSessionOwner(payload.threadId, {
        runId: payload.turnId,
        sessionId: payload.threadId,
        type: "lifecycle",
        payload: `Completed ${payload.item.type}`
      });
      return;
    }

    if (method === "turn/started") {
      const payload = params as TurnStartedNotification;
      this.markTurnActive(payload.threadId, payload.turn.id);
      this.emitToSessionOwner(payload.threadId, {
        runId: payload.turn.id,
        sessionId: payload.threadId,
        type: "lifecycle",
        payload: "Turn started"
      });
      this.emitToSessionOwner(payload.threadId, {
        runId: payload.turn.id,
        sessionId: payload.threadId,
        type: "started"
      });
      return;
    }

    if (method === "turn/completed") {
      const payload = params as TurnCompletedNotification;
      this.markTurnCompleted(payload.threadId, payload.turn.id);
      const key = this.turnKey(payload.threadId, payload.turn.id);
      this.seenAgentDeltaByTurn.delete(key);
      this.seenCommandDeltaByTurn.delete(key);
      this.emitToSessionOwner(payload.threadId, {
        runId: payload.turn.id,
        sessionId: payload.threadId,
        type: "lifecycle",
        payload: `Turn ${payload.turn.status}`
      });
      this.emitToSessionOwner(payload.threadId, toRunNotificationFromCompletion(payload));
      return;
    }

    if (method === "account/login/completed") {
      const payload = params as AccountLoginCompletedNotification;
      for (const listener of this.loginCompletionListeners) {
        listener(payload);
      }
    }
  }

  private emitToSessionOwner(sessionId: string, event: RunNotification): void {
    const session = this.options.sessions.findById(sessionId);
    if (!session) {
      return;
    }

    this.options.onRunEvent(session.ownerUserId, event);
  }

  private markTurnActive(threadId: string, turnId: string): void {
    const turns = this.activeTurnsByThread.get(threadId) ?? new Set<string>();
    turns.add(turnId);
    this.activeTurnsByThread.set(threadId, turns);
  }

  private markTurnCompleted(threadId: string, turnId: string): void {
    const turns = this.activeTurnsByThread.get(threadId);
    if (!turns) {
      return;
    }

    turns.delete(turnId);
    if (turns.size === 0) {
      this.activeTurnsByThread.delete(threadId);
    }
  }

  private toLiveRunStatus(run: RunRecord): RunRecord {
    const turns = this.activeTurnsByThread.get(run.sessionId);
    if (!turns?.has(run.id)) {
      return run;
    }

    return {
      ...run,
      status: "running",
      finishedAt: null,
      error: null
    };
  }

  private turnKey(threadId: string, turnId: string): string {
    return `${threadId}:${turnId}`;
  }

  private async resumeThreadIfSupported(threadId: string): Promise<void> {
    if (this.resumedThreadIds.has(threadId)) {
      return;
    }

    try {
      await this.client.request<ThreadResumeResponse>("thread/resume", {
        threadId
      });
      this.resumedThreadIds.add(threadId);
    } catch (error) {
      if (isCodexResumeUnsupportedError(error) || isCodexThreadMissingError(error) || isCodexThreadNotMaterializedError(error)) {
        this.resumedThreadIds.add(threadId);
        return;
      }

      throw error;
    }
  }
}
