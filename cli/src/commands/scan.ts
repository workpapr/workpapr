import { Command } from "commander";
import path from "node:path";
import fs from "node:fs";
import chalk from "chalk";
import { parse as parseYaml } from "yaml";
import { scan } from "../scanner/index.js";
import type { ScanConfig, ScanResult, Severity } from "../scanner/types.js";
import {
  loadFindings,
  saveFindings,
  reconcileFindings,
} from "../findings/persistence.js";

const SEVERITY_COLORS: Record<Severity, (s: string) => string> = {
  critical: chalk.red.bold,
  high: chalk.red,
  medium: chalk.yellow,
  low: chalk.dim,
};

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];

function typeLabel(type: string): string {
  switch (type) {
    case "import":
      return chalk.blue("import");
    case "api-call":
      return chalk.magenta("api-call");
    case "hardcoded-key":
      return chalk.red.bold("hardcoded-key");
    case "pii-in-prompt":
      return chalk.red.bold("pii-in-prompt");
    case "autonomous-decision":
      return chalk.red("autonomous-decision");
    case "no-error-handling":
      return chalk.red("no-error-handling");
    case "unversioned-model":
      return chalk.yellow("unversioned-model");
    case "missing-output-validation":
      return chalk.yellow("missing-output-validation");
    default:
      return chalk.dim(type);
  }
}

export const scanCommand = new Command("scan")
  .description("Discover AI/LLM usage and risks in your codebase")
  .option("-d, --dir <path>", "Directory to scan", process.cwd())
  .option("--json", "Output results as JSON")
  .option("-v, --verbose", "Show all findings grouped by severity")
  .option("--no-persist", "Skip saving findings to .workpapr/findings.yaml")
  .action(
    async (options: {
      dir: string;
      json?: boolean;
      verbose?: boolean;
      persist?: boolean;
    }) => {
      const rootDir = path.resolve(options.dir);

      if (!fs.existsSync(rootDir)) {
        console.error(chalk.red("Error:") + ` Directory not found: ${rootDir}`);
        process.exit(1);
      }

      // Try to load config
      let scanConfig: Partial<ScanConfig> | undefined;
      const configPath = path.join(rootDir, "workpapr.yaml");
      if (fs.existsSync(configPath)) {
        try {
          const raw = fs.readFileSync(configPath, "utf-8");
          const parsed = parseYaml(raw);
          if (parsed?.scan) {
            scanConfig = parsed.scan;
          }
        } catch {
          // Ignore config parse errors, use defaults
        }
      }

      const summary = await scan(rootDir, scanConfig);

      // Persist findings unless --no-persist
      if (options.persist !== false) {
        const existing = loadFindings(rootDir);
        const reconciled = reconcileFindings(existing, summary.findings);
        saveFindings(rootDir, reconciled);

        const reviewed = reconciled.filter(
          (f) => f.disposition !== null
        ).length;
        const unreviewed = reconciled.filter(
          (f) => f.disposition === null && f.status === "open"
        ).length;

        if (!options.json) {
          console.log(
            chalk.dim(
              `  Findings saved to .workpapr/findings.yaml (${reviewed} reviewed, ${unreviewed} unreviewed)`
            )
          );
        }
      }

      if (options.json) {
        const jsonOutput = {
          ...summary,
          providers: Object.fromEntries(summary.providers),
        };
        console.log(JSON.stringify(jsonOutput, null, 2));
        return;
      }

      console.log();
      console.log(
        chalk.bold("Workpapr Scan") + chalk.dim(` — ${rootDir}`)
      );
      console.log();

      // Display summary
      console.log(
        `  Files scanned:  ${chalk.bold(String(summary.filesScanned))}`
      );
      console.log(
        `  Files with AI:  ${chalk.bold(String(summary.filesWithAI))}`
      );
      console.log(
        `  Total findings: ${chalk.bold(String(summary.findings.length))}`
      );
      console.log(`    Imports:      ${summary.byType.imports}`);
      console.log(`    API calls:    ${summary.byType.apiCalls}`);

      // Severity breakdown
      if (summary.riskFindings > 0) {
        console.log(`    Risk findings: ${chalk.bold(String(summary.riskFindings))}`);
      }
      console.log();
      console.log(chalk.bold("  Severity:"));
      for (const sev of SEVERITY_ORDER) {
        const count = summary.bySeverity[sev];
        if (count > 0) {
          const colorFn = SEVERITY_COLORS[sev];
          console.log(
            `    ${colorFn(sev.toUpperCase().padEnd(9))} ${count}`
          );
        }
      }

      if (summary.providers.size > 0) {
        console.log();
        console.log(chalk.bold("  Providers detected:"));
        const sorted = [...summary.providers.entries()].sort(
          (a, b) => b[1] - a[1]
        );
        for (const [provider, count] of sorted) {
          console.log(
            `    ${chalk.cyan("\u25CF")} ${provider} ${chalk.dim(`(${count} finding${count > 1 ? "s" : ""})`)}`
          );
        }
      }

      if (summary.findings.length > 0 && options.verbose) {
        console.log();
        console.log(chalk.bold("  Findings:"));

        // Group by severity
        for (const sev of SEVERITY_ORDER) {
          const sevFindings = summary.findings.filter(
            (f) => f.severity === sev
          );
          if (sevFindings.length === 0) continue;

          const colorFn = SEVERITY_COLORS[sev];
          console.log();
          console.log(
            `    ${colorFn(sev.toUpperCase())} (${sevFindings.length})`
          );

          for (const finding of sevFindings) {
            console.log(
              `      ${chalk.dim(`${finding.file}:${finding.line}`)} [${typeLabel(finding.type)}] ${chalk.cyan(finding.provider)}`
            );
            if (finding.riskCategory) {
              console.log(
                `        ${chalk.dim(finding.riskCategory)}`
              );
            }
            if (finding.complianceTags && finding.complianceTags.length > 0) {
              console.log(
                `        Tags: ${chalk.dim(finding.complianceTags.join(", "))}`
              );
            }
            console.log(`        ${chalk.dim(finding.context)}`);
          }
        }
      } else if (summary.findings.length > 0 && !options.verbose) {
        console.log();
        console.log(
          chalk.dim(
            "  Use --verbose to see all findings grouped by severity"
          )
        );
      }

      if (summary.findings.length === 0) {
        console.log();
        console.log(
          chalk.dim("  No AI/LLM usage detected in this codebase.")
        );
        console.log(
          chalk.dim(
            "  If this seems wrong, check the scan config in workpapr.yaml"
          )
        );
      }

      console.log();
    }
  );
