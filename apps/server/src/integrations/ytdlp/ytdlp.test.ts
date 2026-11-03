import { expect, test } from "bun:test";
import { SpotarrError } from "../../errors";
import { isUnknownSiteError, parsePostInfo } from "./ytdlp";

// Recorded with `yt-dlp --dump-single-json --ignore-no-formats-error` on real
// posts, trimmed to a few fields: a reel on 2026-10-12, a carousel of eleven
// pictures on 2026-11-03.
const fixture = (name: string) => Bun.file(new URL(`fixtures/${name}`, import.meta.url)).text();

test("an Instagram reel is a video, with its caption and its author", async () => {
  expect(parsePostInfo(await fixture("instagram-reel.json"))).toEqual({
    kind: "video",
    caption: "tu as du choix sur Netflix 🍿 t’es dans quel mood ?",
    author: "CameraCam • Recos Films",
  });
});

test("an empty caption is no caption", () => {
  const json = JSON.stringify({ description: "", channel: "someone", formats: [{}] });
  expect(parsePostInfo(json)).toEqual({ kind: "video", caption: undefined, author: "someone" });
});

test("an Instagram carousel of pictures gives every picture, in order", async () => {
  const info = parsePostInfo(await fixture("instagram-carousel.json"));
  expect(info).toMatchObject({
    kind: "pictures",
    caption: expect.stringContaining("Add these to your watchlist ASAP!"),
    author: "Tiny Tales",
  });
  const pictureUrls = info.kind === "pictures" ? info.pictureUrls : [];
  expect(pictureUrls).toHaveLength(11);
  expect(pictureUrls[0]).toEndWith("/838804265_18422273353157212_3785759981116641935_n.jpg");
});

test("a photo post is one picture", () => {
  const json = JSON.stringify({
    description: "NARNIA : LE NEVEU DU MAGICIEN.",
    uploader: "Netflix France",
    formats: [],
    thumbnail: "https://cdn/narnia.jpg",
  });
  expect(parsePostInfo(json)).toEqual({
    kind: "pictures",
    caption: "NARNIA : LE NEVEU DU MAGICIEN.",
    author: "Netflix France",
    pictureUrls: ["https://cdn/narnia.jpg"],
  });
});

test("a carousel mixing pictures and videos is read as pictures, a video by its cover", () => {
  const json = JSON.stringify({
    _type: "playlist",
    entries: [
      { formats: [], thumbnail: "https://cdn/picture.jpg" },
      { formats: [{ format_id: "1" }], thumbnail: "https://cdn/cover.jpg" },
    ],
  });
  expect(parsePostInfo(json)).toMatchObject({
    kind: "pictures",
    pictureUrls: ["https://cdn/picture.jpg", "https://cdn/cover.jpg"],
  });
});

test("an unknown site is told apart from a video yt-dlp cannot read", () => {
  const failed = (line: string) => new SpotarrError("unavailable", `yt-dlp failed: ${line}`);
  expect(isUnknownSiteError(failed("ERROR: Unsupported URL: https://letterboxd.com/"))).toBe(true);
  expect(isUnknownSiteError(failed("ERROR: [generic] Got HTTP Error 403"))).toBe(true);
  expect(
    isUnknownSiteError(failed("ERROR: [Instagram] x: Requested content is not available")),
  ).toBe(false);
});
