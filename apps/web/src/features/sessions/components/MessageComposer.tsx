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
  const [steerContent, setSteerContent] = useState("");
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

  const submitSteer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onSteer || !steerContent.trim() || disabled) {
      return;
    }

    await onSteer(steerContent.trim());
    setSteerContent("");
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
        <button type="submit" disabled={sending || disabled}>
          {sending ? "Sending..." : "Run Task"}
        </button>
      </form>

      {canSteer && onSteer ? (
        <form className="steer-composer" onSubmit={submitSteer}>
          <input
            placeholder="Steer current run..."
            value={steerContent}
            onChange={(event) => setSteerContent(event.target.value)}
            disabled={disabled || steering}
          />
          <button type="submit" className="secondary-button" disabled={disabled || steering || !steerContent.trim()}>
            {steering ? "Steering..." : "Steer Run"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
