import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import pc from "picocolors";

interface InitOptions {
  dir: string;
  install: boolean;
}

const PACKAGE_JSON = `{
  "name": "my-criterion-project",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@criterionx/core": "^0.3.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0"
  }
}`;

const TSCONFIG = `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}`;

const EXAMPLE_DECISION = `import { defineDecision } from "@criterionx/core";
import { z } from "zod";

/**
 * Example: Transaction Risk Decision
 *
 * Evaluates the risk level of a transaction based on amount and profile thresholds.
 */
export const transactionRisk = defineDecision({
  id: "transaction-risk",
  version: "1.0.0",

  inputSchema: z.object({
    amount: z.number().positive(),
    currency: z.string().length(3),
  }),

  outputSchema: z.object({
    risk: z.enum(["HIGH", "MEDIUM", "LOW"]),
    reason: z.string(),
  }),

  profileSchema: z.object({
    highThreshold: z.number(),
    mediumThreshold: z.number(),
  }),

  rules: [
    {
      id: "high-risk",
      when: (input, profile) => input.amount > profile.highThreshold,
      emit: () => ({ risk: "HIGH", reason: "Amount exceeds high threshold" }),
      explain: (input, profile) =>
        \`Amount \${input.amount} > \${profile.highThreshold}\`,
    },
    {
      id: "medium-risk",
      when: (input, profile) => input.amount > profile.mediumThreshold,
      emit: () => ({ risk: "MEDIUM", reason: "Amount exceeds medium threshold" }),
      explain: (input, profile) =>
        \`Amount \${input.amount} > \${profile.mediumThreshold}\`,
    },
    {
      id: "low-risk",
      when: () => true,
      emit: () => ({ risk: "LOW", reason: "Amount within acceptable range" }),
      explain: () => "Default: amount within limits",
    },
  ],
});
`;

const EXAMPLE_MAIN = `import { Engine } from "@criterionx/core";
import { transactionRisk } from "./decisions/transaction-risk.js";

const engine = new Engine();

// Example: Evaluate a transaction
const result = engine.run(
  transactionRisk,
  { amount: 15000, currency: "USD" },
  { profile: { highThreshold: 10000, mediumThreshold: 5000 } }
);

console.log("Status:", result.status);
console.log("Data:", result.data);
console.log("\\nExplanation:");
console.log(engine.explain(result));
`;

export async function initCommand(options: InitOptions): Promise<void> {
  const targetDir = path.resolve(options.dir);

  console.log(pc.cyan("\\n🎯 Initializing Criterion project...\\n"));

  // Create directories
  const dirs = [
    targetDir,
    path.join(targetDir, "src"),
    path.join(targetDir, "src", "decisions"),
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(pc.green("  ✓"), pc.dim("Created"), dir);
    }
  }

  // Create files
  const files = [
    { path: path.join(targetDir, "package.json"), content: PACKAGE_JSON },
    { path: path.join(targetDir, "tsconfig.json"), content: TSCONFIG },
    {
      path: path.join(targetDir, "src", "decisions", "transaction-risk.ts"),
      content: EXAMPLE_DECISION,
    },
    { path: path.join(targetDir, "src", "index.ts"), content: EXAMPLE_MAIN },
  ];

  for (const file of files) {
    if (!fs.existsSync(file.path)) {
      fs.writeFileSync(file.path, file.content);
      console.log(pc.green("  ✓"), pc.dim("Created"), file.path);
    } else {
      console.log(pc.yellow("  ⚠"), pc.dim("Exists"), file.path);
    }
  }

  // Install dependencies
  if (options.install) {
    console.log(pc.cyan("\\n📦 Installing dependencies...\\n"));
    try {
      execSync("npm install", { cwd: targetDir, stdio: "inherit" });
    } catch {
      console.log(pc.yellow("\\n⚠ Failed to install dependencies. Run 'npm install' manually."));
    }
  }

  console.log(pc.green("\\n✅ Project initialized!\\n"));
  console.log("Next steps:");
  console.log(pc.dim("  cd " + (options.dir === "." ? "." : options.dir)));
  if (!options.install) {
    console.log(pc.dim("  npm install"));
  }
  console.log(pc.dim("  npx tsx src/index.ts"));
  console.log();
}
