import { seerrFrom } from "../../settings/adapters";
import type { SettingsRepository } from "../../settings/repository";
import type { ShareRepository } from "../repository";
import type { Candidate } from "../types";

// Seerr reported a change to a title (requested, approved, declined,
// available…): asks Seerr where the title stands now and writes it on every
// Candidate of that title, in every Share. Asking rather than reading the
// notification keeps one source of truth: libraryState(). A title in no Share
// changes nothing.
export async function updateLibraryState(
  type: Candidate["type"],
  tmdbId: number,
  { shares, settings }: { shares: ShareRepository; settings: SettingsRepository },
): Promise<void> {
  const state = await seerrFrom(await settings.get()).libraryState(type, tmdbId);
  await shares.setLibraryState(type, tmdbId, state);
}
