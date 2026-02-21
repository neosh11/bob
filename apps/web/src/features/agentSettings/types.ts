export type ReasoningEffort = "low" | "medium" | "high";

export interface AgentSettings {
  model: string;
  reasoningEffort: ReasoningEffort;
}
