import { SpotarrError } from "../../../errors";
import { addToSnugWatchlist } from "../../../integrations/snug/client";
import { log } from "../../../log";
import { snugConfigFrom } from "../../settings/adapters";
import type { SettingsRepository } from "../../settings/repository";
import type { ShareRepository } from "../../shares/repository";
import type { Candidate } from "../../shares/types";

// A TV show of a Share goes on Snug's Watchlist: nothing is requested. Snug
// keeps the status of a series it already tracks. Spotarr keeps no trace of
// it, as with Seerr's watchlist. Throws when Snug is not set, the Candidate is
// a movie, or Snug fails: a click shows why, auto add logs it.
export async function addToSnug(
  shareId: string,
  candidate: Pick<Candidate, "tmdbId" | "type">,
  { shares, settings }: { shares: ShareRepository; settings: SettingsRepository },
): Promise<void> {
  if (candidate.type !== "TV") {
    throw new SpotarrError("invalid_input", "Snug only tracks TV shows");
  }
  const share = await shares.get(shareId);
  if (!share) throw new SpotarrError("not_found", `no share ${shareId}`);
  const known = share.candidates.some((c) => c.tmdbId === candidate.tmdbId && c.type === "TV");
  if (!known) {
    throw new SpotarrError("not_found", `no candidate ${candidate.tmdbId} in share ${shareId}`);
  }
  const config = snugConfigFrom(await settings.get());
  if (!config) {
    throw new SpotarrError("not_configured", "Snug's Watchlist URL is not set (Settings → Snug)");
  }

  const answer = await addToSnugWatchlist(config, candidate.tmdbId);
  log({ shareId, step: "snug", tmdbId: candidate.tmdbId, added: answer.added });
}
