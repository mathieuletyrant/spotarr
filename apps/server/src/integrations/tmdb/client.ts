import { SpotarrError } from "../../errors";
import {
  type FindById200MovieResultsItem,
  findById,
  genreMovieList,
  genreTvList,
  type MovieDetails200,
  movieDetails,
  movieKeywords,
  movieWatchProviders,
  type SearchMovie200ResultsItem,
  type SearchTv200ResultsItem,
  searchMovie,
  searchTv,
  type TvSeriesDetails200,
  tvSeriesDetails,
  tvSeriesKeywords,
  tvSeriesWatchProviders,
  watchProvidersAvailableRegions,
  watchProvidersMovieList,
  watchProviderTvList,
} from "./gen/tmdb";

// What Spotarr needs to know about a TMDB title.
export type TmdbTitle = {
  tmdbId: number;
  type: "MOVIE" | "TV";
  title: string;
  originalTitle?: string;
  year?: number;
  // "2026-12-18": the first release, or first air date. Absent when TMDB has none yet.
  releaseDate?: string;
  posterUrl?: string;
  // TMDB's users' average, out of 10, and how many votes it rests on.
  tmdbRating?: number;
  tmdbVotes?: number;
  // Help choosing between namesakes: "fr", "en"…, and TMDB's popularity score.
  originalLanguage?: string;
  popularity?: number;
  // "Science-Fiction", "Drame", in the language asked. Absent when TMDB's list
  // of genre names could not be read: unknown, not "no genre".
  genres?: string[];
  // The synopsis, in the language asked. Absent when TMDB has none in it.
  overview?: string;
};

// A search result carries genre ids; the details carry the names.
type GenreIds = { genre_ids?: number[] };
type GenreNames = { genres?: { id?: number; name?: string }[] };
type Genres = Map<number, string>;

// A streaming service: TMDB calls it a watch provider.
export type TmdbPlatform = { id: number; name: string; logoUrl?: string };

// A country TMDB knows Platforms in: "FR", "France".
export type TmdbCountry = { code: string; name: string };

// Where a title streams in a country: TMDB's page listing it, and the Platforms.
export type TmdbWatchOffers = { link?: string; platforms: TmdbPlatform[] };

// One country of a title's watch providers. TMDB's spec lists only rent, buy
// and flatrate; its answers also carry free and ads.
type ProviderItem = { provider_id?: number; provider_name?: string; logo_path?: string };
type CountryOffers = {
  link?: string;
  flatrate?: ProviderItem[];
  free?: ProviderItem[];
  ads?: ProviderItem[];
};

const POSTERS = "https://image.tmdb.org/t/p/w500";
const LOGOS = "https://image.tmdb.org/t/p/w92";

export type TmdbConfig = { token: string; language: string };

// Calls TMDB through the client generated from its OpenAPI spec (gen/).
export class Tmdb {
  // TMDB's genre names by id, read once per Tmdb (one per Identification).
  private readonly genreLists = new Map<TmdbTitle["type"], Genres>();

  constructor(private readonly config: TmdbConfig) {}

  async findByImdbId(imdbId: string): Promise<TmdbTitle | undefined> {
    const { language, options } = this.request();
    const res = await findById(imdbId, { external_source: "imdb_id", language }, options).catch(
      unreachable,
    );
    checkStatus(res.status);

    const movie = res.data.movie_results?.[0];
    if (movie) return movieTitle(movie, await this.genres("MOVIE"));

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
    return movieTitle(res.data, undefined);
  }

  async show(id: number): Promise<TmdbTitle | undefined> {
    const { language, options } = this.request();
    const res = await tvSeriesDetails(id, { language }, options).catch(unreachable);
    if (isMissing(res.status)) return undefined;
    checkStatus(res.status);
    return showTitle(res.data, undefined);
  }

  // The movies TMDB finds for a title, the year narrowing the search when given.
  // TMDB orders them by relevance; domain/identification picks the right one.
  async searchMovies(query: string, year?: number): Promise<TmdbTitle[]> {
    const { language, options } = this.request();
    const res = await searchMovie(
      { query, language, primary_release_year: year?.toString() },
      options,
    ).catch(unreachable);
    checkStatus(res.status);
    const genres = await this.genres("MOVIE");
    return (res.data.results ?? [])
      .map((m) => movieTitle(m, genres))
      .filter((t) => t !== undefined);
  }

