import type { Tmdb, TmdbTitle } from "../../integrations/tmdb/client";
import type { Candidate } from "../shares/types";
import type { Guess } from "./guess-titles";

const MAX_CANDIDATES = 10;

// Turns the LLM's guesses into Candidates that exist on TMDB. Each keeps the
// LLM's confidence; a work guessed twice keeps the higher one. Best first.
export async function confirmOnTmdb(guesses: Guess[], tmdb: Tmdb): Promise<Candidate[]> {
  const candidates: Candidate[] = [];

  for (const guess of guesses) {
    const title = await findOnTmdb(guess, tmdb);
    if (!title) continue;

    const same = candidates.find((c) => c.tmdbId === title.tmdbId && c.type === title.type);
    if (same) {
      same.confidence = Math.max(same.confidence ?? 0, guess.confidence);
    } else {
      candidates.push({ ...title, confidence: guess.confidence, libraryState: "ABSENT" });
    }
  }

  candidates.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
  return candidates.slice(0, MAX_CANDIDATES);
}

// Searches TMDB with each title the LLM gave, with and without the year, then
// picks the best result. TMDB's first result is not enough: with a wrong
// year, "Kraken" (2024) finds "Kraken Mare" first.
async function findOnTmdb(guess: Guess, tmdb: Tmdb): Promise<TmdbTitle | undefined> {
  const queries = [guess.title];
  if (guess.originalTitle && guess.originalTitle !== guess.title) {
    queries.push(guess.originalTitle);
  }

  const results: TmdbTitle[] = [];
  for (const query of queries) {
    results.push(...(await search(tmdb, guess.type, query)));
    if (guess.year) {
      results.push(...(await search(tmdb, guess.type, query, guess.year)));
    }
  }
  return pickBest(results, guess);
}

function search(tmdb: Tmdb, type: Guess["type"], query: string, year?: number) {
  if (type === "movie") return tmdb.searchMovies(query, year);
  return tmdb.searchShows(query, year);
}

// Each step keeps only the results that pass it, when at least one does.
export function pickBest(results: TmdbTitle[], guess: Guess): TmdbTitle | undefined {
  let best = keepIfAny(results, (result) => sameTitle(result, guess));
  best = keepIfAny(best, (result) => sameEra(result, guess));
  best = keepIfAny(best, (result) => result.originalLanguage === guess.originalLanguage);
  return mostPopular(best);
}

function keepIfAny(results: TmdbTitle[], test: (result: TmdbTitle) => boolean): TmdbTitle[] {
  const kept = results.filter(test);
  if (kept.length === 0) return results;
  return kept;
}

function sameTitle(result: TmdbTitle, guess: Guess): boolean {
  const guessed = [normalize(guess.title), normalize(guess.originalTitle ?? "")];
  return (
    guessed.includes(normalize(result.title)) ||
    guessed.includes(normalize(result.originalTitle ?? ""))
  );
}

// Within 2 years: the LLM often misdates recent films ("The Invite" 2024 for a
// 2026 film). A bigger gap still tells a remake from its original.
function sameEra(result: TmdbTitle, guess: Guess): boolean {
  if (!guess.year || !result.year) return false;
  return Math.abs(guess.year - result.year) <= 2;
}

function mostPopular(results: TmdbTitle[]): TmdbTitle | undefined {
  let best = results[0];
  for (const result of results) {
    if ((result.popularity ?? 0) > (best?.popularity ?? 0)) best = result;
  }
  return best;
}

// "L'Invitation" and "l’invitation" are the same title; so are "Amélie" and "Amelie".
function normalize(title: string): string {
  return title.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, "'").toLowerCase().trim();
}
