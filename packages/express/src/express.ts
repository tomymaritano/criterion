/**
 * Express middleware for Criterion decision engine
 *
 * @example Basic usage
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
 */

import type { Request, Response, NextFunction, RequestHandler } from "express";
import { Engine } from "@criterionx/core";
import type { DecisionMiddlewareOptions, CriterionResult } from "./types.js";

// Extend Express Request type
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      criterion?: CriterionResult<any>;
    }
  }
}

const defaultEngine = new Engine();

/**
 * Create Express middleware that evaluates a decision and sends the result
 *
 * The middleware extracts input from the request, evaluates the decision,
 * and sends the result as JSON response.
 *
 * @example With custom input extraction
 * ```typescript
 * app.post("/evaluate/:decisionId", createDecisionMiddleware({
 *   decision: myDecision,
 *   getInput: (req) => ({
 *     ...req.body,
 *     userId: req.params.userId,
 *   }),
 *   getProfile: (req) => req.query.profile as string,
 * }));
 * ```
 */
export function createDecisionMiddleware<TInput, TOutput, TProfile>(
  options: DecisionMiddlewareOptions<TInput, TOutput, TProfile>
): RequestHandler {
  const {
    decision,
    engine = defaultEngine,
    registry,
    getInput = (req) => (req as Request).body as TInput,
    getProfile = (req) => {
      const r = req as Request;
      return (r.query?.profile ?? r.body?.profile) as TProfile | string;
    },
    formatResponse = (result) => result,
    onError,
  } = options;

  return (req: Request, res: Response, _next: NextFunction): void => {
    try {
      const input = getInput(req);
      const profile = getProfile(req);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = engine.run(decision, input, { profile } as any, registry);

      // Attach to request for downstream middleware
      req.criterion = {
        result,
        decision: decision.id,
        evaluatedAt: new Date().toISOString(),
      };

      // Check for validation/evaluation errors
      if (result.status !== "OK") {
        res.status(400).json({
          error: {
            code: result.status,
            message: result.meta.explanation,
          },
          result: formatResponse(result),
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.json(formatResponse(result));
    } catch (error) {
      if (onError) {
        onError(error instanceof Error ? error : new Error(String(error)), req, res);
        return;
      }

      const err = error instanceof Error ? error : new Error(String(error));
      res.status(400).json({
        error: {
          code: "EVALUATION_ERROR",
          message: err.message,
        },
        timestamp: new Date().toISOString(),
      });
    }
  };
}

/**
 * Create Express middleware that evaluates a decision and attaches result to request
 *
 * Unlike createDecisionMiddleware, this middleware calls next() instead of
 * sending a response, allowing downstream middleware to access the result.
 *
 * @example
 * ```typescript
 * app.post("/pricing",
 *   createDecisionHandler({
 *     decision: pricingDecision,
 *     getProfile: () => ({ basePrice: 100 }),
 *   }),
 *   (req, res) => {
 *     const { result } = req.criterion!;
 *     res.json({ price: result.data?.price, meta: { custom: true } });
 *   }
 * );
 * ```
 */
export function createDecisionHandler<TInput, TOutput, TProfile>(
  options: DecisionMiddlewareOptions<TInput, TOutput, TProfile>
): RequestHandler {
  const {
    decision,
    engine = defaultEngine,
    registry,
    getInput = (req) => (req as Request).body as TInput,
    getProfile = (req) => {
      const r = req as Request;
      return (r.query?.profile ?? r.body?.profile) as TProfile | string;
    },
    onError,
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const input = getInput(req);
      const profile = getProfile(req);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = engine.run(decision, input, { profile } as any, registry);

      req.criterion = {
        result,
        decision: decision.id,
        evaluatedAt: new Date().toISOString(),
      };

      next();
    } catch (error) {
      if (onError) {
        onError(error instanceof Error ? error : new Error(String(error)), req, res);
        return;
      }
      next(error);
    }
  };
}

/**
 * Create an Express router with decision endpoints
 *
 * @example
 * ```typescript
 * import { createDecisionRouter } from "@criterionx/express/express";
 *
 * const router = createDecisionRouter({
 *   decisions: [pricingDecision, eligibilityDecision],
 *   profiles: {
 *     "pricing": { basePrice: 100 },
 *     "eligibility": { minAge: 18 },
 *   },
 * });
 *
 * app.use("/decisions", router);
 * // POST /decisions/pricing
 * // POST /decisions/eligibility
 * ```
 */
export function createDecisionRouter<TProfile>(options: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  decisions: Array<import("@criterionx/core").Decision<any, any, TProfile>>;
  profiles?: Record<string, TProfile>;
  engine?: Engine;
  registry?: import("@criterionx/core").ProfileRegistry<TProfile>;
}): import("express").Router {
  // Dynamic import to avoid requiring express at module load
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Router } = require("express") as typeof import("express");
  const router = Router();

  const { decisions, profiles = {}, engine = defaultEngine, registry } = options;

  for (const decision of decisions) {
    router.post(`/${decision.id}`, createDecisionMiddleware({
      decision,
      engine,
      registry,
      getProfile: (req) => {
        const r = req as Request;
        const profileKey = r.query?.profile ?? r.body?.profile;
        if (typeof profileKey === "string" && profiles[profileKey]) {
          return profiles[profileKey];
        }
        return (profileKey ?? profiles[decision.id]) as TProfile;
      },
    }));
  }

  return router;
}
