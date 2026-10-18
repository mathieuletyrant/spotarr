import { createQueryOptions } from "@connectrpc/connect-query";
import { SpotarrService } from "@spotarr/contract";
import { queryOptions } from "@tanstack/react-query";
import { transport } from "../lib/api";

export function settingsQuery() {
  return queryOptions(createQueryOptions(SpotarrService.method.getSettings, {}, { transport }));
}

// Calls every Dependency, which takes a second or two and pings the LLM: checked
// when the app opens, then every 10 minutes and on demand, never when the
// window gets the focus back.
export function dependenciesQuery() {
  return queryOptions({
    ...createQueryOptions(SpotarrService.method.checkDependencies, {}, { transport }),
    refetchOnWindowFocus: false,
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
  });
}

export function rulesQuery() {
  return queryOptions(createQueryOptions(SpotarrService.method.listRules, {}, { transport }));
}

export function webhooksQuery() {
  return queryOptions(createQueryOptions(SpotarrService.method.listWebhooks, {}, { transport }));
}

// TMDB's list of Platforms in the settings' country: it hardly changes.
export function platformsQuery() {
  return queryOptions({
    ...createQueryOptions(SpotarrService.method.listPlatforms, {}, { transport }),
    staleTime: 60 * 60_000,
  });
}
