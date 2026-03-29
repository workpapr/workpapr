import chalk from "chalk";
import type { AIConfig, AIProvider } from "../ai/types.js";
import { AICache } from "../ai/cache.js";
import { AuditLog } from "../ai/audit-log.js";
import { buildFileContext, buildCodeContext } from "../ai/context.js";
import type { ScanResult } from "../scanner/types.js";
import type { AnalysisResult, AIFinding } from "./types.js";
import { detectSemanticRisks } from "./semantic-detector.js";
import { analyzeDataFlow } from "./data-flow.js";
import { scoreRisks } from "./risk-scorer.js";
import { filterFalsePositives } from "./false-positive-filter.js";
import { mapCompliance } from "./compliance-mapper.js";
import { type TraceHook, nullTraceHook } from "./trace-hook.js";

export interface PipelineOptions {
  rootDir: string;
  staticFindings: ScanResult[];
  aiConfig: AIConfig;
  provider: AIProvider;
  verbose?: boolean;
  dryRun?: boolean;
  traceHook?: TraceHook;
}

export async function runAnalysisPipeline(
  options: PipelineOptions
): Promise<AnalysisResult> {
  const { rootDir, staticFindings, aiConfig, provider, verbose, dryRun, traceHook } = options;

  const result: AnalysisResult = {
    staticFindings,
    aiFindings: [],
    complianceMappings: [],
    falsePositiveIds: [],
    riskAdjustments: new Map(),
  };

  if (aiConfig.tier === "off") return result;

  const cache = aiConfig.cache ? new AICache(rootDir, aiConfig.cacheTtl) : null;
  const logFullPrompts = (aiConfig as unknown as Record<string, unknown>).logFullPrompts === true;
  const auditLog = aiConfig.auditLog ? new AuditLog(rootDir, logFullPrompts) : null;

  const tracer = traceHook ?? nullTraceHook;

  // Dry run: report what would happen
  if (dryRun) {
    printDryRun(aiConfig, staticFindings);
    return result;
  }

  // Get unique files with findings
  const fileSet = new Set(staticFindings.map((f) => f.file));
  const fileContexts = [...fileSet].map((file) =>
    buildFileContext(rootDir, file, aiConfig.maxContextLines, staticFindings)
  );

  // === ASSIST tier: FP filter + risk scoring ===
  if (aiConfig.tier === "assist" || aiConfig.tier === "analyze" || aiConfig.tier === "full") {
    if (verbose) {
      console.log(chalk.dim("  AI: Filtering false positives..."));
    }

    const fpStart = Date.now();
    result.falsePositiveIds = await filterFalsePositives(
      staticFindings,
      fileContexts,
      provider,
      cache,
      auditLog
    );

    tracer.recordPipelineStep(
      "false-positive-filter",
      `${staticFindings.length} findings`,
      `${result.falsePositiveIds.length} flagged as likely FP`,
      result.falsePositiveIds.length > 0 ? "FP flags applied" : "No FPs detected",
      Date.now() - fpStart
    );

    if (verbose && result.falsePositiveIds.length > 0) {
      console.log(
        chalk.dim(`  AI: Flagged ${result.falsePositiveIds.length} likely false positive(s)`)
      );
    }

    if (verbose) {
      console.log(chalk.dim("  AI: Scoring contextual risk..."));
    }

    const riskStart = Date.now();
    result.riskAdjustments = await scoreRisks(
      staticFindings,
      provider,
      cache,
      auditLog,
      aiConfig.context
    );

    tracer.recordPipelineStep(
      "risk-scoring",
      `${staticFindings.length} findings`,
      `${result.riskAdjustments.size} severity adjustment(s)`,
      result.riskAdjustments.size > 0 ? "Severities adjusted" : "No adjustments",
      Date.now() - riskStart
    );

    if (verbose && result.riskAdjustments.size > 0) {
      console.log(
        chalk.dim(`  AI: Adjusted severity for ${result.riskAdjustments.size} finding(s)`)
      );
    }
  }

  // === ANALYZE tier: semantic detection + data flow ===
  if (aiConfig.tier === "analyze" || aiConfig.tier === "full") {
    if (verbose) {
      console.log(chalk.dim("  AI: Running semantic analysis..."));
    }

    const allAIFindings: AIFinding[] = [];

    for (const fileCtx of fileContexts) {
      const semStart = Date.now();
      const findings = await detectSemanticRisks(fileCtx, provider, cache, auditLog);
      allAIFindings.push(...findings);

      tracer.recordPipelineStep(
        "semantic-analysis",
        fileCtx.file,
        `${findings.length} semantic risk(s) found`,
        findings.length > 0 ? "Risks detected" : "No semantic risks",
        Date.now() - semStart
      );
    }

    result.aiFindings = allAIFindings;

    if (verbose && allAIFindings.length > 0) {
      console.log(
        chalk.dim(`  AI: Found ${allAIFindings.length} semantic risk(s)`)
      );
    }

    // Data flow analysis
    if (verbose) {
      console.log(chalk.dim("  AI: Analyzing data flows..."));
    }

    const dfStart = Date.now();
    const codeContext = buildCodeContext(
      rootDir,
      staticFindings,
      aiConfig.maxContextLines,
      aiConfig.context
    );
    result.dataFlow = await analyzeDataFlow(codeContext, provider, cache, auditLog);

    tracer.recordPipelineStep(
      "data-flow-trace",
      `${codeContext.files.length} files`,
      `${result.dataFlow.edges.length} edge(s), ${result.dataFlow.entryPoints.length} entry point(s)`,
      result.dataFlow.edges.length > 0 ? "Data flows traced" : "No significant flows",
      Date.now() - dfStart
    );

    if (verbose && result.dataFlow.edges.length > 0) {
      console.log(
        chalk.dim(`  AI: Traced ${result.dataFlow.edges.length} data flow edge(s)`)
      );
    }

    // Compliance mapping
    const frameworks = aiConfig.context?.regulatoryFrameworks ?? [];
    if (frameworks.length > 0) {
      if (verbose) {
        console.log(chalk.dim("  AI: Mapping compliance..."));
      }

      const compStart = Date.now();
      result.complianceMappings = await mapCompliance(
        staticFindings,
        allAIFindings,
        frameworks,
        provider,
        cache,
        auditLog
      );

      tracer.recordPipelineStep(
        "compliance-mapping",
        frameworks.join(", "),
        `${result.complianceMappings.length} requirement(s) mapped`,
        "Compliance assessment complete",
        Date.now() - compStart
      );

      if (verbose) {
        console.log(
          chalk.dim(
            `  AI: Mapped ${result.complianceMappings.length} compliance requirement(s)`
          )
        );
      }
    }
  }

  // Flush all traces
  tracer.completeAllTraces();

  return result;
}

