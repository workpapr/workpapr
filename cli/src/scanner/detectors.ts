import type { ScanResult, FindingType } from "./types.js";

interface DetectorPattern {
  pattern: RegExp;
  provider: string;
  type: FindingType;
}

// --- Import detectors ---
// Match JS/TS import/require statements and Python imports
const IMPORT_PATTERNS: DetectorPattern[] = [
  // OpenAI
  {
    pattern: /(?:import|require|from)\s*[\(\s]*['"]openai['"]/,
    provider: "openai",
    type: "import",
  },
  // Anthropic
  {
    pattern:
      /(?:import|require|from)\s*[\(\s]*['"](?:@anthropic-ai\/sdk|anthropic)['"]/,
    provider: "anthropic",
    type: "import",
  },
  // Google Generative AI
  {
    pattern:
      /(?:import|require|from)\s*[\(\s]*['"]@google\/generative-ai['"]/,
    provider: "google",
    type: "import",
  },
  // Google Vertex AI
  {
    pattern:
      /(?:import|require|from)\s*[\(\s]*['"]@google-cloud\/vertexai['"]/,
    provider: "google",
    type: "import",
  },
  // AWS Bedrock
  {
    pattern:
      /(?:import|require|from)\s*[\(\s]*['"]@aws-sdk\/client-bedrock-runtime['"]/,
    provider: "bedrock",
    type: "import",
  },
  // Azure OpenAI
  {
    pattern: /(?:import|require|from)\s*[\(\s]*['"]@azure\/openai['"]/,
    provider: "azure",
    type: "import",
  },
  // Ollama
  {
    pattern: /(?:import|require|from)\s*[\(\s]*['"]ollama['"]/,
    provider: "ollama",
    type: "import",
  },
  // LangChain
  {
    pattern: /(?:import|require|from)\s*[\(\s]*['"]langchain/,
    provider: "langchain",
    type: "import",
  },
  // LlamaIndex
  {
    pattern: /(?:import|require|from)\s*[\(\s]*['"]llamaindex/,
    provider: "llamaindex",
    type: "import",
  },
  // Python: import openai / from openai import ...
  {
    pattern: /^(?:import|from)\s+openai\b/,
    provider: "openai",
    type: "import",
  },
  {
    pattern: /^(?:import|from)\s+anthropic\b/,
    provider: "anthropic",
    type: "import",
  },
  {
    pattern: /^(?:import|from)\s+google\.generativeai\b/,
    provider: "google",
    type: "import",
  },
  {
    pattern: /^(?:import|from)\s+langchain\b/,
    provider: "langchain",
    type: "import",
  },
  {
    pattern: /^(?:import|from)\s+llama_index\b/,
    provider: "llamaindex",
    type: "import",
  },
  // Cohere
  {
    pattern: /(?:import|require|from)\s*[\(\s]*['"]cohere-ai['"]/,
    provider: "cohere",
    type: "import",
  },
  {
    pattern: /^(?:import|from)\s+cohere\b/,
    provider: "cohere",
    type: "import",
  },
  // Mistral
  {
    pattern:
      /(?:import|require|from)\s*[\(\s]*['"]@mistralai\/mistralai['"]/,
    provider: "mistral",
    type: "import",
  },
  {
    pattern: /^(?:import|from)\s+mistralai\b/,
    provider: "mistral",
    type: "import",
  },
];

// --- API call detectors ---
// Match REST API calls to known LLM endpoints
const API_CALL_PATTERNS: DetectorPattern[] = [
  // OpenAI chat completions
  {
    pattern: /\/v1\/chat\/completions/,
    provider: "openai",
    type: "api-call",
  },
  // OpenAI completions (legacy)
  {
    pattern: /\/v1\/completions/,
    provider: "openai",
    type: "api-call",
  },
  // OpenAI embeddings
  {
    pattern: /\/v1\/embeddings/,
    provider: "openai",
    type: "api-call",
  },
  // Anthropic messages
  {
    pattern: /\/v1\/messages/,
    provider: "anthropic",
    type: "api-call",
  },
  // Anthropic (complete)
  {
    pattern: /\/v1\/complete/,
    provider: "anthropic",
    type: "api-call",
  },
  // API base URLs
  {
    pattern: /api\.openai\.com/,
    provider: "openai",
    type: "api-call",
  },
  {
    pattern: /api\.anthropic\.com/,
    provider: "anthropic",
    type: "api-call",
  },
  {
    pattern: /generativelanguage\.googleapis\.com/,
    provider: "google",
    type: "api-call",
  },
  {
    pattern: /bedrock-runtime\.[a-z0-9-]+\.amazonaws\.com/,
    provider: "bedrock",
    type: "api-call",
  },
  {
    pattern: /[a-z0-9-]+\.openai\.azure\.com/,
    provider: "azure",
    type: "api-call",
  },
  {
    pattern: /localhost:11434/,
    provider: "ollama",
    type: "api-call",
  },
];

export function detectInLine(
  line: string,
  filePath: string,
  lineNumber: number
): ScanResult[] {
  const results: ScanResult[] = [];
  const trimmed = line.trim();

  // Skip comments (rough heuristic)
  if (
    trimmed.startsWith("//") ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("*") ||
    trimmed.startsWith("/*")
  ) {
    return results;
  }

  const allPatterns = [...IMPORT_PATTERNS, ...API_CALL_PATTERNS];

  for (const { pattern, provider, type } of allPatterns) {
    const match = line.match(pattern);
    if (match) {
      // Avoid duplicate detections for the same provider+type on the same line
      const existing = results.find(
        (r) => r.provider === provider && r.type === type
      );
      if (!existing) {
        results.push({
          file: filePath,
          line: lineNumber,
          type,
          provider,
          match: match[0],
          context: trimmed.slice(0, 120),
          severity: "low",
        });
      }
    }
  }

  return results;
}
