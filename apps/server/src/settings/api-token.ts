import type { SettingsRepository } from "./repository";

const KEY = "api_token";

// Returns the API token, creating it on first start. `created` tells the caller
// to print it: the logs are where the user finds it the first time.
export async function ensureApiToken(
  settings: SettingsRepository,
): Promise<{ token: string; created: boolean }> {
  const existing = await settings.get(KEY);
  if (existing) return { token: existing, created: false };
  const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
  await settings.set(KEY, token);
  return { token, created: true };
}