  // The TV shows TMDB finds for a title, the year of the first episode narrowing the search.
  async searchShows(query: string, year?: number): Promise<TmdbTitle[]> {
    const { language, options } = this.request();
    const res = await searchTv({ query, language, first_air_date_year: year }, options).catch(
      unreachable,
    );
    checkStatus(res.status);
    const genres = await this.genres("TV");
    return (res.data.results ?? []).map((s) => showTitle(s, genres)).filter((t) => t !== undefined);
  }

  // The countries TMDB knows Platforms in, named in the language asked.
  async countries(): Promise<TmdbCountry[]> {
    const { language, options } = this.request();
    const res = await watchProvidersAvailableRegions({ language }, options).catch(unreachable);
    checkStatus(res.status);
    const countries: TmdbCountry[] = [];
    for (const item of res.data.results ?? []) {
      const name = item.native_name || item.english_name;
      if (item.iso_3166_1 && name) countries.push({ code: item.iso_3166_1, name });
    }
    return countries.sort((a, b) => a.name.localeCompare(b.name, language));
  }

  // Every Platform TMDB knows in a country ("FR"), movies and TV shows
  // together, in TMDB's order for that country.
  async platforms(country: string): Promise<TmdbPlatform[]> {
    const { language, options } = this.request();
    const params = { language, watch_region: country };
    const [movies, shows] = await Promise.all([
      watchProvidersMovieList(params, options).catch(unreachable),
      watchProviderTvList(params, options).catch(unreachable),
    ]);
    checkStatus(movies.status);
    checkStatus(shows.status);

    const items = [...(movies.data.results ?? []), ...(shows.data.results ?? [])];
    items.sort((a, b) => (a.display_priority ?? 999) - (b.display_priority ?? 999));
    const platforms = new Map<number, TmdbPlatform>();
    for (const item of items) {
      const platform = platformOf(item);
      if (platform && !platforms.has(platform.id)) platforms.set(platform.id, platform);
    }
    return [...platforms.values()];
  }

  // Where a title streams in a country ("FR"): by subscription, free or with
  // ads. Renting and buying are left out.
  async watchOffers(
    type: TmdbTitle["type"],
    id: number,
    country: string,
  ): Promise<TmdbWatchOffers> {
    const { options } = this.request();
    const res =
      type === "MOVIE"
        ? await movieWatchProviders(id, options).catch(unreachable)
        : await tvSeriesWatchProviders(id, options).catch(unreachable);
    if (isMissing(res.status)) return { platforms: [] };
    checkStatus(res.status);

    // The spec names each country as its own type: read the one asked by its code.
    const results = res.data.results as Record<string, CountryOffers> | undefined;
    const offers = results?.[country];
    if (!offers) return { platforms: [] };
    const items = [...(offers.flatrate ?? []), ...(offers.free ?? []), ...(offers.ads ?? [])];
    const platforms = new Map<number, TmdbPlatform>();
    for (const item of items) {
      const platform = platformOf(item);
      if (platform && !platforms.has(platform.id)) platforms.set(platform.id, platform);
    }
    return { link: offers.link, platforms: [...platforms.values()] };
  }

  // The keywords TMDB's users tagged a title with: "detective", "based on novel
  // or book". TMDB has them in English only, whatever the language asked.
  async keywords(type: TmdbTitle["type"], id: number): Promise<string[]> {
    const { options } = this.request();
    let items: { name?: string }[] | undefined;
    if (type === "MOVIE") {
      const res = await movieKeywords(String(id), options).catch(unreachable);
      if (isMissing(res.status)) return [];
      checkStatus(res.status);
      items = res.data.keywords;
    } else {
      const res = await tvSeriesKeywords(id, options).catch(unreachable);
      if (isMissing(res.status)) return [];
      checkStatus(res.status);
      // TMDB names the list `keywords` for a movie, `results` for a show.
      items = res.data.results;
    }
    return (items ?? []).map((k) => k.name).filter((name) => name !== undefined);
  }

