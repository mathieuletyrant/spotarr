import { createQueryOptions } from "@connectrpc/connect-query";
import { SpotarrService } from "@spotarr/contract";
import { queryOptions } from "@tanstack/react-query";
import { transport } from "../lib/api";

// Spotarr's version and, later, the state of each service it depends on (#19).
// Cheap: also used to check that the user is signed in.
export function statusQuery() {
  return queryOptions(createQueryOptions(SpotarrService.method.getStatus, {}, { transport }));
}
