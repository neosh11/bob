import express, { type NextFunction, type Request, type Response } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import { ZodError } from "zod";

import type { AppContext } from "./appContext.js";
import { attachAuth } from "./auth/authMiddleware.js";
import { createHttpLogger } from "./logging/httpLogger.js";
import { createAuthRoutes } from "./modules/auth/routes.js";
import { createAgentSettingsRoutes } from "./modules/agentSettings/routes.js";
import { createHealthRoutes } from "./modules/health/routes.js";
import { createSessionRoutes } from "./modules/sessions/routes.js";
import { createWorkspaceRoutes } from "./modules/workspaces/routes.js";
import { isCorsOriginAllowed } from "./security/corsOriginPolicy.js";
import { createApiRateLimiter } from "./security/rateLimiter.js";

export function createApp(context: AppContext) {
  const app = express();

  app.use(
    cors({
      origin(origin, callback) {
        const allowed = isCorsOriginAllowed(origin, context.config);
        if (!allowed && origin) {
          context.logger.warn({ origin }, "Blocked CORS origin");
        }
        callback(null, allowed);
      },
      credentials: true
    })
  );
  app.use(createHttpLogger(context.logger));
  app.use(helmet());
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(createApiRateLimiter(context.config));
  app.use(attachAuth(context.config.cookieName, context.config.jwtSecret));

  app.use("/api", createHealthRoutes());
  app.use("/api", createAuthRoutes(context));
  app.use("/api", createAgentSettingsRoutes(context));
  app.use("/api", createWorkspaceRoutes(context));
  app.use("/api", createSessionRoutes(context));

  app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    if (error instanceof ZodError) {
      res.status(400).json({
        error: "Validation failed.",
        issues: error.issues
      });
      return;
    }

    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: "Internal server error." });
  });

  return app;
}
