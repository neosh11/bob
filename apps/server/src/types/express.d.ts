import type { AuthClaims } from "../auth/types.js";

declare global {
  namespace Express {
    interface Request {
      auth?: AuthClaims;
    }
  }
}

export {};
