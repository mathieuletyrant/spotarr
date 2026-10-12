// Finds IMDb and TMDB title links in any text: a shared URL, a pasted text,
// later the links of a web page. Pure regex: no network, no LLM.

export type DirectId =
  | { source: "imdb"; id: string }
  | { source: "tmdb"; type: "MOVIE" | "TV"; id: number };

// imdb.com/title/tt0816692, m.imdb.com/fr/title/tt0816692/?ref_=…
const IMDB = /imdb\.com\/(?:[a-z-]+\/)?title\/(tt\d{7,})/gi;
// themoviedb.org/movie/693134-dune-part-two, themoviedb.org/tv/95396
const TMDB = /themoviedb\.org\/(movie|tv)\/(\d+)/gi;

// A page linking to many titles is a list, not a title: keep the first few.
const MAX_IDS = 4;

export function findDirectIds(text: string): DirectId[] {
  const found = new Map<string, DirectId>();
  for (const m of text.matchAll(IMDB)) {
    const id = (m[1] as string).toLowerCase();
    found.set(id, { source: "imdb", id });
  }
  for (const m of text.matchAll(TMDB)) {
    const type = m[1]?.toLowerCase() === "tv" ? "TV" : "MOVIE";
    const id = Number(m[2]);
    found.set(`${type}:${id}`, { source: "tmdb", type, id });
  }
  return [...found.values()].slice(0, MAX_IDS);
}
