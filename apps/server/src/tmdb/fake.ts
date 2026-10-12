// A fetch that answers TMDB paths from fixtures/, for tests. Records the
// requests so a test can check what was asked, and answers 404 otherwise.
const fixtures: Record<string, string> = {
  "/3/find/tt15239678": "find-tt15239678.json",
  "/3/find/tt11280740": "find-tt11280740.json",
  "/3/find/tt0000001": "find-empty.json",
  "/3/movie/693134": "movie-693134.json",
  "/3/tv/95396": "tv-95396.json",
};

export function fakeTmdbFetch() {
  const requests: URL[] = [];
  const fetch = (async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : input);
    requests.push(url);
    const file = fixtures[url.pathname];
    if (!file) return new Response("{}", { status: 404 });
    return new Response(Bun.file(new URL(`fixtures/${file}`, import.meta.url)));
  }) as typeof globalThis.fetch;
  return { fetch, requests };
}
