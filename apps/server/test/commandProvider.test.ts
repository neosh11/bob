import { afterEach, describe, expect, it } from "vitest";

import { CommandAgentProvider } from "../src/agent/providers/commandProvider.js";

const ORIGINAL_MODEL = process.env.BOB_CODEX_MODEL;
const ORIGINAL_REASONING = process.env.BOB_CODEX_REASONING_EFFORT;

afterEach(() => {
  if (ORIGINAL_MODEL === undefined) {
    delete process.env.BOB_CODEX_MODEL;
  } else {
    process.env.BOB_CODEX_MODEL = ORIGINAL_MODEL;
  }

  if (ORIGINAL_REASONING === undefined) {
    delete process.env.BOB_CODEX_REASONING_EFFORT;
  } else {
    process.env.BOB_CODEX_REASONING_EFFORT = ORIGINAL_REASONING;
  }
});

describe("command provider placeholder interpolation", () => {
  it("passes latest prompt via environment indirection without shell command substitution", async () => {
    const provider = new CommandAgentProvider(`printf '%s' "{{latestPrompt}}"`, 12, {
      model: "gpt-5-codex",
      reasoningEffort: "medium"
    });
    let output = "";

    await provider.run(
      {
        runId: "run-1",
        sessionId: "session-1",
        workspace: "/tmp",
        prompt: "`gpt-5.3-codex`",
        history: []
      },
      (event) => {
        if (event.type === "delta") {
          output += event.text;
        }
      }
    );

    expect(output).toBe("`gpt-5.3-codex`");
  });

  it("resolves model placeholders from current runtime settings", async () => {
    process.env.BOB_CODEX_MODEL = "gpt-5-codex";
    process.env.BOB_CODEX_REASONING_EFFORT = "high";

    const provider = new CommandAgentProvider(`printf '%s|%s' "{{model}}" "{{reasoningEffort}}"`, 12, {
      model: "fallback-model",
      reasoningEffort: "medium"
    });
    let output = "";

    await provider.run(
      {
        runId: "run-2",
        sessionId: "session-2",
        workspace: "/tmp",
        prompt: "check settings",
        history: []
      },
      (event) => {
        if (event.type === "delta") {
          output += event.text;
        }
      }
    );

    expect(output).toBe("gpt-5-codex|high");
  });
});
