import type { Decision } from "@criterionx/core";

/**
 * Server configuration options
 */
export interface ServerOptions {
  /** Decisions to expose via HTTP */
  decisions: Decision<unknown, unknown, unknown>[];
  /** Default profiles for decisions (keyed by decision ID) */
  profiles?: Record<string, unknown>;
  /** Enable CORS (default: true) */
  cors?: boolean;
}

/**
 * Request body for decision evaluation
 */
export interface EvaluateRequest {
  /** Input data for the decision */
  input: unknown;
  /** Profile to use (overrides default) */
  profile?: unknown;
}

/**
 * Decision info for listing
 */
export interface DecisionInfo {
  id: string;
  version: string;
  description?: string;
  meta?: Record<string, unknown>;
}

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
