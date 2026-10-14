import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { readPage } from "./web-page";

afterEach(() => mock.restore());

const serving = (html: string) =>
  spyOn(globalThis, "fetch").mockImplementation(
    (async () =>
      new Response(html, { headers: { "content-type": "text/html" } })) as unknown as typeof fetch,
  );

test("a film's page gives its direct IDs, and its title and description as the caption", async () => {
  serving(
    await Bun.file(
      new URL("../../../integrations/web/fixtures/letterboxd-film.html", import.meta.url),
    ).text(),
  );
  const page = await readPage("https://letterboxd.com/film/dune-part-two/");
  expect(page.directIds).toEqual([
    { source: "imdb", id: "tt15239678" },
    { source: "tmdb", type: "MOVIE", id: 693134 },
  ]);
  expect(page.caption).toStartWith("Dune: Part Two (2024)\nFollow the mythic journey");
  // No og:site_name on Letterboxd: the host names it.
  expect(page.author).toBe("letterboxd.com");
  expect(page.text).toStartWith('The page describes: Movie "Dune: Part Two" (2024)\n');
});

test("an article without IMDb or TMDB links has none", async () => {
  serving(
    await Bun.file(
      new URL("../../../integrations/web/fixtures/ecranlarge-article.html", import.meta.url),
    ).text(),
  );
  const page = await readPage("https://www.ecranlarge.com/films/news/x");
  expect(page.directIds).toEqual([]);
  expect(page.author).toBe("Ecran Large");
});

test("a page with nothing to read (a login wall) throws", async () => {
  serving(`<title>Instagram</title><p>Log in</p>`);
  await expect(readPage("https://www.instagram.com/reel/x/")).rejects.toThrow(
    "the page shows nothing to read",
  );
});
