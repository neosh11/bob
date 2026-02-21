import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { Message, RunStatus } from "../types";

interface MessageThreadProps {
  messages: Message[];
  runStatuses?: Record<string, RunStatus>;
}

const AUTO_SCROLL_THRESHOLD_PX = 120;
const FALLBACK_RUN_KEY = "__session__";

function isNearBottom(element: HTMLElement): boolean {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= AUTO_SCROLL_THRESHOLD_PX;
}

function renderMessageContent(message: Message, runStatus?: RunStatus): string {
  if (message.role === "assistant") {
    if (runStatus === "queued" || runStatus === "running") {
      return "";
    }

    if (message.content.trim().length > 0) {
      return message.content;
    }
    return "No response text returned for this run.";
  }

  if (message.content.trim().length > 0) {
    return message.content;
  }

  return "(empty)";
}

function summarizeReasoning(content: string): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "Working...";
  }

  return normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized;
}

export function MessageThread({ messages, runStatuses = {} }: MessageThreadProps) {
  const threadRef = useRef<HTMLDivElement | null>(null);
  const autoScrollEnabledRef = useRef(true);
  const [activeTimestampMessageId, setActiveTimestampMessageId] = useState<string | null>(null);
  const [expandedPendingReasoningByMessageId, setExpandedPendingReasoningByMessageId] = useState<Record<string, boolean>>({});
  const sessionId = messages[0]?.sessionId ?? null;

  useEffect(() => {
    autoScrollEnabledRef.current = true;
  }, [sessionId]);

  useEffect(() => {
    setActiveTimestampMessageId(null);
    setExpandedPendingReasoningByMessageId({});
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

  const latestReasoningByRunId = useMemo(() => {
    const latestByRunId: Record<string, string> = {};

    for (const message of messages) {
      if (message.role !== "system") {
        continue;
      }

      const trimmed = message.content.trim();
      if (!trimmed) {
        continue;
      }

      const runKey = message.runId ?? FALLBACK_RUN_KEY;
      latestByRunId[runKey] = trimmed;
    }

    return latestByRunId;
  }, [messages]);

  const computedMessages = useMemo(
    () =>
      messages.filter((message) => message.role !== "system").map((message) => {
        const runStatus = message.runId ? runStatuses[message.runId] : undefined;
        const isPendingAssistant = message.role === "assistant" && (runStatus === "queued" || runStatus === "running");
        const content = renderMessageContent(message, runStatus);
        const shouldHideContent = message.role === "assistant" && isPendingAssistant;
        const pendingReasoning = shouldHideContent
          ? latestReasoningByRunId[message.runId ?? FALLBACK_RUN_KEY] ?? latestReasoningByRunId[FALLBACK_RUN_KEY]
          : null;

        return {
          message,
          isPendingAssistant,
          content,
          shouldHideContent,
          pendingReasoning
        };
      }),
    [latestReasoningByRunId, messages, runStatuses]
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
      {computedMessages.map(({ message, isPendingAssistant, content, shouldHideContent, pendingReasoning }) => (
        <article
          key={message.id}
          className={`message message-${message.role}${isPendingAssistant ? " message-pending" : ""}${activeTimestampMessageId === message.id ? " message-show-meta" : ""}`}
          onClick={() => {
            setActiveTimestampMessageId((current) => (current === message.id ? null : message.id));
          }}
        >
          <div className="message-meta">
            <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleTimeString()}</time>
          </div>
          <div className="message-body">
            {isPendingAssistant ? (
              <div className="message-pending-indicator" aria-live="polite">
                <span className="message-pending-dot" />
                <div className="message-pending-reasoning">
                  <button
                    type="button"
                    className="message-pending-reasoning-toggle"
                    onClick={(event) => {
                      event.stopPropagation();
                      setExpandedPendingReasoningByMessageId((current) => ({
                        ...current,
                        [message.id]: !current[message.id]
                      }));
                    }}
                  >
                    {summarizeReasoning(pendingReasoning ?? "")}
                  </button>
                  {pendingReasoning && expandedPendingReasoningByMessageId[message.id] ? (
                    <div className="message-pending-reasoning-details">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{pendingReasoning}</ReactMarkdown>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {!shouldHideContent ? (
              <div id={`message-content-${message.id}`} className="message-contents">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
              </div>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
