import type { AIProvider, CompletionRequest } from "../ai/types.js";
import type { AICache } from "../ai/cache.js";
import type { AuditLog } from "../ai/audit-log.js";
import type { CodeContext } from "../ai/context.js";
import { formatContextForPrompt } from "../ai/context.js";
import type { DataFlowGraph, DataFlowEdge } from "./types.js";

const SYSTEM_PROMPT = `You are an AI code auditor specializing in data flow analysis for AI/LLM systems. Analyze the provided source code files to trace how data flows through AI pipelines.

Identify:
1. Entry points: where external data enters the AI system (user input, API requests, database queries, file uploads)
2. Processing nodes: where data is transformed, enriched, or used in AI operations (embedding, prompting, inference)
3. Exit points: where AI output leaves the system (API responses, database writes, user-facing output, downstream services)
4. Controls present at each stage (validation, filtering, sanitization, access checks)
5. Risks at each stage (unfiltered data, missing validation, PII exposure)

Trace cross-file flows where data from one file is consumed by another.

Respond in JSON format:
{
  "edges": [
    {
      "from": { "file": "path", "line": 10, "description": "what happens here" },
      "to": { "file": "path", "line": 25, "description": "what happens here" },
      "dataType": "user-input|pii|ai-response|embeddings|documents|financial-data",
      "controls": ["validation present", "filtering applied"],
      "risks": ["no sanitization before prompt injection", "PII passed to external API"]
    }
  ],
  "entryPoints": [
    { "file": "path", "line": 5, "description": "API endpoint receives user query" }
  ],
  "exitPoints": [
    { "file": "path", "line": 30, "description": "AI response sent to user" }
  ]
}

Be precise about file paths and line numbers. Only include flows you can trace from the code.`;

export async function analyzeDataFlow(
  context: CodeContext,
  provider: AIProvider,
  cache: AICache | null,
  auditLog: AuditLog | null
): Promise<DataFlowGraph> {
  const request: CompletionRequest = {
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: formatContextForPrompt(context) },
    ],
    temperature: 0,
    responseFormat: "json",
  };

  if (cache) {
    const cached = cache.get(request);
    if (cached) {
      return parseDataFlow(cached.content);
    }
  }

  const start = Date.now();
  let response;
  try {
    response = await provider.complete(request);
  } catch (error) {
    const durationMs = Date.now() - start;
    auditLog?.logError("data-flow-analysis", String(error), {
      provider: provider.id,
      durationMs,
    });
    return { edges: [], entryPoints: [], exitPoints: [] };
  }
  const durationMs = Date.now() - start;

  const promptHash = cache?.getHash(request) ?? "";
  auditLog?.logCompletion(request, response, {
    task: "data-flow-analysis",
    durationMs,
    promptHash,
  });

  cache?.set(request, response);

  return parseDataFlow(response.content);
}

function parseDataFlow(content: string): DataFlowGraph {
  try {
    let cleaned = content.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(cleaned) as DataFlowGraph;

    return {
      edges: Array.isArray(parsed.edges) ? parsed.edges.map(validateEdge) : [],
      entryPoints: Array.isArray(parsed.entryPoints) ? parsed.entryPoints : [],
      exitPoints: Array.isArray(parsed.exitPoints) ? parsed.exitPoints : [],
    };
  } catch {
    return { edges: [], entryPoints: [], exitPoints: [] };
  }
}

function validateEdge(edge: DataFlowEdge): DataFlowEdge {
  return {
    from: edge.from ?? { file: "unknown", line: 0, description: "" },
    to: edge.to ?? { file: "unknown", line: 0, description: "" },
    dataType: edge.dataType ?? "unknown",
    controls: Array.isArray(edge.controls) ? edge.controls : [],
    risks: Array.isArray(edge.risks) ? edge.risks : [],
  };
}
