import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { getSocket } from "../../lib/socket";

import { sessionKeys } from "./queryKeys";
import { applyRunEvent } from "./runEventCache";
import type { RunEvent, SessionDetail } from "./types";

export function useRunEvents() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getSocket();

    const onRunEvent = (event: RunEvent) => {
      queryClient.setQueryData<SessionDetail | undefined>(sessionKeys.detail(event.sessionId), (current) =>
        applyRunEvent(current, event)
      );

      if (event.type === "completed" || event.type === "failed") {
        void queryClient.invalidateQueries({ queryKey: sessionKeys.detail(event.sessionId) });
        void queryClient.invalidateQueries({ queryKey: sessionKeys.all });
      }
    };

    socket.on("run:event", onRunEvent);

    return () => {
      socket.off("run:event", onRunEvent);
    };
  }, [queryClient]);
}
