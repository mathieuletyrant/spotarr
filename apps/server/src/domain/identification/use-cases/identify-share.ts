import type { Seerr } from "../../../integrations/seerr/client";
import type { Tmdb } from "../../../integrations/tmdb/client";
import type { Candidate, Clues, IdentificationResult, ShareInput } from "../../shares/types";
import { confirmOnTmdb } from "../confirm-on-tmdb";
import { type DirectId, findDirectIds } from "../extractors/direct-ids";
import type { Video } from "../extractors/video";
import { guessTitles, type Llm } from "../guess-titles";

export type IdentifyDeps = {
  tmdb: Tmdb;
  seerr: Seerr;
  readVideo: (url: string) => Promise<Video>;
  llm: Llm;
};

// An IMDb/TMDB link is enough. Otherwise the shared video is read, the LLM
// names the works it shows, and TMDB confirms them.
export async function identifyShare(
  input: ShareInput,
  { tmdb, seerr, readVideo, llm }: IdentifyDeps,
): Promise<IdentificationResult> {
  // 1. The shared link may itself be an IMDb or TMDB page: certain, no LLM.
  const ids = findDirectIds(input.url ?? "");
  if (ids.length > 0) {
    const candidates = await checkLibrary(await lookUpAll(ids, tmdb), seerr);
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

  // 3. The LLM reads the caption, looks at the frames and listens to the sound;
  // TMDB confirms its guesses.
  const { answer, costUsd } = await guessTitles(
    { clues, frames: video.frames.map((frame) => frame.jpeg), audio: video.audio },
    llm,
  );
  const candidates = await checkLibrary(await confirmOnTmdb(answer.guesses, tmdb), seerr);
  return {
    status: candidates.length > 0 ? "READY" : "NO_MATCH",
    method: "LLM",
    extractors: ["video"],
    clues,
    reasoning: answer.reasoning,
    candidates,
    // Kept to show on the Share's page; the full frames only served the LLM.
    frames: video.frames.map(({ atMs, thumbnail }) => ({ atMs, thumbnail })),
    llmCostUsd: costUsd,
  };
}

// Asks Seerr whether each Candidate is already in the library. Seerr being down
// or not configured does not fail the Identification: Candidates stay ABSENT.
async function checkLibrary(candidates: Candidate[], seerr: Seerr): Promise<Candidate[]> {
  try {
    for (const candidate of candidates) {
      candidate.libraryState = await seerr.libraryState(candidate.type, candidate.tmdbId);
    }
  } catch (error) {
    console.error(JSON.stringify({ step: "library-check", error: String(error) }));
  }
  return candidates;
}

async function lookUpAll(ids: DirectId[], tmdb: Tmdb): Promise<Candidate[]> {
  const candidates: Candidate[] = [];
  for (const id of ids) {
    const title = await lookUp(id, tmdb);
    // A direct ID is certain: no confidence.
    if (title) candidates.push({ ...title, libraryState: "ABSENT" });
  }
  return candidates;
}

function lookUp(id: DirectId, tmdb: Tmdb) {
  if (id.source === "imdb") return tmdb.findByImdbId(id.id);
  if (id.type === "MOVIE") return tmdb.movie(id.id);
  return tmdb.show(id.id);
}
