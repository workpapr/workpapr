import type { PolicyRule } from "./types.js";

export const DEFAULT_POLICIES: PolicyRule[] = [
  {
    id: "no-hardcoded-keys",
    name: "No hardcoded API keys",
    findingTypes: ["hardcoded-key"],
    severity: "critical",
    action: "block",
    enabled: true,
  },
  {
    id: "no-pii-in-prompts",
    name: "No PII in AI prompts",
    findingTypes: ["pii-in-prompt"],
    severity: "critical",
    action: "block",
    enabled: true,
  },
  {
    id: "require-human-review",
    name: "AI decisions require human oversight",
    findingTypes: ["autonomous-decision"],
    severity: "high",
    action: "block",
    enabled: true,
  },
  {
    id: "require-error-handling",
    name: "AI calls must have error handling",
    findingTypes: ["no-error-handling"],
    severity: "high",
    action: "warn",
    enabled: true,
  },
  {
    id: "pin-model-versions",
    name: "Pin model versions",
    findingTypes: ["unversioned-model"],
    severity: "medium",
    action: "warn",
    enabled: true,
  },
  {
    id: "validate-ai-output",
    name: "Validate AI output before use",
    findingTypes: ["missing-output-validation"],
    severity: "medium",
    action: "warn",
    enabled: true,
  },
];
