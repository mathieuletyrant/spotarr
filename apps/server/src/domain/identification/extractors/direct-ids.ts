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

  // The same link twice (in the URL and in the text) is one title.
  const seen = new Set<string>();
  for (const [link, imdbId = ""] of text.matchAll(IMDB_LINK)) {
    if (seen.has(link)) continue;
    seen.add(link);
    ids.push({ source: "imdb", id: imdbId });
  }
  for (const [link, kind, tmdbId] of text.matchAll(TMDB_LINK)) {
    if (seen.has(link)) continue;
    seen.add(link);
    ids.push({ source: "tmdb", type: kind === "tv" ? "TV" : "MOVIE", id: Number(tmdbId) });
  }

  return ids.slice(0, MAX_IDS);
}
