import type { AIProvider, CompletionRequest } from "../ai/types.js";
import type { AICache } from "../ai/cache.js";
import type { AuditLog } from "../ai/audit-log.js";
import type { ScanResult, Severity } from "../scanner/types.js";
import type { ContextualRisk } from "./types.js";
import { generateFindingId } from "../findings/persistence.js";

const SYSTEM_PROMPT = `You are an AI audit risk assessor. Given a list of findings and context about the business domain, adjust finding severities based on contextual factors.

Consider:
- Business domain impact (financial services findings are higher risk than internal tools)
- Data sensitivity (PII, financial data, health records increase risk)
- Environment indicators (test files, example code, documentation reduce risk)
- Exposure (customer-facing vs internal, production vs staging)
- Compound risk (multiple findings in the same file compound each other)

For each finding, determine if the severity should be adjusted up or down.

Respond in JSON format:
{
  "adjustments": [
    {
      "findingIndex": 0,
      "originalSeverity": "medium",
      "adjustedSeverity": "high",
      "reason": "Financial services context — unversioned model in fraud detection pipeline could lead to inconsistent fraud scoring",
      "factors": ["financial-services domain", "fraud detection use case", "customer-impacting"]
    }
  ]
}

Only include findings where severity should change. If no adjustments needed, return {"adjustments": []}.`;

export async function scoreRisks(
  findings: ScanResult[],
  provider: AIProvider,
  cache: AICache | null,
  auditLog: AuditLog | null,
  context?: { industry?: string; dataTypes?: string[] }
): Promise<Map<string, ContextualRisk>> {
  if (findings.length === 0) return new Map();

  const findingSummary = findings.map((f, i) => ({
    index: i,
    file: f.file,
    line: f.line,
    type: f.type,
    severity: f.severity,
    context: f.context,
    riskCategory: f.riskCategory,
  }));

  const userContent = [
    context?.industry ? `Industry: ${context.industry}` : "",
    context?.dataTypes?.length ? `Data types: ${context.dataTypes.join(", ")}` : "",
    "",
    "Findings to assess:",
    JSON.stringify(findingSummary, null, 2),
  ]
    .filter(Boolean)
    .join("\n");

  const request: CompletionRequest = {
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    temperature: 0,
    responseFormat: "json",
  };

  if (cache) {
    const cached = cache.get(request);
    if (cached) {
      return parseAdjustments(cached.content, findings);
    }
  }

  const start = Date.now();
  let response;
  try {
    response = await provider.complete(request);
  } catch (error) {
    const durationMs = Date.now() - start;
    auditLog?.logError("risk-scoring", String(error), {
      provider: provider.id,
      durationMs,
    });
    return new Map();
  }
  const durationMs = Date.now() - start;

  const promptHash = cache?.getHash(request) ?? "";
  auditLog?.logCompletion(request, response, {
    task: "risk-scoring",
    durationMs,
    promptHash,
  });

  cache?.set(request, response);

  return parseAdjustments(response.content, findings);
}

function parseAdjustments(
  content: string,
  findings: ScanResult[]
): Map<string, ContextualRisk> {
  const result = new Map<string, ContextualRisk>();

  try {
    let cleaned = content.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(cleaned) as {
      adjustments: Array<{
        findingIndex: number;
        originalSeverity: string;
        adjustedSeverity: string;
        reason: string;
        factors: string[];
      }>;
    };

    if (!parsed.adjustments || !Array.isArray(parsed.adjustments)) return result;

    for (const adj of parsed.adjustments) {
      if (adj.findingIndex < 0 || adj.findingIndex >= findings.length) continue;

      const finding = findings[adj.findingIndex];
      const id = generateFindingId(finding);

      result.set(id, {
        originalSeverity: finding.severity,
        adjustedSeverity: validateSeverity(adj.adjustedSeverity),
        reason: adj.reason ?? "",
        factors: adj.factors ?? [],
      });
    }
  } catch {
    // Parse failure — return empty adjustments
  }

  return result;
}

function validateSeverity(sev: string): Severity {
  if (["critical", "high", "medium", "low"].includes(sev)) {
    return sev as Severity;
  }
  return "medium";
}
