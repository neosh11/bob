import type { NextFunction, Request, Response } from "express";

import { verifyAuthToken } from "./jwt.js";

export function attachAuth(cookieName: string, jwtSecret: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const token = req.cookies?.[cookieName] as string | undefined;
    if (token) {
      const claims = verifyAuthToken(token, jwtSecret);
      if (claims) {
        req.auth = {
          userId: claims.userId,
          username: claims.username,
          role: claims.role
        };
      }
    }
    next();
  };
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  next();
}
