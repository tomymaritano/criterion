/**
 * Fastify plugin for Criterion decision engine
 *
 * @example Basic usage
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
 * // POST /decisions/pricing
 * ```
 */

import type {
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
  RouteHandlerMethod,
} from "fastify";
import { Engine, type Decision, type ProfileRegistry, type Result } from "@criterionx/core";
import type { CriterionResult } from "./types.js";

// Extend Fastify Request type
declare module "fastify" {
  interface FastifyRequest {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    criterion?: CriterionResult<any>;
  }
}

const defaultEngine = new Engine();

/**
 * Options for Fastify Criterion plugin
 */
export interface CriterionPluginOptions<TProfile> {
  /** Decisions to register */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  decisions: Array<Decision<any, any, TProfile>>;
  /** Profile map by decision ID */
  profiles?: Record<string, TProfile>;
  /** Engine instance */
  engine?: Engine;
  /** Profile registry */
  registry?: ProfileRegistry<TProfile>;
  /** Route prefix (default: "/decisions") */
  prefix?: string;
}

/**
 * Fastify plugin that registers decision endpoints
 *
 * @example With custom prefix
 * ```typescript
 * app.register(criterionPlugin, {
 *   decisions: [pricingDecision],
 *   profiles: { pricing: { basePrice: 100 } },
 *   prefix: "/api/v1/evaluate",
 * });
 * // POST /api/v1/evaluate/pricing
 * ```
 */
export const criterionPlugin: FastifyPluginAsync<CriterionPluginOptions<unknown>> = async (
  fastify,
  options
) => {
  const {
    decisions,
    profiles = {},
    engine = defaultEngine,
    registry,
    prefix = "/decisions",
  } = options;

  for (const decision of decisions) {
    fastify.post(`${prefix}/${decision.id}`, async (request, reply) => {
      try {
        const body = request.body as Record<string, unknown>;
        const query = request.query as Record<string, unknown>;

        const input = body;
        const profileKey = (query?.profile ?? body?.profile) as string | undefined;
        const profile = profileKey && profiles[profileKey]
          ? profiles[profileKey]
          : (profileKey ?? profiles[decision.id]);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = engine.run(decision, input, { profile } as any, registry);

        request.criterion = {
          result,
          decision: decision.id,
          evaluatedAt: new Date().toISOString(),
        };

        // Check for validation/evaluation errors
        if (result.status !== "OK") {
          reply.status(400);
          return {
            error: {
              code: result.status,
              message: result.meta.explanation,
            },
            result,
            timestamp: new Date().toISOString(),
          };
        }

        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        reply.status(400);
        return {
          error: {
            code: "EVALUATION_ERROR",
            message: err.message,
          },
          timestamp: new Date().toISOString(),
        };
      }
    });
  }
};

/**
 * Options for creating a decision route handler
 */
export interface DecisionRouteOptions<TInput, TOutput, TProfile> {
  /** The decision to evaluate */
  decision: Decision<TInput, TOutput, TProfile>;
  /** Engine instance */
  engine?: Engine;
  /** Profile registry */
  registry?: ProfileRegistry<TProfile>;
  /** Extract input from request */
  getInput?: (request: FastifyRequest) => TInput;
  /** Get profile or profile ID */
  getProfile?: (request: FastifyRequest) => TProfile | string;
  /** Custom response formatter */
  formatResponse?: (result: Result<TOutput>) => unknown;
}

/**
 * Create a Fastify route handler for a decision
 *
 * @example
 * ```typescript
 * import { createDecisionRoute } from "@criterionx/express/fastify";
 *
 * app.post("/pricing", createDecisionRoute({
 *   decision: pricingDecision,
 *   getProfile: () => ({ basePrice: 100 }),
 * }));
 * ```
 */
export function createDecisionRoute<TInput, TOutput, TProfile>(
  options: DecisionRouteOptions<TInput, TOutput, TProfile>
): RouteHandlerMethod {
  const {
    decision,
    engine = defaultEngine,
    registry,
    getInput = (request) => request.body as TInput,
    getProfile = (request) => {
      const query = request.query as Record<string, unknown>;
      const body = request.body as Record<string, unknown>;
      return (query?.profile ?? body?.profile) as TProfile | string;
    },
    formatResponse = (result) => result,
  } = options;

  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const input = getInput(request);
      const profile = getProfile(request);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = engine.run(decision, input, { profile } as any, registry);

      request.criterion = {
        result,
        decision: decision.id,
        evaluatedAt: new Date().toISOString(),
      };

      // Check for validation/evaluation errors
      if (result.status !== "OK") {
        reply.status(400);
        return {
          error: {
            code: result.status,
            message: result.meta.explanation,
          },
          result: formatResponse(result),
          timestamp: new Date().toISOString(),
        };
      }

      return formatResponse(result);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      reply.status(400);
      return {
        error: {
          code: "EVALUATION_ERROR",
          message: err.message,
        },
        timestamp: new Date().toISOString(),
      };
    }
  };
}

/**
 * Fastify preHandler hook for decision evaluation
 *
 * Evaluates a decision and attaches the result to the request,
 * allowing the route handler to access it.
 *
 * @example
 * ```typescript
 * import { createDecisionHook } from "@criterionx/express/fastify";
 *
 * app.post("/pricing", {
 *   preHandler: createDecisionHook({
 *     decision: pricingDecision,
 *     getProfile: () => ({ basePrice: 100 }),
 *   }),
 *   handler: (request, reply) => {
 *     const { result } = request.criterion!;
 *     return { price: result.data?.price, meta: { custom: true } };
 *   },
 * });
 * ```
 */
export function createDecisionHook<TInput, TOutput, TProfile>(
  options: Omit<DecisionRouteOptions<TInput, TOutput, TProfile>, "formatResponse">
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  const {
    decision,
    engine = defaultEngine,
    registry,
    getInput = (request) => request.body as TInput,
    getProfile = (request) => {
      const query = request.query as Record<string, unknown>;
      const body = request.body as Record<string, unknown>;
      return (query?.profile ?? body?.profile) as TProfile | string;
    },
  } = options;

  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const input = getInput(request);
      const profile = getProfile(request);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = engine.run(decision, input, { profile } as any, registry);

      request.criterion = {
        result,
        decision: decision.id,
        evaluatedAt: new Date().toISOString(),
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      reply.status(400).send({
        error: {
          code: "EVALUATION_ERROR",
          message: err.message,
        },
        timestamp: new Date().toISOString(),
      });
    }
  };
}
