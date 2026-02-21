import type { UserRole } from "../types/domain.js";

export interface AuthClaims {
  userId: string;
  username: string;
  role: UserRole;
}
