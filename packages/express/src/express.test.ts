import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { defineDecision } from "@criterionx/core";
import { z } from "zod";
import { createDecisionMiddleware, createDecisionHandler, createDecisionRouter } from "./express.js";

// Test decision
const testDecision = defineDecision({
  id: "express-test",
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

describe("createDecisionMiddleware", () => {
  it("should evaluate decision and return result", async () => {
    const app = express();
    app.use(express.json());
    app.post("/test", createDecisionMiddleware({
      decision: testDecision,
      getProfile: () => ({ threshold: 10 }),
    }));

    const res = await request(app)
      .post("/test")
      .send({ value: 50 })
      .expect(200);

    expect(res.body.status).toBe("OK");
    expect(res.body.data.result).toBe("ABOVE");
  });

  it("should return BELOW when value is under threshold", async () => {
    const app = express();
    app.use(express.json());
    app.post("/test", createDecisionMiddleware({
      decision: testDecision,
      getProfile: () => ({ threshold: 100 }),
    }));

    const res = await request(app)
      .post("/test")
      .send({ value: 50 })
      .expect(200);

    expect(res.body.status).toBe("OK");
    expect(res.body.data.result).toBe("BELOW");
  });

  it("should use custom input extractor", async () => {
    const app = express();
    app.use(express.json());
    app.post("/test/:multiplier", createDecisionMiddleware({
      decision: testDecision,
      getInput: (req) => {
        const r = req as express.Request;
        return { value: (r.body as { base: number }).base * Number(r.params.multiplier) };
      },
      getProfile: () => ({ threshold: 10 }),
    }));

    const res = await request(app)
      .post("/test/5")
      .send({ base: 10 })
      .expect(200);

    expect(res.body.data.result).toBe("ABOVE"); // 10 * 5 = 50 > 10
  });

  it("should use custom response formatter", async () => {
    const app = express();
    app.use(express.json());
    app.post("/test", createDecisionMiddleware({
      decision: testDecision,
      getProfile: () => ({ threshold: 10 }),
      formatResponse: (result) => ({
        outcome: result.data?.result,
        ok: result.status === "OK",
      }),
    }));

    const res = await request(app)
      .post("/test")
      .send({ value: 50 })
      .expect(200);

    expect(res.body).toEqual({
      outcome: "ABOVE",
      ok: true,
    });
  });

  it("should handle errors with custom handler", async () => {
    const app = express();
    app.use(express.json());
    app.post("/test", createDecisionMiddleware({
      decision: testDecision,
      getProfile: () => ({ threshold: 10 }),
      getInput: () => {
        throw new Error("Custom error");
      },
      onError: (_error, _req, res) => {
        (res as express.Response).status(500).json({ custom: "error" });
      },
    }));

    const res = await request(app)
      .post("/test")
      .send({ value: 50 })
      .expect(500);

    expect(res.body).toEqual({ custom: "error" });
  });

  it("should return 400 on validation error", async () => {
    const app = express();
    app.use(express.json());
    app.post("/test", createDecisionMiddleware({
      decision: testDecision,
      getProfile: () => ({ threshold: 10 }),
    }));

    const res = await request(app)
      .post("/test")
      .send({ value: "not a number" })
      .expect(400);

    expect(res.body.error.code).toBe("INVALID_INPUT");
  });
});

describe("createDecisionHandler", () => {
  it("should attach result to request and call next", async () => {
    const app = express();
    app.use(express.json());
    app.post("/test",
      createDecisionHandler({
        decision: testDecision,
        getProfile: () => ({ threshold: 10 }),
      }),
      (req, res) => {
        res.json({
          fromCriterion: req.criterion?.result.data?.result,
          custom: "data",
        });
      }
    );

    const res = await request(app)
      .post("/test")
      .send({ value: 50 })
      .expect(200);

    expect(res.body).toEqual({
      fromCriterion: "ABOVE",
      custom: "data",
    });
  });
});

describe("createDecisionRouter", () => {
  it("should create routes for all decisions", async () => {
    const anotherDecision = defineDecision({
      id: "another-test",
      version: "1.0.0",
      inputSchema: z.object({ name: z.string() }),
      outputSchema: z.object({ greeting: z.string() }),
      profileSchema: z.object({ prefix: z.string() }),
      rules: [
        {
          id: "greet",
          when: () => true,
          emit: (input, profile) => ({ greeting: `${profile.prefix} ${input.name}` }),
          explain: () => "Greeting",
        },
      ],
    });

    const app = express();
    app.use(express.json());
    app.use("/decisions", createDecisionRouter({
      decisions: [testDecision, anotherDecision],
      profiles: {
        "express-test": { threshold: 10 },
        "another-test": { prefix: "Hello" },
      },
    }));

    // Test first decision
    const res1 = await request(app)
      .post("/decisions/express-test")
      .send({ value: 50 })
      .expect(200);
    expect(res1.body.data.result).toBe("ABOVE");

    // Test second decision
    const res2 = await request(app)
      .post("/decisions/another-test")
      .send({ name: "World" })
      .expect(200);
    expect(res2.body.data.greeting).toBe("Hello World");
  });

  it("should use profile from query parameter", async () => {
    const app = express();
    app.use(express.json());
    app.use("/decisions", createDecisionRouter({
      decisions: [testDecision],
      profiles: {
        low: { threshold: 10 },
        high: { threshold: 100 },
      },
    }));

    const resLow = await request(app)
      .post("/decisions/express-test?profile=low")
      .send({ value: 50 })
      .expect(200);
    expect(resLow.body.data.result).toBe("ABOVE");

    const resHigh = await request(app)
      .post("/decisions/express-test?profile=high")
      .send({ value: 50 })
      .expect(200);
    expect(resHigh.body.data.result).toBe("BELOW");
  });
});
