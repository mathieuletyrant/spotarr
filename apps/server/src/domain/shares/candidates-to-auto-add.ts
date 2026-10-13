import type { Settings } from "../settings/schema";
import type { Candidate } from "./types";

// The Candidates auto add requests on its own, by the rule of Settings → Auto
// add. Only the confidence counts; a direct IMDb/TMDB link, certain, has none
// and counts as 100 %.
export function candidatesToAutoAdd(
  candidates: Candidate[],
  rule: Settings["autoAdd"],
): Candidate[] {
  if (!rule.enabled) return [];
  // Only one: the Identification must have found a single Candidate at all.
  if (rule.onlyOne && candidates.length !== 1) return [];
  return candidates.filter(
    (c) =>
      Math.round((c.confidence ?? 1) * 100) >= rule.minConfidence && c.libraryState === "ABSENT",
  );
}
