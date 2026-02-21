import jwt from "jsonwebtoken";

import type { AuthClaims } from "./types.js";

interface TokenPayload {
  sub: string;
  username: string;
  role: AuthClaims["role"];
}

export function signAuthToken(claims: AuthClaims, secret: string, expiresIn: string): string {
  return jwt.sign(
    {
      username: claims.username,
      role: claims.role
    },
    secret,
    {
      subject: claims.userId,
      expiresIn: expiresIn as jwt.SignOptions["expiresIn"]
    }
  );
}

export function verifyAuthToken(token: string, secret: string): AuthClaims | null {
  try {
    const decoded = jwt.verify(token, secret) as TokenPayload;
    if (!decoded.sub) {
      return null;
    }

    return {
      userId: decoded.sub,
      username: decoded.username,
      role: decoded.role
    };
  } catch {
    return null;
  }
}
