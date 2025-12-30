import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { defineDecision } from "@criterionx/core";
import { createServer, toJsonSchema, extractDecisionSchema } from "./index.js";
import type { HookContext, Hooks } from "./types.js";

// Test decision
const testDecision = defineDecision({
  id: "test-decision",
  version: "1.0.0",
  inputSchema: z.object({
    value: z.number(),
    flag: z.boolean(),
    text: z.string(),
  }),
  outputSchema: z.object({
    result: z.string(),
  }),
  profileSchema: z.object({
    threshold: z.number(),
  }),
  rules: [
    {
      id: "above-threshold",
      when: (input, profile) => input.value > profile.threshold,
      emit: () => ({ result: "ABOVE" }),
      explain: () => "Value above threshold",
    },
    {
      id: "default",
      when: () => true,
      emit: () => ({ result: "BELOW" }),
      explain: () => "Default",
    },
  ],
});

describe("createServer", () => {
  it("should create a server with decisions", () => {
    const server = createServer({
      decisions: [testDecision],
      profiles: {
        "test-decision": { threshold: 10 },
      },
    });

    expect(server).toBeDefined();
    expect(server.handler).toBeDefined();
  });
});

describe("toJsonSchema", () => {
  it("should convert Zod schema to JSON Schema", () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });

    const jsonSchema = toJsonSchema(schema);

    expect(jsonSchema.type).toBe("object");
    expect(jsonSchema.properties).toHaveProperty("name");
    expect(jsonSchema.properties).toHaveProperty("age");
  });
});

describe("extractDecisionSchema", () => {
  it("should extract schemas from a decision", () => {
    const schema = extractDecisionSchema(testDecision);

    expect(schema.id).toBe("test-decision");
    expect(schema.version).toBe("1.0.0");
    expect(schema.inputSchema).toBeDefined();
    expect(schema.outputSchema).toBeDefined();
    expect(schema.profileSchema).toBeDefined();
  });
});

describe("falsy input handling", () => {
  it("should accept 0 as valid input value", async () => {
    const zeroDecision = defineDecision({
      id: "zero-decision",
      version: "1.0.0",
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ isZero: z.boolean() }),
      profileSchema: z.object({}),
      rules: [
        {
          id: "is-zero",
          when: (input) => input.value === 0,
          emit: () => ({ isZero: true }),
          explain: () => "Value is zero",
        },
        {
          id: "not-zero",
          when: () => true,
          emit: () => ({ isZero: false }),
          explain: () => "Value is not zero",
        },
      ],
    });

    const server = createServer({
      decisions: [zeroDecision],
      profiles: { "zero-decision": {} },
    });

    // Test via direct handler call
    const response = await server.handler.request(
      new Request("http://localhost/decisions/zero-decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: { value: 0 } }),
      })
    );

    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.status).toBe("OK");
    expect(data.data.isZero).toBe(true);
  });

  it("should accept false as valid input value", async () => {
    const boolDecision = defineDecision({
      id: "bool-decision",
      version: "1.0.0",
      inputSchema: z.object({ flag: z.boolean() }),
      outputSchema: z.object({ result: z.string() }),
      profileSchema: z.object({}),
      rules: [
        {
          id: "is-false",
          when: (input) => input.flag === false,
          emit: () => ({ result: "FALSE" }),
          explain: () => "Flag is false",
        },
        {
          id: "is-true",
          when: () => true,
          emit: () => ({ result: "TRUE" }),
          explain: () => "Flag is true",
        },
      ],
    });

    const server = createServer({
      decisions: [boolDecision],
      profiles: { "bool-decision": {} },
    });

    const response = await server.handler.request(
      new Request("http://localhost/decisions/bool-decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: { flag: false } }),
      })
    );

    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.status).toBe("OK");
    expect(data.data.result).toBe("FALSE");
  });

  it("should accept empty string as valid input value", async () => {
    const stringDecision = defineDecision({
      id: "string-decision",
      version: "1.0.0",
      inputSchema: z.object({ text: z.string() }),
      outputSchema: z.object({ isEmpty: z.boolean() }),
      profileSchema: z.object({}),
      rules: [
        {
          id: "is-empty",
          when: (input) => input.text === "",
          emit: () => ({ isEmpty: true }),
          explain: () => "Text is empty",
        },
        {
          id: "not-empty",
          when: () => true,
          emit: () => ({ isEmpty: false }),
          explain: () => "Text is not empty",
        },
      ],
    });

    const server = createServer({
      decisions: [stringDecision],
      profiles: { "string-decision": {} },
    });

    const response = await server.handler.request(
      new Request("http://localhost/decisions/string-decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: { text: "" } }),
      })
    );

    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.status).toBe("OK");
    expect(data.data.isEmpty).toBe(true);
  });
});

