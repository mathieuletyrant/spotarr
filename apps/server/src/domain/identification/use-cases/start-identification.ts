import { chat, type Effort } from "../../../integrations/llm/client";
import { llmConfigFrom, seerrFrom, tmdbFrom } from "../../settings/adapters";
import type { SettingsRepository } from "../../settings/repository";
import type { Settings } from "../../settings/schema";
import type { IdentificationResult, ShareInput } from "../../shares/types";
import { readLink } from "../extractors/link";
import { AnswerSchema } from "../guess-titles";
import { type IdentifyDeps, identifyShare } from "./identify-share";

// Settings are read once per Identification, so a change applies to the next Share.
// `effort`, asked by Retry, replaces the setting's for this Identification.
export async function startIdentification(
  shareId: string,
  input: ShareInput,
  effort: Effort | undefined,
  settings: SettingsRepository,
): Promise<IdentificationResult> {
  const saved = await settings.get();
  const used = effort ?? saved.identification.effort;
  const deps = identificationDeps({
    ...saved,
    identification: { ...saved.identification, effort: used },
  });
  const result = await identifyShare(shareId, input, deps);
  if (result.method !== "LLM") return result;
  return { ...result, effort: used };
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
