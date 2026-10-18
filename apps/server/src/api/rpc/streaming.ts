import { MediaType } from "@spotarr/contract";
import type { SettingsRepository } from "../../domain/settings/repository";
import { listPlatforms } from "../../domain/streaming/use-cases/list-platforms";
import { listWatchLinks } from "../../domain/streaming/use-cases/list-watch-links";
import { SpotarrError } from "../../errors";
import type { Rpcs } from "./types";

export function streamingRpcs(
  settings: SettingsRepository,
): Rpcs<"listPlatforms" | "listWatchLinks"> {
  return {
    listPlatforms: () => listPlatforms(settings),

    listWatchLinks: async (req) => {
      const type = mediaTypeOf(req.type);
      return { links: await listWatchLinks(settings, type, req.tmdbId) };
    },
  };
}

function mediaTypeOf(type: MediaType): "MOVIE" | "TV" {
  if (type === MediaType.MOVIE) return "MOVIE";
  if (type === MediaType.TV) return "TV";
  throw new SpotarrError("invalid_input", "type must be MOVIE or TV");
}
