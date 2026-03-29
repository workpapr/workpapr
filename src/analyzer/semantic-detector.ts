import type { AIProvider, CompletionRequest, AIProvenance, AIConfidence } from "../ai/types.js";
import type { AICache } from "../ai/cache.js";
import type { AuditLog } from "../ai/audit-log.js";
import type { FileContext } from "../ai/context.js";
import { formatFileForPrompt } from "../ai/context.js";
import type { AIFinding, AIFindingType } from "./types.js";

const SYSTEM_PROMPT = `You are an AI code auditor specializing in identifying risks in AI/LLM-integrated systems. Analyze the provided source code for semantic risks that static regex-based analysis would miss.

Focus on these risk categories:
- unsafe-tool-execution: Agent executes tools (API calls, database writes, financial operations) without authorization checks or amount limits
- unfiltered-pipeline: Data flows from retrieval (RAG, vector DB) to output without filtering or sanitization
- prompt-injection-surface: User input reaches prompts without sanitization, especially in customer-facing systems
- scope-escalation: Agent can act beyond its stated purpose or access resources it shouldn't
- financial-decision: AI makes or influences financial decisions without confidence scoring or human review
- pii-data-flow: PII flows through AI pipeline across files without proper handling
- missing-guardrails: AI system lacks appropriate safety controls for its risk level
- inconsistent-error-handling: Some code paths have error handling but others don't
- model-dependency-risk: Behavior depends on model-specific capabilities that may change
- custom: Any other significant risk not covered above

For each risk found, provide:
1. The specific line number(s) and code involved
2. Why this is a risk (not just what it is)
3. Concrete evidence from the code
4. Confidence level with reasoning

Respond in JSON format:
{
  "findings": [
    {
      "type": "<AIFindingType>",
      "title": "Short descriptive title",
      "line": <primary line number>,
      "description": "Detailed explanation of the risk",
      "severity": "critical|high|medium|low",
      "evidence": ["specific code reference 1", "specific code reference 2"],
      "confidence": {
        "level": "high|medium|low",
        "reasoning": "why this confidence level",
        "corroborating": ["evidence supporting this finding"],
        "contradicting": ["evidence against this finding"]
      },
      "recommendations": ["specific actionable recommendation"]
    }
  ]
}

If no semantic risks are found beyond what static analysis already caught, return {"findings": []}.
Be precise. Do not hallucinate line numbers. Only report genuine risks with specific evidence.`;

export async function detectSemanticRisks(
  fileCtx: FileContext,
  provider: AIProvider,
  cache: AICache | null,
  auditLog: AuditLog | null
): Promise<AIFinding[]> {
  const request: CompletionRequest = {
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: formatFileForPrompt(fileCtx) },
    ],
    temperature: 0,
    responseFormat: "json",
  };

  // Check cache
  if (cache) {
    const cached = cache.get(request);
    if (cached) {
      return parseFindings(cached.content, fileCtx.file, {
        model: cached.model,
        provider: provider.id,
        promptHash: cache.getHash(request),
        timestamp: new Date().toISOString(),
        tokenCount: cached.tokenCount,
        cached: true,
        temperature: 0,
      });
    }
  }

  const start = Date.now();
  let response;
  try {
    response = await provider.complete(request);
  } catch (error) {
    const durationMs = Date.now() - start;
    auditLog?.logError("semantic-detection", String(error), {
      provider: provider.id,
      file: fileCtx.file,
      durationMs,
    });
    return [];
  }
  const durationMs = Date.now() - start;

  const promptHash = cache?.getHash(request) ?? "";

  const provenance = auditLog?.logCompletion(request, response, {
    task: "semantic-detection",
    file: fileCtx.file,
    durationMs,
    promptHash,
  }) ?? {
    model: response.model,
    provider: provider.id,
    promptHash,
    timestamp: new Date().toISOString(),
    tokenCount: response.tokenCount,
    cached: false,
    temperature: 0,
  };

  // Cache the response
  cache?.set(request, response);

  return parseFindings(response.content, fileCtx.file, provenance);
}

function parseFindings(
  content: string,
  file: string,
  provenance: AIProvenance
): AIFinding[] {
  try {
    // Strip markdown fences if present
    let cleaned = content.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(cleaned) as {
      findings: Array<{
        type: string;
        title: string;
        line: number;
        description: string;
        severity: string;
        evidence: string[];
        confidence: { level: string; reasoning: string; corroborating: string[]; contradicting: string[] };
        recommendations: string[];
      }>;
    };

    if (!parsed.findings || !Array.isArray(parsed.findings)) {
      return [];
    }

    return parsed.findings.map((f) => ({
      file,
      line: f.line ?? 1,
      type: validateFindingType(f.type),
      title: f.title ?? "Unnamed finding",
      description: f.description ?? "",
      severity: validateSeverity(f.severity),
      evidence: f.evidence ?? [],
      confidence: {
        level: validateConfidence(f.confidence?.level),
        reasoning: f.confidence?.reasoning ?? "",
        corroborating: f.confidence?.corroborating ?? [],
        contradicting: f.confidence?.contradicting ?? [],
      },
      provenance,
      recommendations: f.recommendations ?? [],
    }));
  } catch {
    return [];
  }
}

const VALID_FINDING_TYPES = new Set<AIFindingType>([
  "unsafe-tool-execution",
  "unfiltered-pipeline",
  "prompt-injection-surface",
  "scope-escalation",
  "financial-decision",
  "pii-data-flow",
  "missing-guardrails",
  "inconsistent-error-handling",
  "model-dependency-risk",
  "custom",
]);

function validateFindingType(type: string): AIFindingType {
  if (VALID_FINDING_TYPES.has(type as AIFindingType)) {
    return type as AIFindingType;
  }
  return "custom";
}

function validateSeverity(sev: string): "critical" | "high" | "medium" | "low" {
  if (["critical", "high", "medium", "low"].includes(sev)) {
    return sev as "critical" | "high" | "medium" | "low";
  }
  return "medium";
}

function validateConfidence(level: string): "high" | "medium" | "low" {
  if (["high", "medium", "low"].includes(level)) {
    return level as "high" | "medium" | "low";
  }
  return "medium";
}
