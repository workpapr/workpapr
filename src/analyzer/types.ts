import type { Severity } from "../scanner/types.js";
import type { AIProvenance, AIConfidence } from "../ai/types.js";

export type AIFindingType =
  | "unsafe-tool-execution"
  | "unfiltered-pipeline"
  | "prompt-injection-surface"
  | "scope-escalation"
  | "financial-decision"
  | "pii-data-flow"
  | "missing-guardrails"
  | "inconsistent-error-handling"
  | "model-dependency-risk"
  | "custom";

export interface AIFinding {
  file: string;
  line: number;
  type: AIFindingType;
  title: string;
  description: string;
  severity: Severity;
  evidence: string[];
  confidence: AIConfidence;
  provenance: AIProvenance;
  recommendations: string[];
}

export interface DataFlowEdge {
  from: { file: string; line: number; description: string };
  to: { file: string; line: number; description: string };
  dataType: string;
  controls: string[];
  risks: string[];
}

export interface DataFlowGraph {
  edges: DataFlowEdge[];
  entryPoints: Array<{ file: string; line: number; description: string }>;
  exitPoints: Array<{ file: string; line: number; description: string }>;
}

export interface ContextualRisk {
  originalSeverity: Severity;
  adjustedSeverity: Severity;
  reason: string;
  factors: string[];
}

export interface ComplianceMapping {
  framework: string;
  requirement: string;
  status: "met" | "partially-met" | "not-met" | "not-applicable";
  findings: string[];
  rationale: string;
}

export interface AnalysisResult {
  staticFindings: import("../scanner/types.js").ScanResult[];
  aiFindings: AIFinding[];
  dataFlow?: DataFlowGraph;
  complianceMappings: ComplianceMapping[];
  falsePositiveIds: string[];
  riskAdjustments: Map<string, ContextualRisk>;
}
