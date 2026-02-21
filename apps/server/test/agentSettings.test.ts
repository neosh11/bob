import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";

import { buildTestApp, cleanupDatabases } from "./testAppFactory.js";

afterEach(async () => {
  await cleanupDatabases();
});

describe("agent settings", () => {
  it("returns current settings and supports runtime updates", async () => {
    const { app } = await buildTestApp();
    const client = request.agent(app);

    await client.post("/api/auth/login").send({ password: "super-secret-password" }).expect(200);

    const initial = await client.get("/api/agent/settings").expect(200);
    expect(initial.body.settings.model).toBe("gpt-5-codex");
    expect(initial.body.settings.reasoningEffort).toBe("medium");

    const updated = await client
      .put("/api/agent/settings")
      .send({ model: "gpt-5", reasoningEffort: "high" })
      .expect(200);

    expect(updated.body.settings.model).toBe("gpt-5");
    expect(updated.body.settings.reasoningEffort).toBe("high");

    const readBack = await client.get("/api/agent/settings").expect(200);
    expect(readBack.body.settings).toEqual({ model: "gpt-5", reasoningEffort: "high" });
  });
});
