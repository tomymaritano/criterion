/**
 * Types for decision specification format
 */

/**
 * Schema field type specification
 */
export type SchemaFieldType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "array"
  | "object";

/**
 * Schema field definition
 */
export interface SchemaField {
  /** Field type */
  type: SchemaFieldType;
  /** Whether field is optional */
  optional?: boolean;
  /** Description for documentation */
  description?: string;
  /** For arrays: item type */
  items?: SchemaFieldType | SchemaSpec;
  /** For objects: nested schema */
  properties?: Record<string, SchemaField>;
  /** Enum values for string fields */
  enum?: string[];
  /** Minimum value for numbers */
  min?: number;
  /** Maximum value for numbers */
  max?: number;
  /** Default value */
  default?: unknown;
}

/**
 * Schema specification
 */
export type SchemaSpec = Record<string, SchemaField>;

/**
 * Rule condition specification
 */
export interface RuleCondition {
  /** Field path (e.g., "input.value", "profile.threshold") */
  field: string;
  /** Comparison operator */
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "contains" | "matches";
  /** Value to compare against (can reference other fields with $) */
  value: unknown;
}

/**
 * Rule specification
 */
export interface RuleSpec {
  /** Unique rule ID */
  id: string;
  /** Human-readable description */
  description?: string;
  /** Conditions (all must match - AND logic) */
  when: RuleCondition[] | "always";
  /** Output to emit when rule matches */
  emit: Record<string, unknown>;
  /** Priority (lower runs first, default: 0) */
  priority?: number;
}

/**
 * Decision specification
 */
export interface DecisionSpec {
  /** Unique decision ID */
  id: string;
  /** Version string */
  version: string;
  /** Human-readable description */
  description?: string;
  /** Input schema */
  input: SchemaSpec;
  /** Output schema */
  output: SchemaSpec;
  /** Profile schema */
  profile: SchemaSpec;
  /** Rules (evaluated in order) */
  rules: RuleSpec[];
}

/**
 * Options for code generation
 */
export interface CodeGenOptions {
  /** Include JSDoc comments */
  includeComments?: boolean;
  /** Use const assertions */
  useConst?: boolean;
  /** Export name for the decision */
  exportName?: string;
  /** Include zod import */
  includeImports?: boolean;
}

/**
 * Generated code result
 */
export interface GeneratedCode {
  /** Generated TypeScript code */
  code: string;
  /** Decision ID */
  decisionId: string;
  /** Export name used */
  exportName: string;
}
