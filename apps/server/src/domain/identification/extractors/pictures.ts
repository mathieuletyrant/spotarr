import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SpotarrError } from "../../../errors";
import { resizePicture } from "../../../integrations/ffmpeg/picture";
import { downloadImage } from "../../../integrations/web/page";
import type { PicturesInfo } from "../../../integrations/ytdlp/ytdlp";

// A post made of pictures: an Instagram photo post, or a carousel. When the
// link was shared from one of a carousel's pictures, it comes first and
// `firstInView` is true: that is the work the person meant.
export type Pictures = {
  kind: "pictures";
  caption?: string;
  author?: string;
  pictures: Uint8Array[];
  firstInView: boolean;
};

// Reads a post made of pictures: its caption, its author and its pictures,
// 768 px JPEGs for the LLM. The pictures are not kept.
export async function readPictures(url: string, info: PicturesInfo): Promise<Pictures> {
  const { pictureUrls, firstInView } = inViewFirst(url, info.pictureUrls);
  const downloaded = await Promise.all(pictureUrls.map(downloadPicture));
  const pictures = downloaded.filter((picture) => picture !== undefined);
  if (pictures.length === 0) {
    throw new SpotarrError("unavailable", "none of the post's pictures could be downloaded");
  }
  return {
    kind: "pictures",
    caption: info.caption,
    author: info.author,
    pictures,
    // The picture in view may be the one that failed to download.
    firstInView: firstInView && downloaded[0] !== undefined,
  };
}

// Instagram adds `img_index` (from 1) to a carousel's link shared from one of
// its pictures. That picture goes first.
export function inViewFirst(
  url: string,
  pictureUrls: string[],
): { pictureUrls: string[]; firstInView: boolean } {
  const index = Number(new URL(url).searchParams.get("img_index"));
  if (!Number.isInteger(index) || index < 1 || index > pictureUrls.length) {
    return { pictureUrls, firstInView: false };
  }
  const inView = pictureUrls[index - 1] as string;
  const others = pictureUrls.filter((_, position) => position !== index - 1);
  return { pictureUrls: [inView, ...others], firstInView: true };
}

// One picture as a 768 px JPEG for the LLM. Undefined when it fails to
// download or to convert: the other pictures and the caption are enough.
export async function downloadPicture(imageUrl: string): Promise<Uint8Array | undefined> {
  const dir = await mkdtemp(join(tmpdir(), "spotarr-"));
  try {
    const file = join(dir, "picture");
    await Bun.write(file, await downloadImage(imageUrl));
    return await resizePicture(file);
  } catch {
    return undefined;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
