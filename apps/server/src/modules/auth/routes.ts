import { type Response, Router } from "express";
import { z } from "zod";

import type { AppContext } from "../../appContext.js";
import { requireAuth } from "../../auth/authMiddleware.js";
import { signAuthToken } from "../../auth/jwt.js";
import { DEFAULT_OPERATOR_NAME, SHARED_DB_USERNAME, SHARED_USER_ID } from "../../auth/sharedIdentity.js";
import { isSharedPasswordValid } from "../../auth/sharedPassword.js";
import { createAuthRateLimiter } from "../../security/rateLimiter.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const loginSchema = z.object({
  password: z.string().min(1),
  username: z.string().trim().min(1).max(64).optional()
});
const cancelCodexLoginSchema = z.object({
  loginId: z.string().trim().min(1)
});

function setSessionCookie(context: AppContext, token: string, res: Response) {
  const isProduction = context.config.nodeEnv === "production";
  res.cookie(context.config.cookieName, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

export function createAuthRoutes(context: AppContext): Router {
  const router = Router();
  const authLimiter = createAuthRateLimiter(context.config);

  router.post(
    "/auth/login",
    authLimiter,
    asyncHandler(async (req, res) => {
      const payload = loginSchema.parse(req.body);
      const valid = isSharedPasswordValid(payload.password, context.config.sharedPassword);
      const username = payload.username ?? DEFAULT_OPERATOR_NAME;

      if (!valid) {
        context.audit.logFromRequest(req, {
          eventType: "auth.login",
          targetType: "system",
          outcome: "failure",
          metadata: { reason: "invalid-shared-password", username }
        });
        res.status(401).json({ error: "Invalid password." });
        return;
      }

      context.repos.users.ensureUser({
        id: SHARED_USER_ID,
        username: SHARED_DB_USERNAME,
        passwordHash: "shared-password-mode",
        role: "admin"
      });

      const token = signAuthToken(
        {
          userId: SHARED_USER_ID,
          username,
          role: "admin"
        },
        context.config.jwtSecret,
        context.config.jwtTtl
      );

      setSessionCookie(context, token, res);
      context.audit.logFromRequest(req, {
        eventType: "auth.login",
        targetType: "system",
        targetId: SHARED_USER_ID,
        outcome: "success",
        metadata: { username }
      });

      res.json({
        user: {
          id: SHARED_USER_ID,
          username,
          role: "admin"
        }
      });
    })
  );

  router.post("/auth/logout", (req, res) => {
    context.audit.logFromRequest(req, {
      eventType: "auth.logout",
      targetType: "system",
      targetId: req.auth?.userId ?? null,
      outcome: "success"
    });
    res.clearCookie(context.config.cookieName);
    res.status(204).send();
  });

  router.get("/auth/me", requireAuth, (req, res) => {
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }

    res.json({
      user: {
        id: auth.userId,
        username: auth.username,
        role: auth.role
      }
    });
  });

  router.get(
    "/auth/codex/account",
    requireAuth,
    asyncHandler(async (_req, res) => {
      if (!context.codex) {
        res.status(503).json({ error: "Codex app-server is disabled for this deployment." });
        return;
      }

      const account = await context.codex.getAccount();
      res.json(account);
    })
  );

  router.post(
    "/auth/codex/login/start",
    requireAuth,
    asyncHandler(async (_req, res) => {
      if (!context.codex) {
        res.status(503).json({ error: "Codex app-server is disabled for this deployment." });
        return;
      }

      const login = await context.codex.loginWithChatGpt();
      res.json({ login });
    })
  );

  router.post(
    "/auth/codex/login/cancel",
    requireAuth,
    asyncHandler(async (req, res) => {
      if (!context.codex) {
        res.status(503).json({ error: "Codex app-server is disabled for this deployment." });
        return;
      }

      const payload = cancelCodexLoginSchema.parse(req.body);
      await context.codex.cancelLogin(payload.loginId);
      res.status(204).send();
    })
  );

  router.post(
    "/auth/codex/logout",
    requireAuth,
    asyncHandler(async (_req, res) => {
      if (!context.codex) {
        res.status(503).json({ error: "Codex app-server is disabled for this deployment." });
        return;
      }

      await context.codex.logoutAccount();
      res.status(204).send();
    })
  );

  return router;
}
