import { describe, expect, it } from "vitest";

import {
  isCodexAuthRequiredError,
  isCodexResumeUnsupportedError,
  isCodexThreadMissingError,
  isCodexThreadNotMaterializedError
} from "../src/codex/errorMatchers.js";

describe("codex error matchers", () => {
  it("matches missing-thread style errors", () => {
    expect(isCodexThreadMissingError(new Error("thread not loaded: abc"))).toBe(true);
    expect(isCodexThreadMissingError(new Error("Thread not found"))).toBe(true);
    expect(isCodexThreadMissingError(new Error("no such thread"))).toBe(true);
    expect(isCodexThreadMissingError(new Error("no rollout found for thread id abc"))).toBe(true);
  });

  it("matches not-materialized thread/read errors", () => {
    expect(
      isCodexThreadNotMaterializedError(
        new Error("thread 019c... is not materialized yet; includeTurns is unavailable before first user message")
      )
    ).toBe(true);
  });

  it("matches codex auth required errors", () => {
    expect(isCodexAuthRequiredError(new Error("OpenAI auth required"))).toBe(true);
    expect(isCodexAuthRequiredError(new Error("authentication required"))).toBe(true);
    expect(isCodexAuthRequiredError(new Error("please login first"))).toBe(true);
  });

  it("matches thread/resume unsupported errors", () => {
    expect(isCodexResumeUnsupportedError(new Error("method not found: thread/resume"))).toBe(true);
    expect(isCodexResumeUnsupportedError(new Error("resume unsupported in this mode"))).toBe(true);
  });
});
