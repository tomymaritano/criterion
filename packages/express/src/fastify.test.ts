import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import { defineDecision } from "@criterionx/core";
import { z } from "zod";
import { criterionPlugin, createDecisionRoute, createDecisionHook } from "./fastify.js";

// Test decision
const testDecision = defineDecision({
  id: "fastify-test",
  version: "1.0.0",
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ result: z.string() }),
  profileSchema: z.object({ threshold: z.number() }),
  rules: [
    {
      id: "above",
      when: (input, profile) => input.value > profile.threshold,
      emit: () => ({ result: "ABOVE" }),
      explain: () => "Value is above threshold",
    },
    {
      id: "below",
      when: () => true,
      emit: () => ({ result: "BELOW" }),
      explain: () => "Default: below threshold",
    },
  ],
});

describe("criterionPlugin", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
  });

  afterEach(async () => {
    await app.close();
  });

  it("should register decision endpoint", async () => {
    await app.register(criterionPlugin, {
      decisions: [testDecision],
      profiles: { "fastify-test": { threshold: 10 } },
    });

    const res = await app.inject({
      method: "POST",
      url: "/decisions/fastify-test",
      payload: { value: 50 },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("OK");
    expect(body.data.result).toBe("ABOVE");
  });

  it("should return BELOW when value is under threshold", async () => {
    await app.register(criterionPlugin, {
      decisions: [testDecision],
      profiles: { "fastify-test": { threshold: 100 } },
    });

    const res = await app.inject({
      method: "POST",
      url: "/decisions/fastify-test",
      payload: { value: 50 },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.result).toBe("BELOW");
  });

  it("should use custom prefix", async () => {
    // Register with empty prefix to test that prefix option is used
    await app.register(criterionPlugin, {
      decisions: [testDecision],
      profiles: { "fastify-test": { threshold: 10 } },
      prefix: "",
    });

    // With empty prefix, route should be at /fastify-test
    const res = await app.inject({
      method: "POST",
      url: "/fastify-test",
      payload: { value: 50 },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.result).toBe("ABOVE");

    // Default route should not exist
    const defaultRes = await app.inject({
      method: "POST",
      url: "/decisions/fastify-test",
      payload: { value: 50 },
    });
    expect(defaultRes.statusCode).toBe(404);
  });

  it("should use profile from query parameter", async () => {
    await app.register(criterionPlugin, {
      decisions: [testDecision],
      profiles: {
        low: { threshold: 10 },
        high: { threshold: 100 },
      },
    });

    const resLow = await app.inject({
      method: "POST",
      url: "/decisions/fastify-test?profile=low",
      payload: { value: 50 },
    });
    expect(JSON.parse(resLow.body).data.result).toBe("ABOVE");

    const resHigh = await app.inject({
      method: "POST",
      url: "/decisions/fastify-test?profile=high",
      payload: { value: 50 },
    });
    expect(JSON.parse(resHigh.body).data.result).toBe("BELOW");
  });

  it("should return 400 on validation error", async () => {
    await app.register(criterionPlugin, {
      decisions: [testDecision],
      profiles: { "fastify-test": { threshold: 10 } },
    });

    const res = await app.inject({
      method: "POST",
      url: "/decisions/fastify-test",
      payload: { value: "not a number" },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe("INVALID_INPUT");
  });
});

describe("createDecisionRoute", () => {
  let app: FastifyInstance;

  beforeEach(() => {
    app = Fastify();
  });

  afterEach(async () => {
    await app.close();
  });

  it("should create route handler", async () => {
    app.post("/test", createDecisionRoute({
      decision: testDecision,
      getProfile: () => ({ threshold: 10 }),
    }));

    const res = await app.inject({
      method: "POST",
      url: "/test",
      payload: { value: 50 },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.result).toBe("ABOVE");
  });

  it("should use custom response formatter", async () => {
    app.post("/test", createDecisionRoute({
      decision: testDecision,
      getProfile: () => ({ threshold: 10 }),
      formatResponse: (result) => ({
        outcome: result.data?.result,
        ok: result.status === "OK",
      }),
    }));

    const res = await app.inject({
      method: "POST",
      url: "/test",
      payload: { value: 50 },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toEqual({
      outcome: "ABOVE",
      ok: true,
    });
  });
});

describe("createDecisionHook", () => {
  let app: FastifyInstance;

  beforeEach(() => {
    app = Fastify();
  });

  afterEach(async () => {
    await app.close();
  });

  it("should attach result to request", async () => {
    app.post("/test", {
      preHandler: createDecisionHook({
        decision: testDecision,
        getProfile: () => ({ threshold: 10 }),
      }),
      handler: (request) => {
        return {
          fromCriterion: request.criterion?.result.data?.result,
          custom: "data",
        };
      },
    });

    const res = await app.inject({
      method: "POST",
      url: "/test",
      payload: { value: 50 },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toEqual({
      fromCriterion: "ABOVE",
      custom: "data",
    });
  });
});
