import { expect, test } from "bun:test";
import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "../process";
import { extractFrames, pictureFrame } from "./frames";

// The width of a JPEG, read by ffprobe from a temporary file.
async function widthOf(jpeg: Uint8Array, dir: string): Promise<string> {
  const file = join(dir, "probe.jpg");
  await Bun.write(file, jpeg);
  const out = await run(
    ["ffprobe", "-v", "error", "-show_entries", "stream=width", "-of", "csv=p=0", file],
    5_000,
  );
  return out.trim();
}

test("takes the asked number of frames: a 768 px JPEG and a 240 px thumbnail each, with their time", async () => {
  // Frames are written next to the video: work on a copy in a temporary folder.
  const dir = await mkdtemp(join(tmpdir(), "spotarr-test-"));
  try {
    const video = join(dir, "video.mp4");
    await copyFile(new URL("fixtures/test-pattern.mp4", import.meta.url).pathname, video);

    const frames = await extractFrames(video, 4);

    expect(frames).toHaveLength(4);
    // The bundled video lasts 4 s: frames in the middle of each second.
    expect(frames.map((f) => f.atMs)).toEqual([500, 1500, 2500, 3500]);
    for (const { jpeg, thumbnail } of frames) {
      expect([jpeg[0], jpeg[1]]).toEqual([0xff, 0xd8]); // every JPEG starts with FF D8
      expect([thumbnail[0], thumbnail[1]]).toEqual([0xff, 0xd8]);
    }
    const first = frames[0];
    expect(await widthOf(first?.jpeg ?? new Uint8Array(), dir)).toBe("768");
    expect(await widthOf(first?.thumbnail ?? new Uint8Array(), dir)).toBe("240");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("a picture gives one frame at 0 ms, sized like a video's", async () => {
  const dir = await mkdtemp(join(tmpdir(), "spotarr-test-"));
  try {
    // A picture to start from: the first frame of the bundled video.
    const video = new URL("fixtures/test-pattern.mp4", import.meta.url).pathname;
    const picture = join(dir, "picture.jpg");
    await run(["ffmpeg", "-v", "error", "-i", video, "-frames:v", "1", picture], 10_000);

    const frame = await pictureFrame(picture);

    expect(frame.atMs).toBe(0);
    expect(await widthOf(frame.jpeg, dir)).toBe("768");
    expect(await widthOf(frame.thumbnail, dir)).toBe("240");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
