export type Severity = "critical" | "high" | "medium" | "low";

export type FindingType =
  | "import"
  | "api-call"
  | "unversioned-model"
  | "pii-in-prompt"
  | "missing-output-validation"
  | "hardcoded-key"
  | "no-error-handling"
  | "autonomous-decision";

export interface ScanResult {
  file: string;
  line: number;
  type: FindingType;
  provider: string;
  match: string;
  context: string;
  severity: Severity;
  riskCategory?: string;
  complianceTags?: string[];
}

export interface ScanSummary {
  totalFiles: number;
  filesScanned: number;
  filesWithAI: number;
  findings: ScanResult[];
  providers: Map<string, number>;
  byType: { imports: number; apiCalls: number };
  bySeverity: { critical: number; high: number; medium: number; low: number };
  riskFindings: number;
}

export interface ScanConfig {
  include: string[];
  exclude: string[];
  extensions: string[];
}
