import type { Tmdb } from "../../../integrations/tmdb/client";
import { step } from "../../../log";
import type { Candidate, Clues, IdentificationResult, ShareInput } from "../../shares/types";
import { confirmOnTmdb } from "../confirm-on-tmdb";
import { type DirectId, findDirectIds } from "../extractors/direct-ids";
import type { Link } from "../extractors/link";
import { guessTitles, type Llm } from "../guess-titles";

// TMDB stays a class: its tests replay recorded answers. The rest are plain
// functions, so a test hands in what the link, the LLM or the library answer.
export type IdentifyDeps = {
  tmdb: Tmdb;
  readLink: (url: string) => Promise<Link>;
  llm: Llm;
  libraryState: (type: Candidate["type"], tmdbId: number) => Promise<Candidate["libraryState"]>;
};

// An IMDb/TMDB link is enough. Otherwise the shared video (or photo post) is
// read, the LLM names the works it shows, and TMDB confirms them. Each step
// logs one line with the Share's id.
export async function identifyShare(
  shareId: string,
  input: ShareInput,
  { tmdb, readLink, llm, libraryState }: IdentifyDeps,
): Promise<IdentificationResult> {
  // 1. The shared link may itself be an IMDb or TMDB page: certain, no LLM.
  const ids = findDirectIds(input.url ?? "");
  if (ids.length > 0) {
    const found = await step(
      shareId,
      "direct-id",
      () => lookUpAll(ids, tmdb),
      (titles) => ({ candidates: titles.length }),
    );
    const candidates = await checkLibrary(shareId, found, libraryState);
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

  // 2. Otherwise it is a video (a reel), or an Instagram photo post. If it
  // cannot be read, the Identification fails with the reason.
  const url = input.url;
  if (!url) {
    return { status: "NO_MATCH", extractors: [], clues: {}, candidates: [] };
  }
  const read = await step(
    shareId,
    "read",
    () => readLink(url),
    (link) => ({ extractor: link.extractor, images: link.images.length, audio: !!link.audio }),
  );
  const clues: Clues = { caption: read.caption, author: read.author };

  // 3. The LLM reads the caption, looks at the images and listens to the sound;
  // TMDB confirms its guesses.
  const { answer, costUsd } = await step(
    shareId,
    "llm",
    () => guessTitles({ clues, images: read.images, audio: read.audio }, llm),
    (reply) => ({ guesses: reply.answer.guesses.length, costUsd: reply.costUsd }),
  );
  const confirmed = await step(
    shareId,
    "tmdb",
    () => confirmOnTmdb(answer.guesses, tmdb),
    (titles) => ({ candidates: titles.length }),
  );
  const candidates = await checkLibrary(shareId, confirmed, libraryState);
  return {
    status: candidates.length > 0 ? "READY" : "NO_MATCH",
    method: "LLM",
    extractors: [read.extractor],
    clues,
    reasoning: answer.reasoning,
    candidates,
    frames: read.frames,
    llmCostUsd: costUsd,
  };
}

// Asks Seerr whether each Candidate is already in the library. Seerr being down
// or not configured does not fail the Identification: Candidates stay ABSENT.
async function checkLibrary(
  shareId: string,
  candidates: Candidate[],
  libraryState: IdentifyDeps["libraryState"],
): Promise<Candidate[]> {
  try {
    return await step(shareId, "library-check", async () => {
      const checked: Candidate[] = [];
      for (const candidate of candidates) {
        checked.push({
          ...candidate,
          libraryState: await libraryState(candidate.type, candidate.tmdbId),
        });
      }
      return checked;
    });
  } catch {
    // Already logged by step().
    return candidates;
  }
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
