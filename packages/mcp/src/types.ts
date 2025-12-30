import type { Decision } from "@criterionx/core";

/**
 * MCP Server configuration options
 */
export interface McpServerOptions {
  /** Server name exposed to MCP clients */
  name?: string;
  /** Server version */
  version?: string;
  /** Decisions to expose as MCP tools */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  decisions: Decision<any, any, any>[];
  /** Default profiles for decisions (keyed by decision ID) */
  profiles?: Record<string, unknown>;
}

/**
 * Decision info returned by list_decisions tool
 */
export interface DecisionListItem {
  id: string;
  version: string;
  description?: string;
  rulesCount: number;
  meta?: Record<string, unknown>;
}

/**
 * Schema response for get_decision_schema tool
 */
export interface DecisionSchemaResponse {
  id: string;
  version: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  profileSchema: Record<string, unknown>;
}

/**
 * Error codes for MCP tool responses
 */
export type McpErrorCode =
  | "DECISION_NOT_FOUND"
  | "MISSING_PROFILE"
  | "EVALUATION_ERROR"
  | "EXPLAIN_ERROR";
