import { apiRequest } from "../../lib/apiClient";

import type { Message, Run, Session, SessionDetail, Workspace } from "./types";

interface SessionsResponse {
  sessions: Session[];
}

interface WorkspacesResponse {
  workspaces: Workspace[];
}

interface SessionDetailResponse {
  session: Session;
  messages: Message[];
  runs: Run[];
}

interface SendMessageResponse {
  userMessage: Message;
  assistantMessage: Message;
  run: Run;
}

export function listSessions(workspace?: string): Promise<SessionsResponse> {
  const params = new URLSearchParams();
  if (workspace) {
    params.set("workspace", workspace);
  }
  const query = params.toString();
  return apiRequest<SessionsResponse>(`/sessions${query ? `?${query}` : ""}`);
}

export function listWorkspaces(): Promise<WorkspacesResponse> {
  return apiRequest<WorkspacesResponse>("/workspaces");
}

export function createSession(input: { title: string; workspace: string }): Promise<{ session: Session }> {
  return apiRequest<{ session: Session }>("/sessions", {
    method: "POST",
    body: input
  });
}

export function fetchSessionDetail(sessionId: string): Promise<SessionDetailResponse> {
  return apiRequest<SessionDetailResponse>(`/sessions/${sessionId}`);
}

export function deleteSession(sessionId: string): Promise<void> {
  return apiRequest<void>(`/sessions/${sessionId}`, {
    method: "DELETE"
  });
}

export function forkSession(sessionId: string, input?: { title?: string }): Promise<{ session: Session }> {
  return apiRequest<{ session: Session }>(`/sessions/${sessionId}/fork`, {
    method: "POST",
    body: input ?? {}
  });
}

export function sendMessage(sessionId: string, input: { content: string }): Promise<SendMessageResponse> {
  return apiRequest<SendMessageResponse>(`/sessions/${sessionId}/messages`, {
    method: "POST",
    body: input
  });
}

export function cancelRun(sessionId: string, runId: string): Promise<{ status: string }> {
  return apiRequest<{ status: string }>(`/sessions/${sessionId}/runs/${runId}/cancel`, {
    method: "POST"
  });
}

export function steerRun(sessionId: string, runId: string, input: { content: string }): Promise<{ status: string }> {
  return apiRequest<{ status: string }>(`/sessions/${sessionId}/runs/${runId}/steer`, {
    method: "POST",
    body: input
  });
}

export function mapDetail(response: SessionDetailResponse): SessionDetail {
  return {
    session: response.session,
    messages: response.messages,
    runs: response.runs
  };
}
