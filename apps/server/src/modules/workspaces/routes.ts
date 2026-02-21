import { Router } from "express";

import type { AppContext } from "../../appContext.js";
import { requireAuth } from "../../auth/authMiddleware.js";

export function createWorkspaceRoutes(context: AppContext): Router {
  const router = Router();

  router.get("/workspaces", requireAuth, (_req, res) => {
    res.json({ workspaces: context.config.workspaces });
  });

  return router;
}
