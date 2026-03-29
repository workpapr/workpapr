import fs from "node:fs";
import path from "node:path";
import type { StylePreferencePair } from "../training/types.js";

/**
 * Firm-specific style profile built from accumulated workpaper edit diffs.
 * Aggregates terminology preferences, structure patterns, and tone markers.
 */
export interface StyleProfile {
  firmId: string;
  terminology: Map<string, string>;    // AI term → firm term
  structureNotes: string[];            // Observed structure preferences
  sampleCount: number;                 // Number of edit pairs analyzed
  lastUpdated: string;
}

/**
 * Load accumulated style preferences from training data.
 */
export function loadStylePreferences(rootDir: string): StylePreferencePair[] {
  const prefPath = path.join(rootDir, ".workpapr", "training-data", "style-preferences.jsonl");
  if (!fs.existsSync(prefPath)) return [];

  try {
    const raw = fs.readFileSync(prefPath, "utf-8");
    return raw
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as StylePreferencePair);
  } catch {
    return [];
  }
}

/**
 * Build a basic terminology map from accumulated edit diffs.
 * Extracts consistent word-for-word replacements across multiple edits.
 */
export function buildTerminologyMap(
  preferences: StylePreferencePair[]
): Map<string, string> {
  const replacements = new Map<string, Map<string, number>>();

  for (const pref of preferences) {
    const draftWords = extractKeyPhrases(pref.aiDraft);
    const editedWords = extractKeyPhrases(pref.auditorEdited);

    // Simple word-level alignment for consistent replacements
    for (const [draftPhrase, editedPhrase] of alignPhrases(draftWords, editedWords)) {
      if (draftPhrase === editedPhrase) continue;

      if (!replacements.has(draftPhrase)) {
        replacements.set(draftPhrase, new Map());
      }
      const counts = replacements.get(draftPhrase)!;
      counts.set(editedPhrase, (counts.get(editedPhrase) ?? 0) + 1);
    }
  }

  // Only keep replacements that appear consistently (>= 2 times)
  const result = new Map<string, string>();
  for (const [original, candidates] of replacements) {
    for (const [replacement, count] of candidates) {
      if (count >= 2) {
        result.set(original, replacement);
      }
    }
  }

  return result;
}

/**
 * Extract key audit phrases from text.
 */
function extractKeyPhrases(text: string): string[] {
  // Common audit phrases to track
  const phrases = text.match(
    /\b(finding|deficiency|observation|risk|control|material|significant|noted|observed|identified|recommend|should|must|weakness|gap|issue)\b/gi
  );
  return phrases?.map((p) => p.toLowerCase()) ?? [];
}

/**
 * Simple alignment of phrase lists for replacement detection.
 */
function alignPhrases(
  draft: string[],
  edited: string[]
): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  const minLen = Math.min(draft.length, edited.length);

  for (let i = 0; i < minLen; i++) {
    pairs.push([draft[i], edited[i]]);
  }

  return pairs;
}
