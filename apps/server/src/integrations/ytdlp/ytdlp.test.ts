import { expect, test } from "bun:test";
import { SpotarrError } from "../../errors";
import { isNoVideoError, parseVideoInfo } from "./ytdlp";

// Recorded on 2026-10-12 with `yt-dlp --dump-single-json` on a real reel, trimmed to a few fields.
const fixture = () => Bun.file(new URL("fixtures/instagram-reel.json", import.meta.url)).text();

test("an Instagram reel gives its caption and its author", async () => {
  expect(parseVideoInfo(await fixture())).toEqual({
    caption: "tu as du choix sur Netflix 🍿 t’es dans quel mood ?",
    author: "CameraCam • Recos Films",
  });
});

test("an empty caption is no caption", () => {
  expect(parseVideoInfo(JSON.stringify({ description: "", channel: "someone" }))).toEqual({
    caption: undefined,
    author: "someone",
  });
});

test("a photo post is told apart from other yt-dlp failures", () => {
  const photo = "yt-dlp failed: ERROR: [Instagram] DeZTyvuF9aF: There is no video in this post";
  expect(isNoVideoError(new SpotarrError("unavailable", photo))).toBe(true);
  const other = "yt-dlp failed: ERROR: [Instagram] x: Requested content is not available";
  expect(isNoVideoError(new SpotarrError("unavailable", other))).toBe(false);
});
