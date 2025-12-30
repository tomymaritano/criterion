import type { Decision, Result } from "@criterionx/core";

// Re-export schema types from core
export type { JsonSchema, DecisionSchema } from "@criterionx/core";

/**
 * Context passed to hooks
 */
export interface HookContext {
  /** ID of the decision being evaluated */
  decisionId: string;
  /** Input data for the decision */
  input: unknown;
  /** Profile being used */
  profile: unknown;
  /** Request ID for tracing (auto-generated) */
  requestId: string;
  /** Timestamp when evaluation started */
  timestamp: Date;
}

/**
 * Hook called before decision evaluation
 *
 * Can modify context (input, profile) by returning a modified context.
 * Return undefined to keep original context.
 * Throw to abort evaluation with error.
 */
export type BeforeEvaluateHook = (
  ctx: HookContext
) => Promise<Partial<HookContext> | void> | Partial<HookContext> | void;

/**
 * Hook called after decision evaluation
 *
 * Receives the evaluation result. Cannot modify the result.
 * Use for logging, metrics, side effects.
 */
export type AfterEvaluateHook = (
  ctx: HookContext,
  result: Result<unknown>
) => Promise<void> | void;

/**
 * Hook called when an error occurs during evaluation
 */
export type OnErrorHook = (
  ctx: HookContext,
  error: Error
) => Promise<void> | void;

/**
 * Middleware hooks configuration
 */
export interface Hooks {
  /** Called before decision evaluation */
  beforeEvaluate?: BeforeEvaluateHook;
  /** Called after successful evaluation */
  afterEvaluate?: AfterEvaluateHook;
  /** Called when an error occurs */
  onError?: OnErrorHook;
}

/**
 * Metrics configuration options
 */
export interface MetricsOptions {
  /** Enable metrics collection (default: false) */
  enabled?: boolean;
  /** Endpoint path for metrics (default: /metrics) */
  endpoint?: string;
  /** Histogram buckets for latency in seconds */
  buckets?: number[];
}

/**
 * Log entry emitted for each evaluation request
 */
export interface LogEntry {
  /** Unique request identifier */
  requestId: string;
  /** ID of the decision that was evaluated */
  decisionId: string;
  /** Result status or ERROR */
  status: "OK" | "NO_MATCH" | "INVALID_INPUT" | "INVALID_OUTPUT" | "ERROR";
  /** Duration of the evaluation in milliseconds */
  durationMs: number;
  /** ISO timestamp when the request completed */
  timestamp: string;
}

/**
 * Logger function type - user provides their own implementation
 */
export type LoggerFn = (entry: LogEntry) => void;

/**
 * Logging configuration options
 */
export interface LoggingOptions {
  /** Enable request logging (default: false) */
  enabled?: boolean;
  /** Custom logger function - receives structured log entries */
  logger: LoggerFn;
}

/**
 * Rate limit info returned by store
 */
export interface RateLimitInfo {
  /** Current request count in window */
  count: number;
  /** Unix timestamp (ms) when window resets */
  resetTime: number;
}

/**
 * Rate limit store interface for custom implementations
 *
 * Implement this interface to use external stores like Redis
 * for distributed rate limiting.
 */
export interface RateLimitStore {
  /** Increment counter for key and return current info */
  increment(key: string): Promise<RateLimitInfo>;
  /** Reset counter for key */
  reset(key: string): Promise<void>;
}

/**
 * Rate limiting configuration options
 */
export interface RateLimitOptions {
  /** Enable rate limiting (default: false) */
  enabled?: boolean;
  /** Time window in milliseconds (default: 60000 = 1 minute) */
  windowMs?: number;
  /** Maximum requests per window (default: 100) */
  max?: number;
  /** Custom key generator function (default: client IP) */
  keyGenerator?: (c: import("hono").Context) => string;
  /** Custom handler for rate limit exceeded (default: 429 JSON response) */
  handler?: (c: import("hono").Context) => Response;
  /** Skip rate limiting for certain requests (default: skip /health, /metrics) */
  skip?: (c: import("hono").Context) => boolean;
  /** Custom store for distributed rate limiting (default: in-memory) */
  store?: RateLimitStore;
}

/**
 * OpenAPI info object
 */
export interface OpenAPIInfo {
  /** API title */
  title: string;
  /** API version */
  version: string;
  /** API description */
  description?: string;
  /** Contact information */
  contact?: {
    name?: string;
    url?: string;
    email?: string;
  };
  /** License information */
  license?: {
    name: string;
    url?: string;
  };
}

/**
 * OpenAPI configuration options
 */
export interface OpenAPIOptions {
  /** Enable OpenAPI spec generation (default: false) */
  enabled?: boolean;
  /** Endpoint path for OpenAPI spec (default: /openapi.json) */
  endpoint?: string;
  /** API info for OpenAPI spec */
  info?: Partial<OpenAPIInfo>;
  /** Enable Swagger UI (default: true when openapi is enabled) */
  swaggerUI?: boolean;
  /** Swagger UI endpoint (default: /swagger) */
  swaggerEndpoint?: string;
}

/**
 * Server configuration options
 */
export interface ServerOptions {
  /** Decisions to expose via HTTP */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  decisions: Decision<any, any, any>[];
  /** Default profiles for decisions (keyed by decision ID) */
  profiles?: Record<string, unknown>;
  /** Enable CORS (default: true) */
  cors?: boolean;
  /** Middleware hooks for evaluation lifecycle */
  hooks?: Hooks;
  /** Prometheus metrics configuration */
  metrics?: MetricsOptions;
  /** OpenAPI spec generation configuration */
  openapi?: OpenAPIOptions;
  /** Request logging configuration */
  logging?: LoggingOptions;
  /** Rate limiting configuration */
  rateLimit?: RateLimitOptions;
}

/**
 * Request body for decision evaluation
 */
export interface EvaluateRequest {
  /** Input data for the decision */
  input: unknown;
  /** Profile to use (overrides default and profileVersion) */
  profile?: unknown;
  /** Profile version to use (e.g., "v1", "conservative") */
  profileVersion?: string;
}

/**
 * Profile version info for listing
 */
export interface ProfileVersionInfo {
  /** Version identifier (null for default) */
  version: string | null;
  /** Whether this is the default profile */
  isDefault: boolean;
}

/**
 * Response for listing profile versions
 */
export interface ProfileListResponse {
  /** Decision ID */
  decisionId: string;
  /** Available profile versions */
  versions: ProfileVersionInfo[];
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
 * Error codes for structured error responses
 */
export type ErrorCode =
  | "DECISION_NOT_FOUND"
  | "INVALID_JSON"
  | "MISSING_INPUT"
  | "MISSING_PROFILE"
  | "VALIDATION_ERROR"
  | "EVALUATION_ERROR"
  | "INTERNAL_ERROR"
  | "RATE_LIMIT_EXCEEDED";

/**
 * Structured error response
 */
export interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
  requestId?: string;
  timestamp: string;
}

/**
 * Health check status
 */
export type HealthStatus = "healthy" | "degraded" | "unhealthy";

/**
 * Health check response
 */
export interface HealthResponse {
  status: HealthStatus;
  version: string;
  uptime: number;
  timestamp: string;
  checks?: Record<string, {
    status: HealthStatus;
    message?: string;
  }>;
}
