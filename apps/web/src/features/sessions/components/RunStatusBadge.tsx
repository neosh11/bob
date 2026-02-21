import type { RunStatus } from "../types";

export function RunStatusBadge({ status }: { status: RunStatus }) {
  return <span className={`run-status run-status-${status}`}>{status}</span>;
}
