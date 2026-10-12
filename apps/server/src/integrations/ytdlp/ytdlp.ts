import { join } from "node:path";
import { z } from "zod";
import { run } from "../process";

export type VideoInfo = { caption?: string; author?: string };

// yt-dlp prints a lot about a video; these are the fields that help name the film.
const YtDlpJson = z.object({
  description: z.string().nullish(),
  uploader: z.string().nullish(),
  channel: z.string().nullish(),
});

export async function readVideoInfo(url: string, cookiesFile?: string): Promise<VideoInfo> {
  const json = await run(
    [
      "yt-dlp",
      "--dump-single-json",
      "--skip-download",
      "--no-warnings",
      ...cookies(cookiesFile),
      url,
    ],
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

// Downloads the lowest quality, which is enough for a few frames, into `dir`.
// Returns the file's path.
export async function downloadVideo(
  url: string,
  dir: string,
  maxMb: number,
  cookiesFile?: string,
): Promise<string> {
  const printed = await run(
    [
      "yt-dlp",
      ...["--format", "worst"],
      ...["--max-filesize", `${maxMb}M`],
      ...["--output", join(dir, "video.%(ext)s")],
      // Print the downloaded file's path, and nothing else.
      ...["--print", "after_move:filepath", "--no-simulate", "--no-warnings"],
      ...cookies(cookiesFile),
      url,
    ],
    120_000,
  );
  const path = printed.trim();
  // yt-dlp skips a file over --max-filesize without failing.
  if (!path) throw new Error(`video larger than ${maxMb} MB`);
  return path;
}

function cookies(cookiesFile?: string): string[] {
  return cookiesFile ? ["--cookies", cookiesFile] : [];
}
