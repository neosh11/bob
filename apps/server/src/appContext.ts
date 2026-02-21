import type { AppConfig } from "./config/env.js";
import type { Repositories } from "./db/repositories/index.js";
import type { RunOrchestrator } from "./agent/runOrchestrator.js";
import type { Logger } from "pino";
import type { AuditService } from "./audit/auditService.js";
import type { CodexService } from "./codex/service.js";

export interface AppContext {
  config: AppConfig;
  repos: Repositories;
  orchestrator: RunOrchestrator;
  codex: CodexService | null;
  logger: Logger;
  audit: AuditService;
}
