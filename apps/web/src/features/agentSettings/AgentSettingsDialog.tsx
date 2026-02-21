import { useEffect, useState, type FormEvent } from "react";

import type { AgentSettings } from "./types";

interface AgentSettingsDialogProps {
  open: boolean;
  current: AgentSettings | undefined;
  saving: boolean;
  onClose: () => void;
  onSave: (next: AgentSettings) => Promise<void>;
}

export function AgentSettingsDialog({ open, current, saving, onClose, onSave }: AgentSettingsDialogProps) {
  const [model, setModel] = useState("");
  const [reasoningEffort, setReasoningEffort] = useState<AgentSettings["reasoningEffort"]>("medium");

  useEffect(() => {
    if (!open || !current) {
      return;
    }

    setModel(current.model);
    setReasoningEffort(current.reasoningEffort);
  }, [current, open]);

  if (!open) {
    return null;
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSave({
      model: model.trim(),
      reasoningEffort
    });
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Agent settings">
      <form className="settings-dialog" onSubmit={onSubmit}>
        <h2>Agent Settings</h2>
        <p className="settings-help">Updates apply to new runs immediately.</p>

        <label>
          Model
          <input value={model} onChange={(event) => setModel(event.target.value)} required maxLength={120} disabled={saving} />
        </label>

        <label>
          Reasoning Effort
          <select value={reasoningEffort} onChange={(event) => setReasoningEffort(event.target.value as AgentSettings["reasoningEffort"])} disabled={saving}>
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </select>
        </label>

        <div className="settings-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
