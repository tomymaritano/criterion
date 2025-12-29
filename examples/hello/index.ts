/**
 * Hello Decision — The simplest possible Criterion decision
 *
 * Run with: npm start
 */

import { z } from "zod";
import { defineDecision, createRule, Engine } from "@criterionx/core";

// Define the decision
const helloDecision = defineDecision({
  id: "hello",
  version: "1.0.0",
  inputSchema: z.object({
    name: z.string(),
  }),
  outputSchema: z.object({
    greeting: z.string(),
  }),
  profileSchema: z.object({}),
  rules: [
    createRule({
      id: "greet",
      when: () => true,
      emit: (ctx) => ({ greeting: `Hello, ${ctx.name}!` }),
      explain: (ctx) => `Greeted ${ctx.name}`,
    }),
  ],
});

// Run it
const engine = new Engine();
const result = engine.run(helloDecision, { name: "World" }, { profile: {} });

// Output
console.log("Status:", result.status);
console.log("Data:", result.data);
console.log("\nFull explanation:");
console.log(engine.explain(result));
