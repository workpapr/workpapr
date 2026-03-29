import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import { exportTrainingData } from "../training/export.js";
import type { InvestigationTrace } from "../training/types.js";
import { loadStylePreferences } from "../workpaper/style-profile.js";
import { loadFindings } from "../findings/persistence.js";

function loadTraces(rootDir: string): InvestigationTrace[] {
  const tracePath = path.join(rootDir, ".workpapr", "training-data", "traces.jsonl");
  if (!fs.existsSync(tracePath)) return [];
  try {
    const raw = fs.readFileSync(tracePath, "utf-8");
    return raw.split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
  } catch { return []; }
}

export const trainingCommand = new Command("training")
  .description("Manage training data for model fine-tuning");

trainingCommand
  .command("export")
  .description("Export accumulated training data as JSONL files")
  .option("-d, --dir <path>", "Project directory", process.cwd())
  .action(async (options: { dir: string }) => {
    const rootDir = path.resolve(options.dir);

    console.log();
    console.log(chalk.bold("Workpapr — Export Training Data"));
    console.log();

    const results = exportTrainingData(rootDir);

    if (results.length === 0) {
      console.log(
        chalk.dim("  No training data available. Run scans with --ai and review findings first.")
      );
      return;
    }

    for (const r of results) {
      console.log(
        `  ${chalk.green(r.taskType.padEnd(30))} ${chalk.bold(String(r.count).padStart(4))} samples → ${chalk.dim(path.relative(rootDir, r.path))}`
      );
    }

    const totalSamples = results.reduce((sum, r) => sum + r.count, 0);
    console.log();
    console.log(
      `  Total: ${chalk.bold(String(totalSamples))} training samples across ${results.length} task type(s)`
    );
    console.log();
  });

trainingCommand
  .command("stats")
  .description("Show training data statistics")
  .option("-d, --dir <path>", "Project directory", process.cwd())
  .action(async (options: { dir: string }) => {
    const rootDir = path.resolve(options.dir);

    console.log();
    console.log(chalk.bold("Workpapr — Training Data Stats"));
    console.log();

    // Findings with AI predictions
    const findings = loadFindings(rootDir);
    const withAIPredictions = findings.filter(
      (f) => f.ai_fp_flag !== undefined || f.ai_predicted_severity
    );
    const withHumanLabels = findings.filter(
      (f) => f.disposition !== null || f.severity_override !== null
    );
    const pairedData = findings.filter(
      (f) =>
        (f.ai_fp_flag !== undefined && f.fp_override) ||
        (f.ai_predicted_severity && f.severity_override)
    );

    console.log("  Findings:");
    console.log(`    Total:                ${chalk.bold(String(findings.length))}`);
    console.log(`    With AI predictions:  ${chalk.bold(String(withAIPredictions.length))}`);
    console.log(`    With human labels:    ${chalk.bold(String(withHumanLabels.length))}`);
    console.log(
      `    Paired (AI + human):  ${chalk.bold(String(pairedData.length))} ${chalk.dim("← usable for SFT")}`
    );

    // Investigation traces
    const traces = loadTraces(rootDir);
    const completedTraces = traces.filter((t) => t.completedAt);
    const avgSteps =
      completedTraces.length > 0
        ? Math.round(
            completedTraces.reduce((sum, t) => sum + t.steps.length, 0) /
              completedTraces.length
          )
        : 0;

    console.log();
    console.log("  Investigation traces:");
    console.log(`    Total:     ${chalk.bold(String(traces.length))}`);
    console.log(`    Completed: ${chalk.bold(String(completedTraces.length))}`);
    console.log(`    Avg steps: ${chalk.bold(String(avgSteps))}`);

    // Style preferences
    const prefs = loadStylePreferences(rootDir);
    console.log();
    console.log("  Style preferences:");
    console.log(`    Edit pairs: ${chalk.bold(String(prefs.length))} ${chalk.dim("← usable for RLHF/DPO")}`);

    console.log();
  });
