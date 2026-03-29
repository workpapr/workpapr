import type { AIProvider, CompletionRequest } from "../ai/types.js";
import type { AICache } from "../ai/cache.js";
import type { AuditLog } from "../ai/audit-log.js";
import type { ScanResult } from "../scanner/types.js";
import type { AIFinding, ComplianceMapping } from "./types.js";

const SYSTEM_PROMPT = `You are an AI compliance auditor. Map the provided findings to specific regulatory framework requirements.

Supported frameworks:
- EU AI Act: Articles on risk classification, transparency, human oversight, data governance, technical documentation
- NIST AI RMF: MAP, MEASURE, MANAGE, GOVERN functions with specific categories
- SOC 2: Trust Services Criteria — security, availability, processing integrity, confidentiality, privacy

For each applicable framework requirement, assess whether it is:
- "met": Controls are in place and functioning
- "partially-met": Some controls exist but gaps remain
- "not-met": Required controls are missing
- "not-applicable": Requirement doesn't apply to this system

Respond in JSON format:
{
  "mappings": [
    {
      "framework": "eu-ai-act",
      "requirement": "Article 14 — Human Oversight",
      "status": "not-met",
      "findings": ["unsafe-tool-execution in tool-agent.ts", "autonomous-decision in batch-risk-scoring.py"],
      "rationale": "Financial tool agent executes transactions without human review loop. Autonomous decisions are made without confirmation gates."
    }
  ]
}

Only include requirements that are relevant to the findings. Be specific about which findings relate to each requirement.`;

export async function mapCompliance(
  staticFindings: ScanResult[],
  aiFindings: AIFinding[],
  frameworks: string[],
  provider: AIProvider,
  cache: AICache | null,
  auditLog: AuditLog | null
): Promise<ComplianceMapping[]> {
  if (frameworks.length === 0) return [];

  const findingSummary = [
    ...staticFindings.map((f) => ({
      source: "static",
      file: f.file,
      line: f.line,
      type: f.type,
      severity: f.severity,
      context: f.context,
    })),
    ...aiFindings.map((f) => ({
      source: "ai",
      file: f.file,
      line: f.line,
      type: f.type,
      severity: f.severity,
      context: f.description,
    })),
  ];

  const request: CompletionRequest = {
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Frameworks to map: ${frameworks.join(", ")}\n\nFindings:\n${JSON.stringify(findingSummary, null, 2)}`,
      },
    ],
    temperature: 0,
    responseFormat: "json",
  };

  if (cache) {
    const cached = cache.get(request);
    if (cached) {
      return parseMappings(cached.content);
    }
  }

  const start = Date.now();
  let response;
  try {
    response = await provider.complete(request);
  } catch (error) {
    const durationMs = Date.now() - start;
    auditLog?.logError("compliance-mapping", String(error), {
      provider: provider.id,
      durationMs,
    });
    return [];
  }
  const durationMs = Date.now() - start;

  const promptHash = cache?.getHash(request) ?? "";
  auditLog?.logCompletion(request, response, {
    task: "compliance-mapping",
    durationMs,
    promptHash,
  });

  cache?.set(request, response);

  return parseMappings(response.content);
}

function parseMappings(content: string): ComplianceMapping[] {
  try {
    let cleaned = content.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(cleaned) as {
      mappings: Array<{
        framework: string;
        requirement: string;
        status: string;
        findings: string[];
        rationale: string;
      }>;
    };

    if (!parsed.mappings || !Array.isArray(parsed.mappings)) return [];

    return parsed.mappings.map((m) => ({
      framework: m.framework ?? "",
      requirement: m.requirement ?? "",
      status: validateStatus(m.status),
      findings: m.findings ?? [],
      rationale: m.rationale ?? "",
    }));
  } catch {
    return [];
  }
}

function validateStatus(
  s: string
): "met" | "partially-met" | "not-met" | "not-applicable" {
  if (["met", "partially-met", "not-met", "not-applicable"].includes(s)) {
    return s as "met" | "partially-met" | "not-met" | "not-applicable";
  }
  return "not-met";
}
