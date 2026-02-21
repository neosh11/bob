import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  BOB_HOST: z.string().default("0.0.0.0"),
  BOB_PORT: z.coerce.number().int().positive().default(4000),
  BOB_WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  BOB_WEB_ORIGIN_HOST_PREFIXES: z.string().default(""),
  BOB_DB_PATH: z.string().default("apps/server/data/bob.sqlite"),
  BOB_JWT_SECRET: z.string().min(16).optional(),
  BOB_JWT_TTL: z.string().default("7d"),
  BOB_COOKIE_NAME: z.string().default("bob_session"),
  BOB_SHARED_PASSWORD: z.string().min(10),
  BOB_WORKSPACES: z.string().default(process.cwd()),
  BOB_AGENT_MODE: z.enum(["auto", "command", "mock"]).default("auto"),
  BOB_AGENT_COMMAND: z.string().optional(),
  BOB_CODEX_MODEL: z.string().default("gpt-5-codex"),
  BOB_CODEX_REASONING_EFFORT: z.enum(["low", "medium", "high"]).default("medium"),
  BOB_SESSIONS_BACKEND: z.enum(["legacy", "app-server"]).default("app-server"),
  BOB_CODEX_BIN: z.string().default("codex"),
  BOB_CODEX_APP_SERVER_LISTEN: z.string().default("ws://127.0.0.1:8787"),
  BOB_CODEX_APPROVAL_POLICY: z.enum(["untrusted", "on-request", "never"]).default("never"),
  BOB_CODEX_SANDBOX_MODE: z.enum(["read-only", "workspace-write", "danger-full-access"]).default("danger-full-access"),
  BOB_AGENT_HISTORY_WINDOW: z.coerce.number().int().min(2).max(40).default(12),
  BOB_MAX_CONCURRENT_RUNS: z.coerce.number().int().positive().max(32).default(2),
  BOB_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  BOB_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(120),
  BOB_AUTH_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(20)
});

export interface WorkspaceSetting {
  id: string;
  label: string;
  path: string;
}

export interface AppConfig {
  nodeEnv: "development" | "test" | "production";
  host: string;
  port: number;
  webOrigin: string;
  webOriginHostPrefixes: string[];
  dbPath: string;
  jwtSecret: string;
  jwtTtl: string;
  cookieName: string;
  sharedPassword: string;
  workspaces: WorkspaceSetting[];
  agentMode: "auto" | "command" | "mock";
  agentCommand?: string;
  codexModel: string;
  codexReasoningEffort: "low" | "medium" | "high";
  sessionsBackend: "legacy" | "app-server";
  codexBin: string;
  codexAppServerListen: string;
  codexApprovalPolicy: "untrusted" | "on-request" | "never";
  codexSandboxMode: "read-only" | "workspace-write" | "danger-full-access";
  agentHistoryWindow: number;
  maxConcurrentRuns: number;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  authRateLimitMaxRequests: number;
}

function parseOriginHostPrefixes(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => value.replace(/\*+$/u, ""))
        .filter(Boolean)
    )
  );
}

function getDevJwtSecret(): string {
  return "bob-dev-secret-change-me";
}

function parseWorkspaces(raw: string): WorkspaceSetting[] {
  const uniquePaths = Array.from(
    new Set(
      raw
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
        .map((workspacePath) => path.resolve(workspacePath))
    )
  );

  return uniquePaths.map((workspacePath, index) => ({
    id: `ws-${index + 1}`,
    label: path.basename(workspacePath) || workspacePath,
    path: workspacePath
  }));
}

let envHydrated = false;

function hydrateProcessEnv(): void {
  if (envHydrated) {
    return;
  }

  const cwd = process.cwd();
  const candidateDirs = [cwd, path.resolve(cwd, ".."), path.resolve(cwd, "..", "..")];
  const candidateFiles = [".env.local", ".env"];
  const visited = new Set<string>();

  for (const dir of candidateDirs) {
    for (const filename of candidateFiles) {
      const filePath = path.resolve(dir, filename);
      if (visited.has(filePath) || !fs.existsSync(filePath)) {
        continue;
      }

      dotenv.config({
        path: filePath,
        override: false
      });
      visited.add(filePath);
    }
  }

  envHydrated = true;
}

export function loadConfig(): AppConfig {
  hydrateProcessEnv();
  const parsed = envSchema.parse(process.env);
  const jwtSecret = parsed.BOB_JWT_SECRET ?? getDevJwtSecret();

  if (!parsed.BOB_JWT_SECRET && parsed.NODE_ENV === "production") {
    throw new Error("BOB_JWT_SECRET is required in production.");
  }

  return {
    nodeEnv: parsed.NODE_ENV,
    host: parsed.BOB_HOST,
    port: parsed.BOB_PORT,
    webOrigin: parsed.BOB_WEB_ORIGIN,
    webOriginHostPrefixes: parseOriginHostPrefixes(parsed.BOB_WEB_ORIGIN_HOST_PREFIXES),
    dbPath: path.resolve(parsed.BOB_DB_PATH),
    jwtSecret,
    jwtTtl: parsed.BOB_JWT_TTL,
    cookieName: parsed.BOB_COOKIE_NAME,
    sharedPassword: parsed.BOB_SHARED_PASSWORD,
    workspaces: parseWorkspaces(parsed.BOB_WORKSPACES),
    agentMode: parsed.BOB_AGENT_MODE,
    agentCommand: parsed.BOB_AGENT_COMMAND,
    codexModel: parsed.BOB_CODEX_MODEL,
    codexReasoningEffort: parsed.BOB_CODEX_REASONING_EFFORT,
    sessionsBackend: parsed.BOB_SESSIONS_BACKEND,
    codexBin: parsed.BOB_CODEX_BIN,
    codexAppServerListen: parsed.BOB_CODEX_APP_SERVER_LISTEN,
    codexApprovalPolicy: parsed.BOB_CODEX_APPROVAL_POLICY,
    codexSandboxMode: parsed.BOB_CODEX_SANDBOX_MODE,
    agentHistoryWindow: parsed.BOB_AGENT_HISTORY_WINDOW,
    maxConcurrentRuns: parsed.BOB_MAX_CONCURRENT_RUNS,
    rateLimitWindowMs: parsed.BOB_RATE_LIMIT_WINDOW_MS,
    rateLimitMaxRequests: parsed.BOB_RATE_LIMIT_MAX_REQUESTS,
    authRateLimitMaxRequests: parsed.BOB_AUTH_RATE_LIMIT_MAX_REQUESTS
  };
}
