import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";

import { buildTestApp, cleanupDatabases } from "./testAppFactory.js";

afterEach(async () => {
  await cleanupDatabases();
});

describe("audit events", () => {
  it("records auth/session/run events for shared-password flows", async () => {
    const { app, repos } = await buildTestApp();
    const client = request.agent(app);

    await client
      .post("/api/auth/login")
      .send({ password: "super-secret-password" })
      .expect(200);

    const sessionResponse = await client
      .post("/api/sessions")
      .send({ title: "Audit Session", workspace: "/tmp" })
      .expect(201);

    const sessionId = sessionResponse.body.session.id as string;

    await client
      .post(`/api/sessions/${sessionId}/messages`)
      .send({ content: "generate plan" })
      .expect(202);

    await new Promise((resolve) => setTimeout(resolve, 450));

    const eventTypes = repos.audit.listRecent(200).map((event) => event.eventType);

    expect(eventTypes).toContain("auth.login");
    expect(eventTypes).toContain("session.create");
    expect(eventTypes).toContain("session.message.create");
    expect(eventTypes).toContain("run.queued");
    expect(eventTypes).toContain("run.completed");
  });

  it("does not expose an audit admin endpoint", async () => {
    const { app } = await buildTestApp();
    await request(app).get("/api/admin/audit-events").expect(404);
  });
});
