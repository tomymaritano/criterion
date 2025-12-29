# @criterionx/cli

CLI for scaffolding Criterion decisions.

## Installation

```bash
npm install -g @criterionx/cli
# or
npx @criterionx/cli
```

## Commands

### `criterion init`

Initialize a new Criterion project with example decision.

```bash
criterion init
criterion init --dir my-project
criterion init --no-install
```

Creates:
- `package.json` with dependencies
- `tsconfig.json` configured for ESM
- `src/decisions/transaction-risk.ts` - Example decision
- `src/index.ts` - Example usage

### `criterion new decision <name>`

Generate a new decision boilerplate.

```bash
criterion new decision user-eligibility
criterion new decision LoanApproval
criterion new decision "payment risk" --dir src/decisions
```

Creates a decision file with:
- Input/output/profile schemas
- Default rule
- TODO comments for customization

### `criterion new profile <name>`

Generate a new profile template.

```bash
criterion new profile us-standard
criterion new profile eu-premium
```

### `criterion list` (coming soon)

List all decisions in the project.

### `criterion validate` (coming soon)

Validate all decisions in the project.

## Example Workflow

```bash
# 1. Create new project
criterion init --dir my-decisions
cd my-decisions

# 2. Generate decisions
criterion new decision loan-approval
criterion new decision fraud-detection

# 3. Run your code
npx tsx src/index.ts
```

## License

MIT
