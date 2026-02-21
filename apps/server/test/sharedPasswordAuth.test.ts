import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";

import { buildTestApp, cleanupDatabases } from "./testAppFactory.js";

afterEach(async () => {
  await cleanupDatabases();
});

describe("shared password auth", () => {
  it("accepts valid shared password and persists auth cookie", async () => {
    const { app } = await buildTestApp();
    const client = request.agent(app);

    const loginResponse = await client
      .post("/api/auth/login")
      .send({ password: "super-secret-password", username: "remote-operator" })
      .expect(200);

    expect(loginResponse.body.user.username).toBe("remote-operator");

    await client.get("/api/auth/me").expect(200);
  });

  it("rejects invalid shared password", async () => {
    const { app } = await buildTestApp();

    await request(app)
      .post("/api/auth/login")
      .send({ password: "incorrect-password" })
      .expect(401);
  });

  it("does not expose bootstrap or admin endpoints", async () => {
    const { app } = await buildTestApp();

    await request(app).post("/api/auth/bootstrap").send({ password: "super-secret-password" }).expect(404);
    await request(app).get("/api/admin/users").expect(404);
  });
});
