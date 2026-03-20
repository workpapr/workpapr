import { Command } from "commander";
import path from "node:path";
import fs from "node:fs";
import chalk from "chalk";
import { scan } from "../scanner/index.js";
import { buildInventory } from "../inventory/builder.js";
import { formatInventory } from "../inventory/formatter.js";

export const inventoryCommand = new Command("inventory")
  .description("Generate an AI system inventory with risk profiles")
  .option("-d, --dir <path>", "Directory to inventory", process.cwd())
  .option("--json", "Output results as JSON")
  .action(
    async (options: { dir: string; json?: boolean }) => {
      const rootDir = path.resolve(options.dir);

      if (!fs.existsSync(rootDir)) {
        console.error(chalk.red("Error:") + ` Directory not found: ${rootDir}`);
        process.exit(1);
      }

      const summary = await scan(rootDir);
      const report = buildInventory(summary.findings);

      if (options.json) {
        console.log(JSON.stringify(report, null, 2));
        return;
      }

      formatInventory(report, rootDir);
    }
  );
