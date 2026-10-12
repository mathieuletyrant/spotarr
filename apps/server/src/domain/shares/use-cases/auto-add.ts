import type { Settings } from "../../settings/schema";
import type { Candidate, Share } from "../types";
import { type AddCandidateDeps, addCandidate } from "./add-candidate";

// The Candidates auto add requests on its own, by the rule of Settings → Auto
// add. Only the confidence counts; a direct IMDb/TMDB link, certain, has none
// and counts as 100 %.
export function candidatesToAutoAdd(
  candidates: Candidate[],
  rule: Settings["autoAdd"],
): Candidate[] {
  if (!rule.enabled) return [];
  const confident = candidates.filter(
    (c) => Math.round((c.confidence ?? 1) * 100) >= rule.minConfidence,
  );
  // Two confident Candidates is a doubt, even if one is already in the library.
  if (rule.onlyOne && confident.length !== 1) return [];
  return confident.filter((c) => c.libraryState === "ABSENT");
}

// Requests them through Seerr, as a click on Add would, marked automatic.
export async function autoAdd(
  share: Share,
  rule: Settings["autoAdd"],
  deps: AddCandidateDeps,
): Promise<void> {
  if (share.identification.status !== "READY") return;
  for (const candidate of candidatesToAutoAdd(share.candidates, rule)) {
    await addCandidate(share.id, candidate, { ...deps, automatic: true });
  }
}
