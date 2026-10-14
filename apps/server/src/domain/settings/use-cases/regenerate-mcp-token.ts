import { newToken } from "../new-token";
import type { SettingsRepository } from "../repository";

// Replaces the MCP token: a client still using the old one is refused from now on.
export async function regenerateMcpToken(settings: SettingsRepository): Promise<string> {
  const token = newToken();
  await settings.setMcpToken(token);
  return token;
}
