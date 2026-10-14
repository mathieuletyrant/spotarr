import { isUnknownSiteError } from "../../../integrations/ytdlp/ytdlp";
import type { Settings } from "../../settings/schema";
import type { DirectId } from "./direct-ids";
import { readPhoto } from "./photo";
import { readVideo, type Video } from "./video";
import { type Page, readPage, readPagePictures } from "./web-page";

// What a shared link gave: the images (and sound) for the LLM, and the frames
// kept to show on the Share's page, a photo post having none.
export type Link = {
  extractor: "video" | "instagram-photo" | "web";
  caption?: string;
  author?: string;
  // A web page's text, for the LLM only: not kept.
  text?: string;
  images: Uint8Array[];
  audio?: Uint8Array;
  frames?: { atMs: number; thumbnail: Uint8Array }[];
  // The IMDb and TMDB links of a web page: they name its work without the LLM.
  directIds?: DirectId[];
};

// Any link works. Its page is read first: a film's page (Letterboxd, Wikipedia)
// links to IMDb or TMDB, which is enough. Otherwise the link is read as a video;
// a post without one is an Instagram photo post, read from its page instead; a
// link that is no video at all (an article, a picture) is the page itself, its
// text and pictures.
export async function readLink(url: string, extraction: Settings["extraction"]): Promise<Link> {
  let page: Page | undefined;
  let pageError: unknown;
  try {
    page = await readPage(url);
  } catch (error) {
    pageError = error;
  }
  if (page && page.directIds.length > 0) {
    return { ...webClues(page), images: [], directIds: page.directIds };
  }

  let video: Video | undefined;
  try {
    video = await readVideo(url, extraction);
  } catch (error) {
    if (page) return { ...webClues(page), images: await readPagePictures(page) };
    // yt-dlp knows nothing of the site: why the page could not be read says more.
    if (pageError && isUnknownSiteError(error)) throw pageError;
    throw error;
  }

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

function webClues(page: Page) {
  return {
    extractor: "web" as const,
    caption: page.caption,
    author: page.author,
    text: page.text,
  };
}
