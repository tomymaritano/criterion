/**
 * OpenAPI 3.0 spec generator for Criterion decisions
 */

import type { Decision } from "@criterionx/core";
import type { OpenAPIInfo, JsonSchema } from "./types.js";
import { extractDecisionSchema } from "./schema.js";

/**
 * OpenAPI 3.0 specification
 */
export interface OpenAPISpec {
  openapi: "3.0.0";
  info: OpenAPIInfo;
  paths: Record<string, PathItem>;
  components: {
    schemas: Record<string, JsonSchema>;
  };
}

interface PathItem {
  post?: Operation;
  get?: Operation;
}

interface Operation {
  operationId: string;
  summary: string;
  description?: string;
  tags?: string[];
  requestBody?: {
    required: boolean;
    content: {
      "application/json": {
        schema: { $ref: string } | JsonSchema;
      };
    };
  };
  responses: Record<string, Response>;
}

interface Response {
  description: string;
  content?: {
    "application/json": {
      schema: { $ref: string } | JsonSchema;
    };
  };
}

/**
 * Convert a decision ID to a schema name (PascalCase)
 */
function toSchemaName(id: string, suffix: string): string {
  const pascal = id
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
  return `${pascal}${suffix}`;
}

/**
 * Generate OpenAPI spec from decisions
 */
export function generateOpenAPISpec(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  decisions: Decision<any, any, any>[],
  info: Partial<OpenAPIInfo> = {}
): OpenAPISpec {
  const paths: Record<string, PathItem> = {};
  const schemas: Record<string, JsonSchema> = {};

  // Add common schemas
  schemas["EvaluateRequest"] = {
    type: "object",
    properties: {
      input: { description: "Input data for the decision" },
      profile: { description: "Profile to use (overrides default)" },
    },
    required: ["input"],
  };

  schemas["EvaluationResult"] = {
    type: "object",
    properties: {
      status: {
        type: "string",
        enum: ["OK", "INVALID_INPUT", "INVALID_OUTPUT", "NO_MATCH"],
        description: "Evaluation status",
      },
      data: {
        description: "Output data (null if status is not OK)",
      },
      meta: {
        $ref: "#/components/schemas/ResultMeta",
      },
    },
    required: ["status", "data", "meta"],
  };

  schemas["ResultMeta"] = {
    type: "object",
    properties: {
      decisionId: { type: "string" },
      decisionVersion: { type: "string" },
      profileId: { type: "string" },
      matchedRule: { type: "string" },
      explanation: { type: "string" },
      evaluatedAt: { type: "string", format: "date-time" },
      evaluatedRules: {
        type: "array",
        items: {
          type: "object",
          properties: {
            ruleId: { type: "string" },
            matched: { type: "boolean" },
            explanation: { type: "string" },
          },
        },
      },
    },
  };

  schemas["ErrorResponse"] = {
    type: "object",
    properties: {
      error: { type: "string", description: "Error message" },
    },
    required: ["error"],
  };

  // Generate paths and schemas for each decision
  for (const decision of decisions) {
    const decisionSchema = extractDecisionSchema(decision);
    const inputSchemaName = toSchemaName(decision.id, "Input");
    const outputSchemaName = toSchemaName(decision.id, "Output");
    const profileSchemaName = toSchemaName(decision.id, "Profile");
    const requestSchemaName = toSchemaName(decision.id, "Request");

    // Add decision-specific schemas
    schemas[inputSchemaName] = decisionSchema.inputSchema;
    schemas[outputSchemaName] = decisionSchema.outputSchema;
    schemas[profileSchemaName] = decisionSchema.profileSchema;

    // Create request schema for this decision
    schemas[requestSchemaName] = {
      type: "object",
      properties: {
        input: { $ref: `#/components/schemas/${inputSchemaName}` },
        profile: { $ref: `#/components/schemas/${profileSchemaName}` },
      },
      required: ["input"],
    };

    // Add path
    const path = `/decisions/${decision.id}`;
    const description = decision.meta?.description as string | undefined;

    paths[path] = {
      post: {
        operationId: `evaluate_${decision.id.replace(/-/g, "_")}`,
        summary: `Evaluate ${decision.id}`,
        description: description ?? `Evaluate the ${decision.id} decision`,
        tags: ["decisions"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: `#/components/schemas/${requestSchemaName}` },
            },
          },
        },
        responses: {
          "200": {
            description: "Decision evaluated successfully",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/EvaluationResult" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: `#/components/schemas/${outputSchemaName}` },
                      },
                    },
                  ],
                },
              },
            },
          },
          "400": {
            description: "Invalid input or no matching rule",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/EvaluationResult" },
              },
            },
          },
          "404": {
            description: "Decision not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    };

    // Add schema endpoint
    paths[`${path}/schema`] = {
      get: {
        operationId: `get_${decision.id.replace(/-/g, "_")}_schema`,
        summary: `Get ${decision.id} schema`,
        description: `Get JSON Schema for the ${decision.id} decision`,
        tags: ["schemas"],
        responses: {
          "200": {
            description: "Decision schema",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    version: { type: "string" },
                    inputSchema: { type: "object" },
                    outputSchema: { type: "object" },
                    profileSchema: { type: "object" },
                  },
                },
              },
            },
          },
        },
      },
    };
  }

  // Add common endpoints
  paths["/"] = {
    get: {
      operationId: "health_check",
      summary: "Health check",
      tags: ["system"],
      responses: {
        "200": {
          description: "Server status",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  version: { type: "string" },
                  decisions: { type: "integer" },
                  metrics: { type: "boolean" },
                },
              },
            },
          },
        },
      },
    },
  };

  paths["/decisions"] = {
    get: {
      operationId: "list_decisions",
      summary: "List all decisions",
      tags: ["decisions"],
      responses: {
        "200": {
          description: "List of registered decisions",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  decisions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        version: { type: "string" },
                        description: { type: "string" },
                        meta: { type: "object" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  return {
    openapi: "3.0.0",
    info: {
      title: info.title ?? "Criterion Decision API",
      version: info.version ?? "1.0.0",
      description: info.description ?? "Auto-generated API for Criterion decisions",
      ...(info.contact && { contact: info.contact }),
      ...(info.license && { license: info.license }),
    },
    paths,
    components: {
      schemas,
    },
  };
}

/**
 * Generate Swagger UI HTML
 */
export function generateSwaggerUIHtml(specUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Criterion API - Swagger UI</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <style>
    body { margin: 0; padding: 0; }
    .swagger-ui .topbar { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        url: "${specUrl}",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout"
      });
    };
  </script>
</body>
</html>`;
}
