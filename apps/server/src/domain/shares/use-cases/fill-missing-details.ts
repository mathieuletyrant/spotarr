import type { Tmdb, TmdbTitle } from "../../../integrations/tmdb/client";
import type { ShareRepository } from "../repository";
import type { Candidate } from "../types";

// Shares identified before Spotarr kept a detail get it from TMDB's details:
// genres, rating and votes, release date, overview, and keywords from their
// own call. A title without a rating
// or an overview, or not out yet, is asked again too: it gets them once out.
// Run at start, in the background. A Candidate TMDB fails for stays as it
// was, and is tried again at the next start. `today` is "2026-10-14".
// Returns how many Candidates were updated.
export async function fillMissingDetails(
  shares: ShareRepository,
  tmdb: Tmdb,
  today: string,
): Promise<number> {
  let filled = 0;
  for (const share of await shares.all()) {
    if (!share.candidates.some((c) => needsDetails(c, today) || c.keywords === undefined)) {
      continue;
    }

    const candidates: Candidate[] = [];
    let changed = false;
    for (const candidate of share.candidates) {
      const updated = await withWhatTmdbAdds(candidate, tmdb, today);
      // TMDB down, or nothing new (a title still without a date): nothing to write.
      if (JSON.stringify(updated) !== JSON.stringify(candidate)) {
        filled++;
        changed = true;
      }
      candidates.push(updated);
    }
    if (changed) await shares.setCandidates(share.id, candidates);
  }
  return filled;
}

// No genres or no release date: identified before they were kept. No rating,
// no overview, or not out yet: TMDB may know more now. A title nobody rates,
// or with no overview in the settings' language, is asked at every start;
// there are few.
function needsDetails(candidate: Candidate, today: string): boolean {
  if (candidate.genres === undefined) return true;
  if (candidate.releaseDate === undefined) return true;
  if (candidate.tmdbRating === undefined) return true;
  if (candidate.overview === undefined) return true;
  return candidate.releaseDate > today;
}

// The Candidate with the details and keywords it misses, those TMDB gave.
async function withWhatTmdbAdds(
  candidate: Candidate,
  tmdb: Tmdb,
  today: string,
): Promise<Candidate> {
  let updated = candidate;
  if (needsDetails(candidate, today)) {
    const title = await detailsOf(candidate, tmdb);
    if (title) updated = withDetails(updated, title);
  }
  if (candidate.keywords === undefined) {
    const keywords = await tmdb.keywords(candidate.type, candidate.tmdbId).catch(() => undefined);
    if (keywords) updated = { ...updated, keywords };
  }
  return updated;
}

// TMDB's latest word on the title; the rest of the Candidate is kept.
function withDetails(candidate: Candidate, title: TmdbTitle): Candidate {
  return {
    ...candidate,
    genres: title.genres ?? candidate.genres,
    releaseDate: title.releaseDate,
    tmdbRating: title.tmdbRating,
    tmdbVotes: title.tmdbVotes,
    overview: title.overview,
  };
}

// The title as TMDB's details give it; undefined when TMDB fails.
async function detailsOf(candidate: Candidate, tmdb: Tmdb): Promise<TmdbTitle | undefined> {
  try {
    if (candidate.type === "MOVIE") return await tmdb.movie(candidate.tmdbId);
    return await tmdb.show(candidate.tmdbId);
  } catch {
    return undefined;
  }
}
