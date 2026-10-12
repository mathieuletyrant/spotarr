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
    let cookiesFile: string | undefined;
    if (extraction.cookiesTxt) {
      cookiesFile = join(dir, "cookies.txt");
      await Bun.write(cookiesFile, extraction.cookiesTxt);
    }

    const info = await readVideoInfo(url, cookiesFile);
    const video = await downloadVideo(url, dir, extraction.maxVideoMb, cookiesFile);
    const frames = await extractFrames(video, extraction.framesPerVideo);
    const audio = await extractAudio(video);
    return { ...info, frames, audio };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