describe("middleware hooks", () => {
  it("should call beforeEvaluate hook with correct context", async () => {
    const beforeEvaluate = vi.fn();

    const server = createServer({
      decisions: [testDecision],
      profiles: { "test-decision": { threshold: 10 } },
      hooks: { beforeEvaluate },
    });

    await server.handler.request(
      new Request("http://localhost/decisions/test-decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: { value: 5, flag: true, text: "hello" } }),
      })
    );

    expect(beforeEvaluate).toHaveBeenCalledTimes(1);
    const ctx = beforeEvaluate.mock.calls[0][0] as HookContext;
    expect(ctx.decisionId).toBe("test-decision");
    expect(ctx.input).toEqual({ value: 5, flag: true, text: "hello" });
    expect(ctx.profile).toEqual({ threshold: 10 });
    expect(ctx.requestId).toMatch(/^req_/);
    expect(ctx.timestamp).toBeInstanceOf(Date);
  });

  it("should allow beforeEvaluate to modify input", async () => {
    const beforeEvaluate = vi.fn((ctx: HookContext) => {
      // Modify input to have value > threshold
      return { input: { ...ctx.input as object, value: 100 } };
    });

    const server = createServer({
      decisions: [testDecision],
      profiles: { "test-decision": { threshold: 10 } },
      hooks: { beforeEvaluate },
    });

    const response = await server.handler.request(
      new Request("http://localhost/decisions/test-decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: { value: 5, flag: true, text: "hello" } }),
      })
    );

    const data = await response.json();
    expect(data.status).toBe("OK");
    expect(data.data.result).toBe("ABOVE"); // Modified input triggered different rule
  });

  it("should call afterEvaluate hook with context and result", async () => {
    const afterEvaluate = vi.fn();

    const server = createServer({
      decisions: [testDecision],
      profiles: { "test-decision": { threshold: 10 } },
      hooks: { afterEvaluate },
    });

    await server.handler.request(
      new Request("http://localhost/decisions/test-decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: { value: 5, flag: true, text: "hello" } }),
      })
    );

    expect(afterEvaluate).toHaveBeenCalledTimes(1);
    const [ctx, result] = afterEvaluate.mock.calls[0];
    expect(ctx.decisionId).toBe("test-decision");
    expect(result.status).toBe("OK");
    expect(result.data).toEqual({ result: "BELOW" });
  });

  it("should call onError hook when afterEvaluate throws", async () => {
    const onError = vi.fn();
    const afterEvaluate = vi.fn(() => {
      throw new Error("afterEvaluate error");
    });

    const server = createServer({
      decisions: [testDecision],
      profiles: { "test-decision": { threshold: 10 } },
      hooks: { afterEvaluate, onError },
    });

    try {
      await server.handler.request(
        new Request("http://localhost/decisions/test-decision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: { value: 5, flag: true, text: "hello" } }),
        })
      );
    } catch {
      // Expected to throw
    }

    expect(afterEvaluate).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
    const [ctx, error] = onError.mock.calls[0];
    expect(ctx.decisionId).toBe("test-decision");
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("afterEvaluate error");
  });

  it("should work with async hooks", async () => {
    const calls: string[] = [];

    const hooks: Hooks = {
      beforeEvaluate: async (ctx) => {
        await new Promise((r) => setTimeout(r, 10));
        calls.push("before");
      },
      afterEvaluate: async (ctx, result) => {
        await new Promise((r) => setTimeout(r, 10));
        calls.push("after");
      },
    };

    const server = createServer({
      decisions: [testDecision],
      profiles: { "test-decision": { threshold: 10 } },
      hooks,
    });

    await server.handler.request(
      new Request("http://localhost/decisions/test-decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: { value: 5, flag: true, text: "hello" } }),
      })
    );

    expect(calls).toEqual(["before", "after"]);
  });

  it("should work without hooks (optional)", async () => {
    const server = createServer({
      decisions: [testDecision],
      profiles: { "test-decision": { threshold: 10 } },
      // No hooks
    });

    const response = await server.handler.request(
      new Request("http://localhost/decisions/test-decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: { value: 5, flag: true, text: "hello" } }),
      })
    );

    expect(response.status).toBe(200);
  });

  it("should abort evaluation if beforeEvaluate throws", async () => {
    const afterEvaluate = vi.fn();
    const beforeEvaluate = vi.fn(() => {
      throw new Error("Validation failed");
    });

    const server = createServer({
      decisions: [testDecision],
      profiles: { "test-decision": { threshold: 10 } },
      hooks: { beforeEvaluate, afterEvaluate },
    });

    try {
      await server.handler.request(
        new Request("http://localhost/decisions/test-decision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: { value: 5, flag: true, text: "hello" } }),
        })
      );
    } catch {
      // Expected to throw
    }

    expect(beforeEvaluate).toHaveBeenCalledTimes(1);
    expect(afterEvaluate).not.toHaveBeenCalled();
  });
});

