import type { RunStatus } from "../types";

const STATUS_LABELS: Record<RunStatus, string> = {
  queued: "Queued",
  running: "Running",
  completed: "Done",
  failed: "Failed"
};

export function RunStatusBadge({ status }: { status: RunStatus }) {
  const label = STATUS_LABELS[status];

  return (
    <span className="run-status-badge detail-action-button" role="status" aria-label={`Run ${label}`} title={`Run ${label}`}>
      <span className={`run-status run-status-${status}`} />
    </span>
  );
}
