import { createQueryOptions } from "@connectrpc/connect-query";
import { SpotarrService } from "@spotarr/contract";
import { queryOptions } from "@tanstack/react-query";
import { transport } from "../lib/api";

export function settingsQuery() {
  return queryOptions(createQueryOptions(SpotarrService.method.getSettings, {}, { transport }));
}

// Calls every Dependency, which takes a second or two and pings the LLM: checked
// when the page opens and on demand, never when the window gets the focus back.
export function dependenciesQuery() {
  return queryOptions({
    ...createQueryOptions(SpotarrService.method.checkDependencies, {}, { transport }),
    refetchOnWindowFocus: false,
  });
}

export function webhooksQuery() {
  return queryOptions(createQueryOptions(SpotarrService.method.listWebhooks, {}, { transport }));
}