describe("openapi", () => {
  it("should expose /openapi.json endpoint when enabled", async () => {
    const server = createServer({
      decisions: [testDecision],
      profiles: { "test-decision": { threshold: 10 } },
      openapi: { enabled: true },
    });

    const response = await server.handler.request(
      new Request("http://localhost/openapi.json")
    );

    expect(response.status).toBe(200);
    const spec = await response.json();
    expect(spec.openapi).toBe("3.0.0");
    expect(spec.paths).toBeDefined();
    expect(spec.paths["/decisions/test-decision"]).toBeDefined();
  });

  it("should use custom OpenAPI endpoint", async () => {
    const server = createServer({
      decisions: [testDecision],
      profiles: { "test-decision": { threshold: 10 } },
      openapi: { enabled: true, endpoint: "/api/spec.json" },
    });

    const response = await server.handler.request(
      new Request("http://localhost/api/spec.json")
    );

    expect(response.status).toBe(200);
  });

  it("should not expose /openapi.json when disabled", async () => {
    const server = createServer({
      decisions: [testDecision],
      profiles: { "test-decision": { threshold: 10 } },
      // openapi not enabled
    });

    const response = await server.handler.request(
      new Request("http://localhost/openapi.json")
    );

    expect(response.status).toBe(404);
  });

  it("should expose Swagger UI by default when OpenAPI enabled", async () => {
    const server = createServer({
      decisions: [testDecision],
      profiles: { "test-decision": { threshold: 10 } },
      openapi: { enabled: true },
    });

    const response = await server.handler.request(
      new Request("http://localhost/swagger")
    );

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("swagger-ui");
    expect(html).toContain("/openapi.json");
  });

  it("should use custom Swagger UI endpoint", async () => {
    const server = createServer({
      decisions: [testDecision],
      profiles: { "test-decision": { threshold: 10 } },
      openapi: { enabled: true, swaggerEndpoint: "/api-docs" },
    });

    const response = await server.handler.request(
      new Request("http://localhost/api-docs")
    );

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("swagger-ui");
  });

  it("should disable Swagger UI when swaggerUI is false", async () => {
    const server = createServer({
      decisions: [testDecision],
      profiles: { "test-decision": { threshold: 10 } },
      openapi: { enabled: true, swaggerUI: false },
    });

    // OpenAPI spec should still be available
    const specResponse = await server.handler.request(
      new Request("http://localhost/openapi.json")
    );
    expect(specResponse.status).toBe(200);

    // But Swagger UI should not be available
    const swaggerResponse = await server.handler.request(
      new Request("http://localhost/swagger")
    );
    expect(swaggerResponse.status).toBe(404);
  });

  it("should include custom info in OpenAPI spec", async () => {
    const server = createServer({
      decisions: [testDecision],
      profiles: { "test-decision": { threshold: 10 } },
      openapi: {
        enabled: true,
        info: {
          title: "My Custom API",
          version: "2.0.0",
          description: "Custom description",
        },
      },
    });

    const response = await server.handler.request(
      new Request("http://localhost/openapi.json")
    );

    const spec = await response.json();
    expect(spec.info.title).toBe("My Custom API");
    expect(spec.info.version).toBe("2.0.0");
    expect(spec.info.description).toBe("Custom description");
  });

  it("should generate schemas for all decisions", async () => {
    const anotherDecision = defineDecision({
      id: "another-decision",
      version: "1.0.0",
      inputSchema: z.object({ name: z.string() }),
      outputSchema: z.object({ greeting: z.string() }),
      profileSchema: z.object({}),
      rules: [
        {
          id: "default",
          when: () => true,
          emit: (input) => ({ greeting: `Hello ${input.name}` }),
          explain: () => "Default greeting",
        },
      ],
    });

    const server = createServer({
      decisions: [testDecision, anotherDecision],
      profiles: {
        "test-decision": { threshold: 10 },
        "another-decision": {},
      },
      openapi: { enabled: true },
    });

    const response = await server.handler.request(
      new Request("http://localhost/openapi.json")
    );

    const spec = await response.json();
    expect(spec.paths["/decisions/test-decision"]).toBeDefined();
    expect(spec.paths["/decisions/another-decision"]).toBeDefined();
    expect(spec.components.schemas["TestDecisionInput"]).toBeDefined();
    expect(spec.components.schemas["AnotherDecisionInput"]).toBeDefined();
  });
});

