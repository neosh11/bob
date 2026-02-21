import { MessageComposer } from "./MessageComposer";
import { MessageThread } from "./MessageThread";
import { RunStatusBadge } from "./RunStatusBadge";

import type { RunStatus, SessionDetail } from "../types";

interface SessionDetailPanelProps {
  detail?: SessionDetail;
  loading: boolean;
  sendPending: boolean;
  steerPending: boolean;
  forkPending: boolean;
  sendDisabled?: boolean;
  cancelPending: boolean;
  deletePending: boolean;
  onSend: (content: string) => Promise<void>;
  onSteer: (content: string) => Promise<void>;
  onCancel: (runId: string) => Promise<void>;
  onFork: () => Promise<void>;
  onDelete: () => Promise<void>;
  showSessionListTrigger?: boolean;
  onShowSessionList?: () => void;
}

export function SessionDetailPanel({
  detail,
  loading,
  sendPending,
  steerPending,
  forkPending,
  sendDisabled = false,
  cancelPending,
  deletePending,
  onSend,
  onSteer,
  onCancel,
  onFork,
  onDelete,
  showSessionListTrigger = false,
  onShowSessionList
}: SessionDetailPanelProps) {
  const renderSessionToggle = () =>
    showSessionListTrigger && onShowSessionList ? (
      <button type="button" className="secondary-button session-list-toggle" onClick={onShowSessionList}>
        View Sessions
      </button>
    ) : null;

  if (loading) {
    return (
      <section className="detail-shell detail-shell-placeholder">
        {renderSessionToggle()}
        <p>Loading session...</p>
      </section>
    );
  }

  if (!detail) {
    return (
      <section className="detail-shell detail-shell-placeholder">
        {renderSessionToggle()}
        <p>Select a session from the list to get started.</p>
      </section>
    );
  }

  const latestRun = detail.runs[0];
  const canCancel = latestRun && (latestRun.status === "queued" || latestRun.status === "running");
  const canSteer = latestRun?.status === "running";
  const runStatuses = Object.fromEntries(detail.runs.map((run) => [run.id, run.status])) as Record<string, RunStatus>;

  return (
    <section className="detail-shell">
      <header className="detail-header">
        <div>
          <p className="eyebrow">Workspace</p>
          <h2>{detail.session.title}</h2>
          <p className="workspace-path">{detail.session.workspace}</p>
        </div>

        <div className="detail-header-actions">
          {renderSessionToggle()}
          {latestRun ? <RunStatusBadge status={latestRun.status} /> : null}
          <button
            type="button"
            className="secondary-button"
            disabled={forkPending || deletePending || cancelPending}
            onClick={() => {
              void onFork();
            }}
          >
            {forkPending ? "Forking..." : "Fork Session"}
          </button>
          {canCancel ? (
            <button
              type="button"
              className="cancel-run-button"
              disabled={cancelPending}
              onClick={() => {
                void onCancel(latestRun.id);
              }}
            >
              {cancelPending ? "Canceling..." : "Cancel Run"}
            </button>
          ) : null}
          <button
            type="button"
            className="delete-session-button"
            disabled={deletePending || cancelPending}
            onClick={() => {
              void onDelete();
            }}
          >
            {deletePending ? "Deleting..." : "Delete Session"}
          </button>
        </div>
      </header>

      <MessageThread messages={detail.messages} runStatuses={runStatuses} />
      <MessageComposer
        sending={sendPending}
        steering={steerPending}
        canSteer={canSteer}
        disabled={sendDisabled}
        onSend={onSend}
        onSteer={onSteer}
      />
    </section>
  );
}
