import { describe, it, expect } from "vitest";
import { z } from "zod";
import { defineDecision } from "@criterionx/core";
import { createMcpServer, CriterionMcpServer } from "./server.js";

// Test decision fixture
const testDecision = defineDecision({
  id: "test-decision",
  version: "1.0.0",
  inputSchema: z.object({
    value: z.number(),
    flag: z.boolean(),
  }),
  outputSchema: z.object({
    result: z.string(),
    score: z.number(),
  }),
  profileSchema: z.object({
    threshold: z.number(),
    multiplier: z.number(),
  }),
  meta: {
    description: "A test decision for unit tests",
    owner: "test-team",
  },
  rules: [
    {
      id: "above-threshold",
      when: (input, profile) => input.value > profile.threshold,
      emit: (input, profile) => ({
        result: "ABOVE",
        score: input.value * profile.multiplier,
      }),
      explain: () => "Value exceeds threshold",
    },
    {
      id: "default",
      when: () => true,
      emit: () => ({ result: "BELOW", score: 0 }),
      explain: () => "Default fallback",
    },
  ],
});

const secondDecision = defineDecision({
  id: "second-decision",
  version: "2.0.0",
  inputSchema: z.object({ name: z.string() }),
  outputSchema: z.object({ greeting: z.string() }),
  profileSchema: z.object({ prefix: z.string() }),
  rules: [
    {
      id: "greet",
      when: () => true,
      emit: (input, profile) => ({ greeting: `${profile.prefix} ${input.name}` }),
      explain: () => "Greeting generated",
    },
  ],
});

describe("createMcpServer", () => {
  it("should create a server with decisions", () => {
    const server = createMcpServer({
      decisions: [testDecision],
      profiles: { "test-decision": { threshold: 10, multiplier: 2 } },
    });

    expect(server).toBeDefined();
    expect(server).toBeInstanceOf(CriterionMcpServer);
    expect(server.server).toBeDefined();
    expect(server.decisionRegistry.size).toBe(1);
    expect(server.profileRegistry.size).toBe(1);
  });

  it("should use default server name and version", () => {
    const server = createMcpServer({
      decisions: [testDecision],
    });

    expect(server.server).toBeDefined();
  });

  it("should accept custom server name and version", () => {
    const server = createMcpServer({
      name: "my-criterion-server",
      version: "2.0.0",
      decisions: [testDecision],
    });

    expect(server.server).toBeDefined();
  });

  it("should create server without profiles", () => {
    const server = createMcpServer({
      decisions: [testDecision],
    });

    expect(server.decisionRegistry.size).toBe(1);
    expect(server.profileRegistry.size).toBe(0);
  });
});

describe("decision registry", () => {
  it("should register all decisions", () => {
    const server = createMcpServer({
      decisions: [testDecision, secondDecision],
    });

    expect(server.decisionRegistry.size).toBe(2);
    expect(server.decisionRegistry.has("test-decision")).toBe(true);
    expect(server.decisionRegistry.has("second-decision")).toBe(true);
  });

  it("should include decision metadata", () => {
    const server = createMcpServer({
      decisions: [testDecision],
    });

    const decision = server.decisionRegistry.get("test-decision");
    expect(decision?.meta?.description).toBe("A test decision for unit tests");
    expect(decision?.meta?.owner).toBe("test-team");
  });

  it("should track rule count", () => {
    const server = createMcpServer({
      decisions: [testDecision],
    });

    const decision = server.decisionRegistry.get("test-decision");
    expect(decision?.rules.length).toBe(2);
  });
});

describe("profile registry", () => {
  it("should register all profiles", () => {
    const server = createMcpServer({
      decisions: [testDecision, secondDecision],
      profiles: {
        "test-decision": { threshold: 10, multiplier: 2 },
        "second-decision": { prefix: "Hello" },
      },
    });

    expect(server.profileRegistry.size).toBe(2);
    expect(server.profileRegistry.has("test-decision")).toBe(true);
    expect(server.profileRegistry.has("second-decision")).toBe(true);
  });

  it("should store profile values", () => {
    const server = createMcpServer({
      decisions: [testDecision],
      profiles: { "test-decision": { threshold: 10, multiplier: 2 } },
    });

    const profile = server.profileRegistry.get("test-decision");
    expect(profile).toEqual({ threshold: 10, multiplier: 2 });
  });

  it("should handle missing profiles gracefully", () => {
    const server = createMcpServer({
      decisions: [testDecision],
    });

    expect(server.profileRegistry.has("test-decision")).toBe(false);
    expect(server.profileRegistry.get("test-decision")).toBeUndefined();
  });
});

describe("multiple decisions", () => {
  it("should handle multiple decisions with different schemas", () => {
    const server = createMcpServer({
      decisions: [testDecision, secondDecision],
      profiles: {
        "test-decision": { threshold: 10, multiplier: 2 },
        "second-decision": { prefix: "Hello" },
      },
    });

    expect(server.decisionRegistry.size).toBe(2);
    expect(server.profileRegistry.size).toBe(2);

    // Verify each decision is correctly registered
    const first = server.decisionRegistry.get("test-decision");
    const second = server.decisionRegistry.get("second-decision");

    expect(first?.version).toBe("1.0.0");
    expect(second?.version).toBe("2.0.0");
  });
});

describe("MCP server instance", () => {
  it("should expose the underlying MCP server", () => {
    const server = createMcpServer({
      decisions: [testDecision],
    });

    // MCP server should be accessible for transport connection
    expect(server.server).toBeDefined();
    expect(typeof server.server.connect).toBe("function");
  });
});
