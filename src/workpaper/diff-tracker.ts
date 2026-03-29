import fs from "node:fs";
import path from "node:path";
import type { StylePreferencePair } from "../training/types.js";
import type { Workpaper, WorkpaperSection } from "./types.js";

/**
 * Track section-level diffs between AI draft and auditor-edited versions.
 * These diffs are the primary training signal for audit language RLHF.
 */
export class DiffTracker {
  private outputPath: string;

  constructor(rootDir: string) {
    const dir = path.join(rootDir, ".workpapr", "training-data");
    fs.mkdirSync(dir, { recursive: true });
    this.outputPath = path.join(dir, "style-preferences.jsonl");
  }

  /**
   * Compare AI draft sections with the current (possibly edited) workpaper.
   * Records diffs for sections that were modified by the auditor.
   */
  recordEdits(
    workpaperId: string,
    originalSections: WorkpaperSection[],
    editedSections: WorkpaperSection[],
    auditor?: string
  ): number {
    let recorded = 0;

    for (const original of originalSections) {
      // Only track AI-generated sections (those with provenance)
      if (!original.provenance) continue;

      const edited = editedSections.find((s) => s.id === original.id);
      if (!edited) continue;

      // Skip if content is unchanged
      if (original.content === edited.content) continue;

      const pair: StylePreferencePair = {
        sectionId: original.id,
        workpaperId,
        aiDraft: original.content,
        auditorEdited: edited.content,
        diffSummary: summarizeDiff(original.content, edited.content),
        auditor,
        timestamp: new Date().toISOString(),
      };

      const line = JSON.stringify(pair) + "\n";
      fs.appendFileSync(this.outputPath, line, "utf-8");
      recorded++;
    }

    return recorded;
  }
}

/**
 * Produce a human-readable summary of what changed between two texts.
 */
function summarizeDiff(original: string, edited: string): string {
  const origLines = original.split("\n");
  const editLines = edited.split("\n");

  let added = 0;
  let removed = 0;
  let changed = 0;

  const origSet = new Set(origLines);
  const editSet = new Set(editLines);

  for (const line of editLines) {
    if (!origSet.has(line) && line.trim()) added++;
  }
  for (const line of origLines) {
    if (!editSet.has(line) && line.trim()) removed++;
  }

  // Rough change estimation
  changed = Math.min(added, removed);
  added -= changed;
  removed -= changed;

  const parts: string[] = [];
  if (changed > 0) parts.push(`${changed} line(s) modified`);
  if (added > 0) parts.push(`${added} line(s) added`);
  if (removed > 0) parts.push(`${removed} line(s) removed`);

  return parts.join(", ") || "minor edits";
}

/**
 * Load stored AI drafts for a workpaper (stored alongside the rendered version).
 */
export function loadOriginalDrafts(
  rootDir: string,
  workpaperId: string
): WorkpaperSection[] {
  const draftPath = path.join(
    rootDir,
    ".workpapr",
    "workpapers",
    `.${workpaperId}-drafts.json`
  );

  if (!fs.existsSync(draftPath)) return [];

  try {
    const raw = fs.readFileSync(draftPath, "utf-8");
    return JSON.parse(raw) as WorkpaperSection[];
  } catch {
    return [];
  }
}

/**
 * Save original AI drafts for later comparison when auditor edits.
 */
export function saveOriginalDrafts(
  rootDir: string,
  workpaperId: string,
  sections: WorkpaperSection[]
): void {
  const dir = path.join(rootDir, ".workpapr", "workpapers");
  fs.mkdirSync(dir, { recursive: true });

  const draftPath = path.join(dir, `.${workpaperId}-drafts.json`);
  fs.writeFileSync(draftPath, JSON.stringify(sections, null, 2), "utf-8");
}
