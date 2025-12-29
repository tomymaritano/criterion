import { describe, it, expect } from "vitest";
import { z } from "zod";
import { defineDecision } from "@criterionx/core";
import { createServer, toJsonSchema, extractDecisionSchema } from "./index.js";

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
