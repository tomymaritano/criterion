/**
 * @criterionx/express
 *
 * Express and Fastify middleware for Criterion decision engine.
 *
 * @example Express
 * ```typescript
 * import express from "express";
 * import { createDecisionMiddleware } from "@criterionx/express/express";
 * import { pricingDecision } from "./decisions";
 *
 * const app = express();
 * app.use(express.json());
 *
 * app.post("/pricing", createDecisionMiddleware({
 *   decision: pricingDecision,
 *   getProfile: () => ({ basePrice: 100 }),
 * }));
 *
 * app.listen(3000);
 * ```
 *
 * @example Fastify
 * ```typescript
 * import Fastify from "fastify";
 * import { criterionPlugin } from "@criterionx/express/fastify";
 * import { pricingDecision } from "./decisions";
 *
 * const app = Fastify();
 *
 * app.register(criterionPlugin, {
 *   decisions: [pricingDecision],
 *   profiles: { pricing: { basePrice: 100 } },
 * });
 *
 * app.listen({ port: 3000 });
 * ```
 */

// Types
export type { DecisionMiddlewareOptions, CriterionResult } from "./types.js";

// Express
export {
  createDecisionMiddleware,
  createDecisionHandler,
  createDecisionRouter,
} from "./express.js";

// Fastify
export {
  criterionPlugin,
  createDecisionRoute,
  createDecisionHook,
  type CriterionPluginOptions,
  type DecisionRouteOptions,
} from "./fastify.js";
