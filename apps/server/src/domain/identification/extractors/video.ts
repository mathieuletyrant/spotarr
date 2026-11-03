import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractAudio } from "../../../integrations/ffmpeg/audio";
import { extractFrames, type Frame } from "../../../integrations/ffmpeg/frames";
import { downloadVideo, type VideoInfo } from "../../../integrations/ytdlp/ytdlp";
import type { Settings } from "../../settings/schema";

export type Video = {
  kind: "video";
  caption?: string;
  author?: string;
  frames: Frame[];
  audio?: Uint8Array;
};

// Reads a shared video, which yt-dlp described in `info`: a few frames and its
// sound for the LLM.
// Everything happens in a temporary folder, deleted at the end: no video is kept.
export async function readVideo(
  url: string,
  info: VideoInfo,
  extraction: Settings["extraction"],
): Promise<Video> {
  const dir = await mkdtemp(join(tmpdir(), "spotarr-"));
  try {
    const video = await downloadVideo(url, dir, extraction.maxVideoMb);
    const [frames, audio] = await Promise.all([
      extractFrames(video, extraction.framesPerVideo),
      extractAudio(video),
    ]);
    return { kind: "video", caption: info.caption, author: info.author, frames, audio };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
