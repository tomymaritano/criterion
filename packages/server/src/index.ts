/**
 * @criterionx/server
 *
 * HTTP server for Criterion decisions with auto-generated documentation.
 *
 * @example Basic usage
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
 *
 * @example With middleware hooks
 * ```ts
 * const server = createServer({
 *   decisions: [myDecision],
 *   profiles: { "my-decision": { threshold: 100 } },
 *   hooks: {
 *     beforeEvaluate: async (ctx) => {
 *       console.log(`[${ctx.requestId}] Evaluating ${ctx.decisionId}`);
 *       // Can modify input/profile by returning partial context
 *       // return { input: transformedInput };
 *     },
 *     afterEvaluate: async (ctx, result) => {
 *       console.log(`[${ctx.requestId}] Result: ${result.status}`);
 *       // Use for logging, metrics, side effects
 *     },
 *     onError: async (ctx, error) => {
 *       console.error(`[${ctx.requestId}] Error: ${error.message}`);
 *     },
 *   },
 * });
 * ```
 */

// Types
export type {
  ServerOptions,
  EvaluateRequest,
  DecisionInfo,
  JsonSchema,
  DecisionSchema,
  // Hook types
  HookContext,
  BeforeEvaluateHook,
  AfterEvaluateHook,
  OnErrorHook,
  Hooks,
} from "./types.js";

// Schema utilities
export { toJsonSchema, extractDecisionSchema, generateEndpointSchema } from "./schema.js";

// Server
export { CriterionServer, createServer } from "./server.js";
