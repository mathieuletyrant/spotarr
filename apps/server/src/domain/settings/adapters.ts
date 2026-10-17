import { Jellyfin } from "../../integrations/jellyfin/client";
import type { LlmConfig } from "../../integrations/llm/client";
import { Seerr } from "../../integrations/seerr/client";
import { Tmdb } from "../../integrations/tmdb/client";
import type { Settings } from "./schema";

// The one place that turns the Settings into what each integration takes:
// integrations get plain config, never the Settings.

export function tmdbFrom({ identification }: Settings): Tmdb {
  return new Tmdb({ token: identification.tmdbToken, language: identification.language });
}

export function seerrFrom({ seerr }: Settings): Seerr {
  return new Seerr({ url: seerr.url, apiKey: seerr.apiKey });
}

export function jellyfinFrom({ jellyfin }: Settings): Jellyfin {
  return new Jellyfin({ url: jellyfin.url, apiKey: jellyfin.apiKey });
}

export function llmConfigFrom({ identification }: Settings): LlmConfig {
  return {
    apiUrl: identification.llmApiUrl,
    apiKey: identification.llmApiKey,
    model: identification.model,
    effort: identification.effort,
  };
}

// The country whose streaming catalogues count: the one chosen, else the TMDB
// language's ("fr-FR" → "FR").
export function countryFrom({ streaming, identification }: Settings): string {
  return streaming.country || identification.language.slice(3);
}
