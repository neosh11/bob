import { apiRequest } from "../../lib/apiClient";

import type { AuthUser, CodexAccountStatus, CodexLoginStartResult } from "./types";

interface AuthResponse {
  user: AuthUser;
}

export function fetchCurrentUser(): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/me");
}

export function login(input: { username?: string; password: string }): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: input
  });
}

export function logout(): Promise<void> {
  return apiRequest<void>("/auth/logout", {
    method: "POST"
  });
}

export function fetchCodexAccount(): Promise<CodexAccountStatus> {
  return apiRequest<CodexAccountStatus>("/auth/codex/account");
}

export function startCodexLogin(): Promise<CodexLoginStartResult> {
  return apiRequest<CodexLoginStartResult>("/auth/codex/login/start", {
    method: "POST"
  });
}

export function cancelCodexLogin(loginId: string): Promise<void> {
  return apiRequest<void>("/auth/codex/login/cancel", {
    method: "POST",
    body: {
      loginId
    }
  });
}

export function logoutCodexAccount(): Promise<void> {
  return apiRequest<void>("/auth/codex/logout", {
    method: "POST"
  });
}
