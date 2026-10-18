import { MediaType, type Rule, RuleAction, type Settings } from "@spotarr/contract";

// A Rule's conditions in words, in the order the form shows them: ["a movie",
// "a single candidate", "confidence ≥ 90%"]. Empty: the Rule adds every candidate.
export function conditionsOf(rule: Rule): string[] {
  const conditions: string[] = [];
  if (rule.type === MediaType.MOVIE) conditions.push("a movie");
  if (rule.type === MediaType.TV) conditions.push("a TV show");
  if (rule.onlyOne) conditions.push("a single candidate");
  if (rule.minConfidence !== undefined) conditions.push(`confidence ≥ ${rule.minConfidence}%`);
  const rating = ratingOf(rule);
  if (rating && rule.unreleasedSkipsRating) conditions.push(`${rating} or not out yet`);
  else if (rating) conditions.push(rating);
  return conditions;
}

// "TMDB ≥ 7.5 (100+ votes)", or undefined when the Rule asks nothing of the rating.
function ratingOf(rule: Rule): string | undefined {
  if (rule.minRating !== undefined && rule.minVotes !== undefined) {
    return `TMDB ≥ ${rule.minRating} (${rule.minVotes}+ votes)`;
  }
  if (rule.minRating !== undefined) return `TMDB ≥ ${rule.minRating}`;
  if (rule.minVotes !== undefined) return `${rule.minVotes}+ TMDB votes`;
  return undefined;
}

// The Actions a Rule can take: those of the connections set up. Seerr's need
// its URL and API key; Radarr and Sonarr will bring their own.
export function actionsSetUp(settings: Settings | undefined): RuleAction[] {
  if (settings?.seerr?.url && settings.seerr.apiKey) {
    return [RuleAction.SEERR_REQUEST, RuleAction.SEERR_WATCHLIST];
  }
  return [];
}
