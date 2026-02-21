import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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

export function MessageThread({ messages, runStatuses = {} }: MessageThreadProps) {
  const threadRef = useRef<HTMLDivElement | null>(null);
  const autoScrollEnabledRef = useRef(true);
  const [activeTimestampMessageId, setActiveTimestampMessageId] = useState<string | null>(null);
  const sessionId = messages[0]?.sessionId ?? null;

  useEffect(() => {
    autoScrollEnabledRef.current = true;
  }, [sessionId]);

  useEffect(() => {
    setActiveTimestampMessageId(null);
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

  const computedMessages = useMemo(
    () =>
      messages.filter((message) => message.role !== "system").map((message) => {
        const runStatus = message.runId ? runStatuses[message.runId] : undefined;
        const isPendingAssistant = message.role === "assistant" && (runStatus === "queued" || runStatus === "running");
        const content = renderMessageContent(message, runStatus);
        const shouldHideContent = message.role === "assistant" && isPendingAssistant;

        return {
          message,
          isPendingAssistant,
          content,
          shouldHideContent
        };
      }),
    [messages, runStatuses]
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
      {computedMessages.map(({ message, isPendingAssistant, content, shouldHideContent }) => (
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
                <p>Generating response...</p>
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
