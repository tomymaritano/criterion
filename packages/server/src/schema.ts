import {
  toJsonSchema,
  extractDecisionSchema,
  type JsonSchema,
  type DecisionSchema,
  type Decision,
} from "@criterionx/core";

// Re-export from core for backwards compatibility
export { toJsonSchema, extractDecisionSchema };
export type { JsonSchema, DecisionSchema };

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
