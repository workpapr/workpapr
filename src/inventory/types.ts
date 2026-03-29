import type { Severity } from "../scanner/types.js";

export type DataClassification = "public" | "internal" | "confidential" | "restricted";

export interface AISystem {
  id: string;
  name: string;
  file: string;
  providers: string[];
  models: string[];
  modelPinned: boolean;
  dataClassification: DataClassification;
  dataTypes: string[];
  riskLevel: Severity;
  hasHumanOversight: boolean;
  hasErrorHandling: boolean;
  hasOutputValidation: boolean;
  complianceTags: string[];
  findingCount: number;
}

export interface InventoryReport {
  systems: AISystem[];
  totalSystems: number;
  totalProviders: number;
  totalFindings: number;
}