  // TMDB's names of the movie or TV genres, by id, in the language asked. A
  // failure only costs the genres: undefined, and asked again next time.
  private async genres(type: TmdbTitle["type"]): Promise<Genres | undefined> {
    const known = this.genreLists.get(type);
    if (known) return known;
    const { language, options } = this.request();
    try {
      const res =
        type === "MOVIE"
          ? await genreMovieList({ language }, options)
          : await genreTvList({ language }, options);
      if (res.status !== 200) return undefined;
      const genres: Genres = new Map();
      for (const genre of res.data.genres ?? []) {
        if (genre.id && genre.name) genres.set(genre.id, genre.name);
      }
      this.genreLists.set(type, genres);
      return genres;
    } catch {
      return undefined;
    }
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
  if (status === 401) throw new SpotarrError("unavailable", "TMDB refused the token (401)");
  if (status !== 200) throw new SpotarrError("unavailable", `TMDB answered ${status}`);
}

// fetch itself failed: no network, or the 10 s timeout ran out.
function unreachable(error: unknown): never {
  if (error instanceof Error && error.name === "TimeoutError") {
    throw new SpotarrError("timeout", "TMDB took more than 10 s");
  }
  throw new SpotarrError("unavailable", `TMDB could not be reached: ${String(error)}`);
}

// `genres` names the ids of a search result; details name their genres themselves.
function movieTitle(
  movie: FindById200MovieResultsItem | MovieDetails200 | SearchMovie200ResultsItem,
  genres: Genres | undefined,
): TmdbTitle | undefined {
  if (!movie.id || !movie.title) return undefined;
  return {
    tmdbId: movie.id,
    type: "MOVIE",
    title: movie.title,
    originalTitle: movie.original_title,
    year: yearOf(movie.release_date),
    releaseDate: dateOf(movie.release_date),
    posterUrl: movie.poster_path ? POSTERS + movie.poster_path : undefined,
    ...ratingOf(movie.vote_average, movie.vote_count),
    originalLanguage: movie.original_language,
    popularity: movie.popularity,
    genres: genresOf(movie, genres),
    overview: textOf(movie.overview),
  };
}

function showTitle(
  show: TvSeriesDetails200 | SearchTv200ResultsItem,
  genres: Genres | undefined,
): TmdbTitle | undefined {
  if (!show.id || !show.name) return undefined;
  return {
    tmdbId: show.id,
    type: "TV",
    title: show.name,
    originalTitle: show.original_name,
    year: yearOf(show.first_air_date),
    releaseDate: dateOf(show.first_air_date),
    posterUrl: show.poster_path ? POSTERS + show.poster_path : undefined,
    ...ratingOf(show.vote_average, show.vote_count),
    originalLanguage: show.original_language,
    popularity: show.popularity,
    genres: genresOf(show, genres),
    overview: textOf(show.overview),
  };
}

function genresOf(title: GenreIds | GenreNames, genres: Genres | undefined): string[] | undefined {
  if ("genres" in title && title.genres) {
    return title.genres.map((g) => g.name).filter((name) => name !== undefined);
  }
  if (!("genre_ids" in title) || !title.genre_ids || !genres) return undefined;
  return title.genre_ids.map((id) => genres.get(id)).filter((name) => name !== undefined);
}

// TMDB sends 0 for a title nobody rated: that is no rating, not a bad one.
function ratingOf(average?: number, votes?: number) {
  if (!average || !votes) return {};
  return { tmdbRating: average, tmdbVotes: votes };
}

function platformOf(item: ProviderItem): TmdbPlatform | undefined {
  if (!item.provider_id || !item.provider_name) return undefined;
  return {
    id: item.provider_id,
    name: item.provider_name,
    logoUrl: item.logo_path ? LOGOS + item.logo_path : undefined,
  };
}

// TMDB sends "" when it has no overview in the language asked.
function textOf(text?: string): string | undefined {
  return text ? text : undefined;
}

// TMDB sends "" when the date is unknown.
function dateOf(date?: string): string | undefined {
  return date ? date : undefined;
}

// "2024-02-27" → 2024. TMDB sends "" when the date is unknown.
function yearOf(date?: string): number | undefined {
  const year = Number(date?.slice(0, 4));
  return year > 0 ? year : undefined;
}
