import { Router } from "express";
import { z } from "zod";

import type { AppContext } from "../../appContext.js";
import { requireAuth } from "../../auth/authMiddleware.js";
import { isCodexAuthRequiredError, isCodexThreadMissingError, isCodexThreadNotMaterializedError } from "../../codex/errorMatchers.js";
import type { MessageRecord, RunRecord } from "../../types/domain.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { parseRouteParam, resolveOwnedSession } from "./sessionAccess.js";

const createSessionSchema = z.object({
  title: z.string().trim().min(1).max(120),
  workspace: z.string().trim().min(1)
});

const createMessageSchema = z.object({
  content: z.string().trim().min(1).max(20_000)
});

const forkSessionSchema = z.object({
  title: z.string().trim().min(1).max(120).optional()
});

const steerRunSchema = z.object({
  content: z.string().trim().min(1).max(20_000)
});

function requireCodex(context: AppContext) {
  if (!context.codex) {
    throw new Error("Codex app-server is not configured.");
  }
  return context.codex;
}

function buildLocalSessionDetail(context: AppContext, sessionId: string) {
  return {
    messages: context.repos.messages.listBySession(sessionId),
    runs: context.repos.runs.listBySession(sessionId)
  };
}

export function createAppServerSessionRoutes(context: AppContext): Router {
  const router = Router();

  router.get(
    "/sessions",
    requireAuth,
    asyncHandler(async (req, res) => {
      const sessions = context.repos.sessions.listByOwner(req.auth!.userId);
      const codex = requireCodex(context);
      const threads = await codex.listThreads();

      const merged = sessions.map((session) => {
        const thread = threads.get(session.id);
        if (!thread) {
          return session;
        }

        return {
          ...session,
          workspace: thread.cwd,
          updatedAt: new Date(thread.updatedAt * 1000).toISOString()
        };
      });

      res.json({ sessions: merged });
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

      const codex = requireCodex(context);
      let remoteSession: { id: string; workspace: string };
      try {
        remoteSession = await codex.startThread({
          title: payload.title,
          workspace: payload.workspace
        });
      } catch (error) {
        if (isCodexAuthRequiredError(error)) {
          res.status(409).json({ error: "Codex account authentication required. Connect ChatGPT first." });
          return;
        }
        throw error;
      }

      const session = context.repos.sessions.createSession({
        id: remoteSession.id,
        ownerUserId: req.auth!.userId,
        title: payload.title,
        workspace: remoteSession.workspace
      });

      context.audit.logFromRequest(req, {
        eventType: "session.create",
        targetType: "session",
        targetId: session.id,
        outcome: "success",
        metadata: {
          backend: "app-server",
          workspace: session.workspace
        }
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

      const codex = requireCodex(context);

      try {
        const detail = await codex.readSession(session);
        res.json(detail);
      } catch (error) {
        if (isCodexThreadMissingError(error)) {
          const fallback = buildLocalSessionDetail(context, session.id);
          res.json({
            session,
            messages: fallback.messages,
            runs: fallback.runs,
            stale: true
          });
          return;
        }
        throw error;
      }
    })
  );

  router.delete(
    "/sessions/:sessionId",
    requireAuth,
    asyncHandler(async (req, res) => {
      const sessionId = parseRouteParam(req.params.sessionId);
      const session = resolveOwnedSession(context, sessionId, req.auth!.userId, res);
      if (!session) return;

      const codex = requireCodex(context);

      try {
        await codex.archiveThread(session.id);
      } catch (error) {
        if (!isCodexThreadMissingError(error)) {
          throw error;
        }
      }

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
          backend: "app-server"
        }
      });

      res.status(204).send();
    })
  );

  router.post(
    "/sessions/:sessionId/fork",
    requireAuth,
    asyncHandler(async (req, res) => {
      const sessionId = parseRouteParam(req.params.sessionId);
      const session = resolveOwnedSession(context, sessionId, req.auth!.userId, res);
      if (!session) return;

      const payload = forkSessionSchema.parse(req.body ?? {});
      const codex = requireCodex(context);

      const forkTitle = payload.title ?? `${session.title} (fork)`;
      let forked: { id: string; workspace: string; title: string };
      try {
        forked = await codex.forkThread({
          threadId: session.id,
          title: forkTitle
        });
      } catch (error) {
        if (isCodexThreadMissingError(error) || isCodexThreadNotMaterializedError(error)) {
          forked = await codex.startThread({
            title: forkTitle,
            workspace: session.workspace
          });
        } else if (isCodexAuthRequiredError(error)) {
          res.status(409).json({ error: "Codex account authentication required. Connect ChatGPT first." });
          return;
        } else {
          throw error;
        }
      }

      const forkedSession = context.repos.sessions.createSession({
        id: forked.id,
        ownerUserId: req.auth!.userId,
        title: forked.title,
        workspace: forked.workspace
      });

      context.audit.logFromRequest(req, {
        eventType: "session.fork",
        targetType: "session",
        targetId: forkedSession.id,
        outcome: "success",
        metadata: {
          sourceSessionId: session.id,
          backend: "app-server"
        }
      });

      res.status(201).json({ session: forkedSession });
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

      const codex = requireCodex(context);
      let result: {
        userMessage: MessageRecord;
        assistantMessage: MessageRecord;
        run: RunRecord;
      };
      try {
        result = await codex.startTurn({
          session,
          content: payload.content
        });
      } catch (error) {
        if (isCodexAuthRequiredError(error)) {
          res.status(409).json({ error: "Codex account authentication required. Connect ChatGPT first." });
          return;
        }
        if (isCodexThreadMissingError(error)) {
          res.status(404).json({ error: "Session not found." });
          return;
        }
        throw error;
      }

      context.repos.sessions.touchUpdatedAt(session.id);
      context.audit.logFromRequest(req, {
        eventType: "session.message.create",
        targetType: "session",
        targetId: session.id,
        outcome: "success",
        metadata: {
          backend: "app-server",
          runId: result.run.id
        }
      });

      res.status(202).json(result);
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

      const codex = requireCodex(context);
      try {
        await codex.interruptTurn({
          threadId: session.id,
          turnId: runId
        });
      } catch (error) {
        if (isCodexThreadMissingError(error)) {
          res.status(404).json({ error: "Run not found." });
          return;
        }
        throw error;
      }

      res.status(202).json({ status: "cancel-requested" });
    })
  );

  router.post(
    "/sessions/:sessionId/runs/:runId/steer",
    requireAuth,
    asyncHandler(async (req, res) => {
      const payload = steerRunSchema.parse(req.body);
      const sessionId = parseRouteParam(req.params.sessionId);
      const runId = parseRouteParam(req.params.runId);
      const session = resolveOwnedSession(context, sessionId, req.auth!.userId, res);
      if (!session) return;
      if (!runId) {
        res.status(400).json({ error: "Run id is required." });
        return;
      }

      const codex = requireCodex(context);
      try {
        await codex.steerTurn({
          threadId: session.id,
          turnId: runId,
          content: payload.content
        });
      } catch (error) {
        if (isCodexThreadMissingError(error)) {
          res.status(404).json({ error: "Run not found." });
          return;
        }
        if (isCodexAuthRequiredError(error)) {
          res.status(409).json({ error: "Codex account authentication required. Connect ChatGPT first." });
          return;
        }
        throw error;
      }

      context.audit.logFromRequest(req, {
        eventType: "run.steer",
        targetType: "session",
        targetId: session.id,
        outcome: "success",
        metadata: {
          runId,
          backend: "app-server"
        }
      });

      res.status(202).json({ status: "steer-sent" });
    })
  );

  return router;
}
