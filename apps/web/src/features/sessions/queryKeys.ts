export const sessionKeys = {
  all: ["sessions"] as const,
  list: (workspace: string) => ["sessions", workspace] as const,
  detail: (sessionId: string) => ["session", sessionId] as const,
  workspaces: ["workspaces"] as const
};
