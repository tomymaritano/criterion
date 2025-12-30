# @criterionx/mcp

MCP (Model Context Protocol) server for Criterion decisions. Exposes business rules as MCP tools for use with LLM applications like Claude Desktop.

## Installation

```bash
npm install @criterionx/mcp @criterionx/core zod
```

## Quick Start

```typescript
import { createMcpServer } from "@criterionx/mcp";
import { defineDecision } from "@criterionx/core";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Define a decision
const pricingDecision = defineDecision({
  id: "pricing-tier",
  version: "1.0.0",
  inputSchema: z.object({ revenue: z.number() }),
  outputSchema: z.object({ tier: z.string(), discount: z.number() }),
  profileSchema: z.object({
    tiers: z.array(z.object({ min: z.number(), name: z.string(), discount: z.number() }))
  }),
  rules: [
    {
      id: "enterprise",
      when: (ctx, profile) => ctx.revenue >= profile.tiers[2].min,
      emit: (ctx, profile) => ({ tier: profile.tiers[2].name, discount: profile.tiers[2].discount }),
      explain: () => "Revenue qualifies for enterprise tier",
    },
    {
      id: "growth",
      when: (ctx, profile) => ctx.revenue >= profile.tiers[1].min,
      emit: (ctx, profile) => ({ tier: profile.tiers[1].name, discount: profile.tiers[1].discount }),
      explain: () => "Revenue qualifies for growth tier",
    },
    {
      id: "starter",
      when: () => true,
      emit: (ctx, profile) => ({ tier: profile.tiers[0].name, discount: profile.tiers[0].discount }),
      explain: () => "Default starter tier",
    },
  ],
});

// Create MCP server
const mcpServer = createMcpServer({
  name: "my-decisions",
  decisions: [pricingDecision],
  profiles: {
    "pricing-tier": {
      tiers: [
        { min: 0, name: "Starter", discount: 0 },
        { min: 100000, name: "Growth", discount: 10 },
        { min: 1000000, name: "Enterprise", discount: 25 },
      ]
    }
  }
});

// Connect via stdio transport
const transport = new StdioServerTransport();
await mcpServer.server.connect(transport);
```

## MCP Tools

The server exposes four MCP tools:

### `list_decisions`

List all registered decisions with their metadata.

**Input:** None

**Output:**
```json
{
  "decisions": [
    {
      "id": "pricing-tier",
      "version": "1.0.0",
      "description": "Determine pricing tier based on revenue",
      "rulesCount": 3
    }
  ]
}
```

### `get_decision_schema`

Get the JSON schemas for a specific decision.

**Input:**
- `decisionId` (string): The ID of the decision

**Output:**
```json
{
  "id": "pricing-tier",
  "version": "1.0.0",
  "inputSchema": { "type": "object", "properties": { "revenue": { "type": "number" } } },
  "outputSchema": { "type": "object", "properties": { "tier": { "type": "string" } } },
  "profileSchema": { ... }
}
```

### `evaluate_decision`

Evaluate a decision with the given input and optional profile.

**Input:**
- `decisionId` (string): The ID of the decision to evaluate
- `input` (object): Input data matching the decision's input schema
- `profile` (object, optional): Profile to use (overrides default)

**Output:**
```json
{
  "status": "OK",
  "data": { "tier": "Growth", "discount": 10 },
  "meta": {
    "decisionId": "pricing-tier",
    "decisionVersion": "1.0.0",
    "matchedRule": "growth",
    "explanation": "Revenue qualifies for growth tier",
    "evaluatedRules": [
      { "ruleId": "enterprise", "matched": false },
      { "ruleId": "growth", "matched": true, "explanation": "Revenue qualifies for growth tier" }
    ],
    "evaluatedAt": "2024-12-29T22:00:00.000Z"
  }
}
```

### `explain_result`

Get a human-readable explanation of a decision result.

**Input:**
- `result` (object): The evaluation result to explain

**Output:**
```
Decision: pricing-tier v1.0.0
Status: OK
Matched: growth
Reason: Revenue qualifies for growth tier

Evaluation trace:
  ✗ enterprise
  ✓ growth
```

## Claude Desktop Configuration

Add to `~/.claude/config.json`:

```json
{
  "mcpServers": {
    "criterion": {
      "command": "node",
      "args": ["/path/to/your/criterion-mcp-server.js"]
    }
  }
}
```

## API Reference

### `createMcpServer(options)`

Create a new Criterion MCP server.

**Options:**
- `name` (string, optional): Server name exposed to MCP clients
- `version` (string, optional): Server version
- `decisions` (Decision[]): Decisions to expose as MCP tools
- `profiles` (Record<string, unknown>, optional): Default profiles keyed by decision ID

**Returns:** `CriterionMcpServer`

### `CriterionMcpServer`

The MCP server class.

**Properties:**
- `server`: The underlying MCP server instance (for transport connection)
- `decisionRegistry`: Map of registered decisions
- `profileRegistry`: Map of registered profiles

## License

MIT
