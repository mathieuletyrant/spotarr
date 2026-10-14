import { MediaType, type Rule } from "@spotarr/contract";

// A Rule's conditions in words, in the order the form shows them: ["Movies",
// "a single candidate", "confidence ≥ 90 %"]. Empty: the Rule adds every candidate.
export function conditionsOf(rule: Rule): string[] {
  const conditions: string[] = [];
  if (rule.type === MediaType.MOVIE) conditions.push("Movies");
  if (rule.type === MediaType.TV) conditions.push("TV shows");
  if (rule.onlyOne) conditions.push("a single candidate");
  if (rule.minConfidence !== undefined) conditions.push(`confidence ≥ ${rule.minConfidence} %`);
  if (rule.minRating !== undefined && rule.minVotes !== undefined) {
    conditions.push(`TMDB ≥ ${rule.minRating} (${rule.minVotes}+ votes)`);
  } else if (rule.minRating !== undefined) {
    conditions.push(`TMDB ≥ ${rule.minRating}`);
  } else if (rule.minVotes !== undefined) {
    conditions.push(`${rule.minVotes}+ TMDB votes`);
  }
  return conditions;
}
