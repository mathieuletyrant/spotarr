import { seerrFrom } from "../../settings/adapters";
import type { SettingsRepository } from "../../settings/repository";
import type { Candidate } from "../../shares/types";

// A title now in the library leaves Seerr's watchlist: it can be watched,
// no longer just spotted. Not in the watchlist is fine.
export async function unwatchTitle(
  type: Candidate["type"],
  tmdbId: number,
  settings: SettingsRepository,
): Promise<void> {
  await seerrFrom(await settings.get()).removeFromWatchlist(type, tmdbId);
}
