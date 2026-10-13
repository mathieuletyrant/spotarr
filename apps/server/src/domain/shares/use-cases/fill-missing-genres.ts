import type { Tmdb } from "../../../integrations/tmdb/client";
import type { ShareRepository } from "../repository";
import type { Candidate } from "../types";

// Shares identified before genres were kept get them: one TMDB details call per
// Candidate without genres. Run once at start, in the background. A Candidate
// TMDB fails for stays without, and is tried again at the next start.
// Returns how many Candidates got their genres.
export async function fillMissingGenres(shares: ShareRepository, tmdb: Tmdb): Promise<number> {
  let filled = 0;
  for (const share of await shares.all()) {
    if (share.candidates.every((c) => c.genres !== undefined)) continue;

    const candidates: Candidate[] = [];
    let changed = false;
    for (const candidate of share.candidates) {
      const genres = candidate.genres ?? (await genresOf(candidate, tmdb));
      if (candidate.genres === undefined && genres !== undefined) {
        filled++;
        changed = true;
      }
      candidates.push({ ...candidate, genres });
    }
    // Nothing found (TMDB down or not configured): nothing to write.
    if (changed) await shares.setCandidates(share.id, candidates);
  }
  return filled;
}

// The genres TMDB's details give a title; undefined when TMDB fails.
async function genresOf(candidate: Candidate, tmdb: Tmdb): Promise<string[] | undefined> {
  try {
    const title =
      candidate.type === "MOVIE"
        ? await tmdb.movie(candidate.tmdbId)
        : await tmdb.show(candidate.tmdbId);
    return title?.genres;
  } catch {
    return undefined;
  }
}
