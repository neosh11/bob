import { apiRequest } from "../../lib/apiClient";

import type { AgentSettings } from "./types";

interface AgentSettingsResponse {
  settings: AgentSettings;
}

export function fetchAgentSettings(): Promise<AgentSettingsResponse> {
  return apiRequest<AgentSettingsResponse>("/agent/settings");
}

export function updateAgentSettings(input: AgentSettings): Promise<AgentSettingsResponse> {
  return apiRequest<AgentSettingsResponse>("/agent/settings", {
    method: "PUT",
    body: input
  });
}
