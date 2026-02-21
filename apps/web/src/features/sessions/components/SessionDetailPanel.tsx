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
  showHeaderMenuTrigger?: boolean;
  headerMenuOpen?: boolean;
  onToggleHeaderMenu?: () => void;
}

function ControlsIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M6 6L18 18" />
        <path d="M18 6L6 18" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
      <circle cx="9" cy="6" r="2" />
      <circle cx="15" cy="12" r="2" />
      <circle cx="11" cy="18" r="2" />
    </svg>
  );
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
  onShowSessionList,
  showHeaderMenuTrigger = false,
  headerMenuOpen = false,
  onToggleHeaderMenu
}: SessionDetailPanelProps) {
  const renderHeaderMenuToggle = () =>
    showHeaderMenuTrigger && onToggleHeaderMenu ? (
      <button
        type="button"
        className="secondary-button detail-action-button detail-action-mobile-icon detail-menu-toggle"
        aria-label={headerMenuOpen ? "Close app controls" : "Open app controls"}
        aria-expanded={headerMenuOpen}
        onClick={onToggleHeaderMenu}
      >
        <span className="detail-action-label">Controls</span>
        <span className="detail-action-icon" aria-hidden="true">
          <ControlsIcon open={headerMenuOpen} />
        </span>
      </button>
    ) : null;

  const renderSessionToggle = () =>
    showSessionListTrigger && onShowSessionList ? (
      <button
        type="button"
        className="secondary-button session-list-toggle detail-action-button detail-action-mobile-icon"
        aria-label="Open sessions"
        onClick={onShowSessionList}
      >
        <span className="detail-action-label">Sessions</span>
        <span className="detail-action-icon" aria-hidden="true">
          ☰
        </span>
      </button>
    ) : null;

  if (loading) {
    return (
      <section className="detail-shell detail-shell-placeholder">
        {renderHeaderMenuToggle()}
        {renderSessionToggle()}
        <p>Loading session...</p>
      </section>
    );
  }

  if (!detail) {
    return (
      <section className="detail-shell detail-shell-placeholder">
        {renderHeaderMenuToggle()}
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
        <div className="detail-header-row">
          <h2 className="detail-title">{detail.session.title}</h2>

          <div className="detail-header-actions">
            {renderHeaderMenuToggle()}
            {renderSessionToggle()}
            <button
              type="button"
              className="secondary-button detail-action-button detail-action-mobile-icon"
              aria-label={forkPending ? "Forking session" : "Fork session"}
              disabled={forkPending || deletePending || cancelPending}
              onClick={() => {
                void onFork();
              }}
            >
              <span className="detail-action-label">{forkPending ? "Forking..." : "Fork Session"}</span>
              <span className="detail-action-icon" aria-hidden="true">
                {forkPending ? "…" : "+"}
              </span>
            </button>
            {canCancel ? (
              <button
                type="button"
                className="cancel-run-button detail-action-button detail-action-mobile-icon"
                aria-label={cancelPending ? "Canceling run" : "Cancel run"}
                disabled={cancelPending}
                onClick={() => {
                  void onCancel(latestRun.id);
                }}
              >
                <span className="detail-action-label">{cancelPending ? "Canceling..." : "Cancel Run"}</span>
                <span className="detail-action-icon" aria-hidden="true">
                  {cancelPending ? "…" : "×"}
                </span>
              </button>
            ) : null}
            <button
              type="button"
              className="delete-session-button detail-action-button detail-action-mobile-icon"
              aria-label={deletePending ? "Deleting session" : "Delete session"}
              disabled={deletePending || cancelPending}
              onClick={() => {
                void onDelete();
              }}
            >
              <span className="detail-action-label">{deletePending ? "Deleting..." : "Delete Session"}</span>
              <span className="detail-action-icon" aria-hidden="true">
                {deletePending ? "…" : "⌫"}
              </span>
            </button>
            {latestRun ? <RunStatusBadge status={latestRun.status} /> : null}
          </div>
        </div>

        <div className="detail-workspace-row" title={detail.session.workspace}>
          <p className="workspace-path">{detail.session.workspace}</p>
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
