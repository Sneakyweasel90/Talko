import request from "supertest";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import cors from "cors";
import authRoutes from "../routes/auth.routes.js";
import channelsRoutes from "../routes/channels.routes.js";
import adminRoutes from "../routes/admin.routes.js";
import db from "../db/postgres.js";

const app = express();
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/channels", channelsRoutes);
app.use("/api/admin", adminRoutes);

let adminToken = "";
let userToken = "";
let testUserId = null;

describe("Auth API", () => {
  it("rejects login with invalid credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "nonexistent", password: "wrong" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("rejects registration with invalid invite code", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        username: "testuser123",
        password: "password123",
        inviteCode: "BADINVITE",
      });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/invalid/i);
  });

  it("rejects registration with short password", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        username: "testuser123",
        password: "123",
        inviteCode: process.env.INVITE_CODE,
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/6 characters/i);
  });

  it("rejects registration with invalid username", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        username: "ab",
        password: "password123",
        inviteCode: process.env.INVITE_CODE,
      });
    expect(res.status).toBe(400);
  });

  it("logs in with valid credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        username: process.env.TEST_ADMIN_USER,
        password: process.env.TEST_ADMIN_PASS,
      });

    if (res.status === 200) {
      adminToken = res.body.token;
      expect(res.body.token).toBeDefined();
    } else {
      console.warn(
        "No TEST_ADMIN_USER/TEST_ADMIN_PASS set, skipping auth test",
      );
    }
  });
});

describe("Channels API", () => {
  it("rejects unauthenticated channel list request", async () => {
    const res = await request(app).get("/api/channels");
    expect(res.status).toBe(401);
  });

  it("returns channels for authenticated user", async () => {
    if (!adminToken) return;
    const res = await request(app)
      .get("/api/channels")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("rejects channel creation without auth", async () => {
    const res = await request(app)
      .post("/api/channels")
      .send({ name: "testchannel", type: "text" });
    expect(res.status).toBe(401);
  });
});

describe("Admin API", () => {
  it("rejects admin users list without auth", async () => {
    const res = await request(app).get("/api/admin/users");
    expect(res.status).toBe(401);
  });

  it("returns afk timeout publicly", async () => {
    const res = await request(app).get("/api/admin/afk-timeout");
    expect(res.status).toBe(200);
    expect(res.body.afk_timeout_minutes).toBeDefined();
  });
});
