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

// An IMDb/TMDB link is enough. Otherwise the shared link is read (a video, a
// photo post, a web page), the LLM names the works it shows, and TMDB confirms
// them. Each step logs one line with the Share's id. `hint`, given with a
// Retry, goes to the LLM.
export async function identifyShare(
  shareId: string,
  input: ShareInput,
  { tmdb, readLink, llm, libraryState }: IdentifyDeps,
  hint?: string,
): Promise<IdentificationResult> {
  // 1. The shared link, or a link in the shared text, may be an IMDb or TMDB
  // page: certain, no LLM.
  const ids = findDirectIds(`${input.url ?? ""}\n${input.text ?? ""}`);
  if (ids.length > 0) {
    const candidates = await identifyByIds(shareId, ids, tmdb, libraryState);
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

  // 2. Otherwise the link is read: a video, an Instagram photo post or any web page.
  // If it cannot be read, the Identification fails with the reason.
  const url = input.url;
  if (!url) {
    return { status: "NO_MATCH", extractors: [], clues: {}, candidates: [] };
  }
  const read = await step(
    shareId,
    "read",
    () => readLink(url),
    (link) => ({
      extractor: link.extractor,
      images: link.images.length,
      audio: !!link.audio,
      directIds: link.directIds?.length ?? 0,
    }),
  );
  const clues: Clues = { caption: read.caption, author: read.author };

  // 3. A web page linking to IMDb or TMDB (Letterboxd, Wikipedia) names its work:
  // certain, no LLM.
  if (read.directIds && read.directIds.length > 0) {
    const candidates = await identifyByIds(shareId, read.directIds, tmdb, libraryState);
    if (candidates.length > 0) {
      return {
        status: "READY",
        method: "DIRECT_ID",
        extractors: [read.extractor],
        clues,
        candidates,
      };
    }
  }

  // 4. The LLM reads the caption (and a page's text), looks at the images and
  // listens to the sound; TMDB confirms its guesses.
  const { answer, costUsd } = await step(
    shareId,
    "llm",
    () =>
      guessTitles({ clues, hint, text: read.text, images: read.images, audio: read.audio }, llm),
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

async function identifyByIds(
  shareId: string,
  ids: DirectId[],
  tmdb: Tmdb,
  libraryState: IdentifyDeps["libraryState"],
): Promise<Candidate[]> {
  const found = await step(
    shareId,
    "direct-id",
    () => lookUpAll(ids, tmdb),
    (titles) => ({ candidates: titles.length }),
  );
  return checkLibrary(shareId, found, libraryState);
}

async function lookUpAll(ids: DirectId[], tmdb: Tmdb): Promise<Candidate[]> {
  const candidates: Candidate[] = [];
  for (const id of ids) {
    const title = await lookUp(id, tmdb);
    // The IMDb and TMDB links of one work (a Wikipedia page has both) give it once.
    const seen = candidates.some((c) => c.type === title?.type && c.tmdbId === title?.tmdbId);
    // A direct ID is certain: no confidence.
    if (title && !seen) candidates.push({ ...title, libraryState: "ABSENT" });
  }
  return candidates;
}

function lookUp(id: DirectId, tmdb: Tmdb) {
  if (id.source === "imdb") return tmdb.findByImdbId(id.id);
  if (id.type === "MOVIE") return tmdb.movie(id.id);
  return tmdb.show(id.id);
}
