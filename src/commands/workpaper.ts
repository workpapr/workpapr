import { Command } from "commander";
import path from "node:path";
import fs from "node:fs";
import chalk from "chalk";
import { parse as parseYaml } from "yaml";
import { scan } from "../scanner/index.js";
import type { ScanConfig } from "../scanner/types.js";
import type { AIConfig } from "../ai/types.js";
import { DEFAULT_AI_CONFIG } from "../ai/types.js";
import { resolveProvider } from "../ai/provider.js";
import { AICache } from "../ai/cache.js";
import { AuditLog } from "../ai/audit-log.js";
import { runAnalysisPipeline } from "../analyzer/pipeline.js";
import { generateWorkpapers } from "../workpaper/generator.js";
import { saveWorkpaper, saveWorkpaperIndex } from "../workpaper/renderer.js";

export const workpaperCommand = new Command("workpaper")
  .description("Generate and manage AI audit workpapers");

workpaperCommand
  .command("generate")
  .description("Generate audit workpapers for AI systems in the codebase")
  .option("-d, --dir <path>", "Directory to analyze", process.cwd())
  .option("--provider <provider>", "AI provider (ollama, anthropic, openai)")
  .option("--model <model>", "Model to use")
  .option("--tier <tier>", "AI analysis tier", "full")
  .option("--no-cache", "Disable AI response caching")
  .option("-v, --verbose", "Show detailed progress")
  .action(
    async (options: {
      dir: string;
      provider?: string;
      model?: string;
      tier?: string;
      cache?: boolean;
      verbose?: boolean;
    }) => {
      const rootDir = path.resolve(options.dir);

      if (!fs.existsSync(rootDir)) {
        console.error(chalk.red("Error:") + ` Directory not found: ${rootDir}`);
        process.exit(1);
      }

      // Load config
      let scanConfig: Partial<ScanConfig> | undefined;
      let aiConfig: AIConfig = { ...DEFAULT_AI_CONFIG };
      let providerConfigs;

      const configPath = path.join(rootDir, "workpapr.yaml");
      if (fs.existsSync(configPath)) {
        try {
          const raw = fs.readFileSync(configPath, "utf-8");
          const parsed = parseYaml(raw);
          if (parsed?.scan) scanConfig = parsed.scan;
          if (parsed?.ai) aiConfig = { ...DEFAULT_AI_CONFIG, ...parsed.ai };
          if (parsed?.providers) providerConfigs = parsed.providers;
        } catch {
          // Use defaults
        }
      }

      // CLI overrides
      if (options.tier) {
        aiConfig.tier = options.tier as AIConfig["tier"];
      }
      if (options.cache === false) {
        aiConfig.cache = false;
      }

      // Force full tier for workpaper generation
      if (aiConfig.tier === "off") {
        aiConfig.tier = "full";
      }

      console.log();
      console.log(chalk.bold("Workpapr — Generating Audit Workpapers"));
      console.log(chalk.dim(`  Directory: ${rootDir}`));
      console.log(chalk.dim(`  AI tier: ${aiConfig.tier}`));

      // Resolve AI provider
      let provider;
      try {
        provider = await resolveProvider({
          provider: options.provider,
          model: options.model,
          aiConfig,
          providers: providerConfigs,
        });
        console.log(chalk.dim(`  Provider: ${provider.name}`));
      } catch (error) {
        console.error(chalk.red("Error:") + ` ${error}`);
        process.exit(1);
      }

      console.log();

      // Step 1: Static scan
      if (options.verbose) {
        console.log(chalk.dim("  Scanning codebase..."));
      }
      const summary = await scan(rootDir, scanConfig);

      if (summary.findings.length === 0) {
        console.log(chalk.dim("  No AI/LLM usage detected. Nothing to generate."));
        return;
      }

      if (options.verbose) {
        console.log(
          chalk.dim(`  Found ${summary.findings.length} static finding(s)`)
        );
      }

      // Step 2: AI analysis pipeline
      const analysisResult = await runAnalysisPipeline({
        rootDir,
        staticFindings: summary.findings,
        aiConfig,
        provider,
        verbose: options.verbose,
      });

      // Step 3: Generate workpapers
      if (options.verbose) {
        console.log(chalk.dim("  Generating workpapers..."));
      }

      const cache = aiConfig.cache
        ? new AICache(rootDir, aiConfig.cacheTtl)
        : null;
      const auditLog = aiConfig.auditLog ? new AuditLog(rootDir) : null;

      const workpapers = await generateWorkpapers({
        rootDir,
        analysisResult,
        provider,
        cache,
        auditLog,
        maxContextLines: aiConfig.maxContextLines,
      });

      // Step 4: Save workpapers
      const savedPaths: string[] = [];
      for (const wp of workpapers) {
        const relPath = saveWorkpaper(rootDir, wp);
        savedPaths.push(relPath);
      }

      const indexPath = saveWorkpaperIndex(rootDir, workpapers);

      // Output
      console.log(
        chalk.green(`  Generated ${workpapers.length} workpaper(s):`)
      );
      for (const p of savedPaths) {
        console.log(`    ${chalk.cyan(p)}`);
      }
      console.log(`    ${chalk.dim(indexPath)}`);
      console.log();
      console.log(
        chalk.dim(
          "  All workpapers are DRAFT. Review and approve via `workpapr workpaper list`."
        )
      );
      console.log();
    }
  );

workpaperCommand
  .command("list")
  .description("List generated workpapers")
  .option("-d, --dir <path>", "Project directory", process.cwd())
  .action(async (options: { dir: string }) => {
    const rootDir = path.resolve(options.dir);
    const wpDir = path.join(rootDir, ".workpapr", "workpapers");

    if (!fs.existsSync(wpDir)) {
      console.log(
        chalk.dim(
          "No workpapers found. Run `workpapr workpaper generate` first."
        )
      );
      return;
    }

    const files = fs
      .readdirSync(wpDir)
      .filter((f) => f.endsWith(".md") && f !== "index.md");

    if (files.length === 0) {
      console.log(chalk.dim("No workpapers found."));
      return;
    }

    console.log();
    console.log(chalk.bold("Audit Workpapers"));
    console.log();

    for (const file of files) {
      const content = fs.readFileSync(path.join(wpDir, file), "utf-8");
      const statusMatch = content.match(/\*\*Status:\*\*\s*(\w+)/);
      const status = statusMatch?.[1] ?? "DRAFT";
      const systemMatch = content.match(/\*\*System:\*\*\s*(.+?)  /);
      const system = systemMatch?.[1] ?? file;

      const statusColor =
        status === "APPROVED"
          ? chalk.green
          : status === "REVIEWED"
            ? chalk.yellow
            : chalk.dim;

      console.log(
        `  ${statusColor(status.padEnd(9))} ${chalk.cyan(file)} ${chalk.dim(`(${system})`)}`
      );
    }
    console.log();
  });
