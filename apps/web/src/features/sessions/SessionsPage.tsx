import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";

import { ApiError } from "../../lib/apiClient";
import { AgentSettingsDialog } from "../agentSettings/AgentSettingsDialog";
import { fetchAgentSettings, updateAgentSettings } from "../agentSettings/agentSettingsApi";
import { useAuth } from "../auth/useAuth";

import { useMediaQuery } from "../../hooks/useMediaQuery";
import { CodexAuthPanel } from "./components/CodexAuthPanel";
import { SessionDetailPanel } from "./components/SessionDetailPanel";
import { SessionList } from "./components/SessionList";
import { sessionKeys } from "./queryKeys";
import { cancelRun, createSession, deleteSession, fetchSessionDetail, forkSession, listSessions, listWorkspaces, mapDetail, sendMessage, steerRun } from "./sessionApi";
import type { SessionDetail } from "./types";
import { useCodexAccount } from "./useCodexAccount";
import { useRunEvents } from "./useRunEvents";

export function SessionsPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const params = useParams<{ sessionId: string }>();
  const queryClient = useQueryClient();
  const codex = useCodexAccount();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [guardError, setGuardError] = useState<string | null>(null);
  const isMobile = useMediaQuery("(max-width: 720px)");
  const [sessionsDrawerOpen, setSessionsDrawerOpen] = useState(false);

  useRunEvents();

  const openSessionsDrawer = useCallback(() => {
    if (!isMobile) {
      return;
    }
    setSessionsDrawerOpen(true);
  }, [isMobile]);

  const closeSessionsDrawer = useCallback(() => {
    if (!isMobile) {
      return;
    }
    setSessionsDrawerOpen(false);
  }, [isMobile]);

  const sessionsQuery = useQuery({
    queryKey: sessionKeys.all,
    queryFn: listSessions
  });

  const workspacesQuery = useQuery({
    queryKey: sessionKeys.workspaces,
    queryFn: listWorkspaces
  });

  const detailQuery = useQuery({
    queryKey: params.sessionId ? sessionKeys.detail(params.sessionId) : ["session", "none"],
    queryFn: async () => {
      if (!params.sessionId) {
        return undefined;
      }
      const response = await fetchSessionDetail(params.sessionId);
      return mapDetail(response);
    },
    enabled: Boolean(params.sessionId)
  });

  const agentSettingsQuery = useQuery({
    queryKey: ["agent", "settings"],
    queryFn: fetchAgentSettings
  });

  const createSessionMutation = useMutation({
    mutationFn: createSession,
    onSuccess: async (response) => {
      setGuardError(null);
      await queryClient.invalidateQueries({ queryKey: sessionKeys.all });
      navigate(`/sessions/${response.session.id}`);
      closeSessionsDrawer();
    }
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!params.sessionId) {
        throw new Error("Select a session before sending a message.");
      }
      return sendMessage(params.sessionId, { content });
    },
    onSuccess: (response) => {
      setGuardError(null);
      if (!params.sessionId) {
        return;
      }

      queryClient.setQueryData<SessionDetail | undefined>(sessionKeys.detail(params.sessionId), (current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          messages: [...current.messages, response.userMessage, response.assistantMessage],
          runs: [response.run, ...current.runs]
        };
      });

      void queryClient.invalidateQueries({ queryKey: sessionKeys.all });
    }
  });

  const steerRunMutation = useMutation({
    mutationFn: async (input: { runId: string; content: string }) => {
      if (!params.sessionId) {
        throw new Error("Select a session before steering a run.");
      }

      return steerRun(params.sessionId, input.runId, {
        content: input.content
      });
    },
    onSuccess: () => {
      if (!params.sessionId) {
        return;
      }

      void queryClient.invalidateQueries({ queryKey: sessionKeys.detail(params.sessionId) });
    }
  });

  const cancelRunMutation = useMutation({
    mutationFn: async (runId: string) => {
      if (!params.sessionId) {
        throw new Error("Select a session before canceling a run.");
      }
      return cancelRun(params.sessionId, runId);
    },
    onSuccess: () => {
      if (!params.sessionId) {
        return;
      }
      void queryClient.invalidateQueries({ queryKey: sessionKeys.detail(params.sessionId) });
      void queryClient.invalidateQueries({ queryKey: sessionKeys.all });
    }
  });

  const deleteSessionMutation = useMutation({
    mutationFn: deleteSession,
    onSuccess: async (_response, deletedSessionId) => {
      await queryClient.invalidateQueries({ queryKey: sessionKeys.all });
      await queryClient.invalidateQueries({ queryKey: sessionKeys.detail(deletedSessionId) });
      navigate("/", { replace: true });
    }
  });

  const forkSessionMutation = useMutation({
    mutationFn: async () => {
      if (!params.sessionId) {
        throw new Error("Select a session before forking.");
      }

      return forkSession(params.sessionId);
    },
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: sessionKeys.all });
      navigate(`/sessions/${response.session.id}`);
      closeSessionsDrawer();
    }
  });

  const updateAgentSettingsMutation = useMutation({
    mutationFn: updateAgentSettings,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["agent", "settings"] });
      setSettingsOpen(false);
    }
  });

  const selectedSession = useMemo(() => detailQuery.data, [detailQuery.data]);
  const showSessionList = !isMobile || sessionsDrawerOpen;

  useEffect(() => {
    if (!isMobile) {
      setSessionsDrawerOpen(true);
    }
  }, [isMobile]);

  useEffect(() => {
    if (isMobile && !params.sessionId) {
      setSessionsDrawerOpen(true);
    }
  }, [isMobile, params.sessionId]);

  const requestError = [
    sessionsQuery.error,
    workspacesQuery.error,
    detailQuery.error,
    createSessionMutation.error,
    sendMessageMutation.error,
    steerRunMutation.error,
    cancelRunMutation.error,
    forkSessionMutation.error,
    deleteSessionMutation.error,
    agentSettingsQuery.error,
    updateAgentSettingsMutation.error,
    codex.error
  ]
    .filter(Boolean)
    .map((error) => (error instanceof ApiError ? error.message : "Unexpected request error"))[0];
  const errorMessage = guardError ?? requestError;
  const codexAuthRequired = Boolean(codex.accountStatus?.requiresOpenaiAuth && !codex.accountStatus?.account);
  const shouldShowCodexPanel = codex.pendingLogin || codexAuthRequired || Boolean(codex.message);

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Bob</p>
        </div>

        <div className="topbar-actions">
          <span className="codex-status">{codex.statusLabel}</span>
          <button type="button" className="secondary-button" onClick={() => setSettingsOpen(true)}>
            Agent
          </button>
          <button
            type="button"
            onClick={() => {
              void auth.logout();
              navigate("/login", { replace: true });
            }}
          >
            Logout
          </button>
        </div>

      </header>

      {errorMessage ? <p className="form-error wide">{errorMessage}</p> : null}

      {shouldShowCodexPanel ? (
        <CodexAuthPanel
          accountStatus={codex.accountStatus}
          loading={codex.loading}
          unavailable={codex.unavailable}
          pendingLogin={codex.pendingLogin}
          authUrl={codex.authUrl}
          message={codex.message}
          connectPending={codex.connectPending}
          cancelPending={codex.cancelPending}
          refreshPending={codex.refreshPending || codex.fetching}
          logoutPending={codex.logoutPending}
          onConnect={() => {
            setGuardError(null);
            codex.startLogin();
          }}
          onCancel={() => {
            codex.cancelLogin();
          }}
          onRefresh={() => {
            codex.refresh();
          }}
          onLogout={() => {
            codex.logout();
          }}
        />
      ) : null}

      {isMobile && sessionsDrawerOpen ? (
        <button type="button" className="session-drawer-overlay" onClick={closeSessionsDrawer} aria-label="Close sessions" />
      ) : null}

      <div className="workspace-shell">
        {showSessionList ? (
          <div className={`session-drawer${isMobile ? " mobile" : ""}`}>
            <SessionList
              sessions={sessionsQuery.data?.sessions ?? []}
              workspaces={workspacesQuery.data?.workspaces ?? []}
              activeSessionId={params.sessionId}
              creating={createSessionMutation.isPending}
              createDisabled={codex.authBlocked}
              onSelect={(sessionId) => {
                navigate(`/sessions/${sessionId}`);
                closeSessionsDrawer();
              }}
              onCreate={(input) => {
                if (codex.authBlocked) {
                  setGuardError("Authenticate Codex before creating a session.");
                  return;
                }
                setGuardError(null);
                createSessionMutation.mutate(input);
              }}
              mobile={isMobile}
              onCloseRequest={closeSessionsDrawer}
            />
          </div>
        ) : null}

        <SessionDetailPanel
          detail={selectedSession}
          loading={detailQuery.isLoading}
          sendPending={sendMessageMutation.isPending}
          steerPending={steerRunMutation.isPending}
          forkPending={forkSessionMutation.isPending}
          sendDisabled={codex.authBlocked}
          cancelPending={cancelRunMutation.isPending}
          deletePending={deleteSessionMutation.isPending}
          onSend={async (content) => {
            if (codex.authBlocked) {
              setGuardError("Authenticate Codex before running tasks.");
              return;
            }
            setGuardError(null);
            await sendMessageMutation.mutateAsync(content);
          }}
          onCancel={async (runId) => {
            await cancelRunMutation.mutateAsync(runId);
          }}
          onSteer={async (content) => {
            if (!selectedSession || !selectedSession.runs[0]) {
              return;
            }
            await steerRunMutation.mutateAsync({
              runId: selectedSession.runs[0].id,
              content
            });
          }}
          onFork={async () => {
            await forkSessionMutation.mutateAsync();
          }}
          onDelete={async () => {
            if (!selectedSession || !params.sessionId) {
              return;
            }

            const confirmed = window.confirm(
              `Delete session "${selectedSession.session.title}"? This removes all runs and messages.`
            );
            if (!confirmed) {
              return;
            }

            await deleteSessionMutation.mutateAsync(params.sessionId);
          }}
          showSessionListTrigger={isMobile}
          onShowSessionList={openSessionsDrawer}
        />
      </div>

      <AgentSettingsDialog
        open={settingsOpen}
        current={agentSettingsQuery.data?.settings}
        saving={updateAgentSettingsMutation.isPending}
        onClose={() => setSettingsOpen(false)}
        onSave={async (next) => {
          await updateAgentSettingsMutation.mutateAsync(next);
        }}
      />
    </main>
  );
}
