import http from "node:http";
import type net from "node:net";

import { createAgentProvider } from "./agent/providerFactory.js";
import { RunOrchestrator } from "./agent/runOrchestrator.js";
import { createApp } from "./app.js";
import { AuditService } from "./audit/auditService.js";
import { loadConfig } from "./config/env.js";
import { CodexService } from "./codex/service.js";
import { createDatabase } from "./db/connection.js";
import { applyMigrations } from "./db/migrations.js";
import { createRepositories } from "./db/repositories/index.js";
import { createLogger } from "./logging/logger.js";
import { createRealtimeGateway, type RealtimeGateway } from "./realtime/socketServer.js";

const config = loadConfig();
const logger = createLogger(config.nodeEnv);

const db = createDatabase(config.dbPath);
applyMigrations(db);

const repos = createRepositories(db);
const provider = createAgentProvider(config);
const audit = new AuditService(repos.audit);
let realtimeGateway: RealtimeGateway | null = null;
const codex =
  config.sessionsBackend === "app-server"
    ? new CodexService({
        config,
        logger,
        sessions: repos.sessions,
        onRunEvent: (userId, event) => {
          realtimeGateway?.emitRunEvent(userId, event);
        }
      })
    : null;

const orchestrator = new RunOrchestrator({
  provider,
  messages: repos.messages,
  runs: repos.runs,
  sessions: repos.sessions,
  maxConcurrency: config.maxConcurrentRuns,
  audit: (event) => {
    audit.log(event);
  },
  notify: (userId, event) => {
    realtimeGateway?.emitRunEvent(userId, event);
  }
});

const app = createApp({
  config,
  repos,
  orchestrator,
  codex,
  logger,
  audit
});
const server = http.createServer(app);
realtimeGateway = createRealtimeGateway(server, config);
const openConnections = new Set<net.Socket>();

server.on("connection", (socket) => {
  openConnections.add(socket);
  socket.on("close", () => {
    openConnections.delete(socket);
  });
});

server.listen(config.port, config.host, () => {
  logger.info({ host: config.host, port: config.port }, "Server listening");
  logger.info({ provider: provider.id, description: provider.description }, "Agent provider initialized");
});

let shutdownPromise: Promise<void> | null = null;
const shutdownTimeoutMs = 5_000;

function isServerAlreadyClosed(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string" &&
    (error as { code: string }).code === "ERR_SERVER_NOT_RUNNING"
  );
}

function destroyOpenConnections(): void {
  for (const socket of openConnections) {
    socket.destroy();
  }
  openConnections.clear();
}

function closeHttpServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error && !isServerAlreadyClosed(error)) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shutdownPromise) {
    return shutdownPromise;
  }

  logger.info({ signal }, "Shutting down");

  shutdownPromise = (async () => {
    const forceExitTimer = setTimeout(() => {
      logger.warn({ timeoutMs: shutdownTimeoutMs }, "Graceful shutdown timed out. Forcing exit.");
      destroyOpenConnections();
      server.closeAllConnections?.();
      process.exit(1);
    }, shutdownTimeoutMs);
    forceExitTimer.unref();

    try {
      server.closeIdleConnections?.();
      server.closeAllConnections?.();
      destroyOpenConnections();

      const realtimeClose = realtimeGateway
        ? realtimeGateway.close().catch((error) => {
            logger.warn({ error }, "Failed to close realtime gateway cleanly");
          })
        : Promise.resolve();

      const codexClose = codex
        ? codex.close().catch((error) => {
            logger.warn({ error }, "Failed to close codex app-server client cleanly");
          })
        : Promise.resolve();

      await Promise.all([closeHttpServer(), realtimeClose, codexClose]);

      db.close();
      clearTimeout(forceExitTimer);
      process.exit(0);
    } catch (error) {
      clearTimeout(forceExitTimer);
      logger.error({ error }, "Server shutdown failed");
      try {
        db.close();
      } catch (dbError) {
        logger.warn({ error: dbError }, "Database close failed during shutdown");
      }
      process.exit(1);
    }
  })();

  return shutdownPromise;
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
process.on("SIGUSR2", () => {
  void shutdown("SIGUSR2");
});
