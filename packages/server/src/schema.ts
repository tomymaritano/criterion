import { zodToJsonSchema } from "zod-to-json-schema";
import type { ZodSchema } from "zod";
import type { Decision } from "@criterionx/core";
import type { DecisionSchema, JsonSchema } from "./types.js";

/**
 * Convert a Zod schema to JSON Schema
 */
export function toJsonSchema(schema: ZodSchema): JsonSchema {
  return zodToJsonSchema(schema, { $refStrategy: "none" }) as JsonSchema;
}

/**
 * Extract JSON Schemas from a decision
 */
export function extractDecisionSchema(
  decision: Decision<unknown, unknown, unknown>
): DecisionSchema {
  return {
    id: decision.id,
    version: decision.version,
    inputSchema: toJsonSchema(decision.inputSchema),
    outputSchema: toJsonSchema(decision.outputSchema),
    profileSchema: toJsonSchema(decision.profileSchema),
  };
}

/**
 * Generate OpenAPI-compatible schema for a decision endpoint
 */
export function generateEndpointSchema(
  decision: Decision<unknown, unknown, unknown>
): {
  requestBody: JsonSchema;
  response: JsonSchema;
} {
  const inputSchema = toJsonSchema(decision.inputSchema);
  const profileSchema = toJsonSchema(decision.profileSchema);

  return {
    requestBody: {
      type: "object",
      properties: {
        input: inputSchema,
        profile: profileSchema,
      },
      required: ["input"],
    },
    response: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["OK", "NO_MATCH", "INVALID_INPUT", "INVALID_OUTPUT"],
        },
        data: toJsonSchema(decision.outputSchema),
        meta: {
          type: "object",
          properties: {
            decisionId: { type: "string" },
            decisionVersion: { type: "string" },
            profileId: { type: "string" },
            matchedRule: { type: "string" },
            explanation: { type: "string" },
            evaluatedAt: { type: "string", format: "date-time" },
          },
        },
      },
      required: ["status", "data", "meta"],
    },
  };
}
