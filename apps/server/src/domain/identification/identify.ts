import type { Tmdb } from "../../integrations/tmdb/client";
import type { Candidate, Clues, IdentificationResult, ShareInput } from "../shares/types";
import { type DirectId, findDirectIds } from "./extractors/direct-ids";
import { readWebPage, type WebPage } from "./extractors/web-page";

// Today: IMDb/TMDB links, then the shared web page. The video extractor (#14),
// the LLM (#16) and the TMDB search (#17) come next, in this function.
export async function identify(input: ShareInput, tmdb: Tmdb): Promise<IdentificationResult> {
  const extractors: string[] = [];
  const clues: Clues = {};

  // 1. The shared URL or text may itself be an IMDb or TMDB link.
  let ids = findDirectIds(`${input.url ?? ""} ${input.text ?? ""}`);
  if (ids.length > 0) extractors.push("id-link");

  // 2. Otherwise, read the shared page: Letterboxd and others name the title for us.
  if (ids.length === 0 && input.url) {
    const page = await tryReadWebPage(input.url);
    if (page) {
      extractors.push("web");
      clues.title = page.title;
      clues.description = page.description;
      ids = page.directIds;
    }
  }

  const candidates = await lookUpAll(ids, tmdb);
  if (candidates.length === 0) {
    return { status: "NO_MATCH", extractors, clues, candidates: [] };
  }
  return { status: "READY", method: "DIRECT_ID", extractors, clues, candidates };
}

// A page that cannot be read is not an error: other extractors may still succeed.
async function tryReadWebPage(url: string): Promise<WebPage | undefined> {
  try {
    return await readWebPage(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ step: "web-page", url, error: message }));
    return undefined;
  }
}

async function lookUpAll(ids: DirectId[], tmdb: Tmdb): Promise<Candidate[]> {
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
  return candidates;
}

function lookUp(id: DirectId, tmdb: Tmdb) {
  if (id.source === "imdb") return tmdb.findByImdbId(id.id);
  if (id.type === "MOVIE") return tmdb.movie(id.id);
  return tmdb.show(id.id);
}
