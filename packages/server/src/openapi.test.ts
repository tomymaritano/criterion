import { describe, it, expect } from "vitest";
import { z } from "zod";
import { defineDecision } from "@criterionx/core";
import { generateOpenAPISpec, generateSwaggerUIHtml } from "./openapi.js";

// Test decision
const testDecision = defineDecision({
  id: "test-decision",
  version: "1.0.0",
  meta: {
    description: "A test decision for pricing",
  },
  inputSchema: z.object({
    value: z.number(),
    category: z.enum(["A", "B", "C"]),
  }),
  outputSchema: z.object({
    price: z.number(),
    approved: z.boolean(),
  }),
  profileSchema: z.object({
    threshold: z.number(),
    multiplier: z.number(),
  }),
  rules: [
    {
      id: "default",
      when: () => true,
      emit: () => ({ price: 100, approved: true }),
      explain: () => "Default pricing",
    },
  ],
});

const anotherDecision = defineDecision({
  id: "risk-assessment",
  version: "2.0.0",
  inputSchema: z.object({
    amount: z.number(),
  }),
  outputSchema: z.object({
    risk: z.string(),
  }),
  profileSchema: z.object({
    limit: z.number(),
  }),
  rules: [
    {
      id: "default",
      when: () => true,
      emit: () => ({ risk: "LOW" }),
      explain: () => "Default risk",
    },
  ],
});

