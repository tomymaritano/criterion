import { zodToJsonSchema } from "zod-to-json-schema";
import type { ZodSchema } from "zod";
import type { Decision } from "./types.js";

/**
 * JSON Schema representation
 */
export interface JsonSchema {
  $schema?: string;
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean;
  items?: JsonSchema;
  enum?: unknown[];
  [key: string]: unknown;
}

/**
 * Decision schema export
 */
export interface DecisionSchema {
  id: string;
  version: string;
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
  profileSchema: JsonSchema;
}

/**
 * Convert a Zod schema to JSON Schema
 *
 * @example
 * ```typescript
 * import { toJsonSchema } from "@criterionx/core";
 * import { z } from "zod";
 *
 * const schema = z.object({ name: z.string(), age: z.number() });
 * const jsonSchema = toJsonSchema(schema);
 * // { type: "object", properties: { name: { type: "string" }, age: { type: "number" } }, required: ["name", "age"] }
 * ```
 */
export function toJsonSchema(schema: ZodSchema): JsonSchema {
  return zodToJsonSchema(schema, { $refStrategy: "none" }) as JsonSchema;
}

/**
 * Extract JSON Schemas from a decision
 *
 * @example
 * ```typescript
 * import { extractDecisionSchema } from "@criterionx/core";
 *
 * const schema = extractDecisionSchema(myDecision);
 * // { id: "my-decision", version: "1.0.0", inputSchema: {...}, outputSchema: {...}, profileSchema: {...} }
 * ```
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
