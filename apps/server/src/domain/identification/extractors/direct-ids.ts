// Finds IMDb and TMDB title links in a text: a shared URL, a pasted text, and
// later the links of a web page. Plain regular expressions: no network, no LLM.

export type DirectId =
  | { source: "imdb"; id: string }
  | { source: "tmdb"; type: "MOVIE" | "TV"; id: number };

// imdb.com/title/tt0816692, m.imdb.com/fr/title/tt0816692/?ref_=…
const IMDB_LINK = /imdb\.com\/(?:[a-z-]+\/)?title\/(tt\d+)/g;
// themoviedb.org/movie/693134-dune-part-two, themoviedb.org/tv/95396
const TMDB_LINK = /themoviedb\.org\/(movie|tv)\/(\d+)/g;

// A page linking to many titles is a list, not a title: keep the first few.
const MAX_IDS = 4;

export function findDirectIds(text: string): DirectId[] {
  const ids: DirectId[] = [];

  for (const [, imdbId = ""] of text.matchAll(IMDB_LINK)) {
    ids.push({ source: "imdb", id: imdbId });
  }
  for (const [, kind, tmdbId] of text.matchAll(TMDB_LINK)) {
    ids.push({ source: "tmdb", type: kind === "tv" ? "TV" : "MOVIE", id: Number(tmdbId) });
  }

  return ids.slice(0, MAX_IDS);
}
