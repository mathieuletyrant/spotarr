import { newToken } from "../new-token";
import type { SettingsRepository } from "../repository";

// Creates the MCP token on first start, so the Settings page has one to show.
// Never printed: unlike the API token, it is not needed to sign in.
export async function ensureMcpToken(settings: SettingsRepository): Promise<void> {
  const { mcpToken } = (await settings.get()).access;
  if (!mcpToken) await settings.setMcpToken(newToken());
}
