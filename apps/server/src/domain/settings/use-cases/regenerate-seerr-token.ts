import { newToken } from "../new-token";
import type { SettingsRepository } from "../repository";

// Replaces the Seerr token: Seerr is refused until it gets the new one.
export async function regenerateSeerrToken(settings: SettingsRepository): Promise<string> {
  const token = newToken();
  await settings.setSeerrToken(token);
  return token;
}
