import { findDirectIds } from "../extractors/direct-ids";
import type { Identify } from "../shares/queue";
import type { Candidate, IdentificationResult } from "../shares/types";
import type { TmdbClient } from "../tmdb/client";

const NO_MATCH: IdentificationResult = {
  status: "NO_MATCH",
  extractors: [],
  clues: {},
  candidates: [],
};

// The Identification pipeline. Today: IMDb/TMDB links only. Next steps plug in
// here: web page and video extractors (#13, #14), the LLM (#16), TMDB search (#17).
export function createIdentify(tmdb: () => Promise<TmdbClient>): Identify {
  return async (input) => {
    const ids = findDirectIds([input.url, input.text].filter(Boolean).join("\n"));
    if (ids.length === 0) return NO_MATCH;

    const client = await tmdb();
    const titles = await Promise.all(
      ids.map((id) =>
        id.source === "imdb" ? client.findByImdbId(id.id) : client.details(id.type, id.id),
      ),
    );
    const candidates = uniqueTitles(titles).map(
      // A direct ID is certain: no confidence. Library state comes from Seerr (#18).
      (title): Candidate => ({ ...title, libraryState: "ABSENT" }),
    );
    if (candidates.length === 0) return { ...NO_MATCH, extractors: ["id-link"] };
    return { status: "READY", method: "DIRECT_ID", extractors: ["id-link"], clues: {}, candidates };
  };
}

// An IMDb link and a TMDB link to the same title give one Candidate.
function uniqueTitles<T extends { type: string; tmdbId: number }>(titles: (T | undefined)[]): T[] {
  const byKey = new Map<string, T>();
  for (const title of titles) {
    if (!title) continue;
    const key = `${title.type}:${title.tmdbId}`;
    if (!byKey.has(key)) byKey.set(key, title);
  }
  return [...byKey.values()];
}
