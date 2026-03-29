import type { AIProvider, CompletionRequest } from "../ai/types.js";
import type { AICache } from "../ai/cache.js";
import type { AuditLog } from "../ai/audit-log.js";
import type { ScanResult } from "../scanner/types.js";
import type { FileContext } from "../ai/context.js";
import { formatFileForPrompt } from "../ai/context.js";
import { generateFindingId } from "../findings/persistence.js";

const SYSTEM_PROMPT = `You are an AI code auditor reviewing static analysis findings for false positives. Given a list of findings and the source code they were found in, determine which findings are likely false positives.

A finding is a false positive when:
- The detected pattern exists but doesn't represent an actual risk (e.g., a key pattern in a test fixture, not a real key)
- The risk is already mitigated by surrounding code not captured by regex
- The pattern match is in a comment, string literal used for documentation, or disabled code
- The code is clearly test/example code with no production impact

A finding is NOT a false positive just because:
- It's low severity (low severity is still a real finding)
- It might be fixed later
- There's a workaround

Respond in JSON format:
{
  "falsePositives": [
    {
      "findingIndex": 0,
      "confidence": "high|medium|low",
      "reasoning": "This key pattern 'sk-...' appears in a test fixture file that uses clearly fake keys"
    }
  ]
}

Only include findings you're confident are false positives. When in doubt, don't flag it.`;

export interface FPResult {
  findingId: string;
  isFP: boolean;
  confidence: string;
  reasoning: string;
}

export async function filterFalsePositives(
  findings: ScanResult[],
  fileContexts: FileContext[],
  provider: AIProvider,
  cache: AICache | null,
  auditLog: AuditLog | null
): Promise<string[]> {
  if (findings.length === 0) return [];

  const riskFindings = findings.filter(
    (f) => f.type !== "import" && f.type !== "api-call"
  );
  if (riskFindings.length === 0) return [];

  const findingSummary = riskFindings.map((f, i) => ({
    index: i,
    id: generateFindingId(f),
    file: f.file,
    line: f.line,
    type: f.type,
    severity: f.severity,
    match: f.match,
    context: f.context,
  }));

  const codeContext = fileContexts
    .map((fc) => formatFileForPrompt(fc))
    .join("\n\n");

  const request: CompletionRequest = {
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Findings to review:\n${JSON.stringify(findingSummary, null, 2)}\n\nSource code:\n${codeContext}`,
      },
    ],
    temperature: 0,
    responseFormat: "json",
  };

  if (cache) {
    const cached = cache.get(request);
    if (cached) {
      return parseFalsePositives(cached.content, riskFindings);
    }
  }

  const start = Date.now();
  let response;
  try {
    response = await provider.complete(request);
  } catch (error) {
    const durationMs = Date.now() - start;
    auditLog?.logError("false-positive-filter", String(error), {
      provider: provider.id,
      durationMs,
    });
    return [];
  }
  const durationMs = Date.now() - start;

  const promptHash = cache?.getHash(request) ?? "";
  auditLog?.logCompletion(request, response, {
    task: "false-positive-filter",
    durationMs,
    promptHash,
  });

  cache?.set(request, response);

  return parseFalsePositives(response.content, riskFindings);
}

/**
 * Returns detailed FP results including reasoning, for training data capture.
 */
export async function filterFalsePositivesDetailed(
  findings: ScanResult[],
  fileContexts: FileContext[],
  provider: AIProvider,
  cache: AICache | null,
  auditLog: AuditLog | null
): Promise<FPResult[]> {
  if (findings.length === 0) return [];

  const riskFindings = findings.filter(
    (f) => f.type !== "import" && f.type !== "api-call"
  );
  if (riskFindings.length === 0) return [];

  const findingSummary = riskFindings.map((f, i) => ({
    index: i,
    id: generateFindingId(f),
    file: f.file,
    line: f.line,
    type: f.type,
    severity: f.severity,
    match: f.match,
    context: f.context,
  }));

  const codeContext = fileContexts
    .map((fc) => formatFileForPrompt(fc))
    .join("\n\n");

  const request: CompletionRequest = {
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Findings to review:\n${JSON.stringify(findingSummary, null, 2)}\n\nSource code:\n${codeContext}`,
      },
    ],
    temperature: 0,
    responseFormat: "json",
  };

  if (cache) {
    const cached = cache.get(request);
    if (cached) {
      return parseFalsePositivesDetailed(cached.content, riskFindings);
    }
  }

  const start = Date.now();
  let response;
  try {
    response = await provider.complete(request);
  } catch (error) {
    const durationMs = Date.now() - start;
    auditLog?.logError("false-positive-filter", String(error), {
      provider: provider.id,
      durationMs,
    });
    return [];
  }
  const durationMs = Date.now() - start;

  const promptHash = cache?.getHash(request) ?? "";
  auditLog?.logCompletion(request, response, {
    task: "false-positive-filter",
    durationMs,
    promptHash,
  });

  cache?.set(request, response);

  return parseFalsePositivesDetailed(response.content, riskFindings);
}

function parseFalsePositivesDetailed(
  content: string,
  findings: ScanResult[]
): FPResult[] {
  try {
    let cleaned = content.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(cleaned) as {
      falsePositives: Array<{
        findingIndex: number;
        confidence: string;
        reasoning: string;
      }>;
    };

    if (!parsed.falsePositives || !Array.isArray(parsed.falsePositives)) {
      return [];
    }

    return parsed.falsePositives
      .filter((fp) => fp.findingIndex >= 0 && fp.findingIndex < findings.length)
      .map((fp) => ({
        findingId: generateFindingId(findings[fp.findingIndex]),
        isFP: fp.confidence === "high",
        confidence: fp.confidence,
        reasoning: fp.reasoning,
      }));
  } catch {
    return [];
  }
}

function parseFalsePositives(content: string, findings: ScanResult[]): string[] {
  try {
    let cleaned = content.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(cleaned) as {
      falsePositives: Array<{
        findingIndex: number;
        confidence: string;
        reasoning: string;
      }>;
    };

    if (!parsed.falsePositives || !Array.isArray(parsed.falsePositives)) {
      return [];
    }

    // Only accept high-confidence FPs
    return parsed.falsePositives
      .filter(
        (fp) =>
          fp.confidence === "high" &&
          fp.findingIndex >= 0 &&
          fp.findingIndex < findings.length
      )
      .map((fp) => generateFindingId(findings[fp.findingIndex]));
  } catch {
    return [];
  }
}
