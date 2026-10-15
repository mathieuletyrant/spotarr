import { newToken } from "../new-token";
import type { SettingsRepository } from "../repository";

// Creates the Seerr token on first start, so the Settings page has one to show.
// Never printed: it is copied from the Settings page into Seerr.
export async function ensureSeerrToken(settings: SettingsRepository): Promise<void> {
  const { seerrToken } = (await settings.get()).access;
  if (!seerrToken) await settings.setSeerrToken(newToken());
}
