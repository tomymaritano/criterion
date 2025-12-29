import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { Engine, type Decision } from "@criterionx/core";
import type { ServerOptions, EvaluateRequest, DecisionInfo } from "./types.js";
import { extractDecisionSchema, generateEndpointSchema } from "./schema.js";

/**
 * Criterion Server
 *
 * Exposes decisions as HTTP endpoints with auto-generated documentation.
 */
export class CriterionServer {
  private app: Hono;
  private engine: Engine;
  private decisions: Map<string, Decision<unknown, unknown, unknown>>;
  private profiles: Map<string, unknown>;

  constructor(options: ServerOptions) {
    this.app = new Hono();
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

    // Setup middleware
    if (options.cors !== false) {
      this.app.use("*", cors());
    }

    // Setup routes
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Health check
    this.app.get("/", (c) => {
      return c.json({
        name: "Criterion Server",
        version: "0.1.0",
        decisions: this.decisions.size,
      });
    });

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
        return c.json({ error: `Decision not found: ${id}` }, 404);
      }

      const schema = extractDecisionSchema(decision);
      return c.json(schema);
    });

    // Get endpoint schema (for docs UI)
    this.app.get("/decisions/:id/endpoint-schema", (c) => {
      const id = c.req.param("id");
      const decision = this.decisions.get(id);

      if (!decision) {
        return c.json({ error: `Decision not found: ${id}` }, 404);
      }

      const schema = generateEndpointSchema(decision);
      return c.json(schema);
    });

    // Evaluate decision
    this.app.post("/decisions/:id", async (c) => {
      const id = c.req.param("id");
      const decision = this.decisions.get(id);

      if (!decision) {
        return c.json({ error: `Decision not found: ${id}` }, 404);
      }

      let body: EvaluateRequest;
      try {
        body = await c.req.json();
      } catch {
        return c.json({ error: "Invalid JSON body" }, 400);
      }

      if (!body.input) {
        return c.json({ error: "Missing 'input' in request body" }, 400);
      }

      // Resolve profile
      let profile = body.profile;
      if (!profile) {
        profile = this.profiles.get(id);
        if (!profile) {
          return c.json(
            {
              error: `No profile provided and no default profile for decision: ${id}`,
            },
            400
          );
        }
      }

      // Run decision
      const result = this.engine.run(decision, body.input, { profile });

      // Return result with appropriate status code
      const statusCode = result.status === "OK" ? 200 : 400;
      return c.json(result, statusCode);
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
   * Start the server
   */
  listen(port: number = 3000): void {
    console.log(`Criterion Server starting on port ${port}...`);
    console.log(`  Decisions: ${this.decisions.size}`);
    console.log(`  Docs: http://localhost:${port}/docs`);
    console.log(`  API: http://localhost:${port}/decisions`);

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
