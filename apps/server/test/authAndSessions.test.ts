import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";

import { buildTestApp, cleanupDatabases } from "./testAppFactory.js";

afterEach(async () => {
  await cleanupDatabases();
});

describe("auth + session flows", () => {
  it("rejects protected routes when not logged in", async () => {
    const { app } = await buildTestApp();
    await request(app).get("/api/sessions").expect(401);
  });

  it("logs in and creates sessions/messages", async () => {
    const { app } = await buildTestApp();
    const client = request.agent(app);

    await client
      .post("/api/auth/login")
      .send({ password: "super-secret-password" })
      .expect(200);

    const createSession = await client
      .post("/api/sessions")
      .send({ title: "First Session", workspace: "/tmp" })
      .expect(201);

    const sessionId = createSession.body.session.id as string;

    await client
      .post(`/api/sessions/${sessionId}/messages`)
      .send({ content: "Create a plan" })
      .expect(202);

    await new Promise((resolve) => setTimeout(resolve, 250));

    const detail = await client.get(`/api/sessions/${sessionId}`).expect(200);
    expect(detail.body.messages.length).toBeGreaterThanOrEqual(2);
    expect(detail.body.runs.length).toBeGreaterThanOrEqual(1);
  });

  it("deletes a session and cascades messages/runs", async () => {
    const { app } = await buildTestApp();
    const client = request.agent(app);

    await client
      .post("/api/auth/login")
      .send({ password: "super-secret-password" })
      .expect(200);

    const createSession = await client
      .post("/api/sessions")
      .send({ title: "Disposable Session", workspace: "/tmp" })
      .expect(201);
    const sessionId = createSession.body.session.id as string;

    await client
      .post(`/api/sessions/${sessionId}/messages`)
      .send({ content: "Create temporary changes" })
      .expect(202);

    await new Promise((resolve) => setTimeout(resolve, 200));

    await client.delete(`/api/sessions/${sessionId}`).expect(204);

    await client.get(`/api/sessions/${sessionId}`).expect(404);

    const list = await client.get("/api/sessions").expect(200);
    const found = (list.body.sessions as Array<{ id: string }>).some((session) => session.id === sessionId);
    expect(found).toBe(false);
  });
});
