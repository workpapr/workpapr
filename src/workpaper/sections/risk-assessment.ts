import type { ScanResult, Severity } from "../../scanner/types.js";
import type { AIFinding, ContextualRisk } from "../../analyzer/types.js";
import { generateFindingId } from "../../findings/persistence.js";
import type { WorkpaperSection } from "../types.js";

const SEVERITY_ICON: Record<Severity, string> = {
  critical: "!!",
  high: "!",
  medium: "~",
  low: "-",
};

export function generateRiskAssessment(
  staticFindings: ScanResult[],
  aiFindings: AIFinding[],
  falsePositiveIds: string[],
  riskAdjustments: Map<string, ContextualRisk>,
  systemFile: string
): WorkpaperSection {
  const relevantStatic = staticFindings.filter((f) => f.file === systemFile);
  const relevantAI = aiFindings.filter((f) => f.file === systemFile);
  const fpSet = new Set(falsePositiveIds);

  const lines: string[] = [];

  // Static findings
  if (relevantStatic.length > 0) {
    lines.push("### Static Analysis Findings");
    lines.push("");
    lines.push("| Severity | Type | Line | Description | Status |");
    lines.push("|----------|------|------|-------------|--------|");

    for (const f of relevantStatic) {
      const id = generateFindingId(f);
      const isFP = fpSet.has(id);
      const adjustment = riskAdjustments.get(id);
      const effectiveSeverity = adjustment?.adjustedSeverity ?? f.severity;
      const status = isFP ? "Likely FP" : "Open";
      const sevNote =
        adjustment && adjustment.adjustedSeverity !== adjustment.originalSeverity
          ? ` (was ${adjustment.originalSeverity})`
          : "";

      lines.push(
        `| ${SEVERITY_ICON[effectiveSeverity]} ${effectiveSeverity.toUpperCase()}${sevNote} | ${f.type} | ${f.line} | ${f.context} | ${status} |`
      );

      if (adjustment?.reason) {
        lines.push(`| | | | *${adjustment.reason}* | |`);
      }
    }
    lines.push("");
  }

  // AI findings
  if (relevantAI.length > 0) {
    lines.push("### AI-Detected Risks");
    lines.push("");

    for (const f of relevantAI) {
      lines.push(
        `#### ${SEVERITY_ICON[f.severity]} ${f.severity.toUpperCase()} — ${f.title}`
      );
      lines.push("");
      lines.push(`**Type:** ${f.type}  `);
      lines.push(`**Line:** ${f.line}  `);
      lines.push(`**Confidence:** ${f.confidence.level}  `);
      lines.push("");
      lines.push(f.description);
      lines.push("");

      if (f.evidence.length > 0) {
        lines.push("**Evidence:**");
        for (const e of f.evidence) {
          lines.push(`- ${e}`);
        }
        lines.push("");
      }

      if (f.confidence.reasoning) {
        lines.push(`**Confidence reasoning:** ${f.confidence.reasoning}`);
        lines.push("");
      }

      if (f.recommendations.length > 0) {
        lines.push("**Recommendations:**");
        for (const r of f.recommendations) {
          lines.push(`- ${r}`);
        }
        lines.push("");
      }
    }
  }

  if (relevantStatic.length === 0 && relevantAI.length === 0) {
    lines.push("No risks identified for this system.");
    lines.push("");
  }

  return {
    id: "risk-assessment",
    title: "Risk Assessment",
    content: lines.join("\n"),
  };
}
