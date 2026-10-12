import { run } from "../process";

// Takes `count` frames spread over the video, 768 px wide, as JPEG.
// Each frame sits in the middle of its slice: no black first or last frame.
export async function extractFrames(videoPath: string, count: number): Promise<Uint8Array[]> {
  const duration = Number(
    await run(
      ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", videoPath],
      10_000,
    ),
  );

  const frames: Uint8Array[] = [];
  for (let i = 0; i < count; i++) {
    const at = (duration * (i + 0.5)) / count;
    const file = `${videoPath}-${i}.jpg`;
    await run(
      ["ffmpeg", "-v", "error", "-y", "-ss", at.toFixed(2), "-i", videoPath].concat([
        "-frames:v",
        "1",
        "-vf",
        "scale=768:-2",
        "-q:v",
        "4",
        file,
      ]),
      15_000,
    );
    frames.push(await Bun.file(file).bytes());
  }
  return frames;
}