describe("generateOpenAPISpec", () => {
  it("should generate valid OpenAPI 3.0 spec", () => {
    const spec = generateOpenAPISpec([testDecision]);

    expect(spec.openapi).toBe("3.0.0");
    expect(spec.info).toBeDefined();
    expect(spec.paths).toBeDefined();
    expect(spec.components).toBeDefined();
    expect(spec.components.schemas).toBeDefined();
  });

  it("should use default info values", () => {
    const spec = generateOpenAPISpec([testDecision]);

    expect(spec.info.title).toBe("Criterion Decision API");
    expect(spec.info.version).toBe("1.0.0");
    expect(spec.info.description).toBe("Auto-generated API for Criterion decisions");
  });

  it("should use custom info values", () => {
    const spec = generateOpenAPISpec([testDecision], {
      title: "My Decision API",
      version: "2.5.0",
      description: "Custom API description",
      contact: {
        name: "API Support",
        email: "support@example.com",
      },
      license: {
        name: "MIT",
        url: "https://opensource.org/licenses/MIT",
      },
    });

    expect(spec.info.title).toBe("My Decision API");
    expect(spec.info.version).toBe("2.5.0");
    expect(spec.info.description).toBe("Custom API description");
    expect(spec.info.contact).toEqual({
      name: "API Support",
      email: "support@example.com",
    });
    expect(spec.info.license).toEqual({
      name: "MIT",
      url: "https://opensource.org/licenses/MIT",
    });
  });

  it("should generate paths for each decision", () => {
    const spec = generateOpenAPISpec([testDecision, anotherDecision]);

    // Decision endpoints
    expect(spec.paths["/decisions/test-decision"]).toBeDefined();
    expect(spec.paths["/decisions/test-decision"].post).toBeDefined();
    expect(spec.paths["/decisions/risk-assessment"]).toBeDefined();
    expect(spec.paths["/decisions/risk-assessment"].post).toBeDefined();

    // Schema endpoints
    expect(spec.paths["/decisions/test-decision/schema"]).toBeDefined();
    expect(spec.paths["/decisions/test-decision/schema"].get).toBeDefined();
  });

  it("should include common endpoints", () => {
    const spec = generateOpenAPISpec([testDecision]);

    // Health check
    expect(spec.paths["/"]).toBeDefined();
    expect(spec.paths["/"].get).toBeDefined();
    expect(spec.paths["/"].get?.operationId).toBe("health_check");

    // List decisions
    expect(spec.paths["/decisions"]).toBeDefined();
    expect(spec.paths["/decisions"].get).toBeDefined();
    expect(spec.paths["/decisions"].get?.operationId).toBe("list_decisions");
  });

  it("should generate schemas for each decision", () => {
    const spec = generateOpenAPISpec([testDecision]);

    // Decision-specific schemas
    expect(spec.components.schemas["TestDecisionInput"]).toBeDefined();
    expect(spec.components.schemas["TestDecisionOutput"]).toBeDefined();
    expect(spec.components.schemas["TestDecisionProfile"]).toBeDefined();
    expect(spec.components.schemas["TestDecisionRequest"]).toBeDefined();
  });

  it("should generate common schemas", () => {
    const spec = generateOpenAPISpec([testDecision]);

    expect(spec.components.schemas["EvaluateRequest"]).toBeDefined();
    expect(spec.components.schemas["EvaluationResult"]).toBeDefined();
    expect(spec.components.schemas["ResultMeta"]).toBeDefined();
    expect(spec.components.schemas["ErrorResponse"]).toBeDefined();
  });

  it("should include decision description in path", () => {
    const spec = generateOpenAPISpec([testDecision]);
    const postOp = spec.paths["/decisions/test-decision"].post;

    expect(postOp?.description).toBe("A test decision for pricing");
  });

  it("should generate correct operation IDs", () => {
    const spec = generateOpenAPISpec([testDecision]);

    const evaluateOp = spec.paths["/decisions/test-decision"].post;
    expect(evaluateOp?.operationId).toBe("evaluate_test_decision");

    const schemaOp = spec.paths["/decisions/test-decision/schema"].get;
    expect(schemaOp?.operationId).toBe("get_test_decision_schema");
  });

  it("should include tags", () => {
    const spec = generateOpenAPISpec([testDecision]);

    const evaluateOp = spec.paths["/decisions/test-decision"].post;
    expect(evaluateOp?.tags).toContain("decisions");

    const schemaOp = spec.paths["/decisions/test-decision/schema"].get;
    expect(schemaOp?.tags).toContain("schemas");

    const healthOp = spec.paths["/"].get;
    expect(healthOp?.tags).toContain("system");
  });

  it("should define request body for POST endpoints", () => {
    const spec = generateOpenAPISpec([testDecision]);
    const postOp = spec.paths["/decisions/test-decision"].post;

    expect(postOp?.requestBody).toBeDefined();
    expect(postOp?.requestBody?.required).toBe(true);
    expect(postOp?.requestBody?.content["application/json"]).toBeDefined();
    expect(postOp?.requestBody?.content["application/json"].schema).toHaveProperty(
      "$ref",
      "#/components/schemas/TestDecisionRequest"
    );
  });

  it("should define responses for POST endpoints", () => {
    const spec = generateOpenAPISpec([testDecision]);
    const postOp = spec.paths["/decisions/test-decision"].post;

    expect(postOp?.responses["200"]).toBeDefined();
    expect(postOp?.responses["200"].description).toBe("Decision evaluated successfully");

    expect(postOp?.responses["400"]).toBeDefined();
    expect(postOp?.responses["400"].description).toBe("Invalid input or no matching rule");

    expect(postOp?.responses["404"]).toBeDefined();
    expect(postOp?.responses["404"].description).toBe("Decision not found");
  });

  it("should handle decision ID with hyphens in schema names", () => {
    const spec = generateOpenAPISpec([anotherDecision]);

    // risk-assessment -> RiskAssessment
    expect(spec.components.schemas["RiskAssessmentInput"]).toBeDefined();
    expect(spec.components.schemas["RiskAssessmentOutput"]).toBeDefined();
  });
});

describe("generateSwaggerUIHtml", () => {
  it("should generate HTML with Swagger UI", () => {
    const html = generateSwaggerUIHtml("/openapi.json");

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("swagger-ui");
    expect(html).toContain("/openapi.json");
  });

  it("should use provided spec URL", () => {
    const html = generateSwaggerUIHtml("/api/spec.json");

    expect(html).toContain('url: "/api/spec.json"');
  });

  it("should include SwaggerUIBundle", () => {
    const html = generateSwaggerUIHtml("/openapi.json");

    expect(html).toContain("swagger-ui-bundle.js");
    expect(html).toContain("swagger-ui.css");
    expect(html).toContain("SwaggerUIBundle");
  });
});
