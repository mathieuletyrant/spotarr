import { SpotarrError } from "../../errors";
import {
  type FindById200MovieResultsItem,
  findById,
  type MovieDetails200,
  movieDetails,
  type TvSeriesDetails200,
  tvSeriesDetails,
} from "./gen/tmdb";

// What Spotarr needs to know about a TMDB title.
export type TmdbTitle = {
  tmdbId: number;
  type: "MOVIE" | "TV";
  title: string;
  originalTitle?: string;
  year?: number;
  posterUrl?: string;
};

const POSTERS = "https://image.tmdb.org/t/p/w500";

export type TmdbConfig = { token: string; language: string };

// Calls TMDB through the client generated from its OpenAPI spec (gen/).
export class Tmdb {
  constructor(private readonly config: TmdbConfig) {}

  async findByImdbId(imdbId: string): Promise<TmdbTitle | undefined> {
    const { language, options } = this.request();
    const res = await findById(imdbId, { external_source: "imdb_id", language }, options).catch(
      unreachable,
    );
    checkStatus(res.status);

    const movie = res.data.movie_results?.[0];
    if (movie) return movieTitle(movie);

    // TMDB's spec leaves tv_results untyped: take the id, then fetch the typed details.
    const show = res.data.tv_results?.[0] as { id?: number } | undefined;
    if (show?.id) return this.show(show.id);

    return undefined;
  }

  async movie(id: number): Promise<TmdbTitle | undefined> {
    const { language, options } = this.request();
    const res = await movieDetails(id, { language }, options).catch(unreachable);
    if (isMissing(res.status)) return undefined;
    checkStatus(res.status);
    return movieTitle(res.data);
  }

  async show(id: number): Promise<TmdbTitle | undefined> {
    const { language, options } = this.request();
    const res = await tvSeriesDetails(id, { language }, options).catch(unreachable);
    if (isMissing(res.status)) return undefined;
    checkStatus(res.status);
    return showTitle(res.data);
  }

  private request() {
    const { token, language } = this.config;
    if (!token) {
      throw new SpotarrError(
        "not_configured",
        "TMDB token not configured (Settings → Identification)",
      );
    }
    const options = {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    };
    return { language, options };
  }
}

// TMDB's spec only describes the 200 answer, so the status is checked by hand.
function isMissing(status: number) {
  return status === 404;
}

function checkStatus(status: number) {
  if (status !== 200) throw new SpotarrError("unavailable", `TMDB answered ${status}`);
}

// fetch itself failed: no network, or the 10 s timeout ran out.
function unreachable(error: unknown): never {
  if (error instanceof Error && error.name === "TimeoutError") {
    throw new SpotarrError("timeout", "TMDB took more than 10 s");
  }
  throw new SpotarrError("unavailable", `TMDB could not be reached: ${String(error)}`);
}

function movieTitle(movie: FindById200MovieResultsItem | MovieDetails200): TmdbTitle | undefined {
  if (!movie.id || !movie.title) return undefined;
  return {
    tmdbId: movie.id,
    type: "MOVIE",
    title: movie.title,
    originalTitle: movie.original_title,
    year: yearOf(movie.release_date),
    posterUrl: movie.poster_path ? POSTERS + movie.poster_path : undefined,
  };
}

function showTitle(show: TvSeriesDetails200): TmdbTitle | undefined {
  if (!show.id || !show.name) return undefined;
  return {
    tmdbId: show.id,
    type: "TV",
    title: show.name,
    originalTitle: show.original_name,
    year: yearOf(show.first_air_date),
    posterUrl: show.poster_path ? POSTERS + show.poster_path : undefined,
  };
}

// "2024-02-27" → 2024. TMDB sends "" when the date is unknown.
function yearOf(date?: string): number | undefined {
  const year = Number(date?.slice(0, 4));
  return year > 0 ? year : undefined;
}
