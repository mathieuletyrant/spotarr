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
      // The library state comes from Seerr (#18).
      candidates.push({ ...title, confidence: guess.confidence, libraryState: "ABSENT" });
    }
  }

  candidates.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
  return candidates.slice(0, MAX_CANDIDATES);
}

// The original title with the year first, then the title with the year, then the title alone.
async function findOnTmdb(guess: Guess, tmdb: Tmdb): Promise<TmdbTitle | undefined> {
  const search = (query: string, year?: number) =>
    guess.type === "movie" ? tmdb.searchMovie(query, year) : tmdb.searchShow(query, year);
  const year = guess.year ?? undefined;

  if (guess.originalTitle && year) {
    const found = await search(guess.originalTitle, year);
    if (found) return found;
  }
  if (year) {
    const found = await search(guess.title, year);
    if (found) return found;
  }
  return search(guess.title);
}
