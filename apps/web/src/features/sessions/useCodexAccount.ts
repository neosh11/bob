import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError } from "../../lib/apiClient";
import { cancelCodexLogin, fetchCodexAccount, logoutCodexAccount, startCodexLogin } from "../auth/authApi";
import type { CodexAccountStatus } from "../auth/types";

interface PendingCodexLogin {
  loginId: string;
  authUrl: string;
}

function resolveCodexStatusLabel(input: {
  loading: boolean;
  unavailable: boolean;
  requiresAuth: boolean;
  pendingLogin: boolean;
  account: CodexAccountStatus["account"] | null;
}): string {
  if (input.unavailable) {
    return "Codex auth unavailable";
  }

  if (input.loading && !input.account && !input.pendingLogin) {
    return "Codex auth checking";
  }

  if (input.pendingLogin) {
    return "Codex auth pending";
  }

  if (input.requiresAuth) {
    return "Codex auth required";
  }

  if (input.account?.type === "chatgpt") {
    return `Codex ${input.account.email}`;
  }

  if (input.account?.type === "apiKey") {
    return "Codex api key";
  }

  return "Codex ready";
}

export interface CodexAccountController {
  accountStatus?: CodexAccountStatus;
  unavailable: boolean;
  authBlocked: boolean;
  pendingLogin: boolean;
  statusLabel: string;
  message: string | null;
  authUrl: string | null;
  loading: boolean;
  fetching: boolean;
  connectPending: boolean;
  cancelPending: boolean;
  refreshPending: boolean;
  logoutPending: boolean;
  error: unknown;
  startLogin: () => void;
  cancelLogin: () => void;
  refresh: () => void;
  logout: () => void;
}

export function useCodexAccount(): CodexAccountController {
  const queryClient = useQueryClient();
  const [pendingLogin, setPendingLogin] = useState<PendingCodexLogin | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const accountQuery = useQuery({
    queryKey: ["auth", "codex", "account"],
    queryFn: fetchCodexAccount,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403 || error.status === 503)) {
        return false;
      }
      return failureCount < 2;
    },
    refetchInterval: pendingLogin ? 2_000 : false
  });

  const startLoginMutation = useMutation({
    mutationFn: startCodexLogin,
    onSuccess: async (response) => {
      setMessage(null);

      if (response.login.type === "chatgpt" && response.login.loginId && response.login.authUrl) {
        setPendingLogin({
          loginId: response.login.loginId,
          authUrl: response.login.authUrl
        });
        setMessage("Continue the sign-in flow in the opened browser tab.");
        const popup = window.open(response.login.authUrl, "_blank", "noopener,noreferrer");
        if (!popup) {
          setMessage("Popup blocked. Use the sign-in link shown below.");
        }
      } else if (response.login.type === "apiKey") {
        setPendingLogin(null);
        setMessage("Codex is configured with API key authentication.");
      } else {
        setPendingLogin(null);
        setMessage("Codex reported token-based ChatGPT authentication.");
      }

      await queryClient.invalidateQueries({ queryKey: ["auth", "codex", "account"] });
    }
  });

  const cancelLoginMutation = useMutation({
    mutationFn: async () => {
      if (!pendingLogin) {
        return;
      }
      await cancelCodexLogin(pendingLogin.loginId);
    },
    onSuccess: async () => {
      setPendingLogin(null);
      setMessage("Sign-in request canceled.");
      await queryClient.invalidateQueries({ queryKey: ["auth", "codex", "account"] });
    }
  });

  const logoutMutation = useMutation({
    mutationFn: logoutCodexAccount,
    onSuccess: async () => {
      setPendingLogin(null);
      setMessage("Codex account disconnected.");
      await queryClient.invalidateQueries({ queryKey: ["auth", "codex", "account"] });
    }
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      await accountQuery.refetch();
    }
  });

  useEffect(() => {
    if (!pendingLogin || !accountQuery.data) {
      return;
    }

    const authenticated = !accountQuery.data.requiresOpenaiAuth || Boolean(accountQuery.data.account);
    if (!authenticated) {
      return;
    }

    setPendingLogin(null);
    setMessage("Codex account connected.");
  }, [accountQuery.data, pendingLogin]);

  const unavailable = accountQuery.error instanceof ApiError && accountQuery.error.status === 503;
  const requiresAuth = !unavailable && Boolean(accountQuery.data?.requiresOpenaiAuth && !accountQuery.data.account);
  const authBlocked = requiresAuth || pendingLogin !== null;
  const mutationError = startLoginMutation.error ?? cancelLoginMutation.error ?? logoutMutation.error ?? refreshMutation.error;
  const statusLabel = resolveCodexStatusLabel({
    loading: accountQuery.isLoading,
    unavailable,
    requiresAuth,
    pendingLogin: pendingLogin !== null,
    account: accountQuery.data?.account ?? null
  });
  const accountError = accountQuery.error instanceof ApiError && accountQuery.error.status === 503 ? null : accountQuery.error;
  const error = mutationError ?? accountError;

  return {
    accountStatus: accountQuery.data,
    unavailable,
    authBlocked,
    pendingLogin: pendingLogin !== null,
    statusLabel,
    message,
    authUrl: pendingLogin?.authUrl ?? null,
    loading: accountQuery.isLoading,
    fetching: accountQuery.isFetching,
    connectPending: startLoginMutation.isPending,
    cancelPending: cancelLoginMutation.isPending,
    refreshPending: refreshMutation.isPending,
    logoutPending: logoutMutation.isPending,
    error,
    startLogin: () => {
      startLoginMutation.mutate();
    },
    cancelLogin: () => {
      if (!pendingLogin) {
        return;
      }
      cancelLoginMutation.mutate();
    },
    refresh: () => {
      refreshMutation.mutate();
    },
    logout: () => {
      logoutMutation.mutate();
    }
  };
}
