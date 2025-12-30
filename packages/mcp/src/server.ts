import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  Engine,
  extractDecisionSchema,
  type Decision,
  type Result,
} from "@criterionx/core";
import type { McpServerOptions, DecisionListItem } from "./types.js";

/** Package version */
const PACKAGE_VERSION = "0.3.2";

/**
 * Criterion MCP Server
 *
 * Exposes Criterion decisions as MCP tools for use with LLM applications.
 *
 * @example
 * ```typescript
 * import { createMcpServer } from "@criterionx/mcp";
 * import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
 *
 * const mcpServer = createMcpServer({
 *   decisions: [myDecision],
 *   profiles: { "my-decision": { threshold: 100 } },
 * });
 *
 * const transport = new StdioServerTransport();
 * await mcpServer.server.connect(transport);
 * ```
 */
export class CriterionMcpServer {
  private mcpServer: McpServer;
  private engine: Engine;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private decisions: Map<string, Decision<any, any, any>>;
  private profiles: Map<string, unknown>;

  constructor(options: McpServerOptions) {
    this.mcpServer = new McpServer({
      name: options.name ?? "criterion-mcp-server",
      version: options.version ?? PACKAGE_VERSION,
    });

    this.engine = new Engine();
    this.decisions = new Map();
    this.profiles = new Map();

    // Register decisions
    for (const decision of options.decisions) {
      this.decisions.set(decision.id, decision);
    }

    // Register profiles
    if (options.profiles) {
      for (const [id, profile] of Object.entries(options.profiles)) {
        this.profiles.set(id, profile);
      }
    }

    // Register MCP tools
    this.registerTools();
  }

  private registerTools(): void {
    // Tool 1: list_decisions
    this.mcpServer.tool(
      "list_decisions",
      "List all registered Criterion decisions with their metadata. Returns decision IDs, versions, descriptions, and rule counts.",
      {},
      async () => {
        const decisions: DecisionListItem[] = Array.from(
          this.decisions.values()
        ).map((d) => ({
          id: d.id,
          version: d.version,
          description: d.meta?.description as string | undefined,
          rulesCount: d.rules.length,
          meta: d.meta as Record<string, unknown> | undefined,
        }));

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ decisions }, null, 2),
            },
          ],
        };
      }
    );

    // Tool 2: get_decision_schema
    this.mcpServer.tool(
      "get_decision_schema",
      "Get the JSON schemas for a specific decision. Returns input, output, and profile schemas that define the decision's contract.",
      {
        decisionId: z
          .string()
          .describe("The ID of the decision to get schemas for"),
      },
      async (args) => {
        const decision = this.decisions.get(args.decisionId);

        if (!decision) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  error: "DECISION_NOT_FOUND",
                  message: `Decision not found: ${args.decisionId}`,
                  availableDecisions: Array.from(this.decisions.keys()),
                }),
              },
            ],
            isError: true,
          };
        }

        const schema = extractDecisionSchema(decision);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(schema, null, 2),
            },
          ],
        };
      }
    );

    // Tool 3: evaluate_decision
    this.mcpServer.tool(
      "evaluate_decision",
      "Evaluate a Criterion decision with the given input and optional profile. Returns the decision result including status, data, and evaluation metadata with full explainability.",
      {
        decisionId: z.string().describe("The ID of the decision to evaluate"),
        input: z
          .record(z.unknown())
          .describe("Input data matching the decision's input schema"),
        profile: z
          .record(z.unknown())
          .optional()
          .describe("Optional profile to use (overrides default profile)"),
      },
      async (args) => {
        const decision = this.decisions.get(args.decisionId);

        if (!decision) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  error: "DECISION_NOT_FOUND",
                  message: `Decision not found: ${args.decisionId}`,
                  availableDecisions: Array.from(this.decisions.keys()),
                }),
              },
            ],
            isError: true,
          };
        }

        // Resolve profile
        let profile = args.profile;
        if (!profile) {
          profile = this.profiles.get(args.decisionId) as
            | Record<string, unknown>
            | undefined;
          if (!profile) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({
                    error: "MISSING_PROFILE",
                    message: `No profile provided and no default profile for decision: ${args.decisionId}`,
                  }),
                },
              ],
              isError: true,
            };
          }
        }

        try {
          const result = this.engine.run(decision, args.input, { profile });
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  error: "EVALUATION_ERROR",
                  message: err.message,
                }),
              },
            ],
            isError: true,
          };
        }
      }
    );

    // Tool 4: explain_result
    this.mcpServer.tool(
      "explain_result",
      "Get a human-readable explanation of a decision evaluation result. Formats the result metadata, matched rules, and evaluation trace into an easy-to-understand summary.",
      {
        result: z
          .object({
            status: z.enum(["OK", "NO_MATCH", "INVALID_INPUT", "INVALID_OUTPUT"]),
            data: z.unknown().nullable(),
            meta: z.object({
              decisionId: z.string(),
              decisionVersion: z.string(),
              profileId: z.string().optional(),
              matchedRule: z.string().optional(),
              evaluatedRules: z.array(
                z.object({
                  ruleId: z.string(),
                  matched: z.boolean(),
                  explanation: z.string().optional(),
                })
              ),
              explanation: z.string(),
              evaluatedAt: z.string(),
            }),
          })
          .describe("The evaluation result to explain"),
      },
      async (args) => {
        try {
          const explanation = this.engine.explain(args.result as Result<unknown>);
          return {
            content: [
              {
                type: "text" as const,
                text: explanation,
              },
            ],
          };
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  error: "EXPLAIN_ERROR",
                  message: err.message,
                }),
              },
            ],
            isError: true,
          };
        }
      }
    );
  }

  /**
   * Get the underlying MCP server instance
   */
  get server(): McpServer {
    return this.mcpServer;
  }

  /**
   * Get the decision registry (for testing/introspection)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get decisionRegistry(): Map<string, Decision<any, any, any>> {
    return this.decisions;
  }

  /**
   * Get the profile registry (for testing/introspection)
   */
  get profileRegistry(): Map<string, unknown> {
    return this.profiles;
  }
}

/**
 * Create a new Criterion MCP server
 *
 * @example
 * ```typescript
 * import { createMcpServer } from "@criterionx/mcp";
 * import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
 *
 * const server = createMcpServer({
 *   decisions: [myDecision],
 *   profiles: { "my-decision": { threshold: 100 } },
 * });
 *
 * const transport = new StdioServerTransport();
 * await server.server.connect(transport);
 * ```
 */
export function createMcpServer(options: McpServerOptions): CriterionMcpServer {
  return new CriterionMcpServer(options);
}
