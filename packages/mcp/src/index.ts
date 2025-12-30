/**
 * @criterionx/mcp
 *
 * MCP (Model Context Protocol) server for Criterion decisions.
 * Exposes business rules as MCP tools for use with LLM applications.
 *
 * @example Basic usage with stdio transport
 * ```typescript
 * import { createMcpServer } from "@criterionx/mcp";
 * import { defineDecision } from "@criterionx/core";
 * import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
 * import { z } from "zod";
 *
 * const myDecision = defineDecision({
 *   id: "pricing-tier",
 *   version: "1.0.0",
 *   inputSchema: z.object({ revenue: z.number() }),
 *   outputSchema: z.object({ tier: z.string(), discount: z.number() }),
 *   profileSchema: z.object({ tiers: z.array(z.object({ min: z.number(), name: z.string() })) }),
 *   rules: [...]
 * });
 *
 * const mcpServer = createMcpServer({
 *   decisions: [myDecision],
 *   profiles: { "pricing-tier": { tiers: [...] } },
 * });
 *
 * const transport = new StdioServerTransport();
 * await mcpServer.server.connect(transport);
 * ```
 *
 * @example Available MCP Tools
 * - `list_decisions` - List all registered decisions
 * - `get_decision_schema` - Get JSON schemas for a decision
 * - `evaluate_decision` - Run a decision with input and profile
 * - `explain_result` - Get human-readable explanation of a result
 *
 * @packageDocumentation
 */

// Types
export type {
  McpServerOptions,
  DecisionListItem,
  DecisionSchemaResponse,
  McpErrorCode,
} from "./types.js";

// Server
export { CriterionMcpServer, createMcpServer } from "./server.js";
