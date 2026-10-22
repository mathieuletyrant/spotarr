import { SpotarrError } from "../../../errors";
import { log } from "../../../log";
import { seerrFrom } from "../../settings/adapters";
import type { SettingsRepository } from "../../settings/repository";
import type { ShareRepository } from "../../shares/repository";
import type { Candidate } from "../../shares/types";
import { addToSnug } from "../../snug/use-cases/add-to-snug";

// A click on "Add to Seerr's watchlist": the Candidate goes to Seerr's
// watchlist, without being requested. Unlike auto add, Seerr failing fails
// the click, so the UI can say why. Spotarr keeps no trace of it.
export async function watchCandidate(
  shareId: string,
  tmdbId: number,
  type: Candidate["type"] | undefined,
  { shares, settings }: { shares: ShareRepository; settings: SettingsRepository },
): Promise<void> {
  if (!type) throw new SpotarrError("invalid_input", "type is required");
  const share = await shares.get(shareId);
  if (!share) throw new SpotarrError("not_found", `no share ${shareId}`);
  const known = share.candidates.some((c) => c.tmdbId === tmdbId && c.type === type);
  if (!known) throw new SpotarrError("not_found", `no candidate ${tmdbId} in share ${shareId}`);

  await seerrFrom(await settings.get()).addToWatchlist(type, tmdbId);
  log({ shareId, step: "watchlist", tmdbId });
  await addToSnug(shareId, { tmdbId, type }, settings);
}
