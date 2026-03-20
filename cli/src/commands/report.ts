import { Command } from "commander";
import path from "node:path";
import fs from "node:fs";
import chalk from "chalk";
import { loadFindings } from "../findings/persistence.js";
import type { PersistedFinding } from "../findings/types.js";
import type { Severity } from "../scanner/types.js";

const SEVERITY_COLORS: Record<Severity, (s: string) => string> = {
  critical: chalk.red.bold,
  high: chalk.red,
  medium: chalk.yellow,
  low: chalk.dim,
};

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];

const DISPOSITION_LABELS: Record<string, string> = {
  confirmed: "CONFIRMED",
  "false-positive": "FALSE POSITIVE",
  "accepted-risk": "ACCEPTED RISK",
  "needs-remediation": "NEEDS REMEDIATION",
};

function progressBar(pct: number, width: number = 20): string {
  const filled = Math.round((pct / 100) * width);
  const empty = width - filled;
  return "\u2588".repeat(filled) + "\u2591".repeat(empty);
}

function formatReport(findings: PersistedFinding[]): string {
  const open = findings.filter((f) => f.status === "open");
  const resolved = findings.filter((f) => f.status === "resolved");
  const reviewed = open.filter((f) => f.disposition !== null);
  const unreviewed = open.filter((f) => f.disposition === null);
  const reviewPct =
    open.length > 0 ? Math.round((reviewed.length / open.length) * 100) : 0;

  const lines: string[] = [];

  // Audit coverage
  lines.push(chalk.bold("AUDIT COVERAGE"));
  lines.push(
    `  Total findings: ${findings.length}    Reviewed: ${reviewed.length} (${reviewPct}%)    Unreviewed: ${unreviewed.length}    Resolved: ${resolved.length}`
  );
  lines.push(`  ${progressBar(reviewPct)}  ${reviewPct}%`);
  lines.push("");

  // Disposition summary
  const dispositionCounts: Record<string, number> = {
    confirmed: 0,
    "needs-remediation": 0,
    "accepted-risk": 0,
    "false-positive": 0,
  };
  for (const f of reviewed) {
    if (f.disposition) {
      dispositionCounts[f.disposition] =
        (dispositionCounts[f.disposition] ?? 0) + 1;
    }
  }
  lines.push(chalk.bold("DISPOSITION SUMMARY"));
  lines.push(
    `  Confirmed: ${dispositionCounts["confirmed"]}    Needs remediation: ${dispositionCounts["needs-remediation"]}    Accepted risk: ${dispositionCounts["accepted-risk"]}    False positive: ${dispositionCounts["false-positive"]}`
  );
  lines.push("");

  // Findings by severity
  lines.push(chalk.bold("FINDINGS BY SEVERITY"));
  for (const sev of SEVERITY_ORDER) {
    const sevFindings = open.filter(
      (f) => (f.severity_override ?? f.severity) === sev
    );
    if (sevFindings.length === 0) continue;

    const colorFn = SEVERITY_COLORS[sev];
    lines.push(`  ${colorFn(sev.toUpperCase())} (${sevFindings.length})`);

    for (const f of sevFindings) {
      lines.push(
        `    [${f.id}] ${f.file}:${f.line} [${f.type}] ${f.provider}`
      );

      if (f.disposition) {
        const label = DISPOSITION_LABELS[f.disposition] ?? f.disposition;
        const auditorInfo = f.auditor ? ` \u2014 ${f.auditor}` : "";
        const dateInfo = f.reviewed_at
          ? ` (${f.reviewed_at.slice(0, 10)})`
          : "";
        lines.push(
          `      ${chalk.bold(label)}${auditorInfo}${dateInfo}`
        );
      }

      if (f.note) {
        lines.push(`      "${f.note}"`);
      }

      if (f.evidence_ref) {
        lines.push(`      Evidence: ${f.evidence_ref}`);
      }

      if (f.complianceTags && f.complianceTags.length > 0) {
        lines.push(
          `      Tags: ${f.complianceTags.join(", ")}`
        );
      }
    }
    lines.push("");
  }

  // Compliance mapping
  const tagCounts = new Map<string, number>();
  for (const f of open) {
    if (f.complianceTags) {
      for (const tag of f.complianceTags) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }
  }
  if (tagCounts.size > 0) {
    lines.push(chalk.bold("COMPLIANCE MAPPING"));
    const sortedTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]);
    const tagStrings = sortedTags.map(
      ([tag, count]) => `${tag}: ${count} finding${count > 1 ? "s" : ""}`
    );
    lines.push(`  ${tagStrings.join("    ")}`);
    lines.push("");
  }

  return lines.join("\n");
}

