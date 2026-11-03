import { readPostInfo } from "../../../integrations/ytdlp/ytdlp";
import type { Settings } from "../../settings/schema";
import { type Pictures, readPictures } from "./pictures";
import { readVideo, type Video } from "./video";

// What yt-dlp reads at a link: a video, or a post made of pictures (an
// Instagram photo post or carousel).
export async function readPost(
  url: string,
  extraction: Settings["extraction"],
): Promise<Video | Pictures> {
  const info = await readPostInfo(url);
  if (info.kind === "pictures") return readPictures(url, info);
  return readVideo(url, info, extraction);
}
