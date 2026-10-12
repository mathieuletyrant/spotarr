import { join } from "node:path";
import { z } from "zod";
import { SpotarrError } from "../../errors";
import { run } from "../process";

export type VideoInfo = { caption?: string; author?: string };

// yt-dlp prints a lot about a video; these are the fields that help name the film.
const YtDlpJson = z.object({
  description: z.string().nullish(),
  uploader: z.string().nullish(),
  channel: z.string().nullish(),
});

// YouTube needs a JavaScript runtime to read its player; yt-dlp only looks for
// Deno by default, and the image has Bun.
const JS_RUNTIME = ["--js-runtimes", "bun"];

export async function readVideoInfo(url: string): Promise<VideoInfo> {
  const json = await run(
    ["yt-dlp", ...JS_RUNTIME, "--dump-single-json", "--skip-download", "--no-warnings", url],
    45_000,
  );
  return parseVideoInfo(json);
}

export function parseVideoInfo(json: string): VideoInfo {
  const info = YtDlpJson.parse(JSON.parse(json));
  return {
    caption: info.description || undefined,
    author: info.uploader || info.channel || undefined,
  };
}

// yt-dlp only reads videos: this is its answer for an Instagram post made of
// pictures only.
export function isNoVideoError(error: unknown): boolean {
  return error instanceof SpotarrError && error.message.includes("There is no video in this post");
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