describe("metrics", () => {
  it("should expose /metrics endpoint when enabled", async () => {
    const server = createServer({
      decisions: [testDecision],
      profiles: { "test-decision": { threshold: 10 } },
      metrics: { enabled: true },
    });

    const response = await server.handler.request(
      new Request("http://localhost/metrics")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
  });

  it("should use custom metrics endpoint", async () => {
    const server = createServer({
      decisions: [testDecision],
      profiles: { "test-decision": { threshold: 10 } },
      metrics: { enabled: true, endpoint: "/custom-metrics" },
    });

    const response = await server.handler.request(
      new Request("http://localhost/custom-metrics")
    );

    expect(response.status).toBe(200);
  });

  it("should not expose /metrics when disabled", async () => {
    const server = createServer({
      decisions: [testDecision],
      profiles: { "test-decision": { threshold: 10 } },
      // metrics not enabled
    });

    const response = await server.handler.request(
      new Request("http://localhost/metrics")
    );

    expect(response.status).toBe(404);
  });

  it("should track evaluation count", async () => {
    const server = createServer({
      decisions: [testDecision],
      profiles: { "test-decision": { threshold: 10 } },
      metrics: { enabled: true },
    });

    // Make two evaluations
    await server.handler.request(
      new Request("http://localhost/decisions/test-decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: { value: 5, flag: true, text: "hello" } }),
      })
    );

    await server.handler.request(
      new Request("http://localhost/decisions/test-decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: { value: 15, flag: true, text: "hello" } }),
      })
    );

    const metricsResponse = await server.handler.request(
      new Request("http://localhost/metrics")
    );

    const metricsText = await metricsResponse.text();

    // Should have evaluation count metrics
    expect(metricsText).toContain("criterion_evaluations_total");
    expect(metricsText).toContain('decision_id="test-decision"');
    expect(metricsText).toContain('status="OK"');
  });

  it("should track evaluation duration", async () => {
    const server = createServer({
      decisions: [testDecision],
      profiles: { "test-decision": { threshold: 10 } },
      metrics: { enabled: true },
    });

    await server.handler.request(
      new Request("http://localhost/decisions/test-decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: { value: 5, flag: true, text: "hello" } }),
      })
    );

    const metricsResponse = await server.handler.request(
      new Request("http://localhost/metrics")
    );

    const metricsText = await metricsResponse.text();

    // Should have duration histogram
    expect(metricsText).toContain("criterion_evaluation_duration_seconds");
    expect(metricsText).toContain("criterion_evaluation_duration_seconds_bucket");
    expect(metricsText).toContain("criterion_evaluation_duration_seconds_sum");
    expect(metricsText).toContain("criterion_evaluation_duration_seconds_count");
  });

  it("should track rule matches", async () => {
    const server = createServer({
      decisions: [testDecision],
      profiles: { "test-decision": { threshold: 10 } },
      metrics: { enabled: true },
    });

    // Trigger the "above-threshold" rule
    await server.handler.request(
      new Request("http://localhost/decisions/test-decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: { value: 15, flag: true, text: "hello" } }),
      })
    );

    // Trigger the "default" rule
    await server.handler.request(
      new Request("http://localhost/decisions/test-decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: { value: 5, flag: true, text: "hello" } }),
      })
    );

    const metricsResponse = await server.handler.request(
      new Request("http://localhost/metrics")
    );

    const metricsText = await metricsResponse.text();

    // Should have rule match metrics
    expect(metricsText).toContain("criterion_rule_matches_total");
    expect(metricsText).toContain('rule_id="above-threshold"');
    expect(metricsText).toContain('rule_id="default"');
  });

  it("should indicate server info in root endpoint", async () => {
    const server = createServer({
      decisions: [testDecision],
      profiles: { "test-decision": { threshold: 10 } },
      metrics: { enabled: true },
    });

    const response = await server.handler.request(
      new Request("http://localhost/")
    );

    const data = await response.json();
    expect(data.name).toBe("Criterion Server");
    expect(data.decisions).toBe(1);
    expect(data.health).toBe("/health");
  });

  it("should return health check status", async () => {
    const server = createServer({
      decisions: [testDecision],
      profiles: { "test-decision": { threshold: 10 } },
    });

    const response = await server.handler.request(
      new Request("http://localhost/health")
    );

    const data = await response.json();
    expect(data.status).toBe("healthy");
    expect(data.version).toBeDefined();
    expect(data.uptime).toBeGreaterThanOrEqual(0);
    expect(data.checks.decisions.status).toBe("healthy");
    expect(data.checks.engine.status).toBe("healthy");
  });

  it("should provide access to metrics collector programmatically", () => {
    const server = createServer({
      decisions: [testDecision],
      profiles: { "test-decision": { threshold: 10 } },
      metrics: { enabled: true },
    });

    expect(server.metrics).not.toBeNull();
    expect(server.metrics!.toPrometheus).toBeDefined();
  });

  it("should return null metrics collector when disabled", () => {
    const server = createServer({
      decisions: [testDecision],
      profiles: { "test-decision": { threshold: 10 } },
    });

    expect(server.metrics).toBeNull();
  });
});

