#!/usr/bin/env node
import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { newCommand } from "./commands/new.js";
import { listCommand } from "./commands/list.js";
import { validateCommand } from "./commands/validate.js";

const program = new Command();

program
  .name("criterion")
  .description("CLI for scaffolding and managing Criterion decisions")
  .version("0.3.1");

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

// criterion list
program
  .command("list")
  .description("List all decisions in the project")
  .option("-d, --dir <directory>", "Directory to search", ".")
  .option("--json", "Output as JSON")
  .action(listCommand);

// criterion validate
program
  .command("validate")
  .description("Validate all decisions in the project")
  .option("-d, --dir <directory>", "Directory to validate", ".")
  .action(validateCommand);

program.parse();
