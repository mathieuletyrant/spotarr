import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SpotarrError } from "../../../errors";
import { extractAudio } from "../../../integrations/ffmpeg/audio";
import { extractFrames, type Frame, pictureFrame } from "../../../integrations/ffmpeg/frames";
import { downloadPicture, readInstagramPost } from "../../../integrations/instagram/post";
import { downloadVideo, readVideoInfo, type VideoInfo } from "../../../integrations/ytdlp/ytdlp";
import type { Settings } from "../../settings/schema";

export type Video = {
  // "video" for a video, "instagram-photo" for a photo post read from its page.
  extractor: "video" | "instagram-photo";
  caption?: string;
  author?: string;
  frames: Frame[];
  audio?: Uint8Array;
};

// Reads a shared video: what yt-dlp knows about it, a few frames and its sound
// for the LLM. An Instagram photo post has no video: its picture is the only frame.
// Everything happens in a temporary folder, deleted at the end: no video is kept.
export async function readVideo(url: string, extraction: Settings["extraction"]): Promise<Video> {
  const dir = await mkdtemp(join(tmpdir(), "spotarr-"));
  try {
    let info: VideoInfo;
    try {
      info = await readVideoInfo(url);
    } catch (error) {
      if (isPhotoPost(error)) return await readPhotoPost(url, dir);
      throw error;
    }

    const video = await downloadVideo(url, dir, extraction.maxVideoMb);
    const [frames, audio] = await Promise.all([
      extractFrames(video, extraction.framesPerVideo),
      extractAudio(video),
    ]);
    return { extractor: "video", ...info, frames, audio };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// yt-dlp's own words for an Instagram post made of pictures only.
function isPhotoPost(error: unknown): boolean {
  return error instanceof SpotarrError && error.message.includes("There is no video in this post");
}

async function readPhotoPost(url: string, dir: string): Promise<Video> {
  const post = await readInstagramPost(url);
  const picture = join(dir, "picture.jpg");
  await Bun.write(picture, await downloadPicture(post.imageUrl));
  const frame = await pictureFrame(picture);
  return {
    extractor: "instagram-photo",
    caption: post.caption,
    author: post.author,
    frames: [frame],
  };
}
