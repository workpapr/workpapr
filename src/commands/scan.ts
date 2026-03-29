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
  generateFindingId,
} from "../findings/persistence.js";
import type { AIConfig } from "../ai/types.js";
import { DEFAULT_AI_CONFIG } from "../ai/types.js";
import { resolveProvider } from "../ai/provider.js";
import { runAnalysisPipeline } from "../analyzer/pipeline.js";

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
    case "unsafe-tool-execution":
      return chalk.red.bold("unsafe-tool-execution");
    case "unfiltered-pipeline":
      return chalk.red.bold("unfiltered-pipeline");
    case "prompt-injection-surface":
      return chalk.red.bold("prompt-injection-surface");
    case "scope-escalation":
      return chalk.red("scope-escalation");
    case "financial-decision":
      return chalk.red("financial-decision");
    case "pii-data-flow":
      return chalk.red("pii-data-flow");
    case "missing-guardrails":
      return chalk.yellow("missing-guardrails");
    case "inconsistent-error-handling":
      return chalk.yellow("inconsistent-error-handling");
    case "model-dependency-risk":
      return chalk.yellow("model-dependency-risk");
    case "custom":
      return chalk.magenta("custom");
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
  .option("--ai", "Enable AI-powered analysis")
  .option("--tier <tier>", "AI analysis tier (assist, analyze, full)")
  .option("--provider <provider>", "AI provider (ollama, anthropic, openai)")
  .option("--no-cache", "Disable AI response caching")
  .option("--dry-run", "Preview AI analysis calls and estimated cost")
  .action(
    async (options: {
      dir: string;
      json?: boolean;
      verbose?: boolean;
      persist?: boolean;
      ai?: boolean;
      tier?: string;
      provider?: string;
      cache?: boolean;
      dryRun?: boolean;
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

      // AI analysis
      let aiConfig: AIConfig = { ...DEFAULT_AI_CONFIG };
      if (options.ai || options.tier || options.dryRun) {
        // Load AI config from workpapr.yaml
        if (fs.existsSync(configPath)) {
          try {
            const raw = fs.readFileSync(configPath, "utf-8");
            const parsed = parseYaml(raw);
            if (parsed?.ai) aiConfig = { ...DEFAULT_AI_CONFIG, ...parsed.ai };
          } catch {
            // Use defaults
          }
        }

        // CLI overrides
        if (options.tier) {
          aiConfig.tier = options.tier as AIConfig["tier"];
        } else if (aiConfig.tier === "off") {
          aiConfig.tier = "analyze";
        }
        if (options.cache === false) {
          aiConfig.cache = false;
        }

        try {
          let providerConfigs;
          if (fs.existsSync(configPath)) {
            try {
              const raw = fs.readFileSync(configPath, "utf-8");
              const parsed = parseYaml(raw);
              if (parsed?.providers) providerConfigs = parsed.providers;
            } catch {
              // ignore
            }
          }

          const provider = await resolveProvider({
            provider: options.provider,
            aiConfig,
            providers: providerConfigs,
          });

          if (!options.json) {
            console.log(
              chalk.dim(`  AI provider: ${provider.name} (tier: ${aiConfig.tier})`)
            );
          }

          const analysisResult = await runAnalysisPipeline({
            rootDir,
            staticFindings: summary.findings,
            aiConfig,
            provider,
            verbose: options.verbose,
            dryRun: options.dryRun,
          });

          // Merge AI findings into summary
          if (analysisResult.aiFindings.length > 0) {
            for (const aif of analysisResult.aiFindings) {
              summary.findings.push({
                file: aif.file,
                line: aif.line,
                type: aif.type,
                provider: aif.provenance.provider,
                match: aif.title,
                context: aif.description,
                severity: aif.severity,
                aiDetected: true,
                aiConfidence: {
                  level: aif.confidence.level,
                  reasoning: aif.confidence.reasoning,
                },
                aiProvenance: {
                  model: aif.provenance.model,
                  provider: aif.provenance.provider,
                  promptHash: aif.provenance.promptHash,
                  timestamp: aif.provenance.timestamp,
                  cached: aif.provenance.cached,
                },
              });
            }
            summary.aiFindings = analysisResult.aiFindings.length;
            // Recount severities
            for (const aif of analysisResult.aiFindings) {
              summary.bySeverity[aif.severity]++;
              summary.riskFindings++;
            }
          }

          // Apply false positive flags to individual findings for training data
          if (analysisResult.falsePositiveIds.length > 0) {
            summary.falsePositives = analysisResult.falsePositiveIds.length;
            const fpSet = new Set(analysisResult.falsePositiveIds);
            for (const finding of summary.findings) {
              const id = generateFindingId(finding);
              if (fpSet.has(id)) {
                finding.ai_fp_flag = true;
              }
            }
          }

          // Apply risk adjustments to findings for training data
          if (analysisResult.riskAdjustments.size > 0) {
            for (const finding of summary.findings) {
              const id = generateFindingId(finding);
              const adj = analysisResult.riskAdjustments.get(id);
              if (adj) {
                finding.ai_predicted_severity = adj.adjustedSeverity;
                finding.ai_reasoning = adj.reason;
              }
            }
          }
        } catch (error) {
          if (!options.json) {
            console.log(
              chalk.yellow("  AI analysis unavailable:") +
                chalk.dim(` ${error}`)
            );
            console.log(
              chalk.dim("  Continuing with static analysis only.")
            );
          }
        }
      }

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
      if (summary.aiFindings && summary.aiFindings > 0) {
        console.log(`    AI findings:   ${chalk.bold(String(summary.aiFindings))}`);
      }
      if (summary.falsePositives && summary.falsePositives > 0) {
        console.log(`    False positives flagged: ${chalk.dim(String(summary.falsePositives))}`);
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
            const aiTag = finding.aiDetected ? chalk.magenta(" [AI]") : "";
            console.log(
              `      ${chalk.dim(`${finding.file}:${finding.line}`)} [${typeLabel(finding.type)}]${aiTag} ${chalk.cyan(finding.provider)}`
            );
            if (finding.riskCategory) {
              console.log(
                `        ${chalk.dim(finding.riskCategory)}`
              );
            }
            if (finding.aiConfidence) {
              console.log(
                `        Confidence: ${chalk.dim(finding.aiConfidence.level)}`
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
