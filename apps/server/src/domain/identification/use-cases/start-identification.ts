import { chat } from "../../../integrations/llm/client";
import { llmConfigFrom, seerrFrom, tmdbFrom } from "../../settings/adapters";
import type { SettingsRepository } from "../../settings/repository";
import type { Settings } from "../../settings/schema";
import type { ShareInput } from "../../shares/types";
import { readLink } from "../extractors/link";
import { AnswerSchema } from "../guess-titles";
import { type IdentifyDeps, identifyShare } from "./identify-share";

// Settings are read once per Identification, so a change applies to the next Share.
export async function startIdentification(
  shareId: string,
  input: ShareInput,
  settings: SettingsRepository,
) {
  return identifyShare(shareId, input, identificationDeps(await settings.get()));
}

// The real link reader, LLM, TMDB and Seerr, as the Settings configure them.
// Also used by the evaluation script, which swaps Seerr out.
export function identificationDeps(settings: Settings): IdentifyDeps {
  const seerr = seerrFrom(settings);
  return {
    tmdb: tmdbFrom(settings),
    readLink: (url) => readLink(url, settings.extraction),
    llm: (messages) => chat(llmConfigFrom(settings), messages, AnswerSchema),
    libraryState: (type, tmdbId) => seerr.libraryState(type, tmdbId),
  };
}
