import type { MessageRecord } from "../types/domain.js";

const MAX_MESSAGE_CHARS = 3_000;

function summarizeMessage(message: MessageRecord): string {
  const compact = message.content.replace(/\s+/gu, " ").trim();
  const clipped = compact.length > MAX_MESSAGE_CHARS ? `${compact.slice(0, MAX_MESSAGE_CHARS)}...` : compact;
  return `[${message.role}] ${clipped}`;
}

export function renderHistoryWindow(history: MessageRecord[], windowSize: number): string {
  const window = history.slice(-windowSize);
  if (window.length === 0) {
    return "(no prior messages)";
  }

  return window.map(summarizeMessage).join("\n");
}

export function composePrompt(input: {
  sessionId: string;
  workspace: string;
  prompt: string;
  history: MessageRecord[];
  historyWindow: number;
}): string {
  const historyText = renderHistoryWindow(input.history, input.historyWindow);

  return [
    "Continue the coding conversation using the available workspace context.",
    `Session: ${input.sessionId}`,
    `Workspace: ${input.workspace}`,
    "Recent conversation (oldest to newest):",
    historyText,
    "Latest user request:",
    input.prompt
  ].join("\n\n");
}
