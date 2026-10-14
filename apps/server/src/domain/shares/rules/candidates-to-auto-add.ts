import type { Rule } from "../../auto-add/types";
import type { Candidate } from "../types";

// A Candidate auto add requests, and the Rule credited for it.
export type AutoAddition = { candidate: Candidate; rule: Rule };

// The Candidates auto add requests on its own: each one not in the library yet
// for which an enabled Rule holds, credited to the first such Rule.
export function candidatesToAutoAdd(candidates: Candidate[], rules: Rule[]): AutoAddition[] {
  const additions: AutoAddition[] = [];
  for (const candidate of candidates) {
    if (candidate.libraryState !== "ABSENT") continue;
    const rule = rules.find((r) => holds(r, candidate, candidates.length));
    if (rule) additions.push({ candidate, rule });
  }
  return additions;
}

// Every condition of the Rule holds for the Candidate; an absent one is no
// condition. `count` is how many Candidates the Identification found.
function holds(rule: Rule, candidate: Candidate, count: number): boolean {
  if (!rule.enabled) return false;
  if (rule.type && candidate.type !== rule.type) return false;
  if (rule.onlyOne && count !== 1) return false;
  // A direct IMDb/TMDB link has no confidence: it is certain, 100 %.
  const confidence = Math.round((candidate.confidence ?? 1) * 100);
  if (rule.minConfidence !== undefined && confidence < rule.minConfidence) return false;
  if (rule.minRating !== undefined) {
    if (candidate.tmdbRating === undefined || candidate.tmdbRating < rule.minRating) return false;
  }
  if (rule.minVotes !== undefined && (candidate.tmdbVotes ?? 0) < rule.minVotes) return false;
  return true;
}
