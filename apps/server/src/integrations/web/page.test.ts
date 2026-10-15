import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { parseWebPage, readWebPage } from "./page";

afterEach(() => mock.restore());

// Recorded on 2026-10-14, trimmed to their meta tags, JSON-LD and a few paragraphs.
const fixture = (name: string) =>
  Bun.file(new URL(`fixtures/${name}.html`, import.meta.url)).text();

const answering = (body: string, init: ResponseInit) =>
  spyOn(globalThis, "fetch").mockImplementation(
    (async () => new Response(body, init)) as unknown as typeof fetch,
  );

test("a Letterboxd film page gives its title, its JSON-LD work and its IMDb and TMDB links", async () => {
  const page = parseWebPage(
    await fixture("letterboxd-film"),
    "https://letterboxd.com/film/dune-part-two/",
  );
  expect(page.title).toBe("Dune: Part Two (2024)");
  expect(page.description).toStartWith("Follow the mythic journey of Paul Atreides");
  expect(page.imageUrls[0]).toStartWith("https://a.ltrbxd.com/resized/");
  expect(page.works).toEqual(['Movie "Dune: Part Two" (2024)']);
  // The id on <body> comes first, as a TMDB link.
  expect(page.links[0]).toBe("https://www.themoviedb.org/movie/693134");
  expect(page.links).toContain("http://www.imdb.com/title/tt15239678/maindetails");
});

test("an AlloCiné film page gives its site and both names of its work", async () => {
  const page = parseWebPage(
    await fixture("allocine-film"),
    "https://www.allocine.fr/film/fichefilm_gen_cfilm=282546.html",
  );
  expect(page.title).toBe("Athéna");
  expect(page.siteName).toBe("AlloCiné");
  expect(page.works).toEqual(['Movie "Athéna" (also "Athena")']);
});

test("an article gives its paragraphs, without the menus", async () => {
  const page = parseWebPage(
    await fixture("ecranlarge-article"),
    "https://www.ecranlarge.com/films/news/enfer-ia-antonio-banderas-conquistador-film-cortes",
  );
  expect(page.title).toBe(
    "Antonio Banderas tourne pour l'IA dans un film sur le conquistador Cortés",
  );
  expect(page.siteName).toBe("Ecran Large");
  expect(page.text).toContain("son scénario de film consacré à une autre figure majeure");
  expect(page.text).not.toContain("Menu");
});

test("a Wikipedia page's IMDb and TMDB links are found among the others", async () => {
  const page = parseWebPage(
    await fixture("wikipedia-film"),
    "https://fr.wikipedia.org/wiki/Dune,_deuxi%C3%A8me_partie",
  );
  expect(page.title).toBe("Dune, deuxième partie — Wikipédia");
  expect(page.links).toContain("https://www.themoviedb.org/movie/693134");
  expect(page.links).toContain("https://www.imdb.com/title/tt15239678/awards/");
});

test("relative addresses are made absolute, and the text is capped", () => {
  const html = `<meta property="og:image" content="/poster.jpg">
<a href="/title/tt0816692/">Interstellar</a>
<p>${"a".repeat(10_000)}</p>`;
  const page = parseWebPage(html, "https://www.imdb.com/fr/");
  expect(page.imageUrls).toEqual(["https://www.imdb.com/poster.jpg"]);
  expect(page.links).toEqual(["https://www.imdb.com/title/tt0816692/"]);
  expect(page.text).toHaveLength(8000);
});

test("the content's pictures follow the share picture; logos, thumbnails and other articles are left out", () => {
  const html = `<meta property="og:image" content="https://cdn.test/share.jpg">
<header><img src="https://cdn.test/header.jpg"></header>
<article>
  <img src="https://cdn.test/share.jpg">
  <img src="/logo.svg">
  <img src="data:image/gif;base64,R0lGOD">
  <img src="https://cdn.test/still.jpg" width="1260" height="708">
  <img src="https://cdn.test/other-article.jpg" width="286" height="161">
  <img src="placeholder.gif" data-src="https://cdn.test/poster.webp">
  <a href="https://cdn.test/full.jpg"><img src="https://cdn.test/full-small.jpg"></a>
  <a href="/news/another-film"><img src="https://cdn.test/another-film.jpg"></a>
</article>`;
  expect(parseWebPage(html, "https://example.org/").imageUrls).toEqual([
    "https://cdn.test/share.jpg",
    "https://cdn.test/still.jpg",
    "https://cdn.test/poster.webp",
    "https://cdn.test/full-small.jpg",
  ]);
});

test("a page gives 6 pictures at most", () => {
  const images = Array.from({ length: 10 }, (_, i) => `<img src="/${i}.jpg">`).join("");
  expect(parseWebPage(`<main>${images}</main>`, "https://example.org/").imageUrls).toHaveLength(6);
});

test("a link to a picture is a page made of that picture", async () => {
  spyOn(globalThis, "fetch").mockImplementation((async () => {
    const res = new Response("jpeg", { headers: { "content-type": "image/jpeg" } });
    Object.defineProperty(res, "url", { value: "https://cdn.test/poster.jpg" });
    return res;
  }) as unknown as typeof fetch);
  expect(await readWebPage("https://cdn.test/poster.jpg")).toEqual({
    imageUrls: ["https://cdn.test/poster.jpg"],
    works: [],
    links: [],
    text: "",
  });
});

test("an unreadable JSON-LD block is skipped", () => {
  const html = `<script type="application/ld+json">{ "@type": "Movie", </script>
<script type="application/ld+json">{"@graph": [{"@type": ["TVSeries"], "name": "Severance", "startDate": "2022-02-18"}]}</script>`;
  expect(parseWebPage(html, "https://example.org/").works).toEqual(['TVSeries "Severance" (2022)']);
});

test("a link to something else than a web page is refused", async () => {
  answering("%PDF", { headers: { "content-type": "application/pdf" } });
  await expect(readWebPage("https://example.org/a.pdf")).rejects.toThrow(
    "the link is not a web page (application/pdf)",
  );
});

test("a site refusing the page names itself and the status", async () => {
  answering("", { status: 403 });
  await expect(readWebPage("https://www.premiere.fr/Cinema")).rejects.toThrow(
    "premiere.fr answered HTTP 403 for the page",
  );
});
