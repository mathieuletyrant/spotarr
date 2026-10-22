import { log } from "../../../log";
import { seerrFrom } from "../../settings/adapters";
import type { SettingsRepository } from "../../settings/repository";
import type { Candidate } from "../../shares/types";
import { addToSnug } from "../../snug/use-cases/add-to-snug";

// A Rule with the WATCHLIST action holds for a Candidate: it goes to Seerr's
// watchlist, without being requested. Seerr failing is logged and never fails
// the Share: the Candidate can still be added by hand.
export async function watchTitle(
  shareId: string,
  candidate: Candidate,
  rule: string,
  settings: SettingsRepository,
): Promise<void> {
  try {
    await seerrFrom(await settings.get()).addToWatchlist(candidate.type, candidate.tmdbId);
    log({ shareId, step: "watchlist", tmdbId: candidate.tmdbId, rule });
    await addToSnug(shareId, candidate, settings);
  } catch (error) {
    log({ shareId, step: "watchlist", tmdbId: candidate.tmdbId, rule, error: String(error) });
  }
}
