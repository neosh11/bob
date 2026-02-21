import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { Message, RunStatus } from "../types";

interface MessageThreadProps {
  messages: Message[];
  runStatuses?: Record<string, RunStatus>;
}

const AUTO_SCROLL_THRESHOLD_PX = 120;

function isNearBottom(element: HTMLElement): boolean {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= AUTO_SCROLL_THRESHOLD_PX;
}

function renderMessageContent(message: Message, runStatus?: RunStatus): string {
  if (message.content.trim().length > 0) {
    return message.content;
  }

  if (message.role === "assistant") {
    if (runStatus === "queued" || runStatus === "running") {
      return "Waiting for first token...";
    }
    return "No response text returned for this run.";
  }

  return "(empty)";
}

function renderPreview(content: string): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "(empty)";
  }

  return normalized.length > 140 ? `${normalized.slice(0, 137)}...` : normalized;
}

export function MessageThread({ messages, runStatuses = {} }: MessageThreadProps) {
  const [expandedMessages, setExpandedMessages] = useState<Record<string, boolean>>({});
  const threadRef = useRef<HTMLDivElement | null>(null);
  const autoScrollEnabledRef = useRef(true);
  const sessionId = messages[0]?.sessionId ?? null;

  useEffect(() => {
    autoScrollEnabledRef.current = true;
  }, [sessionId]);

  useLayoutEffect(() => {
    const thread = threadRef.current;
    if (!thread || !autoScrollEnabledRef.current) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      thread.scrollTop = thread.scrollHeight;
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [messages, runStatuses]);

  const toggleExpanded = (id: string) => {
    setExpandedMessages((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const computedMessages = useMemo(
    () =>
      messages.map((message) => {
        const runStatus = message.runId ? runStatuses[message.runId] : undefined;
        const isAssistant = message.role === "assistant";
        const isSystem = message.role === "system";
        const isExpanded = expandedMessages[message.id] ?? false;
        const isPendingAssistant = isAssistant && (runStatus === "queued" || runStatus === "running");
        const content = renderMessageContent(message, runStatus);
        const shouldShowToggle = !isPendingAssistant && (isAssistant || isSystem);
        const shouldCollapse = shouldShowToggle && !isExpanded;

        return {
          message,
          isAssistant,
          isExpanded,
          isPendingAssistant,
          content,
          shouldShowToggle,
          shouldCollapse
        };
      }),
    [expandedMessages, messages, runStatuses]
  );

  return (
    <div
      className="message-thread"
      ref={threadRef}
      onScroll={() => {
        const thread = threadRef.current;
        if (!thread) {
          return;
        }
        autoScrollEnabledRef.current = isNearBottom(thread);
      }}
    >
      {computedMessages.map(({ message, isAssistant, isExpanded, isPendingAssistant, content, shouldShowToggle, shouldCollapse }) => (
        <article
          key={message.id}
          className={`message message-${message.role}${isPendingAssistant ? " message-pending" : ""}`}
        >
          <div className="message-meta">
            <span className="message-role">
              {message.role === "system"
                ? message.systemMessageType === "plan"
                  ? "Plan"
                  : message.systemMessageType === "reasoning"
                    ? "Reasoning"
                    : "System"
                : message.role === "assistant"
                  ? "Assistant"
                  : "User"}
            </span>
            <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleTimeString()}</time>
          </div>
          <div className="message-body">
            {isPendingAssistant ? (
              <div className="message-pending-indicator" aria-live="polite">
                <span className="message-pending-dot" />
                <p>Generating response...</p>
              </div>
            ) : null}

            {shouldShowToggle ? (
              <div className="message-toggle-row">
                <button
                  type="button"
                  className="message-toggle"
                  aria-expanded={isExpanded}
                  aria-controls={`message-content-${message.id}`}
                  onClick={() => {
                    toggleExpanded(message.id);
                  }}
                >
                  {isExpanded ? "Hide details" : isAssistant ? "Show response" : "Show reasoning"}
                </button>
                {isExpanded ? null : <p className="message-preview">{renderPreview(content)}</p>}
              </div>
            ) : null}

            <pre id={`message-content-${message.id}`} className={`message-contents${shouldCollapse ? " message-contents-collapsed" : ""}`}>
              {content}
            </pre>
          </div>
        </article>
      ))}
    </div>
  );
}
