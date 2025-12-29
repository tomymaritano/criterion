# Criterion VS Code Extension

VS Code extension for the Criterion decision engine. Provides syntax highlighting, snippets, and validation for Criterion decision files.

## Features

### Syntax Highlighting

Enhanced syntax highlighting for Criterion-specific keywords:
- `defineDecision`, `createRule`, `createProfileRegistry`
- Status codes: `OK`, `NO_MATCH`, `INVALID_INPUT`, `INVALID_OUTPUT`
- Zod schema methods: `z.object`, `z.string`, `z.number`, etc.

### Snippets

Quick snippets to scaffold Criterion code:

| Prefix | Description |
|--------|-------------|
| `decision` | Create a new decision |
| `rule` | Add a rule to a decision |
| `profile` | Create a profile object |
| `run` | Run a decision with the engine |
| `inputSchema` | Define an input schema |
| `outputSchema` | Define an output schema |
| `profileSchema` | Define a profile schema |
| `when` | Create a when condition |
| `emit` | Create an emit function |
| `explain` | Create an explain function |
| `test-decision` | Create a test for a decision |
| `server` | Create a Criterion server |

### Validation

Real-time validation for Criterion decisions:

- Missing required properties (`id`, `version`, schemas)
- Empty rules array
- Missing rule properties (`when`, `emit`, `explain`)

### Hover Documentation

Hover over Criterion keywords to see documentation:
- `defineDecision`
- `inputSchema`, `outputSchema`, `profileSchema`
- `when`, `emit`, `explain`

### Commands

- **Criterion: New Decision** - Create a new decision file with boilerplate

## Installation

### From VS Code Marketplace

Search for "Criterion" in the VS Code Extensions panel.

### Manual Installation

1. Download the `.vsix` file from releases
2. Open VS Code
3. Press `Ctrl+Shift+P` / `Cmd+Shift+P`
4. Run "Extensions: Install from VSIX..."
5. Select the downloaded file

### Development

```bash
# Clone the repository
git clone https://github.com/tomymaritano/criterionx.git
cd criterionx/packages/vscode-extension

# Install dependencies
pnpm install

# Build the extension
pnpm build

# Package the extension
pnpm package
```

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `criterion.validate` | `true` | Enable/disable validation |
| `criterion.trace` | `false` | Enable trace logging |

## Supported File Types

- `.criterion.ts` - Dedicated Criterion files
- `.ts` / `.tsx` - TypeScript files containing `defineDecision` or importing `@criterionx/core`

## Example

```typescript
import { defineDecision } from "@criterionx/core";
import { z } from "zod";

export const riskDecision = defineDecision({
  id: "transaction-risk",
  version: "1.0.0",

  inputSchema: z.object({
    amount: z.number(),
    country: z.string(),
  }),

  outputSchema: z.object({
    risk: z.enum(["low", "medium", "high"]),
    score: z.number(),
  }),

  profileSchema: z.object({
    threshold: z.number(),
    blockedCountries: z.array(z.string()),
  }),

  rules: [
    {
      id: "blocked-country",
      when: (ctx, profile) => profile.blockedCountries.includes(ctx.country),
      emit: () => ({ risk: "high", score: 100 }),
      explain: (ctx) => `Country ${ctx.country} is blocked`,
    },
    {
      id: "default",
      when: () => true,
      emit: () => ({ risk: "low", score: 0 }),
      explain: () => "Default low risk",
    },
  ],
});
```

## License

MIT
