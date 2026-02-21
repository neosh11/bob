import { spawn } from "node:child_process";

import { composePrompt, renderHistoryWindow } from "../promptComposer.js";
import type { AgentEvent, AgentProvider, AgentRunInput } from "../types.js";
import { RunCanceledError, throwIfAborted } from "../errors.js";

const PLACEHOLDER_PROMPT = "{{prompt}}";
const PLACEHOLDER_LATEST_PROMPT = "{{latestPrompt}}";
const PLACEHOLDER_HISTORY = "{{history}}";
const PLACEHOLDER_WORKSPACE = "{{workspace}}";
const PLACEHOLDER_SESSION = "{{sessionId}}";
const PLACEHOLDER_RUN = "{{runId}}";
const PLACEHOLDER_MODEL = "{{model}}";
const PLACEHOLDER_REASONING_EFFORT = "{{reasoningEffort}}";

const RUNTIME_PROMPT_ENV = "BOB_RUNTIME_PROMPT";
const RUNTIME_LATEST_PROMPT_ENV = "BOB_RUNTIME_LATEST_PROMPT";
const RUNTIME_HISTORY_ENV = "BOB_RUNTIME_HISTORY";
const RUNTIME_WORKSPACE_ENV = "BOB_RUNTIME_WORKSPACE";
const RUNTIME_SESSION_ENV = "BOB_RUNTIME_SESSION_ID";
const RUNTIME_RUN_ENV = "BOB_RUNTIME_RUN_ID";
const RUNTIME_MODEL_ENV = "BOB_RUNTIME_MODEL";
const RUNTIME_REASONING_EFFORT_ENV = "BOB_RUNTIME_REASONING_EFFORT";

function toShellEnvReference(envName: string): string {
  return `\${${envName}}`;
}

function renderCommand(template: string): string {
  return template
    .replaceAll(PLACEHOLDER_PROMPT, toShellEnvReference(RUNTIME_PROMPT_ENV))
    .replaceAll(PLACEHOLDER_LATEST_PROMPT, toShellEnvReference(RUNTIME_LATEST_PROMPT_ENV))
    .replaceAll(PLACEHOLDER_HISTORY, toShellEnvReference(RUNTIME_HISTORY_ENV))
    .replaceAll(PLACEHOLDER_WORKSPACE, toShellEnvReference(RUNTIME_WORKSPACE_ENV))
    .replaceAll(PLACEHOLDER_SESSION, toShellEnvReference(RUNTIME_SESSION_ENV))
    .replaceAll(PLACEHOLDER_RUN, toShellEnvReference(RUNTIME_RUN_ENV))
    .replaceAll(PLACEHOLDER_MODEL, toShellEnvReference(RUNTIME_MODEL_ENV))
    .replaceAll(PLACEHOLDER_REASONING_EFFORT, toShellEnvReference(RUNTIME_REASONING_EFFORT_ENV));
}

export class CommandAgentProvider implements AgentProvider {
  id = "command";

  description = "Executes a configured shell command and streams output.";

  constructor(
    private readonly commandTemplate: string,
    private readonly historyWindow: number,
    private readonly defaults: {
      model: string;
      reasoningEffort: "low" | "medium" | "high";
    }
  ) {}

  run(input: AgentRunInput, onEvent: (event: AgentEvent) => void, options?: { signal?: AbortSignal }): Promise<void> {
    return new Promise((resolve, reject) => {
      throwIfAborted(options?.signal);

      const historyText = renderHistoryWindow(input.history, this.historyWindow);
      const promptText = composePrompt({
        sessionId: input.sessionId,
        workspace: input.workspace,
        prompt: input.prompt,
        history: input.history,
        historyWindow: this.historyWindow
      });
      const command = renderCommand(this.commandTemplate);
      const runtimeModel = process.env.BOB_CODEX_MODEL ?? this.defaults.model;
      const runtimeReasoningEffort = process.env.BOB_CODEX_REASONING_EFFORT ?? this.defaults.reasoningEffort;
      onEvent({ type: "status", value: "running-command" });

      const child = spawn("bash", ["-lc", command], {
        cwd: input.workspace,
        env: {
          ...process.env,
          [RUNTIME_PROMPT_ENV]: promptText,
          [RUNTIME_LATEST_PROMPT_ENV]: input.prompt,
          [RUNTIME_HISTORY_ENV]: historyText,
          [RUNTIME_WORKSPACE_ENV]: input.workspace,
          [RUNTIME_SESSION_ENV]: input.sessionId,
          [RUNTIME_RUN_ENV]: input.runId,
          [RUNTIME_MODEL_ENV]: runtimeModel,
          [RUNTIME_REASONING_EFFORT_ENV]: runtimeReasoningEffort
        },
        stdio: ["ignore", "pipe", "pipe"]
      });

      child.stdout.on("data", (chunk: Buffer) => {
        onEvent({ type: "delta", text: chunk.toString("utf8") });
      });

      child.stderr.on("data", (chunk: Buffer) => {
        onEvent({ type: "stderr", text: chunk.toString("utf8") });
      });

      const abortHandler = () => {
        child.kill("SIGTERM");
        reject(new RunCanceledError());
      };

      options?.signal?.addEventListener("abort", abortHandler, { once: true });

      child.on("error", (error) => {
        options?.signal?.removeEventListener("abort", abortHandler);
        reject(error);
      });

      child.on("close", (code) => {
        options?.signal?.removeEventListener("abort", abortHandler);
        if (code === 0) {
          resolve();
          return;
        }

        reject(new Error(`Agent command exited with code ${code ?? "unknown"}`));
      });
    });
  }
}
