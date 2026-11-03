import { join } from "node:path";
import { z } from "zod";
import { SpotarrError } from "../../errors";
import { run } from "../process";

// What yt-dlp reads at a link: a video, or a post made of pictures (an
// Instagram photo post or carousel), with the address of each picture.
export type VideoInfo = { kind: "video"; caption?: string; author?: string };
export type PicturesInfo = {
  kind: "pictures";
  caption?: string;
  author?: string;
  pictureUrls: string[];
};

// A slide is a post, or one entry of a carousel. A picture has no formats;
// `thumbnail` is the picture itself, or a video's cover.
const Slide = z.object({
  formats: z.array(z.unknown()).nullish(),
  thumbnail: z.string().nullish(),
});

// yt-dlp prints a lot about a post; these are the fields that help name the film.
const YtDlpJson = Slide.extend({
  description: z.string().nullish(),
  uploader: z.string().nullish(),
  channel: z.string().nullish(),
  entries: z.array(Slide).nullish(),
});

// YouTube needs a JavaScript runtime to read its player; yt-dlp only looks for
// Deno by default, and the image has Bun.
const JS_RUNTIME = ["--js-runtimes", "bun"];

// yt-dlp only downloads videos: on a post without one, it fails with "There is
// no video in this post" (a photo post) or "No video formats found!" (a
// carousel's picture). `--ignore-no-formats-error` makes it describe the post
// all the same, pictures included.
export async function readPostInfo(url: string): Promise<VideoInfo | PicturesInfo> {
  const json = await run(
    [
      "yt-dlp",
      ...JS_RUNTIME,
      ...["--dump-single-json", "--skip-download", "--ignore-no-formats-error", "--no-warnings"],
      url,
    ],
    45_000,
  );
  return parsePostInfo(json);
}

export function parsePostInfo(json: string): VideoInfo | PicturesInfo {
  const info = YtDlpJson.parse(JSON.parse(json));
  const caption = info.description || undefined;
  const author = info.uploader || info.channel || undefined;
  // A carousel lists its slides; any other post is a slide of its own.
  const slides = info.entries ?? [info];
  if (slides.every(hasVideo)) return { kind: "video", caption, author };

  // A carousel holding pictures is read as pictures, a video's cover included.
  const pictureUrls: string[] = [];
  for (const slide of slides) {
    if (slide.thumbnail) pictureUrls.push(slide.thumbnail);
  }
  return { kind: "pictures", caption, author, pictureUrls };
}

function hasVideo(slide: z.infer<typeof Slide>): boolean {
  return (slide.formats?.length ?? 0) > 0;
}

// yt-dlp has no extractor for the site (an article, a film's page): it says
// "Unsupported URL", or its generic extractor fails on the page.
export function isUnknownSiteError(error: unknown): boolean {
  if (!(error instanceof SpotarrError)) return false;
  return error.message.includes("Unsupported URL") || error.message.includes("[generic]");
}

// Downloads a low quality, which is enough for a few frames, into `dir`.
// Returns the file's path.
// `worst` is the smallest file with sound and picture (Instagram, TikTok).
// YouTube only offers them apart: the smallest picture of at least 360 px, so
// on-screen text stays readable, plus the smallest sound, merged by ffmpeg.
const FORMAT = "worst/wv[height>=360][width>=360]+wa/wv+wa";

export async function downloadVideo(url: string, dir: string, maxMb: number): Promise<string> {
  const printed = await run(
    [
      "yt-dlp",
      ...JS_RUNTIME,
      ...["--format", FORMAT],
      ...["--max-filesize", `${maxMb}M`],
      ...["--output", join(dir, "video.%(ext)s")],
      // Print the downloaded file's path, and nothing else.
      ...["--print", "after_move:filepath", "--no-simulate", "--no-warnings"],
      url,
    ],
    120_000,
  );
  const path = printed.trim();
  // yt-dlp skips a file over --max-filesize without failing.
  if (!path) throw new SpotarrError("invalid_input", `video larger than ${maxMb} MB`);
  return path;
}

// "2026.08.19". Instagram, TikTok and YouTube change often: an old yt-dlp is the first suspect.
export async function ytDlpVersion(): Promise<string> {
  return (await run(["yt-dlp", "--version"], 10_000)).trim();
}
