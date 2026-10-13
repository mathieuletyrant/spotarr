import type { SettingsRepository } from "../../settings/repository";
import { parseInput } from "../input";
import type { ShareRepository } from "../repository";
import type { ShareInput } from "../types";

// Records a Share, QUEUED: the queue's workers pick it up within a second.
// Returns at once with its id. Invalid input throws a ZodError. The effort of
// the settings is kept with it, so the pages can say how long it may take.
export async function createShare(
  raw: ShareInput,
  shares: ShareRepository,
  settings: SettingsRepository,
): Promise<string> {
  const { input, source } = parseInput(raw);
  const { effort } = (await settings.get()).identification;
  return shares.create(input, source, effort);
}
