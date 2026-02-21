export const sessionKeys = {
  all: ["sessions"] as const,
  detail: (sessionId: string) => ["session", sessionId] as const,
  workspaces: ["workspaces"] as const
};