function formatMarkdownReport(findings: PersistedFinding[]): string {
  const open = findings.filter((f) => f.status === "open");
  const resolved = findings.filter((f) => f.status === "resolved");
  const reviewed = open.filter((f) => f.disposition !== null);
  const unreviewed = open.filter((f) => f.disposition === null);
  const reviewPct =
    open.length > 0 ? Math.round((reviewed.length / open.length) * 100) : 0;

  const lines: string[] = [];

  lines.push("# Workpapr Audit Report");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString().slice(0, 10)}`);
  lines.push("");

  lines.push("## Audit Coverage");
  lines.push("");
  lines.push(`| Metric | Count |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total findings | ${findings.length} |`);
  lines.push(`| Reviewed | ${reviewed.length} (${reviewPct}%) |`);
  lines.push(`| Unreviewed | ${unreviewed.length} |`);
  lines.push(`| Resolved | ${resolved.length} |`);
  lines.push("");

  lines.push("## Disposition Summary");
  lines.push("");
  const dispositionCounts: Record<string, number> = {};
  for (const f of reviewed) {
    if (f.disposition) {
      dispositionCounts[f.disposition] =
        (dispositionCounts[f.disposition] ?? 0) + 1;
    }
  }
  lines.push(`| Disposition | Count |`);
  lines.push(`|-------------|-------|`);
  for (const [disp, count] of Object.entries(dispositionCounts)) {
    lines.push(`| ${disp} | ${count} |`);
  }
  lines.push("");

  lines.push("## Findings by Severity");
  lines.push("");

  for (const sev of SEVERITY_ORDER) {
    const sevFindings = open.filter(
      (f) => (f.severity_override ?? f.severity) === sev
    );
    if (sevFindings.length === 0) continue;

    lines.push(`### ${sev.toUpperCase()} (${sevFindings.length})`);
    lines.push("");

    for (const f of sevFindings) {
      lines.push(
        `- **\`[${f.id}]\`** \`${f.file}:${f.line}\` [${f.type}] ${f.provider}`
      );
      if (f.disposition) {
        const label = DISPOSITION_LABELS[f.disposition] ?? f.disposition;
        const auditorInfo = f.auditor ? ` — ${f.auditor}` : "";
        const dateInfo = f.reviewed_at
          ? ` (${f.reviewed_at.slice(0, 10)})`
          : "";
        lines.push(`  - **${label}**${auditorInfo}${dateInfo}`);
      }
      if (f.note) {
        lines.push(`  - "${f.note}"`);
      }
      if (f.evidence_ref) {
        lines.push(`  - Evidence: ${f.evidence_ref}`);
      }
      if (f.complianceTags && f.complianceTags.length > 0) {
        lines.push(`  - Tags: ${f.complianceTags.join(", ")}`);
      }
    }
    lines.push("");
  }

  // Compliance mapping
  const tagCounts = new Map<string, number>();
  for (const f of open) {
    if (f.complianceTags) {
      for (const tag of f.complianceTags) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }
  }
  if (tagCounts.size > 0) {
    lines.push("## Compliance Mapping");
    lines.push("");
    lines.push(`| Framework | Findings |`);
    lines.push(`|-----------|----------|`);
    const sortedTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]);
    for (const [tag, count] of sortedTags) {
      lines.push(`| ${tag} | ${count} |`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function formatJsonReport(findings: PersistedFinding[]): string {
  const open = findings.filter((f) => f.status === "open");
  const resolved = findings.filter((f) => f.status === "resolved");
  const reviewed = open.filter((f) => f.disposition !== null);

  const dispositionCounts: Record<string, number> = {};
  for (const f of reviewed) {
    if (f.disposition) {
      dispositionCounts[f.disposition] =
        (dispositionCounts[f.disposition] ?? 0) + 1;
    }
  }

  const tagCounts: Record<string, number> = {};
  for (const f of open) {
    if (f.complianceTags) {
      for (const tag of f.complianceTags) {
        tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
      }
    }
  }

  return JSON.stringify(
    {
      coverage: {
        total: findings.length,
        reviewed: reviewed.length,
        unreviewed: open.length - reviewed.length,
        resolved: resolved.length,
        reviewPercentage:
          open.length > 0
            ? Math.round((reviewed.length / open.length) * 100)
            : 0,
      },
      dispositions: dispositionCounts,
      findings,
      complianceMapping: tagCounts,
    },
    null,
    2
  );
}

export const reportCommand = new Command("report")
  .description("Generate audit report from persisted findings")
  .option("-d, --dir <path>", "Project directory", process.cwd())
  .option("--json", "Output as JSON")
  .option("--format <format>", "Output format (md)")
  .action(
    async (options: { dir: string; json?: boolean; format?: string }) => {
      const rootDir = path.resolve(options.dir);
      const findings = loadFindings(rootDir);

      if (findings.length === 0) {
        console.log(
          chalk.dim(
            "No findings found. Run `workpapr scan` first to generate findings."
          )
        );
        return;
      }

      if (options.json) {
        console.log(formatJsonReport(findings));
        return;
      }

      if (options.format === "md") {
        const reportsDir = path.join(rootDir, ".workpapr", "reports");
        if (!fs.existsSync(reportsDir)) {
          fs.mkdirSync(reportsDir, { recursive: true });
        }
        const fileName = `report-${new Date().toISOString().slice(0, 10)}.md`;
        const filePath = path.join(reportsDir, fileName);
        fs.writeFileSync(filePath, formatMarkdownReport(findings), "utf-8");
        console.log(
          chalk.green("Report saved to") +
            ` ${path.relative(rootDir, filePath)}`
        );
        return;
      }

      console.log();
      console.log(formatReport(findings));
    }
  );
