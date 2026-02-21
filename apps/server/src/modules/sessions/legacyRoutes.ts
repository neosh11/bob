import { Router } from "express";
import { z } from "zod";

import type { AppContext } from "../../appContext.js";
import { requireAuth } from "../../auth/authMiddleware.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { parseRouteParam, resolveOwnedSession } from "./sessionAccess.js";

const createSessionSchema = z.object({
  title: z.string().trim().min(1).max(120),
  workspace: z.string().trim().min(1)
});

const createMessageSchema = z.object({
  content: z.string().trim().min(1).max(20_000)
});

export function createLegacySessionRoutes(context: AppContext): Router {
  const router = Router();

  router.get(
    "/sessions",
    requireAuth,
    asyncHandler(async (req, res) => {
      const sessions = context.repos.sessions.listByOwner(req.auth!.userId);
      res.json({ sessions });
    })
  );

  router.post(
    "/sessions",
    requireAuth,
    asyncHandler(async (req, res) => {
      const payload = createSessionSchema.parse(req.body);

      const workspaceExists = context.config.workspaces.some((workspace) => workspace.path === payload.workspace);
      if (!workspaceExists) {
        res.status(400).json({ error: "Workspace is not allowed." });
        return;
      }

      const session = context.repos.sessions.createSession({
        ownerUserId: req.auth!.userId,
        title: payload.title,
        workspace: payload.workspace
      });
      context.audit.logFromRequest(req, {
        eventType: "session.create",
        targetType: "session",
        targetId: session.id,
        outcome: "success",
        metadata: { workspace: payload.workspace }
      });

      res.status(201).json({ session });
    })
  );

  router.get(
    "/sessions/:sessionId",
    requireAuth,
    asyncHandler(async (req, res) => {
      const sessionId = parseRouteParam(req.params.sessionId);
      const session = resolveOwnedSession(context, sessionId, req.auth!.userId, res);
      if (!session) return;

      const messages = context.repos.messages.listBySession(session.id);
      const runs = context.repos.runs.listBySession(session.id);
      res.json({ session, messages, runs });
    })
  );

  router.delete(
    "/sessions/:sessionId",
    requireAuth,
    asyncHandler(async (req, res) => {
      const sessionId = parseRouteParam(req.params.sessionId);
      const session = resolveOwnedSession(context, sessionId, req.auth!.userId, res);
      if (!session) return;

      const canceledRuns = context.orchestrator.cancelRunsForSession({
        userId: req.auth!.userId,
        sessionId: session.id
      });
      const deleted = context.repos.sessions.deleteForOwner(session.id, req.auth!.userId);
      if (!deleted) {
        res.status(404).json({ error: "Session not found." });
        return;
      }

      context.audit.logFromRequest(req, {
        eventType: "session.delete",
        targetType: "session",
        targetId: session.id,
        outcome: "success",
        metadata: {
          canceledRuns
        }
      });

      res.status(204).send();
    })
  );

  router.post(
    "/sessions/:sessionId/messages",
    requireAuth,
    asyncHandler(async (req, res) => {
      const payload = createMessageSchema.parse(req.body);
      const sessionId = parseRouteParam(req.params.sessionId);
      const session = resolveOwnedSession(context, sessionId, req.auth!.userId, res);
      if (!session) return;

      const userMessage = context.repos.messages.createMessage({
        sessionId: session.id,
        role: "user",
        content: payload.content
      });
      context.audit.logFromRequest(req, {
        eventType: "session.message.create",
        targetType: "session",
        targetId: session.id,
        outcome: "success",
        metadata: { messageId: userMessage.id }
      });

      const history = context.repos.messages.listBySession(session.id);
      const runResult = context.orchestrator.queueRun({
        userId: req.auth!.userId,
        sessionId: session.id,
        workspace: session.workspace,
        prompt: payload.content,
        history
      });

      context.repos.sessions.touchUpdatedAt(session.id);

      res.status(202).json({
        userMessage,
        assistantMessage: runResult.assistantMessage,
        run: runResult.run
      });
    })
  );

  router.post(
    "/sessions/:sessionId/runs/:runId/cancel",
    requireAuth,
    asyncHandler(async (req, res) => {
      const sessionId = parseRouteParam(req.params.sessionId);
      const runId = parseRouteParam(req.params.runId);
      const session = resolveOwnedSession(context, sessionId, req.auth!.userId, res);
      if (!session) return;
      if (!runId) {
        res.status(400).json({ error: "Run id is required." });
        return;
      }

      const result = context.orchestrator.cancelRun({
        userId: req.auth!.userId,
        sessionId: session.id,
        runId
      });

      if (result === "not-found") {
        res.status(404).json({ error: "Run not found." });
        return;
      }

      if (result === "not-active") {
        res.status(409).json({ error: "Run is not active." });
        return;
      }

      res.status(202).json({ status: "cancel-requested" });
    })
  );

  return router;
}
