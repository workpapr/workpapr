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
}
