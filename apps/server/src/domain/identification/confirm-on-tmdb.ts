import type { Tmdb, TmdbTitle } from "../../integrations/tmdb/client";
import type { Candidate } from "../shares/types";
import type { Guesses } from "./guess-titles";

type Guess = Guesses["candidates"][number];

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

// Searches TMDB with every title the LLM gave, with and without the year, then
// keeps the best of all the results. Taking TMDB's first result is not enough:
// with a wrong year, "Kraken" (2024) finds "Kraken Mare" first.
async function findOnTmdb(guess: Guess, tmdb: Tmdb): Promise<TmdbTitle | undefined> {
  const search = (query: string, year?: number) =>
    guess.type === "movie" ? tmdb.searchMovies(query, year) : tmdb.searchShows(query, year);
  const queries = [...new Set([guess.originalTitle, guess.title].filter((q) => q !== null))];

  const results: TmdbTitle[] = [];
  for (const query of queries) {
    if (guess.year) results.push(...(await search(query, guess.year)));
    results.push(...(await search(query)));
  }
  return bestMatch(results, guess);
}

// The result that looks most like the guess, compared in this order:
// 1. the same title (or original title);
// 2. the same era: a year gap of 2 or less counts as none, since the LLM often
//    misdates recent films ("The Invite" 2024 for a 2026 film); a bigger gap
//    still tells a remake from its original;
// 3. the same original language; 4. the more popular on TMDB.
export function bestMatch(results: TmdbTitle[], guess: Guess): TmdbTitle | undefined {
  const guessedTitles = [guess.title, guess.originalTitle].filter((t) => t !== null).map(normalize);
  const sameTitle = (r: TmdbTitle) =>
    guessedTitles.includes(normalize(r.title)) ||
    guessedTitles.includes(normalize(r.originalTitle ?? ""));
  // An unknown year counts as far away.
  const yearGap = (r: TmdbTitle) => {
    const gap = guess.year && r.year ? Math.abs(guess.year - r.year) : 99;
    return gap <= 2 ? 0 : gap;
  };
  const sameLanguage = (r: TmdbTitle) =>
    guess.originalLanguage !== null && r.originalLanguage === guess.originalLanguage;

  return [...results].sort(
    (a, b) =>
      Number(sameTitle(b)) - Number(sameTitle(a)) ||
      yearGap(a) - yearGap(b) ||
      Number(sameLanguage(b)) - Number(sameLanguage(a)) ||
      (b.popularity ?? 0) - (a.popularity ?? 0),
  )[0];
}

// "L'Invitation" and "l’invitation" are the same title; so are "Amélie" and "Amelie".
function normalize(title: string): string {
  return title.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, "'").toLowerCase().trim();
}
