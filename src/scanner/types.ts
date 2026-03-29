export type Severity = "critical" | "high" | "medium" | "low";

export type FindingCategory = "ai" | "security" | "data" | "operational" | "custom";

// AI-specific finding types (the original set)
export type AIFindingType =
  | "import"
  | "api-call"
  | "unversioned-model"
  | "pii-in-prompt"
  | "missing-output-validation"
  | "hardcoded-key"
  | "no-error-handling"
  | "autonomous-decision"
  | "unsafe-tool-execution"
  | "unfiltered-pipeline"
  | "prompt-injection-surface"
  | "scope-escalation"
  | "financial-decision"
  | "pii-data-flow"
  | "missing-guardrails"
  | "inconsistent-error-handling"
  | "model-dependency-risk";

// Extensible: category-prefixed types (e.g. "security:weak-auth") + AI types + custom
export type FindingType = AIFindingType | `${string}:${string}` | "custom";

export interface ScanResult {
  file: string;
  line: number;
  type: FindingType;
  category?: FindingCategory;
  provider: string;
  match: string;
  context: string;
  severity: Severity;
  riskCategory?: string;
  complianceTags?: string[];

  // AI analysis fields (populated when --ai is used)
  aiDetected?: boolean;
  aiConfidence?: { level: "high" | "medium" | "low"; reasoning: string };
  aiProvenance?: {
    model: string;
    provider: string;
    promptHash: string;
    timestamp: string;
    cached: boolean;
  };

  // Training data capture fields
  ai_predicted_disposition?: string;
  ai_predicted_severity?: Severity;
  ai_reasoning?: string;
  ai_fp_flag?: boolean;
  ai_fp_reasoning?: string;
}

export interface ScanSummary {
  totalFiles: number;
  filesScanned: number;
  filesWithAI: number;
  findings: ScanResult[];
  providers: Map<string, number>;
  byType: { imports: number; apiCalls: number };
  bySeverity: { critical: number; high: number; medium: number; low: number };
  byCategory?: Partial<Record<FindingCategory, number>>;
  riskFindings: number;
  aiFindings?: number;
  falsePositives?: number;
}

export interface ScanConfig {
  include: string[];
  exclude: string[];
  extensions: string[];
}
