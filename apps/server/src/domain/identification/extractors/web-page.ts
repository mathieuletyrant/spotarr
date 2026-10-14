import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SpotarrError } from "../../../errors";
import { resizePicture } from "../../../integrations/ffmpeg/picture";
import { downloadImage, readWebPage } from "../../../integrations/web/page";
import { type DirectId, findDirectIds } from "./direct-ids";

export type Page = {
  caption?: string;
  author?: string;
  text: string;
  imageUrl?: string;
  directIds: DirectId[];
};

// Reads a shared web page: its title and description as the caption, its site
// as the author, its text and JSON-LD for the LLM, and its IMDb and TMDB links.
// A page with nothing to read (a login wall, an app's empty shell) throws.
export async function readPage(url: string): Promise<Page> {
  const page = await readWebPage(url);
  const works = page.works.map((work) => `The page describes: ${work}`);
  const text = [...works, page.text].filter(Boolean).join("\n");
  if (!page.description && text.length < 200) {
    throw new SpotarrError("unavailable", "the page shows nothing to read (login wall?)");
  }
  return {
    caption: [page.title, page.description].filter(Boolean).join("\n") || undefined,
    author: page.siteName ?? new URL(url).hostname.replace(/^www\./, ""),
    text,
    imageUrl: page.imageUrl,
    directIds: findDirectIds(page.links.join("\n")),
  };
}

// The page's picture, a 768 px JPEG for the LLM. Not kept. A page without one,
// or whose picture fails, still has its text.
export async function readPagePicture(page: Page): Promise<Uint8Array[]> {
  if (!page.imageUrl) return [];
  const dir = await mkdtemp(join(tmpdir(), "spotarr-"));
  try {
    const file = join(dir, "picture");
    await Bun.write(file, await downloadImage(page.imageUrl));
    return [await resizePicture(file)];
  } catch {
    return [];
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
