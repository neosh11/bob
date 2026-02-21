import process from "node:process";

import { Router } from "express";
import { z } from "zod";

import type { AppContext } from "../../appContext.js";
import { requireAuth } from "../../auth/authMiddleware.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const settingsSchema = z.object({
  model: z.string().trim().min(1).max(120),
  reasoningEffort: z.enum(["low", "medium", "high"])
});

function resolveRuntimeSettings(context: AppContext): { model: string; reasoningEffort: "low" | "medium" | "high" } {
  const model = process.env.BOB_CODEX_MODEL ?? context.config.codexModel;
  const reasoningEffortRaw = process.env.BOB_CODEX_REASONING_EFFORT ?? context.config.codexReasoningEffort;
  const reasoningEffort = settingsSchema.shape.reasoningEffort.parse(reasoningEffortRaw);
  return { model, reasoningEffort };
}

export function createAgentSettingsRoutes(context: AppContext): Router {
  const router = Router();

  router.get(
    "/agent/settings",
    requireAuth,
    asyncHandler(async (_req, res) => {
      res.json({ settings: resolveRuntimeSettings(context) });
    })
  );

  router.put(
    "/agent/settings",
    requireAuth,
    asyncHandler(async (req, res) => {
      const payload = settingsSchema.parse(req.body);
      process.env.BOB_CODEX_MODEL = payload.model;
      process.env.BOB_CODEX_REASONING_EFFORT = payload.reasoningEffort;

      context.audit.logFromRequest(req, {
        eventType: "agent.settings.update",
        targetType: "system",
        outcome: "success",
        metadata: payload
      });

      res.json({ settings: resolveRuntimeSettings(context) });
    })
  );

  return router;
}
