export function isCodexThreadMissingError(error: unknown): boolean {
  return error instanceof Error && /not found|no such|not loaded|no rollout found/i.test(error.message);
}

export function isCodexThreadNotMaterializedError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /not materialized yet|includeTurns is unavailable before first user message/i.test(error.message)
  );
}

export function isCodexAuthRequiredError(error: unknown): boolean {
  return error instanceof Error && /openai auth|authentication required|login/i.test(error.message);
}

export function isCodexResumeUnsupportedError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /method not found|unknown method|invalid request|thread\/resume|resume.*unsupported/i.test(error.message)
  );
}
