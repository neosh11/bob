import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";

import { throwIfAborted } from "../src/agent/errors.js";
import type { AgentEvent, AgentProvider, AgentRunInput } from "../src/agent/types.js";
import { buildTestApp, cleanupDatabases } from "./testAppFactory.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class SlowProvider implements AgentProvider {
  id = "slow";

  description = "Slow test provider for queue and cancellation behavior";

  async run(input: AgentRunInput, onEvent: (event: AgentEvent) => void, options?: { signal?: AbortSignal }): Promise<void> {
    onEvent({ type: "status", value: "slow" });

    for (let index = 0; index < 20; index += 1) {
      throwIfAborted(options?.signal);
      onEvent({ type: "delta", text: `chunk-${index}:${input.prompt}\n` });
      await sleep(40);
    }
  }
}

afterEach(async () => {
  await cleanupDatabases();
});

describe("run cancellation", () => {
  it("cancels an actively running run", async () => {
    const { app } = await buildTestApp({
      provider: new SlowProvider(),
      configOverrides: {
        maxConcurrentRuns: 1
      }
    });

    const client = request.agent(app);
    await client
      .post("/api/auth/login")
      .send({ password: "super-secret-password" })
      .expect(200);

    const createSession = await client
      .post("/api/sessions")
      .send({ title: "Cancel Running", workspace: "/tmp" })
      .expect(201);

    const sessionId = createSession.body.session.id as string;

    const messageResponse = await client
      .post(`/api/sessions/${sessionId}/messages`)
      .send({ content: "long-run" })
      .expect(202);

    const runId = messageResponse.body.run.id as string;

    await sleep(120);

    await client.post(`/api/sessions/${sessionId}/runs/${runId}/cancel`).expect(202);

    await sleep(150);

    const detail = await client.get(`/api/sessions/${sessionId}`).expect(200);
    const run = detail.body.runs.find((entry: { id: string }) => entry.id === runId);
    expect(run.status).toBe("failed");
    expect(run.error).toContain("canceled");
  });

  it("cancels a queued run before execution", async () => {
    const { app } = await buildTestApp({
      provider: new SlowProvider(),
      configOverrides: {
        maxConcurrentRuns: 1
      }
    });

    const client = request.agent(app);
    await client
      .post("/api/auth/login")
      .send({ password: "super-secret-password" })
      .expect(200);

    const createSession = await client
      .post("/api/sessions")
      .send({ title: "Cancel Queued", workspace: "/tmp" })
      .expect(201);

    const sessionId = createSession.body.session.id as string;

    await client
      .post(`/api/sessions/${sessionId}/messages`)
      .send({ content: "primary" })
      .expect(202);

    const queuedMessage = await client
      .post(`/api/sessions/${sessionId}/messages`)
      .send({ content: "secondary" })
      .expect(202);

    const queuedRunId = queuedMessage.body.run.id as string;

    await client.post(`/api/sessions/${sessionId}/runs/${queuedRunId}/cancel`).expect(202);

    await sleep(120);

    const detail = await client.get(`/api/sessions/${sessionId}`).expect(200);
    const queuedRun = detail.body.runs.find((entry: { id: string }) => entry.id === queuedRunId);
    expect(queuedRun.status).toBe("failed");
    expect(queuedRun.error).toContain("canceled");

    const canceledMessage = detail.body.messages.find(
      (entry: { runId: string | null; role: string }) => entry.runId === queuedRunId && entry.role === "assistant"
    );
    expect(canceledMessage.content).toContain("canceled");
  });

  it("deletes a session while a run is active", async () => {
    const { app } = await buildTestApp({
      provider: new SlowProvider(),
      configOverrides: {
        maxConcurrentRuns: 1
      }
    });

    const client = request.agent(app);
    await client
      .post("/api/auth/login")
      .send({ password: "super-secret-password" })
      .expect(200);

    const createSession = await client
      .post("/api/sessions")
      .send({ title: "Delete Active", workspace: "/tmp" })
      .expect(201);
    const sessionId = createSession.body.session.id as string;

    await client
      .post(`/api/sessions/${sessionId}/messages`)
      .send({ content: "long-running work" })
      .expect(202);

    await sleep(120);
    await client.delete(`/api/sessions/${sessionId}`).expect(204);

    await sleep(120);
    await client.get(`/api/sessions/${sessionId}`).expect(404);
  });
});
