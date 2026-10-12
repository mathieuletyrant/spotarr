import { expect, test } from "bun:test";
import { parseVideoInfo } from "./ytdlp";

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