describe("logging", () => {
  it("should not log when logging is disabled", async () => {
    const logger = vi.fn();
    const server = createServer({
      decisions: [testDecision],
      profiles: { "test-decision": { threshold: 10 } },
      logging: { enabled: false, logger },
    });

    await server.handler.request(
      new Request("http://localhost/decisions/test-decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: { value: 50 } }),
      })
    );

    expect(logger).not.toHaveBeenCalled();
  });

  it("should call logger with correct entry on successful evaluation", async () => {
    const logger = vi.fn();
    const server = createServer({
      decisions: [testDecision],
      profiles: { "test-decision": { threshold: 10 } },
      logging: { enabled: true, logger },
    });

    await server.handler.request(
      new Request("http://localhost/decisions/test-decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: { value: 50, flag: true, text: "test" } }),
      })
    );

    expect(logger).toHaveBeenCalledTimes(1);
    const entry = logger.mock.calls[0][0];
    expect(entry.requestId).toMatch(/^req_/);
    expect(entry.decisionId).toBe("test-decision");
    expect(entry.status).toBe("OK");
    expect(entry.durationMs).toBeGreaterThanOrEqual(0);
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("should log ERROR status when hook throws", async () => {
    const logger = vi.fn();
    const server = createServer({
      decisions: [testDecision],
      profiles: { "test-decision": { threshold: 10 } },
      logging: { enabled: true, logger },
      hooks: {
        afterEvaluate: () => {
          throw new Error("Hook error");
        },
      },
    });

    await server.handler.request(
      new Request("http://localhost/decisions/test-decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: { value: 50, flag: true, text: "test" } }),
      })
    );

    expect(logger).toHaveBeenCalledTimes(1);
    const entry = logger.mock.calls[0][0];
    expect(entry.status).toBe("ERROR");
    expect(entry.decisionId).toBe("test-decision");
  });

  it("should log NO_MATCH status when no rules match", async () => {
    const noMatchDecision = defineDecision({
      id: "no-match-decision",
      version: "1.0.0",
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ result: z.string() }),
      profileSchema: z.object({ threshold: z.number() }),
      rules: [
        {
          id: "never-matches",
          when: () => false,
          emit: () => ({ result: "never" }),
        },
      ],
    });

    const logger = vi.fn();
    const server = createServer({
      decisions: [noMatchDecision],
      profiles: { "no-match-decision": { threshold: 10 } },
      logging: { enabled: true, logger },
    });

    await server.handler.request(
      new Request("http://localhost/decisions/no-match-decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: { value: 50 } }),
      })
    );

    expect(logger).toHaveBeenCalledTimes(1);
    const entry = logger.mock.calls[0][0];
    expect(entry.status).toBe("NO_MATCH");
  });
});

