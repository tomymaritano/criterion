import { describe, it, expect } from "vitest";
import { initTRPC } from "@trpc/server";
import { defineDecision } from "@criterionx/core";
import { z } from "zod";
import { createDecisionProcedure, createDecisionRouter, createDecisionCaller } from "./router.js";

// Test decision
const testDecision = defineDecision({
  id: "trpc-test",
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

const t = initTRPC.create();

describe("createDecisionProcedure", () => {
  it("should create a mutation procedure", () => {
    const procedure = createDecisionProcedure(t, {
      decision: testDecision,
      defaultProfile: { threshold: 10 },
    });

    expect(procedure).toBeDefined();
    expect(procedure._def).toBeDefined();
  });

  it("should evaluate decision with default profile", async () => {
    const router = t.router({
      test: createDecisionProcedure(t, {
        decision: testDecision,
        defaultProfile: { threshold: 10 },
      }),
    });

    const caller = router.createCaller({});
    const result = await caller.test({ input: { value: 50 } });

    expect(result.status).toBe("OK");
    expect(result.data?.result).toBe("ABOVE");
  });

  it("should evaluate decision with inline profile", async () => {
    const router = t.router({
      test: createDecisionProcedure(t, {
        decision: testDecision,
        defaultProfile: { threshold: 10 },
      }),
    });

    const caller = router.createCaller({});
    const result = await caller.test({
      input: { value: 50 },
      profile: { threshold: 100 },
    });

    expect(result.status).toBe("OK");
    expect(result.data?.result).toBe("BELOW");
  });

  it("should return error when no profile provided", async () => {
    const router = t.router({
      test: createDecisionProcedure(t, {
        decision: testDecision,
        // No default profile
      }),
    });

    const caller = router.createCaller({});
    const result = await caller.test({ input: { value: 50 } });

    expect(result.status).toBe("INVALID_INPUT");
    expect(result.meta.explanation).toContain("No profile provided");
  });

  it("should validate input schema", async () => {
    const router = t.router({
      test: createDecisionProcedure(t, {
        decision: testDecision,
        defaultProfile: { threshold: 10 },
      }),
    });

    const caller = router.createCaller({});

    await expect(
      // @ts-expect-error - intentionally passing invalid input
      caller.test({ input: { value: "not a number" } })
    ).rejects.toThrow();
  });
});

describe("createDecisionRouter", () => {
  it("should create router with multiple decisions", () => {
    const decisionsRouter = createDecisionRouter(t, {
      decisions: [testDecision, anotherDecision],
      profiles: {
        "trpc-test": { threshold: 10 },
        "another-test": { prefix: "Hello" },
      },
    });

    expect(decisionsRouter).toBeDefined();
    expect(decisionsRouter._def.procedures["trpc-test"]).toBeDefined();
    expect(decisionsRouter._def.procedures["another-test"]).toBeDefined();
  });

  it("should evaluate decisions through router", async () => {
    const decisionsRouter = createDecisionRouter(t, {
      decisions: [testDecision, anotherDecision],
      profiles: {
        "trpc-test": { threshold: 10 },
        "another-test": { prefix: "Hello" },
      },
    });

    const appRouter = t.router({
      decisions: decisionsRouter,
    });

    const caller = appRouter.createCaller({});

    const result1 = await caller.decisions["trpc-test"]({ input: { value: 50 } });
    expect(result1.status).toBe("OK");
    expect(result1.data?.result).toBe("ABOVE");

    const result2 = await caller.decisions["another-test"]({ input: { name: "World" } });
    expect(result2.status).toBe("OK");
    expect(result2.data?.greeting).toBe("Hello World");
  });
});

describe("createDecisionCaller", () => {
  it("should create callable function", () => {
    const call = createDecisionCaller({
      decision: testDecision,
      defaultProfile: { threshold: 10 },
    });

    expect(typeof call).toBe("function");
  });

  it("should evaluate decision with default profile", () => {
    const call = createDecisionCaller({
      decision: testDecision,
      defaultProfile: { threshold: 10 },
    });

    const result = call({ input: { value: 50 } });

    expect(result.status).toBe("OK");
    expect(result.data?.result).toBe("ABOVE");
  });

  it("should evaluate decision with inline profile", () => {
    const call = createDecisionCaller({
      decision: testDecision,
      defaultProfile: { threshold: 10 },
    });

    const result = call({
      input: { value: 50 },
      profile: { threshold: 100 },
    });

    expect(result.status).toBe("OK");
    expect(result.data?.result).toBe("BELOW");
  });

  it("should return error when no profile provided", () => {
    const call = createDecisionCaller({
      decision: testDecision,
    });

    const result = call({ input: { value: 50 } });

    expect(result.status).toBe("INVALID_INPUT");
    expect(result.meta.explanation).toContain("No profile provided");
  });

  it("should handle validation errors", () => {
    const call = createDecisionCaller({
      decision: testDecision,
      defaultProfile: { threshold: 10 },
    });

    // @ts-expect-error - intentionally passing invalid input
    const result = call({ input: { value: "not a number" } });

    expect(result.status).toBe("INVALID_INPUT");
  });
});
