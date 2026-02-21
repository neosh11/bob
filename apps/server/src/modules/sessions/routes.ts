import type { Router } from "express";

import type { AppContext } from "../../appContext.js";

import { createAppServerSessionRoutes } from "./appServerRoutes.js";
import { createLegacySessionRoutes } from "./legacyRoutes.js";

export function createSessionRoutes(context: AppContext): Router {
  if (context.config.sessionsBackend === "app-server") {
    return createAppServerSessionRoutes(context);
  }

  return createLegacySessionRoutes(context);
}
