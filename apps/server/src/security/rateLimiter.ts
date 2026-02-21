import rateLimit from "express-rate-limit";

import type { AppConfig } from "../config/env.js";

export function createApiRateLimiter(config: AppConfig) {
  return rateLimit({
    windowMs: config.rateLimitWindowMs,
    limit: config.rateLimitMaxRequests,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
      error: "Too many requests. Please slow down and retry shortly."
    }
  });
}

export function createAuthRateLimiter(config: AppConfig) {
  return rateLimit({
    windowMs: config.rateLimitWindowMs,
    limit: config.authRateLimitMaxRequests,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
      error: "Too many authentication attempts. Please wait and try again."
    }
  });
}
