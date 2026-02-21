import { useEffect, useMemo, useState, type FormEvent } from "react";

import type { Session, Workspace } from "../types";

interface SessionListProps {
  sessions: Session[];
  workspaces: Workspace[];
  activeSessionId?: string;
  creating: boolean;
  createDisabled?: boolean;
  onSelect: (sessionId: string) => void;
  onCreate: (input: { title: string; workspace: string }) => void;
  mobile?: boolean;
  onCloseRequest?: () => void;
}

export function SessionList({
  sessions,
  workspaces,
  activeSessionId,
  creating,
  createDisabled = false,
  onSelect,
  onCreate,
  mobile = false,
  onCloseRequest
}: SessionListProps) {
  const [title, setTitle] = useState("");
  const defaultWorkspace = useMemo(() => workspaces[0]?.path ?? "", [workspaces]);
  const [workspace, setWorkspace] = useState(defaultWorkspace);

  useEffect(() => {
    if (defaultWorkspace && !workspace) {
      setWorkspace(defaultWorkspace);
    }
  }, [defaultWorkspace, workspace]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || !workspace) {
      return;
    }

    onCreate({ title: title.trim(), workspace });
    setTitle("");
  };

  return (
    <aside className="session-list">
      <header className="session-list-header">
        <div>
          <p className="eyebrow">Sessions</p>
          <h2>Workspace Threads</h2>
        </div>
        {mobile && onCloseRequest ? (
          <button type="button" className="secondary-button session-list-close" onClick={onCloseRequest}>
            Close
          </button>
        ) : null}
      </header>

      <form className="session-create-form" onSubmit={submit}>
        <select
          value={workspace}
          onChange={(event) => setWorkspace(event.target.value)}
          disabled={creating || createDisabled || workspaces.length === 0}
        >
          {workspaces.map((item) => (
            <option value={item.path} key={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <input
          placeholder="Session title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          disabled={creating || createDisabled}
        />
        <button type="submit" disabled={creating || createDisabled || workspaces.length === 0}>
          {creating ? "Creating..." : "New Session"}
        </button>
      </form>

      <div className="session-items">
        {sessions.map((session) => (
          <button
            key={session.id}
            onClick={() => onSelect(session.id)}
            className={session.id === activeSessionId ? "active" : ""}
            type="button"
          >
            <span>{session.title}</span>
            <small>{new Date(session.updatedAt).toLocaleString()}</small>
          </button>
        ))}

        {sessions.length === 0 ? <p className="empty-hint">Create a session to start a coding run.</p> : null}
      </div>
    </aside>
  );
}
