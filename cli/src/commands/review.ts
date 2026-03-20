import { Command } from "commander";
import path from "node:path";
import { execSync } from "node:child_process";
import chalk from "chalk";
import { loadFindings } from "../findings/persistence.js";
import type { Severity } from "../scanner/types.js";

const SEVERITY_COLORS: Record<Severity, (s: string) => string> = {
  critical: chalk.red.bold,
  high: chalk.red,
  medium: chalk.yellow,
  low: chalk.dim,
};

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];

export const reviewCommand = new Command("review")
  .description("Show unreviewed findings for auditor review")
  .option("-d, --dir <path>", "Project directory", process.cwd())
  .option(
    "--severity <levels>",
    "Filter by severity (comma-separated: critical,high)"
  )
  .option("--edit", "Open findings.yaml in $EDITOR")
  .action(
    async (options: { dir: string; severity?: string; edit?: boolean }) => {
      const rootDir = path.resolve(options.dir);
      const findings = loadFindings(rootDir);

      if (findings.length === 0) {
        console.log(
          chalk.dim(
            "No findings found. Run `workpapr scan` first."
          )
        );
        return;
      }

      if (options.edit) {
        const editor = process.env.EDITOR || "vi";
        const findingsPath = path.join(
          rootDir,
          ".workpapr",
          "findings.yaml"
        );
        try {
          execSync(`${editor} "${findingsPath}"`, { stdio: "inherit" });
        } catch {
          console.error(
            chalk.red("Failed to open editor. Set $EDITOR environment variable.")
          );
        }
        return;
      }

      const severityFilter = options.severity
        ? new Set(options.severity.split(",").map((s) => s.trim().toLowerCase()))
        : null;

      const unreviewed = findings.filter((f) => {
        if (f.status !== "open" || f.disposition !== null) return false;
        if (severityFilter && !severityFilter.has(f.severity)) return false;
        return true;
      });

      if (unreviewed.length === 0) {
        console.log(
          chalk.green(
            "All findings have been reviewed!"
          )
        );
        return;
      }

      console.log();
      console.log(
        chalk.bold(`${unreviewed.length} Unreviewed Findings`)
      );
      console.log(
        chalk.dim(
          "Edit .workpapr/findings.yaml to add dispositions, or use --edit to open in $EDITOR"
        )
      );
      console.log();

      for (const sev of SEVERITY_ORDER) {
        const sevFindings = unreviewed.filter((f) => f.severity === sev);
        if (sevFindings.length === 0) continue;

        const colorFn = SEVERITY_COLORS[sev];
        console.log(colorFn(`  ${sev.toUpperCase()} (${sevFindings.length})`));

        for (const f of sevFindings) {
          console.log(
            `    [${f.id}] ${chalk.dim(`${f.file}:${f.line}`)} [${f.type}] ${f.provider}`
          );
          console.log(`      ${chalk.dim(f.context)}`);
          if (f.riskCategory) {
            console.log(`      ${chalk.dim(f.riskCategory)}`);
          }
          console.log(
            chalk.dim(
              `      # disposition: confirmed | false-positive | accepted-risk | needs-remediation`
            )
          );
          console.log(
            chalk.dim(`      # note: "your expert assessment here"`)
          );
          console.log(
            chalk.dim(`      # auditor: "Name, Credential"`)
          );
          console.log();
        }
      }
    }
  );
