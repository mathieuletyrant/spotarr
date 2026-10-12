import type { SettingsRepository } from "../repository";

// Returns the API token, creating it on first start. `created` tells the caller
// to print it: the logs are where the user finds it the first time.
export async function ensureApiToken(
  settings: SettingsRepository,
): Promise<{ token: string; created: boolean }> {
  const { apiToken } = (await settings.get()).access;
  if (apiToken) return { token: apiToken, created: false };
  const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
  await settings.setApiToken(token);
  return { token, created: true };
}
