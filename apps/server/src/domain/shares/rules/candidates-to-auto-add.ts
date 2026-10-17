import type { Rule } from "../../auto-add/types";
import type { Candidate } from "../types";

// A Candidate auto add requests or puts in the watchlist, and the Rule credited for it.
export type AutoAddition = { candidate: Candidate; rule: Rule };

// The Candidates auto add handles on its own: each one not in the library yet
// for which an enabled Rule holds. A Rule that requests wins over one that only
// puts in the watchlist, whatever their order; among Rules with the same
// action, the first one is credited. `today` is "2026-10-14": a title released
// after it is not out yet.
export function candidatesToAutoAdd(
  candidates: Candidate[],
  rules: Rule[],
  today: string,
): AutoAddition[] {
  const additions: AutoAddition[] = [];
  for (const candidate of candidates) {
    if (candidate.libraryState !== "ABSENT") continue;
    const holding = rules.filter((r) => holds(r, candidate, candidates.length, today));
    // An Action that downloads wins over one that keeps the title for later.
    const rule = holding.find((r) => r.action === "SEERR_REQUEST") ?? holding[0];
    if (rule) additions.push({ candidate, rule });
  }
  return additions;
}

// Every condition of the Rule holds for the Candidate; an absent one is no
// condition. `count` is how many Candidates the Identification found.
function holds(rule: Rule, candidate: Candidate, count: number, today: string): boolean {
  if (!rule.enabled) return false;
  if (rule.type && candidate.type !== rule.type) return false;
  if (rule.onlyOne && count !== 1) return false;
  // A direct IMDb/TMDB link has no confidence: it is certain, 100 %.
  const confidence = Math.round((candidate.confidence ?? 1) * 100);
  if (rule.minConfidence !== undefined && confidence < rule.minConfidence) return false;
  if (rule.unreleasedSkipsRating && isUnreleased(candidate, today)) return true;
  if (rule.minRating !== undefined) {
    if (candidate.tmdbRating === undefined || candidate.tmdbRating < rule.minRating) return false;
  }
  if (rule.minVotes !== undefined && (candidate.tmdbVotes ?? 0) < rule.minVotes) return false;
  return true;
}

// Not out yet: released after today, or with no date at all on TMDB. A Share
// identified before release dates were kept has only the year to tell.
function isUnreleased(candidate: Candidate, today: string): boolean {
  if (candidate.releaseDate) return candidate.releaseDate > today;
  if (candidate.year === undefined) return true;
  return candidate.year > Number(today.slice(0, 4));
}
