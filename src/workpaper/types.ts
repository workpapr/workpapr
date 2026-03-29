import type { AIProvenance } from "../ai/types.js";

export type WorkpaperStatus = "draft" | "edited" | "reviewed" | "approved";

export interface WorkpaperSection {
  id: string;
  title: string;
  content: string;
  provenance?: AIProvenance;
  /** Original AI-generated content, preserved for training data when auditor edits */
  originalContent?: string;
}

export interface Workpaper {
  id: string;
  systemName: string;
  systemFile: string;
  status: WorkpaperStatus;
  createdAt: string;
  updatedAt: string;
  reviewedBy: string | null;
  approvedBy: string | null;
  sections: WorkpaperSection[];
}
