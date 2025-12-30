import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { Engine, type Decision } from "@criterionx/core";
import type {
  ServerOptions,
  EvaluateRequest,
  DecisionInfo,
  Hooks,
  HookContext,
  MetricsOptions,
  OpenAPIOptions,
  LoggingOptions,
  LogEntry,
  ErrorCode,
  ErrorResponse,
  HealthResponse,
  ProfileVersionInfo,
} from "./types.js";
import { extractDecisionSchema, generateEndpointSchema } from "./schema.js";
import {
  MetricsCollector,
  METRIC_EVALUATIONS_TOTAL,
  METRIC_EVALUATION_DURATION_SECONDS,
  METRIC_RULE_MATCHES_TOTAL,
} from "./metrics.js";
import {
  generateOpenAPISpec,
  generateSwaggerUIHtml,
  type OpenAPISpec,
} from "./openapi.js";
import { createRateLimitMiddleware } from "./rate-limit.js";

/** Server version */
const SERVER_VERSION = "0.3.2";

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Create a structured error response
 */
function createErrorResponse(
  code: ErrorCode,
  message: string,
  requestId?: string,
  details?: Record<string, unknown>
): ErrorResponse {
  return {
    error: {
      code,
      message,
      ...(details && { details }),
    },
    ...(requestId && { requestId }),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Criterion Server
 *
 * Exposes decisions as HTTP endpoints with auto-generated documentation.
 */
export class CriterionServer {
  private app: Hono;
  private engine: Engine;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private decisions: Map<string, Decision<any, any, any>>;
  private profiles: Map<string, unknown>;
  private hooks: Hooks;
  private metricsCollector: MetricsCollector | null = null;
  private metricsOptions: MetricsOptions;
  private openApiOptions: OpenAPIOptions;
  private openApiSpec: OpenAPISpec | null = null;
  private loggingOptions: LoggingOptions | null = null;
  private startTime: Date;

  constructor(options: ServerOptions) {
    this.app = new Hono();
    this.engine = new Engine();
    this.decisions = new Map();
    this.profiles = new Map();
    this.hooks = options.hooks ?? {};
    this.metricsOptions = options.metrics ?? {};
    this.openApiOptions = options.openapi ?? {};
    this.startTime = new Date();

    // Setup metrics if enabled
    if (this.metricsOptions.enabled) {
      this.metricsCollector = new MetricsCollector(this.metricsOptions);
    }

    // Setup logging if enabled
    if (options.logging?.enabled) {
      this.loggingOptions = options.logging;
    }

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

    // Generate OpenAPI spec if enabled
    if (this.openApiOptions.enabled) {
      this.openApiSpec = generateOpenAPISpec(
        options.decisions,
        this.openApiOptions.info
      );
    }

    // Setup middleware
    if (options.cors !== false) {
      this.app.use("*", cors());
    }

    // Rate limiting
    if (options.rateLimit?.enabled) {
      this.app.use("*", createRateLimitMiddleware(options.rateLimit));
    }

    // Setup routes
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Root endpoint (basic info)
    this.app.get("/", (c) => {
      return c.json({
        name: "Criterion Server",
        version: SERVER_VERSION,
        decisions: this.decisions.size,
        docs: "/docs",
        health: "/health",
      });
    });

    // Health check endpoint
    this.app.get("/health", (c) => {
      const uptime = Math.floor((Date.now() - this.startTime.getTime()) / 1000);
      const response: HealthResponse = {
        status: "healthy",
        version: SERVER_VERSION,
        uptime,
        timestamp: new Date().toISOString(),
        checks: {
          decisions: {
            status: this.decisions.size > 0 ? "healthy" : "degraded",
            message: `${this.decisions.size} decision(s) registered`,
          },
          engine: {
            status: "healthy",
            message: "Engine operational",
          },
        },
      };
      return c.json(response);
    });

    // Metrics endpoint (Prometheus format)
    if (this.metricsCollector) {
      const endpoint = this.metricsOptions.endpoint ?? "/metrics";
      this.app.get(endpoint, (c) => {
        c.header("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
        return c.text(this.metricsCollector!.toPrometheus());
      });
    }

    // OpenAPI endpoints
    if (this.openApiSpec) {
      const specEndpoint = this.openApiOptions.endpoint ?? "/openapi.json";
      this.app.get(specEndpoint, (c) => {
        return c.json(this.openApiSpec);
      });

      // Swagger UI (enabled by default when OpenAPI is enabled)
      if (this.openApiOptions.swaggerUI !== false) {
        const swaggerEndpoint = this.openApiOptions.swaggerEndpoint ?? "/swagger";
        this.app.get(swaggerEndpoint, (c) => {
          const html = generateSwaggerUIHtml(specEndpoint);
          return c.html(html);
        });
      }
    }

    // List all decisions
    this.app.get("/decisions", (c) => {
      const decisions: DecisionInfo[] = [];
      for (const decision of this.decisions.values()) {
        decisions.push({
          id: decision.id,
          version: decision.version,
          description: decision.meta?.description,
          meta: decision.meta as Record<string, unknown> | undefined,
        });
      }
      return c.json({ decisions });
    });

    // Get decision schema
    this.app.get("/decisions/:id/schema", (c) => {
      const id = c.req.param("id");
      const decision = this.decisions.get(id);

      if (!decision) {
        return c.json(
          createErrorResponse("DECISION_NOT_FOUND", `Decision not found: ${id}`),
          404
        );
      }

      const schema = extractDecisionSchema(decision);
      return c.json(schema);
    });

    // Get endpoint schema (for docs UI)
    this.app.get("/decisions/:id/endpoint-schema", (c) => {
      const id = c.req.param("id");
      const decision = this.decisions.get(id);

      if (!decision) {
        return c.json(
          createErrorResponse("DECISION_NOT_FOUND", `Decision not found: ${id}`),
          404
        );
      }

      const schema = generateEndpointSchema(decision);
      return c.json(schema);
    });

    // Evaluate decision
    this.app.post("/decisions/:id", async (c) => {
      const id = c.req.param("id");
      const requestId = generateRequestId();
      const decision = this.decisions.get(id);

      if (!decision) {
        return c.json(
          createErrorResponse("DECISION_NOT_FOUND", `Decision not found: ${id}`, requestId),
          404
        );
      }

      let body: EvaluateRequest;
      try {
        body = await c.req.json();
      } catch {
        return c.json(
          createErrorResponse("INVALID_JSON", "Invalid JSON body", requestId),
          400
        );
      }

      if (body.input === undefined) {
        return c.json(
          createErrorResponse("MISSING_INPUT", "Missing 'input' in request body", requestId),
          400
        );
      }

      // Resolve profile (priority: inline > version > default)
      let profile = body.profile;
      if (!profile) {
        if (body.profileVersion) {
          // Look for versioned profile
          const versionedKey = `${id}:${body.profileVersion}`;
          profile = this.profiles.get(versionedKey);
          if (!profile) {
            return c.json(
              createErrorResponse(
                "MISSING_PROFILE",
                `Profile version not found: ${body.profileVersion} for decision: ${id}`,
                requestId
              ),
              400
            );
          }
        } else {
          // Look for default profile
          profile = this.profiles.get(id);
          if (!profile) {
            return c.json(
              createErrorResponse(
                "MISSING_PROFILE",
                `No profile provided and no default profile for decision: ${id}`,
                requestId
              ),
              400
            );
          }
        }
      }

      // Build hook context
      let ctx: HookContext = {
        decisionId: id,
        input: body.input,
        profile,
        requestId,
        timestamp: new Date(),
      };

      // Track start time for metrics
      const startTime = performance.now();

      try {
        // Call beforeEvaluate hook
        if (this.hooks.beforeEvaluate) {
          const modified = await this.hooks.beforeEvaluate(ctx);
          if (modified) {
            ctx = { ...ctx, ...modified };
          }
        }

        // Run decision with potentially modified context
        const result = this.engine.run(decision, ctx.input, {
          profile: ctx.profile,
        });

        // Record metrics
        if (this.metricsCollector) {
          const durationSeconds = (performance.now() - startTime) / 1000;

          // Evaluation count
          this.metricsCollector.increment(METRIC_EVALUATIONS_TOTAL, {
            decision_id: id,
            status: result.status,
          });

          // Evaluation duration
          this.metricsCollector.observe(
            METRIC_EVALUATION_DURATION_SECONDS,
            { decision_id: id },
            durationSeconds
          );

          // Rule matches
          if (result.meta.matchedRule) {
            this.metricsCollector.increment(METRIC_RULE_MATCHES_TOTAL, {
              decision_id: id,
              rule_id: result.meta.matchedRule,
            });
          }
        }

        // Call afterEvaluate hook
        if (this.hooks.afterEvaluate) {
          await this.hooks.afterEvaluate(ctx, result);
        }

        // Log request
        if (this.loggingOptions) {
          const entry: LogEntry = {
            requestId,
            decisionId: id,
            status: result.status,
            durationMs: performance.now() - startTime,
            timestamp: new Date().toISOString(),
          };
          this.loggingOptions.logger(entry);
        }

        // Return result with appropriate status code
        const statusCode = result.status === "OK" ? 200 : 400;
        return c.json(result, statusCode);
      } catch (error) {
        // Record error metric
        if (this.metricsCollector) {
          this.metricsCollector.increment(METRIC_EVALUATIONS_TOTAL, {
            decision_id: id,
            status: "ERROR",
          });
        }

        const err = error instanceof Error ? error : new Error(String(error));

        // Call onError hook
        if (this.hooks.onError) {
          await this.hooks.onError(ctx, err);
        }

        // Log error request
        if (this.loggingOptions) {
          const entry: LogEntry = {
            requestId,
            decisionId: id,
            status: "ERROR",
            durationMs: performance.now() - startTime,
            timestamp: new Date().toISOString(),
          };
          this.loggingOptions.logger(entry);
        }

        // Return structured error response
        return c.json(
          createErrorResponse(
            "EVALUATION_ERROR",
            err.message,
            requestId,
            { decisionId: id }
          ),
          500
        );
      }
    });

    // List profile versions for a decision
    this.app.get("/decisions/:id/profiles", (c) => {
      const id = c.req.param("id");
      const decision = this.decisions.get(id);

      if (!decision) {
        return c.json(
          createErrorResponse("DECISION_NOT_FOUND", `Decision not found: ${id}`),
          404
        );
      }

      const versions = this.getProfileVersions(id);
      return c.json({ decisionId: id, versions });
    });

    // Interactive docs UI
    this.app.get("/docs", (c) => {
      const decisions = Array.from(this.decisions.values()).map((d) => ({
        id: d.id,
        version: d.version,
        description: d.meta?.description,
      }));

      const html = this.generateDocsHtml(decisions);
      return c.html(html);
    });
  }

  /**
   * Get available profile versions for a decision
   */
  private getProfileVersions(decisionId: string): ProfileVersionInfo[] {
    const versions: ProfileVersionInfo[] = [];
    const prefix = `${decisionId}:`;

    // Check for default (no version)
    if (this.profiles.has(decisionId)) {
      versions.push({ version: null, isDefault: true });
    }

    // Check for versioned profiles
    for (const key of this.profiles.keys()) {
      if (key.startsWith(prefix)) {
        const version = key.slice(prefix.length);
        versions.push({ version, isDefault: false });
      }
    }

    return versions;
  }

  private generateDocsHtml(
    decisions: Array<{ id: string; version: string; description?: string }>
  ): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Criterion API Docs</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      background: #f5f5f5;
    }
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
    header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 2rem;
      margin-bottom: 2rem;
      border-radius: 8px;
    }
    header h1 { font-size: 2rem; margin-bottom: 0.5rem; }
    header p { opacity: 0.9; }
    .decisions { display: grid; gap: 1rem; }
    .decision {
      background: white;
      border-radius: 8px;
      padding: 1.5rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .decision h2 {
      font-size: 1.25rem;
      color: #667eea;
      margin-bottom: 0.5rem;
    }
    .decision .version {
      font-size: 0.875rem;
      color: #666;
      margin-bottom: 1rem;
    }
    .decision .description {
      color: #444;
      margin-bottom: 1rem;
    }
    .endpoint {
      background: #f8f9fa;
      border-radius: 4px;
      padding: 1rem;
      font-family: monospace;
      font-size: 0.875rem;
      margin-bottom: 1rem;
    }
    .method {
      background: #28a745;
      color: white;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      margin-right: 0.5rem;
    }
    .playground {
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid #eee;
    }
    textarea {
      width: 100%;
      min-height: 150px;
      padding: 1rem;
      font-family: monospace;
      font-size: 0.875rem;
      border: 1px solid #ddd;
      border-radius: 4px;
      margin-bottom: 0.5rem;
    }
    button {
      background: #667eea;
      color: white;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 4px;
      cursor: pointer;
      font-size: 1rem;
    }
    button:hover { background: #5a6fd6; }
    .result {
      margin-top: 1rem;
      padding: 1rem;
      background: #f8f9fa;
      border-radius: 4px;
      font-family: monospace;
      font-size: 0.875rem;
      white-space: pre-wrap;
      display: none;
    }
    .result.show { display: block; }
    .result.error { background: #fff3f3; border: 1px solid #ffcccc; }
    .result.success { background: #f0fff4; border: 1px solid #9ae6b4; }
    .links { margin-top: 0.5rem; }
    .links a {
      color: #667eea;
      text-decoration: none;
      margin-right: 1rem;
      font-size: 0.875rem;
    }
    .links a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Criterion API</h1>
      <p>Interactive documentation for registered decisions</p>
    </header>

    <div class="decisions">
      ${decisions
        .map(
          (d) => `
        <div class="decision" data-id="${d.id}">
          <h2>${d.id}</h2>
          <div class="version">v${d.version}</div>
          ${d.description ? `<div class="description">${d.description}</div>` : ""}
          <div class="endpoint">
            <span class="method">POST</span>
            /decisions/${d.id}
          </div>
          <div class="links">
            <a href="/decisions/${d.id}/schema" target="_blank">View Schema</a>
            <a href="/decisions/${d.id}/endpoint-schema" target="_blank">Endpoint Schema</a>
          </div>
          <div class="playground">
            <textarea id="input-${d.id}" placeholder='{"input": {...}, "profile": {...}}'></textarea>
            <button onclick="evaluate('${d.id}')">Evaluate</button>
            <div class="result" id="result-${d.id}"></div>
          </div>
        </div>
      `
        )
        .join("")}
    </div>
  </div>

  <script>
    // Load schemas for each decision
    document.querySelectorAll('.decision').forEach(async (el) => {
      const id = el.dataset.id;
      const textarea = document.getElementById('input-' + id);

      try {
        const res = await fetch('/decisions/' + id + '/schema');
        const schema = await res.json();

        // Generate example from schema
        const example = {
          input: generateExample(schema.inputSchema),
          profile: generateExample(schema.profileSchema)
        };
        textarea.value = JSON.stringify(example, null, 2);
      } catch (e) {
        console.error('Failed to load schema for', id, e);
      }
    });

    function generateExample(schema) {
      if (!schema || !schema.properties) return {};
      const obj = {};
      for (const [key, prop] of Object.entries(schema.properties)) {
        if (prop.type === 'string') obj[key] = prop.enum ? prop.enum[0] : 'example';
        else if (prop.type === 'number') obj[key] = 0;
        else if (prop.type === 'boolean') obj[key] = false;
        else if (prop.type === 'array') obj[key] = [];
        else if (prop.type === 'object') obj[key] = generateExample(prop);
      }
      return obj;
    }

    async function evaluate(id) {
      const textarea = document.getElementById('input-' + id);
      const resultEl = document.getElementById('result-' + id);

      try {
        const body = JSON.parse(textarea.value);
        const res = await fetch('/decisions/' + id, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        const data = await res.json();

        resultEl.textContent = JSON.stringify(data, null, 2);
        resultEl.className = 'result show ' + (data.status === 'OK' ? 'success' : 'error');
      } catch (e) {
        resultEl.textContent = 'Error: ' + e.message;
        resultEl.className = 'result show error';
      }
    }
  </script>
</body>
</html>`;
  }

  /**
   * Get the Hono app instance (for custom middleware)
   */
  get handler(): Hono {
    return this.app;
  }

  /**
   * Get the metrics collector (if enabled)
   */
  get metrics(): MetricsCollector | null {
    return this.metricsCollector;
  }

  /**
   * Start the server
   */
  listen(port: number = 3000): void {
    console.log(`Criterion Server starting on port ${port}...`);
    console.log(`  Decisions: ${this.decisions.size}`);
    console.log(`  Docs: http://localhost:${port}/docs`);
    console.log(`  API: http://localhost:${port}/decisions`);
    if (this.metricsCollector) {
      const endpoint = this.metricsOptions.endpoint ?? "/metrics";
      console.log(`  Metrics: http://localhost:${port}${endpoint}`);
    }
    if (this.openApiSpec) {
      const specEndpoint = this.openApiOptions.endpoint ?? "/openapi.json";
      console.log(`  OpenAPI: http://localhost:${port}${specEndpoint}`);
      if (this.openApiOptions.swaggerUI !== false) {
        const swaggerEndpoint = this.openApiOptions.swaggerEndpoint ?? "/swagger";
        console.log(`  Swagger: http://localhost:${port}${swaggerEndpoint}`);
      }
    }

    serve({
      fetch: this.app.fetch,
      port,
    });
  }
}

/**
 * Create a new Criterion server
 */
export function createServer(options: ServerOptions): CriterionServer {
  return new CriterionServer(options);
}
