import type { JellyfinItem } from "../../../integrations/jellyfin/client";
import type { Candidate, Share } from "../../shares/types";

type Title = { type: Candidate["type"]; tmdbId: number };

// What the sync does to the Collection, and the counts it reports.
export type CollectionChanges = {
  // Jellyfin item ids.
  add: string[];
  remove: string[];
  // Spotted titles in the Collection once the changes are made.
  titles: number;
  // Spotted titles the user watched: kept out of the Collection.
  watched: number;
  // Spotted titles Jellyfin does not have (yet).
  notInJellyfin: number;
};

// The titles added from a Share: every Addition that did not fail, the
// newest first, each title once. A deleted Share takes its titles with it.
export function spottedTitles(shares: Share[]): Title[] {
  const additions = shares
    .flatMap((share) => share.additions)
    .filter((addition) => addition.status !== "FAILED")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const titles: Title[] = [];
  for (const { type, tmdbId } of additions) {
    if (titles.some((t) => t.type === type && t.tmdbId === tmdbId)) continue;
    titles.push({ type, tmdbId });
  }
  return titles;
}

// What the Collection should hold: the spotted titles Jellyfin has and the
// user has not watched. Anything else in it goes, even if put there by hand:
// Spotarr owns it. `current` is what it holds now.
export function collectionChanges(
  spotted: Title[],
  library: JellyfinItem[],
  current: string[],
): CollectionChanges {
  const wanted: string[] = [];
  let watched = 0;
  let notInJellyfin = 0;

  for (const title of spotted) {
    // A title can be in two libraries (HD and 4K): all its copies count.
    const copies = library.filter((i) => i.type === title.type && i.tmdbId === title.tmdbId);
    if (copies.length === 0) notInJellyfin++;
    else if (copies.some((copy) => copy.played)) watched++;
    else wanted.push(...copies.map((copy) => copy.id));
  }

  return {
    add: wanted.filter((id) => !current.includes(id)),
    remove: current.filter((id) => !wanted.includes(id)),
    titles: spotted.length - watched - notInJellyfin,
    watched,
    notInJellyfin,
  };
}
