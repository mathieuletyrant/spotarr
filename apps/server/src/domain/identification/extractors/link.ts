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

// Any link works. The page is read once, at the start, and used twice: its
// IMDb and TMDB links first, its content for the LLM last, when the link is
// no video. From the surest answer to the least sure:
//   1. the page's IMDb or TMDB links: certain, no LLM;
//   2. the video: its frames and sound for the LLM;
//   3. the page's content: its text and pictures for the LLM.
// Each step's failure is kept as a value (`.catch`): a later step uses it.
export async function readLink(url: string, readers: LinkReaders): Promise<Link> {
  const page = await readers.readPage(url).catch((error: Error) => error);

  // 1. The page's IMDb or TMDB links (Letterboxd, Wikipedia) name its work.
  if (!(page instanceof Error) && page.directIds.length > 0) {
    return fromPageLinks(page);
  }

  // 2. The video. A post without one is an Instagram photo post.
  const video = await readers.readVideo(url).catch((error: Error) => error);
  if (video === undefined) return fromPhoto(await readers.readPhoto(url));
  if (!(video instanceof Error)) return fromVideo(video);

  // 3. No video (an article, a poster): the page's content goes to the LLM,
  // its text and its pictures, downloaded now.
  if (!(page instanceof Error)) {
    return fromPageContent(page, await readers.readPagePictures(page));
  }

  // Neither could be read. When yt-dlp knows nothing of the site, why the page
  // could not be read says more.
  if (isUnknownSiteError(video)) throw page;
  throw video;
}

// The page's IMDb and TMDB links answer: no pictures to download. Its text
// stays for the LLM, in case TMDB knows none of the links.
function fromPageLinks(page: Page): Link {
  return {
    extractor: "web",
    caption: page.caption,
    author: page.author,
    text: page.text,
    images: [],
    directIds: page.directIds,
  };
}

// The page's content, for the LLM to read and look at.
function fromPageContent(page: Page, pictures: Uint8Array[]): Link {
  return {
    extractor: "web",
    caption: page.caption,
    author: page.author,
    text: page.text,
    images: pictures,
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
