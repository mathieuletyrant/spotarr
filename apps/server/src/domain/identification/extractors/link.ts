import type { Settings } from "../../settings/schema";
import { readPhoto } from "./photo";
import { readVideo } from "./video";

// What a shared link gave: the images (and sound) for the LLM, and the frames
// kept to show on the Share's page, a photo post having none.
export type Link = {
  extractor: "video" | "instagram-photo";
  caption?: string;
  author?: string;
  images: Uint8Array[];
  audio?: Uint8Array;
  frames?: { atMs: number; thumbnail: Uint8Array }[];
};

// Reads the link as a video; a post without one is an Instagram photo post,
// read from its page instead.
export async function readLink(url: string, extraction: Settings["extraction"]): Promise<Link> {
  const video = await readVideo(url, extraction);
  if (video) {
    return {
      extractor: "video",
      caption: video.caption,
      author: video.author,
      images: video.frames.map((frame) => frame.jpeg),
      audio: video.audio,
      // Kept to show on the Share's page; the full frames only served the LLM.
      frames: video.frames.map(({ atMs, thumbnail }) => ({ atMs, thumbnail })),
    };
  }

  const photo = await readPhoto(url);
  return {
    extractor: "instagram-photo",
    caption: photo.caption,
    author: photo.author,
    images: [photo.picture],
  };
}
