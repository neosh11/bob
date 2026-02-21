import type { AgentEvent, AgentProvider, AgentRunInput } from "../types.js";
import { throwIfAborted } from "../errors.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MockAgentProvider implements AgentProvider {
  id = "mock";

  description = "Deterministic fallback provider for local smoke testing.";

  async run(input: AgentRunInput, onEvent: (event: AgentEvent) => void, options?: { signal?: AbortSignal }): Promise<void> {
    throwIfAborted(options?.signal);

    const chunks = [
      "I can run coding tasks through a pluggable command provider.\n\n",
      `Workspace: ${input.workspace}\n`,
      `Prompt received: ${input.prompt}\n\n`,
      "To connect a real coding engine, set BOB_AGENT_MODE=command and provide BOB_AGENT_COMMAND in .env."
    ];

    onEvent({ type: "status", value: "analyzing" });
    for (const chunk of chunks) {
      throwIfAborted(options?.signal);
      onEvent({ type: "delta", text: chunk });
      await sleep(80);
    }
  }
}
