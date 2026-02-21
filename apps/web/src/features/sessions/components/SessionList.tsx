import { useRef, useState, type FormEvent } from "react";

import type { Session, Workspace } from "../types";

interface SessionListProps {
  sessions: Session[];
  workspaces: Workspace[];
  selectedWorkspace: string;
  activeSessionId?: string;
  creating: boolean;
  deleting?: boolean;
  createDisabled?: boolean;
  onWorkspaceChange: (workspace: string) => void;
  onSelect: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
  onCreate: (input: { title: string; workspace: string }) => void;
  mobile?: boolean;
  onCloseRequest?: () => void;
}

const SWIPE_ACTION_WIDTH = 88;
const SWIPE_OPEN_THRESHOLD = 36;
const SWIPE_DELETE_THRESHOLD = 80;

export function SessionList({
  sessions,
  workspaces,
  selectedWorkspace,
  activeSessionId,
  creating,
  deleting = false,
  createDisabled = false,
  onWorkspaceChange,
  onSelect,
  onDelete,
  onCreate,
  mobile = false,
  onCloseRequest
}: SessionListProps) {
  const [title, setTitle] = useState("");
  const [openActionsSessionId, setOpenActionsSessionId] = useState<string | null>(null);
  const [dragOffsetBySessionId, setDragOffsetBySessionId] = useState<Record<string, number>>({});
  const touchStartXRef = useRef(0);
  const touchSessionIdRef = useRef<string | null>(null);
  const didSwipeRef = useRef(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || !selectedWorkspace) {
      return;
    }

    onCreate({ title: title.trim(), workspace: selectedWorkspace });
    setTitle("");
  };

  const closeSwipeActions = () => {
    setOpenActionsSessionId(null);
    setDragOffsetBySessionId({});
  };

  const getSessionOffset = (sessionId: string) => {
    const draggedOffset = dragOffsetBySessionId[sessionId];
    if (typeof draggedOffset === "number") {
      return draggedOffset;
    }

    return openActionsSessionId === sessionId ? SWIPE_ACTION_WIDTH : 0;
  };

  const onItemTouchStart = (sessionId: string, touchX: number) => {
    if (!mobile) {
      return;
    }

    touchStartXRef.current = touchX;
    touchSessionIdRef.current = sessionId;
    didSwipeRef.current = false;
  };

  const onItemTouchMove = (sessionId: string, touchX: number) => {
    if (!mobile || touchSessionIdRef.current !== sessionId) {
      return;
    }

    const baseOffset = openActionsSessionId === sessionId ? SWIPE_ACTION_WIDTH : 0;
    const delta = touchStartXRef.current - touchX;
    const nextOffset = Math.max(0, Math.min(SWIPE_ACTION_WIDTH, baseOffset + delta));

    if (Math.abs(delta) > 6) {
      didSwipeRef.current = true;
    }

    setDragOffsetBySessionId({ [sessionId]: nextOffset });
  };

  const onItemTouchEnd = (sessionId: string) => {
    if (!mobile || touchSessionIdRef.current !== sessionId) {
      return;
    }

    const finalOffset = dragOffsetBySessionId[sessionId] ?? 0;
    if (finalOffset >= SWIPE_DELETE_THRESHOLD) {
      closeSwipeActions();
      onDelete(sessionId);
      touchSessionIdRef.current = null;
      return;
    }

    const shouldOpen = finalOffset >= SWIPE_OPEN_THRESHOLD;
    setOpenActionsSessionId(shouldOpen ? sessionId : null);
    setDragOffsetBySessionId({});
    touchSessionIdRef.current = null;
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
          value={selectedWorkspace}
          onChange={(event) => onWorkspaceChange(event.target.value)}
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
        <button type="submit" disabled={creating || createDisabled || workspaces.length === 0 || !selectedWorkspace}>
          {creating ? "Creating..." : "New Session"}
        </button>
      </form>

      <div className="session-items">
        {sessions.map((session) => {
          const offset = getSessionOffset(session.id);

          return (
            <div key={session.id} className={`session-swipe-item${openActionsSessionId === session.id ? " actions-open" : ""}`}>
              <div className="session-swipe-actions">
                <button
                  type="button"
                  className="session-delete-action"
                  disabled={deleting}
                  onClick={() => {
                    closeSwipeActions();
                    onDelete(session.id);
                  }}
                >
                  Delete
                </button>
              </div>
              <button
                onClick={() => {
                  if (didSwipeRef.current) {
                    didSwipeRef.current = false;
                    return;
                  }

                  if (openActionsSessionId === session.id) {
                    closeSwipeActions();
                    return;
                  }

                  onSelect(session.id);
                }}
                onTouchStart={(event) => {
                  const touch = event.touches.item(0);
                  if (!touch) {
                    return;
                  }
                  onItemTouchStart(session.id, touch.clientX);
                }}
                onTouchMove={(event) => {
                  const touch = event.touches.item(0);
                  if (!touch) {
                    return;
                  }
                  onItemTouchMove(session.id, touch.clientX);
                }}
                onTouchEnd={() => {
                  onItemTouchEnd(session.id);
                }}
                onTouchCancel={() => {
                  touchSessionIdRef.current = null;
                  setDragOffsetBySessionId({});
                }}
                className={`session-item-main${session.id === activeSessionId ? " active" : ""}`}
                style={mobile ? { transform: `translateX(-${offset}px)` } : undefined}
                type="button"
              >
                <span>{session.title}</span>
                <small>{new Date(session.updatedAt).toLocaleString()}</small>
              </button>
            </div>
          );
        })}

        {sessions.length === 0 ? <p className="empty-hint">Create a session to start a coding run.</p> : null}
      </div>
    </aside>
  );
}
