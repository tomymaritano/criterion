#!/usr/bin/env node
import { Command } from "commander";
import pc from "picocolors";
import { initCommand } from "./commands/init.js";
import { newCommand } from "./commands/new.js";

const program = new Command();

program
  .name("criterion")
  .description("CLI for scaffolding Criterion decisions")
  .version("0.1.0");

// criterion init
program
  .command("init")
  .description("Initialize a new Criterion project")
  .option("-d, --dir <directory>", "Target directory", ".")
  .option("--no-install", "Skip npm install")
  .action(initCommand);

// criterion new decision <name>
program
  .command("new")
  .description("Generate new Criterion components")
  .argument("<type>", "Type to generate (decision, profile)")
  .argument("<name>", "Name of the component")
  .option("-d, --dir <directory>", "Target directory", "src/decisions")
  .action(newCommand);

// criterion list (future)
program
  .command("list")
  .description("List all decisions in the project")
  .action(() => {
    console.log(pc.yellow("Coming soon: criterion list"));
  });

// criterion validate (future)
program
  .command("validate")
  .description("Validate all decisions in the project")
  .action(() => {
    console.log(pc.yellow("Coming soon: criterion validate"));
  });

program.parse();
