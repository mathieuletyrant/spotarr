import { getMovieMovieId, getTvTvId, postRequest } from "./gen/seerr";
import type { SeerrConfig } from "./seerr-fetch";

export type LibraryState = "ABSENT" | "REQUESTED" | "PARTIAL" | "AVAILABLE";
type MediaType = "MOVIE" | "TV";

// The title's page on the library's media server: "Jellyfin", "Plex" or "Emby".
export type LibraryLink = { server: string; url: string };

// Fields Seerr's answers carry that its spec leaves out (server/entity/Media.ts).
type MediaLinks = { mediaUrl?: string; ratingKey?: string | null };

// Calls Seerr through the client generated from its OpenAPI spec (gen/).
export class Seerr {
  constructor(private readonly config: SeerrConfig) {}

  // What the library knows of a title. Seerr's statuses: 1 unknown,
  // 2 pending, 3 processing, 4 partially available, 5 available, 6 deleted.
  async libraryState(type: MediaType, tmdbId: number): Promise<LibraryState> {
    const options = { seerr: this.config };
    const { data } =
      type === "MOVIE"
        ? await getMovieMovieId(tmdbId, undefined, options)
        : await getTvTvId(tmdbId, undefined, options);

    const status = data.mediaInfo?.status;
    if (status === 2 || status === 3) return "REQUESTED";
    if (status === 4) return "PARTIAL";
    if (status === 5) return "AVAILABLE";
    return "ABSENT";
  }

  // Where the title can be opened on the media server, when it is in the
  // library. Seerr builds the link from its own media server settings.
  async libraryLink(type: MediaType, tmdbId: number): Promise<LibraryLink | undefined> {
    const options = { seerr: this.config };
    const { data } =
      type === "MOVIE"
        ? await getMovieMovieId(tmdbId, undefined, options)
        : await getTvTvId(tmdbId, undefined, options);

    const media = data.mediaInfo as MediaLinks | undefined;
    if (!media?.mediaUrl) return undefined;
    return { server: serverOf(media), url: media.mediaUrl };
  }

  // Asks Seerr to add a title. A TV show gets its first season only.
  // Seerr picks the quality profile and the folder; with an admin key, the
  // request is approved at once and sent on to Radarr or Sonarr.
  async request(type: MediaType, tmdbId: number): Promise<void> {
    const body =
      type === "MOVIE"
        ? { mediaType: "movie" as const, mediaId: tmdbId }
        : { mediaType: "tv" as const, mediaId: tmdbId, seasons: [1] };
    await postRequest(body, {
      seerr: this.config,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// Plex titles have a rating key. Jellyfin and Emby share Seerr's fields, but
// Emby's page is "item" where Jellyfin's is "details".
function serverOf(media: MediaLinks): string {
  if (media.ratingKey) return "Plex";
  if (media.mediaUrl?.includes("#!/item?")) return "Emby";
  return "Jellyfin";
}
