import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractAudio } from "../../../integrations/ffmpeg/audio";
import { extractFrames, type Frame } from "../../../integrations/ffmpeg/frames";
import { downloadVideo, readVideoInfo } from "../../../integrations/ytdlp/ytdlp";
import type { Settings } from "../../settings/schema";

export type Video = { caption?: string; author?: string; frames: Frame[]; audio?: Uint8Array };

// Reads a shared video: what yt-dlp knows about it, a few frames and its sound
// for the LLM.
// Everything happens in a temporary folder, deleted at the end: no video is kept.
export async function readVideo(url: string, extraction: Settings["extraction"]): Promise<Video> {
  const dir = await mkdtemp(join(tmpdir(), "spotarr-"));
  try {
    const info = await readVideoInfo(url);
    const video = await downloadVideo(url, dir, extraction.maxVideoMb);
    const [frames, audio] = await Promise.all([
      extractFrames(video, extraction.framesPerVideo),
      extractAudio(video),
    ]);
    return { ...info, frames, audio };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
