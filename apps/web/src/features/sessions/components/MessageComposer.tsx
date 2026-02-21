import { useState, useLayoutEffect, useRef, type FormEvent } from "react";

interface MessageComposerProps {
  sending: boolean;
  steering?: boolean;
  canSteer?: boolean;
  disabled?: boolean;
  onSend: (content: string) => Promise<void>;
  onSteer?: (content: string) => Promise<void>;
}

export function MessageComposer({
  sending,
  steering = false,
  canSteer = false,
  disabled = false,
  onSend,
  onSteer
}: MessageComposerProps) {
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const MAX_TEXTAREA_HEIGHT = 220;

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    const nextHeight = Math.min(MAX_TEXTAREA_HEIGHT, textarea.scrollHeight);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > MAX_TEXTAREA_HEIGHT ? "auto" : "hidden";
  }, [content]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!content.trim()) {
      return;
    }

    await onSend(content.trim());
    setContent("");
  };

  const submitSteer = async () => {
    if (!onSteer || !content.trim() || disabled) {
      return;
    }

    await onSteer(content.trim());
    setContent("");
  };

  return (
    <div className="message-composer">
      <form className="message-run-form" onSubmit={submit}>
        <textarea
          placeholder="Describe the coding task for Bob..."
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={3}
          ref={textareaRef}
          disabled={sending || disabled}
        />
        <div className="message-composer-actions">
          <button type="submit" disabled={sending || disabled}>
            {sending ? "Sending..." : "Run Task"}
          </button>
          {canSteer && onSteer ? (
            <button
              type="button"
              className="secondary-button steer-action-button"
              disabled={disabled || steering || !content.trim()}
              onClick={() => {
                void submitSteer();
              }}
            >
              {steering ? "Steering..." : "Steer"}
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
