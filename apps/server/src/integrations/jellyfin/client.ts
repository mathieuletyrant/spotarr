import { SpotarrError } from "../../errors";
import {
  addToCollection,
  createCollection,
  getItems,
  getSystemInfo,
  getUsers,
  removeFromCollection,
} from "./gen/jellyfin";
import type { JellyfinConfig } from "./jellyfin-fetch";

// A movie or a series in Jellyfin, known by its TMDB id.
export type JellyfinItem = {
  id: string;
  type: "MOVIE" | "TV";
  tmdbId: number;
  // Watched by the user: a series once every episode it has is.
  played: boolean;
};

// Calls Jellyfin through the client generated from its OpenAPI spec (gen/).
export class Jellyfin {
  constructor(private readonly config: JellyfinConfig) {}

  // "12.2.0". Needs the API key, so it also proves the key works.
  async version(): Promise<string> {
    const data = ok(await getSystemInfo({ jellyfin: this.config }));
    return data.Version ?? "unknown version";
  }

  // The id of the user named in the settings, whatever its case.
  async userId(name: string): Promise<string> {
    const data = ok(await getUsers(undefined, { jellyfin: this.config }));
    const user = data.find((u) => u.Name?.toLowerCase() === name.trim().toLowerCase());
    if (!user?.Id) {
      throw new SpotarrError("not_configured", `Jellyfin has no user named "${name}"`);
    }
    return user.Id;
  }

  // Every movie and series with a TMDB id, with whether the user watched it.
  // Jellyfin cannot filter on a TMDB id: the whole library is listed once.
  async library(userId: string): Promise<JellyfinItem[]> {
    const data = ok(
      await getItems(
        {
          userId,
          recursive: true,
          includeItemTypes: ["Movie", "Series"],
          hasTmdbId: true,
          fields: ["ProviderIds"],
          enableUserData: true,
          enableImages: false,
        },
        { jellyfin: this.config },
      ),
    );

    const items: JellyfinItem[] = [];
    for (const item of data.Items ?? []) {
      const tmdbId = Number(item.ProviderIds?.Tmdb);
      if (!item.Id || !Number.isInteger(tmdbId) || tmdbId <= 0) continue;
      items.push({
        id: item.Id,
        type: item.Type === "Series" ? "TV" : "MOVIE",
        tmdbId,
        played: item.UserData?.Played ?? false,
      });
    }
    return items;
  }

  // The collection with exactly this name, and the ids of what it holds.
  // Undefined when there is none.
  async collection(
    name: string,
    userId: string,
  ): Promise<{ id: string; itemIds: string[] } | undefined> {
    const options = { jellyfin: this.config };
    const sets = ok(
      await getItems(
        { userId, recursive: true, includeItemTypes: ["BoxSet"], enableImages: false },
        options,
      ),
    );
    const set = sets.Items?.find((item) => item.Name === name);
    if (!set?.Id) return undefined;

    const children = ok(await getItems({ userId, parentId: set.Id, enableImages: false }, options));
    const itemIds = (children.Items ?? []).flatMap((item) => (item.Id ? [item.Id] : []));
    return { id: set.Id, itemIds };
  }

  // Creates an empty collection; returns its id.
  async createCollection(name: string): Promise<string> {
    const data = ok(await createCollection({ name }, { jellyfin: this.config }));
    if (!data.Id) throw new SpotarrError("unavailable", "Jellyfin created no collection");
    return data.Id;
  }

  async addToCollection(collectionId: string, itemIds: string[]): Promise<void> {
    if (itemIds.length === 0) return;
    await addToCollection(collectionId, { ids: itemIds }, { jellyfin: this.config });
  }

  async removeFromCollection(collectionId: string, itemIds: string[]): Promise<void> {
    if (itemIds.length === 0) return;
    await removeFromCollection(collectionId, { ids: itemIds }, { jellyfin: this.config });
  }
}

// The generated types list every answer of the spec (401, 403, 503…), but
// jellyfinFetch throws on any of them: what comes back is the 200 answer.
function ok<Response extends { status: number; data: unknown }>(
  response: Response,
): Extract<Response, { status: 200 }>["data"] {
  return response.data as Extract<Response, { status: 200 }>["data"];
}
