import { expect, test } from "bun:test";
import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractAudio } from "./audio";

// The audio file is written next to the video: work on a copy in a temporary folder.
async function onCopyOf<T>(fixture: string, use: (video: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "spotarr-test-"));
  try {
    const video = join(dir, "video.mp4");
    await copyFile(new URL(`fixtures/${fixture}`, import.meta.url).pathname, video);
    return await use(video);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("a video with sound gives an MP3", async () => {
  const mp3 = await onCopyOf("with-sound.mp4", extractAudio);
  expect(mp3?.length).toBeGreaterThan(0);
  // An MP3 starts with an ID3 tag or an MPEG frame header (FF Fx).
  const start = String.fromCharCode(...(mp3?.slice(0, 3) ?? []));
  expect(start === "ID3" || mp3?.[0] === 0xff).toBe(true);
});

test("a silent video gives no audio", async () => {
  expect(await onCopyOf("test-pattern.mp4", extractAudio)).toBeUndefined();
});