describe("profile versioning", () => {
  it("should resolve versioned profile with profileVersion in request", async () => {
    const server = createServer({
      decisions: [testDecision],
      profiles: {
        "test-decision": { threshold: 10 },
        "test-decision:v2": { threshold: 100 },
      },
    });

    // With default profile (threshold: 10), value 50 is ABOVE
    const defaultResponse = await server.handler.request(
      new Request("http://localhost/decisions/test-decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: { value: 50, flag: true, text: "test" } }),
      })
    );
    const defaultResult = await defaultResponse.json();
    expect(defaultResult.data.result).toBe("ABOVE");

    // With v2 profile (threshold: 100), value 50 is BELOW
    const v2Response = await server.handler.request(
      new Request("http://localhost/decisions/test-decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { value: 50, flag: true, text: "test" },
          profileVersion: "v2",
        }),
      })
    );
    const v2Result = await v2Response.json();
    expect(v2Result.data.result).toBe("BELOW");
  });

  it("should fallback to default when profileVersion not provided", async () => {
    const server = createServer({
      decisions: [testDecision],
      profiles: {
        "test-decision": { threshold: 10 },
        "test-decision:alternative": { threshold: 200 },
      },
    });

    const response = await server.handler.request(
      new Request("http://localhost/decisions/test-decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: { value: 50, flag: true, text: "test" } }),
      })
    );

    const result = await response.json();
    // Default threshold is 10, so 50 > 10 = ABOVE
    expect(result.data.result).toBe("ABOVE");
  });

  it("should return error when profileVersion not found", async () => {
    const server = createServer({
      decisions: [testDecision],
      profiles: {
        "test-decision": { threshold: 10 },
      },
    });

    const response = await server.handler.request(
      new Request("http://localhost/decisions/test-decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { value: 50, flag: true, text: "test" },
          profileVersion: "nonexistent",
        }),
      })
    );

    expect(response.status).toBe(400);
    const result = await response.json();
    expect(result.error.code).toBe("MISSING_PROFILE");
    expect(result.error.message).toContain("nonexistent");
  });

  it("should list profile versions for a decision", async () => {
    const server = createServer({
      decisions: [testDecision],
      profiles: {
        "test-decision": { threshold: 10 },
        "test-decision:v1": { threshold: 50 },
        "test-decision:conservative": { threshold: 150 },
      },
    });

    const response = await server.handler.request(
      new Request("http://localhost/decisions/test-decision/profiles")
    );

    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.decisionId).toBe("test-decision");
    expect(result.versions).toHaveLength(3);

    // Check default version
    const defaultVersion = result.versions.find(
      (v: { version: string | null }) => v.version === null
    );
    expect(defaultVersion).toBeDefined();
    expect(defaultVersion.isDefault).toBe(true);

    // Check named versions
    const v1 = result.versions.find(
      (v: { version: string | null }) => v.version === "v1"
    );
    expect(v1).toBeDefined();
    expect(v1.isDefault).toBe(false);

    const conservative = result.versions.find(
      (v: { version: string | null }) => v.version === "conservative"
    );
    expect(conservative).toBeDefined();
  });

  it("should return empty versions array when no profiles configured", async () => {
    const server = createServer({
      decisions: [testDecision],
      profiles: {},
    });

    const response = await server.handler.request(
      new Request("http://localhost/decisions/test-decision/profiles")
    );

    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.decisionId).toBe("test-decision");
    expect(result.versions).toHaveLength(0);
  });

  it("should prefer inline profile over profileVersion", async () => {
    const server = createServer({
      decisions: [testDecision],
      profiles: {
        "test-decision": { threshold: 10 },
        "test-decision:high": { threshold: 200 },
      },
    });

    // Even with profileVersion: "high", inline profile should win
    const response = await server.handler.request(
      new Request("http://localhost/decisions/test-decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { value: 50, flag: true, text: "test" },
          profileVersion: "high",
          profile: { threshold: 10 }, // inline override
        }),
      })
    );

    const result = await response.json();
    // With inline threshold: 10, value 50 > 10 = ABOVE
    expect(result.data.result).toBe("ABOVE");
  });

  it("should return 404 when listing profiles for nonexistent decision", async () => {
    const server = createServer({
      decisions: [testDecision],
      profiles: { "test-decision": { threshold: 10 } },
    });

    const response = await server.handler.request(
      new Request("http://localhost/decisions/nonexistent/profiles")
    );

    expect(response.status).toBe(404);
    const result = await response.json();
    expect(result.error.code).toBe("DECISION_NOT_FOUND");
  });
});
