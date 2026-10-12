import { expect, test } from "bun:test";
import { parseWebPage } from "./web-page";

const fixture = (name: string) => Bun.file(new URL(`fixtures/${name}`, import.meta.url)).text();

test("a Letterboxd page gives its TMDB id, title, description and image", async () => {
  const page = parseWebPage(await fixture("letterboxd-dune-part-two.html"));

  expect(page.directIds).toEqual([{ source: "tmdb", type: "MOVIE", id: 693134 }]);
  expect(page.title).toBe("Dune: Part Two (2024)");
  expect(page.description).toStartWith("Follow the mythic journey of Paul Atreides");
  expect(page.imageUrl).toStartWith("https://a.ltrbxd.com/");
  expect(page.work).toEqual({ name: "Dune: Part Two", originalName: undefined });
});

test("an AlloCiné page gives its title and the original title, but no direct id", async () => {
  const page = parseWebPage(await fixture("allocine-natural-light.html"));

  expect(page.directIds).toEqual([]);
  expect(page.title).toBe("Natural Light");
  expect(page.description).toStartWith("1943, l’Union Soviétique est sous occupation allemande");
  expect(page.work).toEqual({ name: "Natural Light", originalName: "Természetes fény" });
});

test("the text keeps the article and drops scripts and menus, 8 000 characters at most", () => {
  const long = "word ".repeat(3000);
  const page = parseWebPage(
    `<html><body><nav>Menu</nav><article><h1>Review</h1><p>${long}</p></article><script>x()</script></body></html>`,
  );
  expect(page.text).toStartWith("Review word word");
  expect(page.text).not.toContain("Menu");
  expect(page.text.length).toBe(8000);
});

test("links to IMDb in an article are found", () => {
  const page = parseWebPage(
    '<html><body><p>See <a href="https://www.imdb.com/title/tt0816692/">Interstellar</a>.</p></body></html>',
  );
  expect(page.directIds).toEqual([{ source: "imdb", id: "tt0816692" }]);
});

test("a page without metadata still gives its text", () => {
  const page = parseWebPage(
    "<html><head><title>Blog</title></head><body>Le film avec Cillian Murphy</body></html>",
  );
  expect(page).toMatchObject({ title: "Blog", text: "Le film avec Cillian Murphy", directIds: [] });
});
