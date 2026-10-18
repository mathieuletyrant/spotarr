import { seerrFrom, tmdbFrom } from "../../settings/adapters";
import type { SettingsRepository } from "../../settings/repository";

type MediaType = "MOVIE" | "TV";

export type WatchLink = { name: string; url: string; logoUrl?: string };

// Where a title can be watched now: the library when the title is there, then
// each chosen Platform that streams it. TMDB links to its own page of where to
// watch, since it gives no link to the Platform itself.
export async function listWatchLinks(
  settings: SettingsRepository,
  type: MediaType,
  tmdbId: number,
): Promise<WatchLink[]> {
  const current = await settings.get();
  const chosen = current.streaming.platformIds;

  const [library, offers] = await Promise.all([
    // Seerr not set up or not answering only costs the library's link.
    seerrFrom(current)
      .libraryLink(type, tmdbId)
      .catch(() => undefined),
    chosen.length > 0 ? tmdbFrom(current).watchOffers(type, tmdbId) : undefined,
  ]);

  const links: WatchLink[] = [];
  if (library) links.push({ name: library.server, url: library.url });
  if (offers?.link) {
    for (const platform of offers.platforms) {
      if (!chosen.includes(platform.id)) continue;
      links.push({ name: platform.name, url: offers.link, logoUrl: platform.logoUrl });
    }
  }
  return links;
}
