import { createHash } from "node:crypto";
import type { AIProvider } from "../ai/types.js";
import type { AICache } from "../ai/cache.js";
import type { AuditLog } from "../ai/audit-log.js";
import { buildFileContext } from "../ai/context.js";
import type { ScanResult } from "../scanner/types.js";
import type { AnalysisResult } from "../analyzer/types.js";
import type { Workpaper } from "./types.js";
import { generateSystemDescription } from "./sections/system-description.js";
import { generateDataFlowSection } from "./sections/data-flow-analysis.js";
import { generateRiskAssessment } from "./sections/risk-assessment.js";
import { generateControlEvaluation } from "./sections/control-evaluation.js";
import { generateComplianceMappingSection } from "./sections/compliance-mapping.js";
import { generateRecommendations } from "./sections/recommendations.js";

export interface GeneratorOptions {
  rootDir: string;
  analysisResult: AnalysisResult;
  provider: AIProvider;
  cache: AICache | null;
  auditLog: AuditLog | null;
  maxContextLines: number;
}

export async function generateWorkpapers(
  options: GeneratorOptions
): Promise<Workpaper[]> {
  const { rootDir, analysisResult, provider, cache, auditLog, maxContextLines } =
    options;

  // Identify distinct AI systems (one per file with findings)
  const fileSet = new Set([
    ...analysisResult.staticFindings.map((f) => f.file),
    ...analysisResult.aiFindings.map((f) => f.file),
  ]);

  const workpapers: Workpaper[] = [];

  for (const file of fileSet) {
    const workpaper = await generateWorkpaper(
      file,
      rootDir,
      analysisResult,
      provider,
      cache,
      auditLog,
      maxContextLines
    );
    workpapers.push(workpaper);
  }

  return workpapers;
}

async function generateWorkpaper(
  systemFile: string,
  rootDir: string,
  analysisResult: AnalysisResult,
  provider: AIProvider,
  cache: AICache | null,
  auditLog: AuditLog | null,
  maxContextLines: number
): Promise<Workpaper> {
  const now = new Date().toISOString();
  const id = `wp-${createHash("sha256").update(systemFile).digest("hex").slice(0, 8)}`;
  const systemName = systemFile.replace(/^src\//, "").replace(/\.\w+$/, "");

  const fileCtx = buildFileContext(
    rootDir,
    systemFile,
    maxContextLines,
    analysisResult.staticFindings
  );

  // Generate sections (AI-powered sections may fail gracefully)
  const [systemDescription, controlEvaluation, recommendations] = await Promise.all([
    generateSystemDescription(fileCtx, provider, cache, auditLog),
    generateControlEvaluation(fileCtx, provider, cache, auditLog),
    generateRecommendations(
      analysisResult.staticFindings,
      analysisResult.aiFindings,
      systemFile,
      provider,
      cache,
      auditLog
    ),
  ]);

  // Non-AI sections (deterministic)
  const dataFlow = generateDataFlowSection(analysisResult.dataFlow, systemFile);
  const riskAssessment = generateRiskAssessment(
    analysisResult.staticFindings,
    analysisResult.aiFindings,
    analysisResult.falsePositiveIds,
    analysisResult.riskAdjustments,
    systemFile
  );
  const complianceMapping = generateComplianceMappingSection(
    analysisResult.complianceMappings
  );

  return {
    id,
    systemName,
    systemFile,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    reviewedBy: null,
    approvedBy: null,
    sections: [
      systemDescription,
      dataFlow,
      riskAssessment,
      controlEvaluation,
      complianceMapping,
      recommendations,
    ],
  };
}
