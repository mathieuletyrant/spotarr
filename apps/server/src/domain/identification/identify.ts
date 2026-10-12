import type { Tmdb } from "../../integrations/tmdb/client";
import type { Candidate, Clues, IdentificationResult, ShareInput } from "../shares/types";
import { type DirectId, findDirectIds } from "./extractors/direct-ids";
import type { Video } from "./extractors/video";

export type IdentifyDeps = {
  tmdb: Tmdb;
  readVideo: (url: string) => Promise<Video>;
};

// Today: an IMDb/TMDB link, or the shared video's caption and frames.
// The LLM (#16) and the TMDB search (#17) come next, in this function.
export async function identify(
  input: ShareInput,
  { tmdb, readVideo }: IdentifyDeps,
): Promise<IdentificationResult> {
  // 1. The shared link may itself be an IMDb or TMDB page: certain, no LLM.
  const ids = findDirectIds(input.url ?? "");
  if (ids.length > 0) {
    const candidates = await lookUpAll(ids, tmdb);
    if (candidates.length > 0) {
      return {
        status: "READY",
        method: "DIRECT_ID",
        extractors: ["id-link"],
        clues: {},
        candidates,
      };
    }
  }

  // 2. Otherwise it is a video (a reel). If it cannot be read, the Identification fails with the reason.
  if (!input.url) {
    return { status: "NO_MATCH", extractors: [], clues: {}, candidates: [] };
  }
  const video = await readVideo(input.url);
  const clues: Clues = { caption: video.caption, author: video.author };

  // The frames wait for the LLM (#16), which will look at them with the caption.
  return { status: "NO_MATCH", extractors: ["video"], clues, candidates: [] };
}

async function lookUpAll(ids: DirectId[], tmdb: Tmdb): Promise<Candidate[]> {
  const candidates: Candidate[] = [];
  for (const id of ids) {
    const title = await lookUp(id, tmdb);
    // A direct ID is certain: no confidence. The library state comes from Seerr (#18).
    if (title) candidates.push({ ...title, libraryState: "ABSENT" });
  }
  return candidates;
}

function lookUp(id: DirectId, tmdb: Tmdb) {
  if (id.source === "imdb") return tmdb.findByImdbId(id.id);
  if (id.type === "MOVIE") return tmdb.movie(id.id);
  return tmdb.show(id.id);
}
