import {
  deleteWatchlistTmdbId,
  getMovieMovieId,
  getTvTvId,
  postRequest,
  postWatchlist,
} from "./gen/seerr";
import type { SeerrConfig } from "./seerr-fetch";

export type LibraryState = "ABSENT" | "REQUESTED" | "PARTIAL" | "AVAILABLE";
type MediaType = "MOVIE" | "TV";

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

  // Puts a title in the watchlist of the user the API key acts as: Seerr's
  // owner. Nothing is requested. Already there (409) is fine.
  async addToWatchlist(type: MediaType, tmdbId: number): Promise<void> {
    await postWatchlist(
      { tmdbId, mediaType: seerrMediaType(type) },
      { seerr: this.config, alsoFine: [409] },
    );
  }

  // Takes a title out of that watchlist. Not there (404) is fine.
  async removeFromWatchlist(type: MediaType, tmdbId: number): Promise<void> {
    await deleteWatchlistTmdbId(
      String(tmdbId),
      { mediaType: seerrMediaType(type) },
      { seerr: this.config, alsoFine: [404] },
    );
  }
}

// Seerr's name for a media type.
function seerrMediaType(type: MediaType): "movie" | "tv" {
  if (type === "MOVIE") return "movie";
  return "tv";
}
