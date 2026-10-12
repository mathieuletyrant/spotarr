import { run } from "../process";

// The first 3 minutes are plenty to hear a title, and keep a long YouTube
// video from costing tens of thousands of tokens.
const MAX_SECONDS = 180;

// The video's sound as a small MP3 (mono, 16 kHz, 32 kbps: ≈ 250 KB a minute),
// for an LLM that listens. Undefined when the video has no sound at all.
export async function extractAudio(videoPath: string): Promise<Uint8Array | undefined> {
  const audioStreams = await run(
    [
      "ffprobe",
      "-v",
      "error",
      "-select_streams",
      "a",
      "-show_entries",
      "stream=index",
      "-of",
      "csv=p=0",
      videoPath,
    ],
    10_000,
  );
  if (!audioStreams.trim()) return undefined;

  const file = `${videoPath}-audio.mp3`;
  await run(
    ["ffmpeg", "-v", "error", "-y", "-i", videoPath, "-t", String(MAX_SECONDS)].concat([
      "-vn",
      ...["-ac", "1", "-ar", "16000", "-b:a", "32k"],
      file,
    ]),
    60_000,
  );
  return Bun.file(file).bytes();
}
