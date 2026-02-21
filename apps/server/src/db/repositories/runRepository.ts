import crypto from "node:crypto";
import type Database from "better-sqlite3";

import type { RunRecord, RunStatus } from "../../types/domain.js";

type RunRow = {
  id: string;
  session_id: string;
  provider: string;
  status: RunStatus;
  output: string;
  error: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
};

function mapRun(row: RunRow): RunRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    provider: row.provider,
    status: row.status,
    output: row.output,
    error: row.error,
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at
  };
}

export class RunRepository {
  constructor(private readonly db: Database.Database) {}

  createRun(input: { sessionId: string; provider: string }): RunRecord {
    const run: RunRecord = {
      id: crypto.randomUUID(),
      sessionId: input.sessionId,
      provider: input.provider,
      status: "queued",
      output: "",
      error: null,
      createdAt: new Date().toISOString(),
      startedAt: null,
      finishedAt: null
    };

    this.db
      .prepare(
        `INSERT INTO runs (id, session_id, provider, status, output, error, created_at, started_at, finished_at)
         VALUES (@id, @session_id, @provider, @status, @output, @error, @created_at, @started_at, @finished_at)`
      )
      .run({
        id: run.id,
        session_id: run.sessionId,
        provider: run.provider,
        status: run.status,
        output: run.output,
        error: run.error,
        created_at: run.createdAt,
        started_at: run.startedAt,
        finished_at: run.finishedAt
      });

    return run;
  }

  listBySession(sessionId: string): RunRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM runs WHERE session_id = ? ORDER BY created_at DESC")
      .all(sessionId) as RunRow[];
    return rows.map(mapRun);
  }

  findByIdForSession(runId: string, sessionId: string): RunRecord | null {
    const row = this.db
      .prepare("SELECT * FROM runs WHERE id = ? AND session_id = ? LIMIT 1")
      .get(runId, sessionId) as RunRow | undefined;
    return row ? mapRun(row) : null;
  }

  updateRunStatus(runId: string, status: RunStatus, error: string | null = null): void {
    const startedAt = status === "running" ? new Date().toISOString() : null;
    const finishedAt = status === "completed" || status === "failed" ? new Date().toISOString() : null;

    const row = this.db
      .prepare("SELECT started_at FROM runs WHERE id = ?")
      .get(runId) as { started_at: string | null } | undefined;

    this.db
      .prepare(
        `UPDATE runs
         SET status = @status,
             error = @error,
             started_at = @started_at,
             finished_at = @finished_at
         WHERE id = @id`
      )
      .run({
        id: runId,
        status,
        error,
        started_at: row?.started_at ?? startedAt,
        finished_at: finishedAt
      });
  }

  appendOutput(runId: string, chunk: string): void {
    this.db
      .prepare("UPDATE runs SET output = output || ? WHERE id = ?")
      .run(chunk, runId);
  }
}
