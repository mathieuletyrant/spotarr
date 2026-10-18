import { syncCollection } from "../../domain/collection/use-cases/sync-collection";
import type { SettingsRepository } from "../../domain/settings/repository";
import type { ShareRepository } from "../../domain/shares/repository";
import type { Rpcs } from "./types";

export function collectionRpcs(
  shares: ShareRepository,
  settings: SettingsRepository,
): Rpcs<"syncCollection"> {
  return {
    syncCollection: () => syncCollection({ shares, settings }),
  };
}
