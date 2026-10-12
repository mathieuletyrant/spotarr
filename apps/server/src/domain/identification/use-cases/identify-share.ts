import type { Seerr } from "../../../integrations/seerr/client";
import type { Tmdb } from "../../../integrations/tmdb/client";
import { isNoVideoError } from "../../../integrations/ytdlp/ytdlp";
import { step } from "../../../log";
import type { Candidate, Clues, IdentificationResult, ShareInput } from "../../shares/types";
import { confirmOnTmdb } from "../confirm-on-tmdb";
import { type DirectId, findDirectIds } from "../extractors/direct-ids";
import type { Photo } from "../extractors/photo";
import type { Video } from "../extractors/video";
import { guessTitles, type Llm } from "../guess-titles";

export type IdentifyDeps = {
  tmdb: Tmdb;
  seerr: Seerr;
  readVideo: (url: string) => Promise<Video>;
  readPhoto: (url: string) => Promise<Photo>;
  llm: Llm;
};

// An IMDb/TMDB link is enough. Otherwise the shared video (or photo post) is
// read, the LLM names the works it shows, and TMDB confirms them. Each step
// logs one line with the Share's id.
export async function identifyShare(
  shareId: string,
  input: ShareInput,
  { tmdb, seerr, readVideo, readPhoto, llm }: IdentifyDeps,
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
    const candidates = await checkLibrary(shareId, found, seerr);
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
  if (!input.url) {
    return { status: "NO_MATCH", extractors: [], clues: {}, candidates: [] };
  }
  const read = await readLink(shareId, input.url, readVideo, readPhoto);
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
  const candidates = await checkLibrary(shareId, confirmed, seerr);
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

// What a shared link gave: the images (and sound) for the LLM, and the frames
// kept to show on the Share's page, a photo post having none.
type ReadLink = {
  extractor: "video" | "instagram-photo";
  caption?: string;
  author?: string;
  images: Uint8Array[];
  audio?: Uint8Array;
  frames?: { atMs: number; thumbnail: Uint8Array }[];
};

// Reads the link as a video. yt-dlp only reads videos: when it says the post
// has none, it is an Instagram photo post, read from its page instead.
async function readLink(
  shareId: string,
  url: string,
  readVideo: IdentifyDeps["readVideo"],
  readPhoto: IdentifyDeps["readPhoto"],
): Promise<ReadLink> {
  try {
    const video = await step(
      shareId,
      "video",
      () => readVideo(url),
      (read) => ({ frames: read.frames.length, audio: read.audio !== undefined }),
    );
    return {
      extractor: "video",
      caption: video.caption,
      author: video.author,
      images: video.frames.map((frame) => frame.jpeg),
      audio: video.audio,
      // Kept to show on the Share's page; the full frames only served the LLM.
      frames: video.frames.map(({ atMs, thumbnail }) => ({ atMs, thumbnail })),
    };
  } catch (error) {
    if (!isNoVideoError(error)) throw error;
  }

  const photo = await step(shareId, "photo", () => readPhoto(url));
  return {
    extractor: "instagram-photo",
    caption: photo.caption,
    author: photo.author,
    images: [photo.picture],
  };
}

// Asks Seerr whether each Candidate is already in the library. Seerr being down
// or not configured does not fail the Identification: Candidates stay ABSENT.
async function checkLibrary(
  shareId: string,
  candidates: Candidate[],
  seerr: Seerr,
): Promise<Candidate[]> {
  try {
    await step(shareId, "library-check", async () => {
      for (const candidate of candidates) {
        candidate.libraryState = await seerr.libraryState(candidate.type, candidate.tmdbId);
      }
    });
  } catch {
    // Already logged by step().
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
