import { run } from "../process";

export type Frame = { atMs: number; jpeg: Uint8Array; thumbnail: Uint8Array };

// Takes `count` frames spread over the video: a 768 px JPEG for the LLM, and a
// 240 px thumbnail for the web UI, both written by the same ffmpeg run.
// Each frame sits in the middle of its slice: no black first or last frame.
export async function extractFrames(videoPath: string, count: number): Promise<Frame[]> {
  const duration = Number(
    await run(
      ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", videoPath],
      10_000,
    ),
  );

  const frames: Frame[] = [];
  for (let i = 0; i < count; i++) {
    const at = (duration * (i + 0.5)) / count;
    const full = `${videoPath}-${i}.jpg`;
    const thumbnail = `${videoPath}-${i}-thumbnail.jpg`;
    await run(
      ["ffmpeg", "-v", "error", "-y", "-ss", at.toFixed(2), "-i", videoPath]
        .concat(["-frames:v", "1", "-vf", "scale=768:-2", "-q:v", "4", full])
        .concat(["-frames:v", "1", "-vf", "scale=240:-2", "-q:v", "5", thumbnail]),
      15_000,
    );
    frames.push({
      atMs: Math.round(at * 1000),
      jpeg: await Bun.file(full).bytes(),
      thumbnail: await Bun.file(thumbnail).bytes(),
    });
  }
  return frames;
}
