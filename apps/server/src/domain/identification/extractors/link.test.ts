import { expect, test } from "bun:test";
import { SpotarrError } from "../../../errors";
import { type LinkReaders, readLink } from "./link";
import type { Pictures } from "./pictures";
import type { Video } from "./video";
import type { Page } from "./web-page";

const letterboxd: Page = {
  caption: "Dune: Part Two (2024)",
  author: "letterboxd.com",
  text: "Follow the mythic journey of Paul Atreides",
  imageUrls: ["https://a.ltrbxd.com/dune.jpg"],
  directIds: [{ source: "tmdb", type: "MOVIE", id: 693134 }],
};
const article: Page = {
  caption: "Antonio Banderas tourne dans un film sur Cortés",
  author: "Ecran Large",
  text: "Nicholas Kazan fait mieux avec Cortés.",
  imageUrls: ["https://www.ecranlarge.com/cortes.jpg"],
  directIds: [],
};
const reel: Video = {
  kind: "video",
  caption: "tu as du choix sur Netflix",
  author: "CameraCam",
  frames: [{ atMs: 2500, jpeg: new Uint8Array([1]), thumbnail: new Uint8Array([2]) }],
  audio: new Uint8Array([3]),
};
const carousel: Pictures = {
  kind: "pictures",
  caption: "Add these to your watchlist ASAP!",
  author: "Tiny Tales",
  pictures: [new Uint8Array([8]), new Uint8Array([1])],
  firstInView: true,
};

const unsupported = new SpotarrError(
  "unavailable",
  "yt-dlp failed: ERROR: Unsupported URL: https://www.ecranlarge.com/x",
);
const notCalled = async (): Promise<never> => {
  throw new Error("should not be called");
};
const failing = (error: Error) => async (): Promise<never> => {
  throw error;
};

// Every reader fails the test unless the test says what it answers.
function readers(answers: Partial<LinkReaders>): LinkReaders {
  return {
    readPage: notCalled,
    readPagePictures: notCalled,
    readPost: notCalled,
    ...answers,
  };
}

test("1. the page's IMDb or TMDB links are enough: no video, no pictures", async () => {
  const link = await readLink(
    "https://letterboxd.com/film/dune-part-two/",
    readers({ readPage: async () => letterboxd }),
  );
  expect(link).toEqual({
    extractor: "web",
    caption: "Dune: Part Two (2024)",
    author: "letterboxd.com",
    text: "Follow the mythic journey of Paul Atreides",
    images: [],
    directIds: [{ source: "tmdb", type: "MOVIE", id: 693134 }],
  });
});

test("2. a video gives its frames and sound, even when its page could not be read", async () => {
  const link = await readLink(
    "https://www.instagram.com/reel/x/",
    readers({
      readPage: failing(new SpotarrError("unavailable", "instagram.com answered HTTP 429")),
      readPost: async () => reel,
    }),
  );
  expect(link).toEqual({
    extractor: "video",
    caption: "tu as du choix sur Netflix",
    author: "CameraCam",
    images: [new Uint8Array([1])],
    audio: new Uint8Array([3]),
    frames: [{ atMs: 2500, thumbnail: new Uint8Array([2]) }],
  });
});

test("2. a post of pictures gives them all, the one in view first", async () => {
  const link = await readLink(
    "https://www.instagram.com/p/x/?img_index=8",
    readers({ readPage: async () => article, readPost: async () => carousel }),
  );
  expect(link).toEqual({
    extractor: "pictures",
    caption: "Add these to your watchlist ASAP!",
    author: "Tiny Tales",
    images: [new Uint8Array([8]), new Uint8Array([1])],
    firstImageInView: true,
  });
});

test("3. a link that is no video: the page's content, its text and pictures, for the LLM", async () => {
  const link = await readLink(
    "https://www.ecranlarge.com/x",
    readers({
      readPage: async () => article,
      readPost: failing(unsupported),
      readPagePictures: async () => [new Uint8Array([7])],
    }),
  );
  expect(link).toEqual({
    extractor: "web",
    caption: "Antonio Banderas tourne dans un film sur Cortés",
    author: "Ecran Large",
    text: "Nicholas Kazan fait mieux avec Cortés.",
    images: [new Uint8Array([7])],
  });
});

test("a site yt-dlp does not know, whose page fails: the page's error", async () => {
  const pageError = new SpotarrError("unavailable", "premiere.fr answered HTTP 403 for the page");
  await expect(
    readLink(
      "https://www.premiere.fr/Cinema",
      readers({ readPage: failing(pageError), readPost: failing(unsupported) }),
    ),
  ).rejects.toThrow("premiere.fr answered HTTP 403 for the page");
});

test("a video yt-dlp cannot read, whose page fails too: yt-dlp's error", async () => {
  const videoError = new SpotarrError(
    "unavailable",
    "yt-dlp failed: ERROR: [Instagram] x: Requested content is not available",
  );
  await expect(
    readLink(
      "https://www.instagram.com/reel/x/",
      readers({
        readPage: failing(new SpotarrError("unavailable", "the page shows nothing to read")),
        readPost: failing(videoError),
      }),
    ),
  ).rejects.toThrow("Requested content is not available");
});
