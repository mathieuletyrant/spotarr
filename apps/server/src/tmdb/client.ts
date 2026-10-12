import { z } from "zod";

// What Spotarr needs to know about a TMDB title.
export type TmdbTitle = {
  tmdbId: number;
  type: "MOVIE" | "TV";
  title: string;
  originalTitle?: string;
  year?: number;
  posterUrl?: string;
};

// TMDB names fields differently for movies (title, release_date) and TV
// (name, first_air_date); both shapes are read here and nowhere else.
const Movie = z.object({
  id: z.int(),
  title: z.string(),
  original_title: z.string().optional(),
  release_date: z.string().optional(),
  poster_path: z.string().nullish(),
});
const Tv = z.object({
  id: z.int(),
  name: z.string(),
  original_name: z.string().optional(),
  first_air_date: z.string().optional(),
  poster_path: z.string().nullish(),
});
const FindResult = z.object({ movie_results: z.array(Movie), tv_results: z.array(Tv) });

const API = "https://api.themoviedb.org/3";
const POSTERS = "https://image.tmdb.org/t/p/w500";

export type TmdbOptions = {
  token: string;
  language: string;
  // Injected in tests; the real fetch otherwise.
  fetch?: typeof fetch;
};

export class TmdbClient {
  private readonly fetch: typeof fetch;

  constructor(private readonly options: TmdbOptions) {
    this.fetch = options.fetch ?? globalThis.fetch;
  }

  // An IMDb id (tt…) to its TMDB title, movie or TV. Undefined when TMDB does not know it.
  async findByImdbId(imdbId: string): Promise<TmdbTitle | undefined> {
    const found = FindResult.parse(
      await this.get(`/find/${imdbId}`, { external_source: "imdb_id" }),
    );
    const [movie] = found.movie_results;
    if (movie) return fromMovie(movie);
    const [tv] = found.tv_results;
    return tv ? fromTv(tv) : undefined;
  }

  // Undefined when the id does not exist (404).
  async details(type: "MOVIE" | "TV", id: number): Promise<TmdbTitle | undefined> {
    const body = await this.get(
      `/${type === "MOVIE" ? "movie" : "tv"}/${id}`,
      {},
      { allow404: true },
    );
    if (body === undefined) return undefined;
    return type === "MOVIE" ? fromMovie(Movie.parse(body)) : fromTv(Tv.parse(body));
  }

  private async get(
    path: string,
    params: Record<string, string>,
    { allow404 = false } = {},
  ): Promise<unknown> {
    const url = new URL(API + path);
    for (const [k, v] of Object.entries({ ...params, language: this.options.language })) {
      url.searchParams.set(k, v);
    }
    const res = await this.fetch(url, {
      headers: { Authorization: `Bearer ${this.options.token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (allow404 && res.status === 404) return undefined;
    if (!res.ok) throw new Error(`TMDB answered ${res.status} on ${path}`);
    return res.json();
  }
}

function fromMovie(m: z.infer<typeof Movie>): TmdbTitle {
  return {
    tmdbId: m.id,
    type: "MOVIE",
    title: m.title,
    originalTitle: m.original_title,
    year: yearOf(m.release_date),
    posterUrl: m.poster_path ? POSTERS + m.poster_path : undefined,
  };
}

function fromTv(t: z.infer<typeof Tv>): TmdbTitle {
  return {
    tmdbId: t.id,
    type: "TV",
    title: t.name,
    originalTitle: t.original_name,
    year: yearOf(t.first_air_date),
    posterUrl: t.poster_path ? POSTERS + t.poster_path : undefined,
  };
}

// "2024-02-27" → 2024; TMDB sends "" for unknown dates.
function yearOf(date?: string): number | undefined {
  const year = Number(date?.slice(0, 4));
  return year > 0 ? year : undefined;
}
