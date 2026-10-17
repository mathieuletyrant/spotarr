import { SpotarrError } from "../../../errors";
import { log } from "../../../log";
import { jellyfinFrom } from "../../settings/adapters";
import type { SettingsRepository } from "../../settings/repository";
import type { ShareRepository } from "../../shares/repository";
import { collectionChanges, spottedTitles } from "../rules/collection-changes";

type Deps = { shares: ShareRepository; settings: SettingsRepository };

// What a sync did, for the Settings page and the logs.
export type SyncResult = {
  collection: string;
  titles: number;
  added: number;
  removed: number;
  watched: number;
  notInJellyfin: number;
};

// The sync running now, if any: a second caller gets the same one rather than
// racing it (two syncs could create the Collection twice).
let running: Promise<SyncResult> | undefined;

// Brings the Jellyfin Collection in line with the history: in it, the titles
// added from a Share that Jellyfin has and the user has not watched. Creates
// it on the first sync.
export function syncCollection(deps: Deps): Promise<SyncResult> {
  running ??= sync(deps).finally(() => {
    running = undefined;
  });
  return running;
}

// For the timer and the Seerr webhook: nothing when Jellyfin is off, and an
// error is logged, never thrown. `reason` says what started it.
export function syncCollectionInBackground(deps: Deps, reason: string): void {
  deps.settings
    .get()
    .then(async ({ jellyfin }) => {
      if (!jellyfin.url) return;
      log({ step: "jellyfin collection", reason, ...(await syncCollection(deps)) });
    })
    .catch((error) => log({ step: "jellyfin collection", reason, error: String(error) }));
}

async function sync({ shares, settings }: Deps): Promise<SyncResult> {
  const current = await settings.get();
  const { user, collection: name } = current.jellyfin;
  if (!user) {
    throw new SpotarrError("not_configured", "Jellyfin user not configured (Settings → Jellyfin)");
  }

  const jellyfin = jellyfinFrom(current);
  const userId = await jellyfin.userId(user);
  const library = await jellyfin.library(userId);
  const collection = await jellyfin.collection(name, userId);
  const changes = collectionChanges(
    spottedTitles(await shares.all()),
    library,
    collection?.itemIds ?? [],
  );

  const id = collection?.id ?? (await jellyfin.createCollection(name));
  await jellyfin.addToCollection(id, changes.add);
  await jellyfin.removeFromCollection(id, changes.remove);

  return {
    collection: name,
    titles: changes.titles,
    added: changes.add.length,
    removed: changes.remove.length,
    watched: changes.watched,
    notInJellyfin: changes.notInJellyfin,
  };
}
