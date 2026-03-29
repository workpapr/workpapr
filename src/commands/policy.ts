import { Command } from "commander";
import path from "node:path";
import fs from "node:fs";
import chalk from "chalk";
import { scan } from "../scanner/index.js";
import { loadPolicies } from "../policy/loader.js";
import { evaluatePolicies } from "../policy/engine.js";
import type { PolicyRuleResult } from "../policy/types.js";

const RESULT_LABELS: Record<PolicyRuleResult, string> = {
  block: chalk.red.bold("BLOCK"),
  warn: chalk.yellow.bold(" WARN"),
  pass: chalk.green.bold(" PASS"),
};

export const policyCommand = new Command("policy")
  .description("Enforce AI governance policies");

policyCommand
  .command("check")
  .description("Check scan results against governance policies")
  .option("-d, --dir <path>", "Directory to check", process.cwd())
  .option("--json", "Output results as JSON")
  .action(
    async (options: { dir: string; json?: boolean }) => {
      const rootDir = path.resolve(options.dir);

      if (!fs.existsSync(rootDir)) {
        console.error(chalk.red("Error:") + ` Directory not found: ${rootDir}`);
        process.exit(1);
      }

      const summary = await scan(rootDir);
      const policies = loadPolicies(rootDir);
      const report = evaluatePolicies(summary.findings, policies);

      if (options.json) {
        console.log(JSON.stringify(report, null, 2));
        process.exit(report.passed ? 0 : 1);
        return;
      }

      console.log();
      console.log(chalk.bold("Policy Check") + chalk.dim(` — ${rootDir}`));
      console.log();

      for (const ruleReport of report.rules) {
        const label = RESULT_LABELS[ruleReport.result];
        const name = ruleReport.rule.name;

        if (ruleReport.violations.length > 0) {
          const count = ruleReport.violations.length;
          const noun = ruleReport.result === "block" ? "violation" : "warning";
          console.log(
            `  ${label}  ${name}${chalk.dim(`         ${count} ${noun}${count > 1 ? "s" : ""}`)}`
          );
          for (const v of ruleReport.violations) {
            console.log(
              `         ${chalk.dim(`${v.file}:${v.line}`)}       ${chalk.dim(`${v.findingType} (${v.severity})`)}`
            );
          }
        } else {
          console.log(`  ${label}  ${name}`);
        }
      }

      console.log();
      const { blocked, warned, passed } = report.summary;
      const resultText = report.passed
        ? chalk.green.bold("PASSED")
        : chalk.red.bold("FAILED");
      console.log(
        `  Result: ${resultText} (${blocked} blocked, ${warned} warned, ${passed} passed)`
      );
      console.log();

      process.exit(report.passed ? 0 : 1);
    }
  );

policyCommand
  .command("list")
  .description("List available governance policies")
  .option("-d, --dir <path>", "Directory to load policies from", process.cwd())
  .action((options: { dir: string }) => {
    const rootDir = path.resolve(options.dir);
    const policies = loadPolicies(rootDir);

    console.log();
    console.log(chalk.bold("Governance Policies"));
    console.log();

    for (const p of policies) {
      const action =
        p.action === "block"
          ? chalk.red.bold("BLOCK")
          : chalk.yellow.bold("WARN ");
      const status = p.enabled ? chalk.green("enabled") : chalk.dim("disabled");
      console.log(`  ${action}  ${p.name}`);
      console.log(
        `         ${chalk.dim(`id: ${p.id}  severity: ${p.severity}  ${status}`)}`
      );
      console.log(
        `         ${chalk.dim(`finding types: ${p.findingTypes.join(", ")}`)}`
      );
      console.log();
    }
  });
