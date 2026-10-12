import { expect, test } from "bun:test";
import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "../process";
import { extractFrames } from "./frames";

test("takes the asked number of JPEG frames, 768 px wide", async () => {
  // Frames are written next to the video: work on a copy in a temporary folder.
  const dir = await mkdtemp(join(tmpdir(), "spotarr-test-"));
  try {
    const video = join(dir, "video.mp4");
    await copyFile(new URL("fixtures/test-pattern.mp4", import.meta.url).pathname, video);

    const frames = await extractFrames(video, 3);

    expect(frames).toHaveLength(3);
    for (const frame of frames) {
      expect([frame[0], frame[1]]).toEqual([0xff, 0xd8]); // every JPEG starts with FF D8
    }
    const width = await run(
      [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "stream=width",
        "-of",
        "csv=p=0",
        `${video}-0.jpg`,
      ],
      5_000,
    );
    expect(width.trim()).toBe("768");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
