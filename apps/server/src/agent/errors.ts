export class RunCanceledError extends Error {
  constructor(message = "Run canceled by user.") {
    super(message);
    this.name = "RunCanceledError";
  }
}

export function isRunCanceledError(error: unknown): error is RunCanceledError {
  return error instanceof RunCanceledError;
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new RunCanceledError();
  }
}
