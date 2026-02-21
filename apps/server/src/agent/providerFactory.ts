import type { AppConfig } from "../config/env.js";

import { CommandAgentProvider } from "./providers/commandProvider.js";
import { MockAgentProvider } from "./providers/mockProvider.js";
import type { AgentProvider } from "./types.js";

export function createAgentProvider(config: AppConfig): AgentProvider {
  if (config.agentMode === "mock") {
    return new MockAgentProvider();
  }

  if (config.agentMode === "command") {
    if (!config.agentCommand) {
      throw new Error("BOB_AGENT_COMMAND is required when BOB_AGENT_MODE=command");
    }
    return new CommandAgentProvider(config.agentCommand, config.agentHistoryWindow, {
      model: config.codexModel,
      reasoningEffort: config.codexReasoningEffort
    });
  }

  if (config.agentCommand) {
    return new CommandAgentProvider(config.agentCommand, config.agentHistoryWindow, {
      model: config.codexModel,
      reasoningEffort: config.codexReasoningEffort
    });
  }

  return new MockAgentProvider();
}
