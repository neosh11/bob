import type Database from "better-sqlite3";

import { MockAgentProvider } from "../src/agent/providers/mockProvider.js";
import { RunOrchestrator } from "../src/agent/runOrchestrator.js";
import type { AgentProvider } from "../src/agent/types.js";
import { createApp } from "../src/app.js";
import { AuditService } from "../src/audit/auditService.js";
import type { AppConfig } from "../src/config/env.js";
import { createDatabase } from "../src/db/connection.js";
import { createRepositories } from "../src/db/repositories/index.js";
import { applyMigrations } from "../src/db/migrations.js";
import { createLogger } from "../src/logging/logger.js";

const databases: Database.Database[] = [];
const orchestrators: RunOrchestrator[] = [];

export async function cleanupDatabases(): Promise<void> {
  await Promise.allSettled(orchestrators.map(async (orchestrator) => orchestrator.onIdle()));
  orchestrators.length = 0;

  while (databases.length > 0) {
    const db = databases.pop();
    db?.close();
  }
}

function buildConfig(overrides?: Partial<AppConfig>): AppConfig {
  const base: AppConfig = {
    nodeEnv: "test",
    host: "127.0.0.1",
    port: 4400,
    webOrigin: "http://localhost:5173",
    webOriginHostPrefixes: [],
    dbPath: ":memory:",
    jwtSecret: "test-secret-that-is-long-enough",
    jwtTtl: "7d",
    cookieName: "bob_session",
    sharedPassword: "super-secret-password",
    workspaces: [
      {
        id: "ws-1",
        label: "workspace",
        path: "/tmp"
      }
    ],
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
    rateLimitMaxRequests: 2_000,
    authRateLimitMaxRequests: 2_000
  };

  return {
    ...base,
    ...overrides,
    webOriginHostPrefixes: overrides?.webOriginHostPrefixes ?? base.webOriginHostPrefixes
  };
}

export async function buildTestApp(options?: {
  provider?: AgentProvider;
  configOverrides?: Partial<AppConfig>;
}) {
  const config = buildConfig(options?.configOverrides);
  const db = createDatabase(config.dbPath);
  databases.push(db);
  applyMigrations(db);

  const repos = createRepositories(db);
  const audit = new AuditService(repos.audit);

  const orchestrator = new RunOrchestrator({
    provider: options?.provider ?? new MockAgentProvider(),
    messages: repos.messages,
    runs: repos.runs,
    sessions: repos.sessions,
    maxConcurrency: config.maxConcurrentRuns,
    audit: (event) => {
      audit.log(event);
    },
    notify: () => {}
  });
  orchestrators.push(orchestrator);

  const app = createApp({ config, repos, orchestrator, codex: null, logger: createLogger("test"), audit });
  return { app, repos, config, orchestrator, audit };
}
