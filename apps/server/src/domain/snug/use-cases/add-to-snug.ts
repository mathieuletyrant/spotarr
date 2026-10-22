import { addToSnugWatchlist } from "../../../integrations/snug/client";
import { log } from "../../../log";
import { snugConfigFrom } from "../../settings/adapters";
import type { SettingsRepository } from "../../settings/repository";
import type { Candidate } from "../../shares/types";

// A TV show Spotarr adds (requested, already in the library, or put in Seerr's
// watchlist) also goes on Snug's Watchlist, when Snug is set. Snug keeps the
// status of a series it already tracks. Snug failing is logged and never fails
// the addition: Seerr's part stands.
export async function addToSnug(
  shareId: string,
  candidate: Pick<Candidate, "tmdbId" | "type">,
  settings: SettingsRepository,
): Promise<void> {
  if (candidate.type !== "TV") return;
  const config = snugConfigFrom(await settings.get());
  if (!config) return;
  try {
    const answer = await addToSnugWatchlist(config, candidate.tmdbId);
    log({ shareId, step: "snug", tmdbId: candidate.tmdbId, added: answer.added });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log({ shareId, step: "snug", tmdbId: candidate.tmdbId, error: message });
  }
}
