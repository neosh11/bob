import { describe, expect, it } from "vitest";

import type { AppConfig } from "../src/config/env.js";
import { isCorsOriginAllowed } from "../src/security/corsOriginPolicy.js";

function buildConfig(overrides?: Partial<AppConfig>): AppConfig {
  const base: AppConfig = {
    nodeEnv: "test",
    host: "127.0.0.1",
    port: 4000,
    webOrigin: "http://localhost:5173",
    webOriginHostPrefixes: [],
    dbPath: ":memory:",
    jwtSecret: "test-secret-that-is-long-enough",
    jwtTtl: "7d",
    cookieName: "bob_session",
    sharedPassword: "super-secret-password",
    workspaces: [],
    agentMode: "mock",
    codexModel: "gpt-5-codex",
    codexReasoningEffort: "medium",
    sessionsBackend: "legacy",
    codexBin: "codex",
    codexAppServerListen: "ws://127.0.0.1:8787",
    codexApprovalPolicy: "never",
    codexSandboxMode: "danger-full-access",
    agentHistoryWindow: 12,
    maxConcurrentRuns: 2,
    rateLimitWindowMs: 60_000,
    rateLimitMaxRequests: 120,
    authRateLimitMaxRequests: 20
  };

  return {
    ...base,
    ...overrides,
    webOriginHostPrefixes: overrides?.webOriginHostPrefixes ?? base.webOriginHostPrefixes
  };
}

describe("cors origin policy", () => {
  it("allows requests without an origin header", () => {
    const config = buildConfig();
    expect(isCorsOriginAllowed(undefined, config)).toBe(true);
  });

  it("allows only exact origin when prefix policy is empty", () => {
    const config = buildConfig();
    expect(isCorsOriginAllowed("http://localhost:5173", config)).toBe(true);
    expect(isCorsOriginAllowed("http://192.168.1.17:5173", config)).toBe(false);
  });

  it("allows only configured hostname prefixes when prefix policy is set", () => {
    const config = buildConfig({
      webOriginHostPrefixes: ["100"]
    });

    expect(isCorsOriginAllowed("http://100.112.182.79:5173", config)).toBe(true);
    expect(isCorsOriginAllowed("http://localhost:5173", config)).toBe(false);
    expect(isCorsOriginAllowed("http://192.168.1.17:5173", config)).toBe(false);
  });
});
