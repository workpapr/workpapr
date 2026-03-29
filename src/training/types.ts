import type { Severity, FindingType } from "../scanner/types.js";

export type TraceAction =
  | "read-file"
  | "grep"
  | "git-blame"
  | "git-log"
  | "follow-import"
  | "check-config"
  | "semantic-analysis"
  | "data-flow-trace"
  | "false-positive-filter"
  | "risk-scoring"
  | "compliance-mapping";

export interface TraceStep {
  action: TraceAction;
  target: string;
  resultSummary: string;
  decision: string;
  timestamp: string;
  durationMs?: number;
}

export interface InvestigationTrace {
  id: string;
  findingId: string;
  findingType: FindingType;
  findingSeverity: Severity;
  file: string;
  steps: TraceStep[];
  finalDisposition?: string;
  auditor?: string;
  domain?: string;
  startedAt: string;
  completedAt?: string;
}

export interface StylePreferencePair {
  sectionId: string;
  workpaperId: string;
  aiDraft: string;
  auditorEdited: string;
  diffSummary: string;
  auditor?: string;
  timestamp: string;
}

export interface TrainingTriple {
  taskType: string;
  input: string;
  aiOutput: string;
  humanLabel: string;
  metadata: Record<string, unknown>;
  timestamp: string;
}
