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

  it("filters sessions by workspace", async () => {
    const { app } = await buildTestApp({
      configOverrides: {
        workspaces: [
          { id: "ws-1", label: "alpha", path: "/tmp/alpha" },
          { id: "ws-2", label: "beta", path: "/tmp/beta" }
        ]
      }
    });
    const client = request.agent(app);

    await client
      .post("/api/auth/login")
      .send({ password: "super-secret-password" })
      .expect(200);

    await client
      .post("/api/sessions")
      .send({ title: "Alpha Session", workspace: "/tmp/alpha" })
      .expect(201);

    await client
      .post("/api/sessions")
      .send({ title: "Beta Session", workspace: "/tmp/beta" })
      .expect(201);

    const alpha = await client.get("/api/sessions").query({ workspace: "/tmp/alpha" }).expect(200);
    expect((alpha.body.sessions as Array<{ workspace: string }>).every((session) => session.workspace === "/tmp/alpha")).toBe(true);
    expect((alpha.body.sessions as Array<unknown>).length).toBe(1);

    const beta = await client.get("/api/sessions").query({ workspace: "/tmp/beta" }).expect(200);
    expect((beta.body.sessions as Array<{ workspace: string }>).every((session) => session.workspace === "/tmp/beta")).toBe(true);
    expect((beta.body.sessions as Array<unknown>).length).toBe(1);
  });
});
