import type { Severity, FindingType } from "../scanner/types.js";

export interface PersistedFinding {
  id: string;
  file: string;
  line: number;
  type: FindingType;
  provider: string;
  match: string;
  context: string;
  severity: Severity;
  riskCategory?: string;
  complianceTags?: string[];

  // Persistence fields
  status: "open" | "resolved";
  first_seen: string;
  last_seen: string;

  // Auditor fields
  disposition:
    | "confirmed"
    | "false-positive"
    | "accepted-risk"
    | "needs-remediation"
    | null;
  note: string | null;
  auditor: string | null;
  reviewed_at: string | null;
  severity_override: Severity | null;
  evidence_ref: string | null;

  // AI analysis fields
  aiDetected?: boolean;
  aiConfidence?: { level: "high" | "medium" | "low"; reasoning: string };
  aiProvenance?: {
    model: string;
    provider: string;
    promptHash: string;
    timestamp: string;
    cached: boolean;
  };
  workpaperRef?: string;

  // Training data capture: AI predictions paired with human labels
  ai_predicted_disposition?:
    | "confirmed"
    | "false-positive"
    | "accepted-risk"
    | "needs-remediation";
  ai_predicted_severity?: Severity;
  ai_reasoning?: string;
  ai_fp_flag?: boolean;
  ai_fp_reasoning?: string;
  fp_override?: "confirmed" | "rejected";
}
