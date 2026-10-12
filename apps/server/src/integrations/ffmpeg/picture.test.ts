import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "../process";
import { resizePicture } from "./picture";

test("a picture becomes a 768 px JPEG", async () => {
  const dir = await mkdtemp(join(tmpdir(), "spotarr-test-"));
  try {
    // A picture to start from: the first frame of the bundled video.
    const video = new URL("fixtures/test-pattern.mp4", import.meta.url).pathname;
    const picture = join(dir, "picture.jpg");
    await run(["ffmpeg", "-v", "error", "-i", video, "-frames:v", "1", picture], 10_000);

    const jpeg = await resizePicture(picture);

    expect([jpeg[0], jpeg[1]]).toEqual([0xff, 0xd8]); // every JPEG starts with FF D8
    await Bun.write(join(dir, "resized.jpg"), jpeg);
    const width = await run(
      [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "stream=width",
        "-of",
        "csv=p=0",
        join(dir, "resized.jpg"),
      ],
      5_000,
    );
    expect(width.trim()).toBe("768");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
