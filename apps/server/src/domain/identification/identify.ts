import type { Tmdb } from "../../integrations/tmdb/client";
import type { Candidate, IdentificationResult, ShareInput } from "../shares/types";
import { type DirectId, findDirectIds } from "./extractors/direct-ids";

// Today: IMDb and TMDB links only. The web page and video extractors (#13, #14),
// the LLM (#16) and the TMDB search (#17) come next, in this function.
export async function identify(input: ShareInput, tmdb: Tmdb): Promise<IdentificationResult> {
  const ids = findDirectIds(`${input.url ?? ""} ${input.text ?? ""}`);
  const candidates: Candidate[] = [];

  for (const id of ids) {
    const title = await lookUp(id, tmdb);
    const alreadyThere = candidates.some(
      (c) => c.tmdbId === title?.tmdbId && c.type === title?.type,
    );
    if (title && !alreadyThere) {
      // A direct ID is certain: no confidence. The library state comes from Seerr (#18).
      candidates.push({ ...title, libraryState: "ABSENT" });
    }
  }

  if (candidates.length === 0) {
    return { status: "NO_MATCH", extractors: [], clues: {}, candidates: [] };
  }
  return { status: "READY", method: "DIRECT_ID", extractors: ["id-link"], clues: {}, candidates };
}

function lookUp(id: DirectId, tmdb: Tmdb) {
  if (id.source === "imdb") return tmdb.findByImdbId(id.id);
  if (id.type === "MOVIE") return tmdb.movie(id.id);
  return tmdb.show(id.id);
}
