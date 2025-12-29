import { describe, it, expect } from "vitest";
import { z } from "zod";
import { toJsonSchema, extractDecisionSchema } from "./schema.js";
import { defineDecision } from "./types.js";

describe("toJsonSchema", () => {
  it("should convert simple object schema", () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });

    const jsonSchema = toJsonSchema(schema);

    expect(jsonSchema.type).toBe("object");
    expect(jsonSchema.properties).toHaveProperty("name");
    expect(jsonSchema.properties).toHaveProperty("age");
    expect(jsonSchema.properties?.name).toEqual({ type: "string" });
    expect(jsonSchema.properties?.age).toEqual({ type: "number" });
  });

  it("should convert schema with enum", () => {
    const schema = z.object({
      status: z.enum(["active", "inactive"]),
    });

    const jsonSchema = toJsonSchema(schema);

    expect(jsonSchema.properties?.status).toHaveProperty("enum");
    expect(jsonSchema.properties?.status?.enum).toEqual(["active", "inactive"]);
  });

  it("should convert nested object schema", () => {
    const schema = z.object({
      user: z.object({
        name: z.string(),
        email: z.string(),
      }),
    });

    const jsonSchema = toJsonSchema(schema);

    expect(jsonSchema.properties?.user).toHaveProperty("properties");
    expect(jsonSchema.properties?.user?.properties?.name).toEqual({ type: "string" });
  });

  it("should convert array schema", () => {
    const schema = z.object({
      items: z.array(z.string()),
    });

    const jsonSchema = toJsonSchema(schema);

    expect(jsonSchema.properties?.items?.type).toBe("array");
    expect(jsonSchema.properties?.items?.items).toEqual({ type: "string" });
  });

  it("should convert optional fields", () => {
    const schema = z.object({
      required: z.string(),
      optional: z.string().optional(),
    });

    const jsonSchema = toJsonSchema(schema);

    expect(jsonSchema.required).toContain("required");
    expect(jsonSchema.required).not.toContain("optional");
  });
});

describe("extractDecisionSchema", () => {
  const testDecision = defineDecision({
    id: "test-decision",
    version: "1.0.0",
    inputSchema: z.object({ value: z.number() }),
    outputSchema: z.object({ result: z.string() }),
    profileSchema: z.object({ threshold: z.number() }),
    rules: [
      {
        id: "default",
        when: () => true,
        emit: () => ({ result: "ok" }),
        explain: () => "default",
      },
    ],
  });

  it("should extract decision metadata", () => {
    const schema = extractDecisionSchema(testDecision);

    expect(schema.id).toBe("test-decision");
    expect(schema.version).toBe("1.0.0");
  });

  it("should extract input schema", () => {
    const schema = extractDecisionSchema(testDecision);

    expect(schema.inputSchema.type).toBe("object");
    expect(schema.inputSchema.properties?.value).toEqual({ type: "number" });
  });

  it("should extract output schema", () => {
    const schema = extractDecisionSchema(testDecision);

    expect(schema.outputSchema.type).toBe("object");
    expect(schema.outputSchema.properties?.result).toEqual({ type: "string" });
  });

  it("should extract profile schema", () => {
    const schema = extractDecisionSchema(testDecision);

    expect(schema.profileSchema.type).toBe("object");
    expect(schema.profileSchema.properties?.threshold).toEqual({ type: "number" });
  });
});
