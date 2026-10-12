import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { parseInstagramPost, readInstagramPost } from "./post";

afterEach(() => mock.restore());

// Recorded on 2026-10-12 from https://www.instagram.com/p/DeZTyvuF9aF/, trimmed to its meta tags.
const fixture = () => Bun.file(new URL("fixtures/photo-post.html", import.meta.url)).text();

test("a photo post gives its caption, its author and its picture", async () => {
  const post = parseInstagramPost(await fixture());
  expect(post.caption).toBe("NARNIA : LE NEVEU DU MAGICIEN. Bande-annonce demain.");
  expect(post.author).toBe("Netflix France");
  // `&amp;` in the page is a plain `&` in the picture's address.
  expect(post.imageUrl).toStartWith("https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/");
  expect(post.imageUrl).toContain("&_nc_cat=1&");
});

test("a post without a caption still gives its author", () => {
  const html = `<meta property="og:title" content="Netflix France on Instagram" />
<meta property="og:image" content="https://cdn.test/a.jpg" />`;
  expect(parseInstagramPost(html)).toEqual({
    caption: undefined,
    author: "Netflix France",
    imageUrl: "https://cdn.test/a.jpg",
  });
});

test("entities in the caption are decoded", () => {
  const html = `<meta property="og:title" content="A &amp; B on Instagram: &quot;Fast &#x2022; Furious &#064;universal&quot;" />
<meta property="og:image" content="https://cdn.test/a.jpg" />`;
  expect(parseInstagramPost(html)).toMatchObject({
    caption: "Fast • Furious @universal",
    author: "A & B",
  });
});

test("a login wall, with no picture, says to share a screenshot", () => {
  const html = `<meta property="og:title" content="Instagram" />`;
  expect(() => parseInstagramPost(html)).toThrow("share a screenshot");
});

test("Instagram refusing the page names the status", async () => {
  spyOn(globalThis, "fetch").mockImplementation(
    (async () => new Response("", { status: 429 })) as unknown as typeof fetch,
  );
  await expect(readInstagramPost("https://www.instagram.com/p/x/")).rejects.toThrow(
    "Instagram answered HTTP 429 for the post",
  );
});
