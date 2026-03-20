#!/usr/bin/env node

import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { scanCommand } from "./commands/scan.js";
import { providersCommand } from "./commands/providers.js";
import { reportCommand } from "./commands/report.js";
import { reviewCommand } from "./commands/review.js";
import { policyCommand } from "./commands/policy.js";
import { inventoryCommand } from "./commands/inventory.js";
import { monitorCommand } from "./commands/monitor.js";

const program = new Command();

program
  .name("workpapr")
  .description(
    "The provider-neutral AI audit platform. We don't use AI to audit — we make AI auditable."
  )
  .version("0.2.0");

program.addCommand(initCommand);
program.addCommand(scanCommand);
program.addCommand(providersCommand);
program.addCommand(reportCommand);
program.addCommand(reviewCommand);
program.addCommand(policyCommand);
program.addCommand(inventoryCommand);
program.addCommand(monitorCommand);

program.parse();
