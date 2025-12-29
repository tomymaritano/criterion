/**
 * @criterionx/server
 *
 * HTTP server for Criterion decisions with auto-generated documentation.
 *
 * @example
 * ```ts
 * import { createServer } from "@criterionx/server";
 * import { defineDecision } from "@criterionx/core";
 * import { z } from "zod";
 *
 * const myDecision = defineDecision({ ... });
 *
 * const server = createServer({
 *   decisions: [myDecision],
 *   profiles: { "my-decision": { threshold: 100 } },
 * });
 *
 * server.listen(3000);
 * ```
 */

// Types
export type {
  ServerOptions,
  EvaluateRequest,
  DecisionInfo,
  JsonSchema,
  DecisionSchema,
} from "./types.js";

// Schema utilities
export { toJsonSchema, extractDecisionSchema, generateEndpointSchema } from "./schema.js";

// Server
export { CriterionServer, createServer } from "./server.js";
