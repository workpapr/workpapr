import type { ScanResult } from "./types.js";

// --- Key format patterns ---
const KEY_PATTERNS = [
  { pattern: /\bsk-[a-zA-Z0-9_-]{20,}/, provider: "openai" },
  { pattern: /\bsk-ant-[a-zA-Z0-9_-]{20,}/, provider: "anthropic" },
  { pattern: /\bAKIA[A-Z0-9]{16}/, provider: "aws" },
  { pattern: /\bAIza[a-zA-Z0-9_-]{35}/, provider: "google" },
];

// Lines that indicate env var usage (not hardcoded)
const ENV_PATTERNS =
  /process\.env|os\.environ|os\.getenv|Environment\.GetEnvironmentVariable|env\[|getenv\(|ENV\[/;

// --- Prompt context keywords ---
const PROMPT_KEYWORDS =
  /\b(?:content|message|prompt|role|system|user|assistant|messages)\b/i;

// PII variable names in interpolation
const PII_INTERPOLATION_PATTERNS = [
  /\$\{[^}]*(?:email|ssn|social_security|phone|address|name|dob|date_of_birth|account|credit_card|passport|salary|income)[^}]*\}/i,
  /f["'][^"']*\{[^}]*(?:email|ssn|social_security|phone|address|name|dob|date_of_birth|account|credit_card|passport|salary|income)[^}]*\}/i,
  /\+\s*(?:\w+\.)?(?:email|ssn|social_security|phone|address|name|dob|date_of_birth|account|credit_card|passport|salary|income)\b/i,
  /["']\s*\+\s*(?:\w+\.)?(?:email|ssn|social_security|phone|address|customer_name|user_name|full_name)\s*\+/i,
];

// --- AI call patterns ---
const AI_CALL_PATTERNS = [
  /\.chat\.completions\.create/,
  /\.messages\.create/,
  /\.generate_content/,
  /\.completions\.create/,
  /openai\.chat/,
  /anthropic\.messages/,
  /client\.chat/,
  /\.invoke\(/,
  /BedrockRuntimeClient/,
  /\.send\(.*Command\)/,
  /model\.generate/,
  /\.complete\(/,
  /await.*(?:openai|anthropic|client).*\(/,
];

// --- Action patterns (post-AI) ---
const ACTION_PATTERNS = [
  /\.execute\(/, /\.query\(/, /\.update\(/, /\.insert\(/, /\.delete\(/,
  /\.save\(/, /\.write\(/, /\.send\(/, /\.post\(/, /\.put\(/,
  /\.transfer\(/, /\.approve\(/, /\.process\(/,
  /db\.\w+/, /prisma\.\w+/, /knex\.\w+/,
  /UPDATE\s/, /INSERT\s/, /DELETE\s/,
  /fetch\(/, /axios\.\w+/,
];

// --- Human review patterns ---
const REVIEW_PATTERNS = [
  /await.*review/, /await.*approve/, /human.*review/i, /manual.*check/i,
  /confirm.*before/i, /requires.*approval/i, /pending.*review/i,
];

// --- AI response access patterns ---
const RESPONSE_ACCESS_PATTERNS = [
  /response\.choices\[0\]/,
  /response\.data/,
  /completion\.choices/,
  /\.message\.content/,
  /\.text/,
  /result\.content/,
  /response\.content/,
];

// --- Validation patterns ---
const VALIDATION_PATTERNS = [
  /\bif\s*\(/, /\.parse\(/, /\.validate\(/, /schema/, /\.safeParse\(/,
  /JSON\.parse/, /try\s*\{/, /\.check\(/, /assert/,
];

// --- Floating model patterns (no date pin) ---
const FLOATING_MODEL_PATTERNS = [
  /["']gpt-4o["']/, /["']gpt-4["']/, /["']gpt-4-turbo["']/,
  /["']gpt-3\.5-turbo["']/, /["']claude-3-opus["']/, /["']claude-3-sonnet["']/,
  /["']claude-3-haiku["']/, /["']claude-3\.5-sonnet["']/, /["']claude-3\.5-haiku["']/,
  /["']gemini-pro["']/, /["']gemini-1\.5-pro["']/, /["']gemini-1\.5-flash["']/,
];

// Date-pinned model check
const DATE_PINNED = /\d{4}[-_]\d{2}[-_]\d{2}/;

// Model assignment pattern
const MODEL_ASSIGN = /model\s*[:=]\s*["']([^"']+)["']/;

export function detectRisksInFile(
  lines: string[],
  filePath: string
): ScanResult[] {
  const results: ScanResult[] = [];
  const autonomousDecisionLines = new Set<number>();

  let tryDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const lineNum = i + 1;

    // Skip comments
    if (
      trimmed.startsWith("//") ||
      trimmed.startsWith("#") ||
      trimmed.startsWith("*") ||
      trimmed.startsWith("/*")
    ) {
      continue;
    }

    // Track try/catch depth
    if (/\btry\s*\{/.test(trimmed) || /\btry\s*:/.test(trimmed)) {
      tryDepth++;
    }
    if (/\}\s*catch\b/.test(trimmed) || /\bexcept\b/.test(trimmed)) {
      tryDepth = Math.max(0, tryDepth - 1);
    }

    // --- Hardcoded key detection ---
    for (const { pattern, provider } of KEY_PATTERNS) {
      if (pattern.test(trimmed) && !ENV_PATTERNS.test(trimmed)) {
        results.push({
          file: filePath,
          line: lineNum,
          type: "hardcoded-key",
          category: "ai",
          provider,
          match: (trimmed.match(pattern)?.[0] ?? "").slice(0, 20) + "...",
          context: trimmed.slice(0, 120),
          severity: "critical",
          riskCategory: "Hardcoded API key in source code",
          complianceTags: ["NIST-MAP-3.1", "SOC2-CC6.1"],
        });
      }
    }

    // --- PII in prompt detection ---
    if (PROMPT_KEYWORDS.test(trimmed)) {
      for (const piiPattern of PII_INTERPOLATION_PATTERNS) {
        if (piiPattern.test(trimmed)) {
          const piiMatch = trimmed.match(piiPattern)?.[0] ?? "";
          results.push({
            file: filePath,
            line: lineNum,
            type: "pii-in-prompt",
            category: "ai",
            provider: "any",
            match: piiMatch.slice(0, 60),
            context: trimmed.slice(0, 120),
            severity: "critical",
            riskCategory: "PII data interpolated into AI prompt",
            complianceTags: ["EU-AI-ACT-14", "NIST-MAP-1.5", "SOC2-CC6.1"],
          });
          break;
        }
      }
    }

    // --- Unversioned model detection ---
    const modelMatch = trimmed.match(MODEL_ASSIGN);
    if (modelMatch) {
      const modelName = modelMatch[1];
      const isFloating = FLOATING_MODEL_PATTERNS.some((p) => p.test(trimmed));
      if (isFloating && !DATE_PINNED.test(modelName)) {
        results.push({
          file: filePath,
          line: lineNum,
          type: "unversioned-model",
          category: "ai",
          provider: modelName.startsWith("gpt")
            ? "openai"
            : modelName.startsWith("claude")
              ? "anthropic"
              : modelName.startsWith("gemini")
                ? "google"
                : "unknown",
          match: modelName,
          context: trimmed.slice(0, 120),
          severity: "medium",
          riskCategory: "Floating model version — behavior may change without notice",
          complianceTags: ["NIST-MAP-2.6"],
        });
      }
    }

    // --- No error handling detection ---
    const isAICall = AI_CALL_PATTERNS.some((p) => p.test(trimmed));
    if (isAICall && tryDepth === 0) {
      results.push({
        file: filePath,
        line: lineNum,
        type: "no-error-handling",
        category: "ai",
        provider: "any",
        match: trimmed.match(/\.\w+\.\w+\.\w+\(/)?.[0] ??
          trimmed.match(/\.\w+\(/)?.[0] ?? "AI call",
        context: trimmed.slice(0, 120),
        severity: "high",
        riskCategory: "AI API call without error handling",
        complianceTags: ["NIST-MAP-2.6"],
      });
    }

    // --- Autonomous decision detection ---
    if (isAICall) {
      const lookAhead = Math.min(i + 20, lines.length);
      let hasAction = false;
      let hasReview = false;
      let actionLine = -1;
      let actionContext = "";

      for (let j = i + 1; j < lookAhead; j++) {
        const nextLine = lines[j].trim();
        if (REVIEW_PATTERNS.some((p) => p.test(nextLine))) {
          hasReview = true;
          break;
        }
        if (!hasAction && ACTION_PATTERNS.some((p) => p.test(nextLine))) {
          hasAction = true;
          actionLine = j + 1;
          actionContext = nextLine.slice(0, 120);
        }
      }

      if (hasAction && !hasReview && !autonomousDecisionLines.has(actionLine)) {
        autonomousDecisionLines.add(actionLine);
        results.push({
          file: filePath,
          line: actionLine,
          type: "autonomous-decision",
          category: "ai",
          provider: "any",
          match: "AI output used in action without human review",
          context: actionContext,
          severity: "high",
          riskCategory: "AI output drives action without human oversight",
          complianceTags: ["EU-AI-ACT-14", "NIST-MAP-1.5"],
        });
      }
    }

    // --- Missing output validation detection ---
    const isResponseAccess = RESPONSE_ACCESS_PATTERNS.some((p) =>
      p.test(trimmed)
    );
    if (isResponseAccess) {
      const nearbyStart = Math.max(0, i - 3);
      const nearbyEnd = Math.min(lines.length, i + 3);
      let hasValidation = false;
      for (let j = nearbyStart; j < nearbyEnd; j++) {
        if (VALIDATION_PATTERNS.some((p) => p.test(lines[j]))) {
          hasValidation = true;
          break;
        }
      }
      if (!hasValidation) {
        results.push({
          file: filePath,
          line: lineNum,
          type: "missing-output-validation",
          category: "ai",
          provider: "any",
          match: trimmed.match(/\w+\.\w+(?:\[\d+\])?(?:\.\w+)*/)?.[0] ?? "response access",
          context: trimmed.slice(0, 120),
          severity: "medium",
          riskCategory: "AI output used without validation",
          complianceTags: ["NIST-MAP-2.6"],
        });
      }
    }
  }

  return results;
}