function printDryRun(aiConfig: AIConfig, findings: ScanResult[]): void {
  const fileCount = new Set(findings.map((f) => f.file)).size;
  const riskFindings = findings.filter(
    (f) => f.type !== "import" && f.type !== "api-call"
  );

  console.log();
  console.log(chalk.bold("AI Analysis — Dry Run"));
  console.log(`  Tier: ${chalk.cyan(aiConfig.tier)}`);
  console.log(`  Files to analyze: ${fileCount}`);
  console.log(`  Risk findings to assess: ${riskFindings.length}`);
  console.log();

  const calls: Array<{ task: string; estimatedCalls: number }> = [];

  if (aiConfig.tier === "assist" || aiConfig.tier === "analyze" || aiConfig.tier === "full") {
    calls.push({ task: "False positive filtering", estimatedCalls: 1 });
    calls.push({ task: "Risk scoring", estimatedCalls: 1 });
  }

  if (aiConfig.tier === "analyze" || aiConfig.tier === "full") {
    calls.push({ task: "Semantic detection", estimatedCalls: fileCount });
    calls.push({ task: "Data flow analysis", estimatedCalls: 1 });
    if (aiConfig.context?.regulatoryFrameworks?.length) {
      calls.push({ task: "Compliance mapping", estimatedCalls: 1 });
    }
  }

  if (aiConfig.tier === "full") {
    calls.push({ task: "Workpaper generation", estimatedCalls: fileCount });
  }

  const totalCalls = calls.reduce((sum, c) => sum + c.estimatedCalls, 0);

  console.log(chalk.bold("  Estimated AI calls:"));
  for (const c of calls) {
    console.log(`    ${c.task}: ${c.estimatedCalls}`);
  }
  console.log(`    ${chalk.bold("Total")}: ${totalCalls}`);
  console.log();

  // Rough cost estimate for cloud providers
  const costPerCall = 0.01;
  const estimatedCost = totalCalls * costPerCall;
  console.log(
    chalk.dim(
      `  Estimated cost (cloud): ~$${estimatedCost.toFixed(2)} | Free with Ollama`
    )
  );
  console.log();
}
