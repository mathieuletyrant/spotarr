import { isUnknownSiteError } from "../../../integrations/ytdlp/ytdlp";
import type { Settings } from "../../settings/schema";
import type { DirectId } from "./direct-ids";
import { type Photo, readPhoto } from "./photo";
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

// What readLink reads a link with. The real readers download and run yt-dlp;
// a test hands in plain functions answering what it needs.
export type LinkReaders = {
  readPage: (url: string) => Promise<Page>;
  readPagePictures: (page: Page) => Promise<Uint8Array[]>;
  readVideo: (url: string) => Promise<Video | undefined>;
  readPhoto: (url: string) => Promise<Photo>;
};

export function linkReaders(extraction: Settings["extraction"]): LinkReaders {
  return {
    readPage,
    readPagePictures,
    readVideo: (url) => readVideo(url, extraction),
    readPhoto,
  };
}

// Any link works, read in three steps. Each step's failure is kept as a value
// (`.catch`): the next step decides what to do with it.
export async function readLink(url: string, readers: LinkReaders): Promise<Link> {
  // 1. The page: a film's page (Letterboxd, Wikipedia) links to IMDb or TMDB,
  // which is enough.
  const page = await readers.readPage(url).catch((error: Error) => error);
  if (!(page instanceof Error) && page.directIds.length > 0) {
    return fromPage(page, []);
  }

  // 2. A video. A post without one is an Instagram photo post.
  const video = await readers.readVideo(url).catch((error: Error) => error);
  if (video === undefined) return fromPhoto(await readers.readPhoto(url));
  if (!(video instanceof Error)) return fromVideo(video);

  // 3. No video (an article, a picture): the page itself, its text and pictures.
  if (!(page instanceof Error)) return fromPage(page, await readers.readPagePictures(page));

  // Neither could be read. When yt-dlp knows nothing of the site, why the page
  // could not be read says more.
  if (isUnknownSiteError(video)) throw page;
  throw video;
}

function fromPage(page: Page, images: Uint8Array[]): Link {
  return {
    extractor: "web",
    caption: page.caption,
    author: page.author,
    text: page.text,
    images,
    directIds: page.directIds,
  };
}

function fromVideo(video: Video): Link {
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

function fromPhoto(photo: Photo): Link {
  return {
    extractor: "instagram-photo",
    caption: photo.caption,
    author: photo.author,
    images: [photo.picture],
  };
}
