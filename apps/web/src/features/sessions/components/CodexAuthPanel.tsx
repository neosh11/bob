import type { CodexAccountStatus } from "../../auth/types";

interface CodexAuthPanelProps {
  accountStatus?: CodexAccountStatus;
  loading: boolean;
  unavailable: boolean;
  pendingLogin: boolean;
  authUrl: string | null;
  message: string | null;
  connectPending: boolean;
  cancelPending: boolean;
  refreshPending: boolean;
  logoutPending: boolean;
  onConnect: () => void;
  onCancel: () => void;
  onRefresh: () => void;
  onLogout: () => void;
}

function buildStatusDescription(input: {
  loading: boolean;
  accountStatus?: CodexAccountStatus;
  pendingLogin: boolean;
}): string {
  if (input.loading && !input.accountStatus) {
    return "Checking account status...";
  }

  if (input.pendingLogin) {
    return "Authentication is in progress. Complete sign in, then return here.";
  }

  const account = input.accountStatus?.account;
  if (!account) {
    return "No Codex account is connected yet.";
  }

  if (account.type === "chatgpt") {
    return `Connected as ${account.email} (${account.planType}).`;
  }

  return "Connected with API key credentials.";
}

export function CodexAuthPanel({
  accountStatus,
  loading,
  unavailable,
  pendingLogin,
  authUrl,
  message,
  connectPending,
  cancelPending,
  refreshPending,
  logoutPending,
  onConnect,
  onCancel,
  onRefresh,
  onLogout
}: CodexAuthPanelProps) {
  if (unavailable) {
    return null;
  }

  const requiresAuth = Boolean(accountStatus?.requiresOpenaiAuth && !accountStatus.account);
  const hasConnectedAccount = Boolean(accountStatus?.account);
  const description = buildStatusDescription({
    loading,
    accountStatus,
    pendingLogin
  });
  const connectDisabled = connectPending || cancelPending || refreshPending || logoutPending || loading;
  const cancelDisabled = cancelPending || connectPending || refreshPending || logoutPending;
  const refreshDisabled = refreshPending || connectPending || cancelPending || logoutPending;
  const logoutDisabled = logoutPending || connectPending || cancelPending || refreshPending;
  const panelClassName = `codex-auth-panel${requiresAuth || pendingLogin ? " warning" : ""}`;

  return (
    <section className={panelClassName}>
      <div className="codex-auth-header">
        <div>
          <p className="eyebrow">Codex Account</p>
          <h2>{requiresAuth || pendingLogin ? "Authentication Required" : "Authentication Ready"}</h2>
          <p className="codex-auth-description">{description}</p>
        </div>

        <div className="codex-auth-actions">
          {pendingLogin ? (
            <button type="button" className="secondary-button" onClick={onCancel} disabled={cancelDisabled}>
              {cancelPending ? "Canceling..." : "Cancel Login"}
            </button>
          ) : (
            <button type="button" onClick={onConnect} disabled={connectDisabled}>
              {connectPending ? "Opening..." : requiresAuth ? "Connect ChatGPT" : "Reconnect"}
            </button>
          )}
          <button type="button" className="secondary-button" onClick={onRefresh} disabled={refreshDisabled}>
            {refreshPending ? "Refreshing..." : "Refresh"}
          </button>
          {hasConnectedAccount ? (
            <button type="button" className="secondary-button" onClick={onLogout} disabled={logoutDisabled}>
              {logoutPending ? "Disconnecting..." : "Disconnect"}
            </button>
          ) : null}
        </div>
      </div>

      {message ? <p className="codex-auth-note">{message}</p> : null}
      {authUrl ? (
        <p className="codex-auth-note">
          If a popup did not open, continue sign in here:{" "}
          <a href={authUrl} target="_blank" rel="noreferrer">
            {authUrl}
          </a>
        </p>
      ) : null}
      {pendingLogin ? (
        <p className="codex-auth-note">
          If you are signing in from a phone and callback fails, open the auth link on the same machine running this app.
        </p>
      ) : null}
    </section>
  );
}
