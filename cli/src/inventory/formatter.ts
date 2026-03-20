import chalk from "chalk";
import type { Severity } from "../scanner/types.js";
import type { AISystem, InventoryReport } from "./types.js";

const SEVERITY_COLORS: Record<Severity, (s: string) => string> = {
  critical: chalk.red.bold,
  high: chalk.red,
  medium: chalk.yellow,
  low: chalk.dim,
};

const CLASSIFICATION_COLORS: Record<string, (s: string) => string> = {
  restricted: chalk.red.bold,
  confidential: chalk.red,
  internal: chalk.yellow,
  public: chalk.green,
};

function formatControls(system: AISystem): string {
  const issues: string[] = [];
  if (!system.hasHumanOversight) issues.push("No human oversight");
  if (!system.hasErrorHandling) issues.push("No error handling");
  if (!system.hasOutputValidation) issues.push("No output validation");
  if (issues.length === 0) return chalk.green("All controls present");
  return chalk.red(issues.join(" \u00B7 "));
}

export function formatInventory(report: InventoryReport, rootDir: string): void {
  console.log();
  console.log(chalk.bold("AI Inventory") + chalk.dim(` — ${rootDir}`));
  console.log();
  console.log(
    `  ${chalk.bold(String(report.totalSystems))} AI system${report.totalSystems !== 1 ? "s" : ""} \u00B7 ` +
      `${chalk.bold(String(report.totalProviders))} provider${report.totalProviders !== 1 ? "s" : ""} \u00B7 ` +
      `${chalk.bold(String(report.totalFindings))} findings`
  );

  for (const system of report.systems) {
    console.log();
    const severityColor = SEVERITY_COLORS[system.riskLevel];
    console.log(
      `  ${severityColor(system.riskLevel.toUpperCase())} — ${chalk.bold(system.name)} (${chalk.dim(system.file)})`
    );

    // Provider line
    const providerStr = system.providers.join(", ");
    const modelStr =
      system.models.length > 0
        ? system.models.join(", ") +
          (system.modelPinned ? "" : chalk.red(", UNPINNED"))
        : "no model detected";
    console.log(
      `    Provider: ${chalk.cyan(providerStr)} (${modelStr})`
    );

    // Data line
    const classColor = CLASSIFICATION_COLORS[system.dataClassification] ?? chalk.dim;
    const dataStr =
      system.dataTypes.length > 0
        ? system.dataTypes.join(", ")
        : "no PII detected";
    console.log(
      `    Data:     ${classColor(system.dataClassification.toUpperCase())} — ${dataStr}`
    );

    // Controls line
    console.log(`    Controls: ${formatControls(system)}`);

    // Tags line
    if (system.complianceTags.length > 0) {
      console.log(
        `    Tags:     ${chalk.dim(system.complianceTags.join(", "))}`
      );
    }
  }

  console.log();
}
