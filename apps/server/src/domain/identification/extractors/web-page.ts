import { SpotarrError } from "../../../errors";
import { readWebPage } from "../../../integrations/web/page";
import { type DirectId, findDirectIds } from "./direct-ids";
import { downloadPicture } from "./pictures";

export type Page = {
  caption?: string;
  author?: string;
  text: string;
  imageUrls: string[];
  directIds: DirectId[];
};

// Reads a shared web page: its title and description as the caption, its site
// as the author, its text, JSON-LD and pictures for the LLM, and its IMDb and
// TMDB links. A page with nothing to read nor see (a login wall, an app's empty
// shell) throws.
export async function readPage(url: string): Promise<Page> {
  const page = await readWebPage(url);
  const works = page.works.map((work) => `The page describes: ${work}`);
  const text = [...works, page.text].filter(Boolean).join("\n");
  if (!page.description && text.length < 200 && page.imageUrls.length === 0) {
    throw new SpotarrError("unavailable", "the page shows nothing to read (login wall?)");
  }
  return {
    caption: [page.title, page.description].filter(Boolean).join("\n") || undefined,
    author: page.siteName ?? new URL(url).hostname.replace(/^www\./, ""),
    text,
    imageUrls: page.imageUrls,
    directIds: findDirectIds(page.links.join("\n")),
  };
}

// The page's pictures, 768 px JPEGs for the LLM, in the page's order. Not kept.
// A picture that fails to download or to convert is skipped: the others and
// the text are enough.
export async function readPagePictures(page: Page): Promise<Uint8Array[]> {
  const pictures = await Promise.all(page.imageUrls.map(downloadPicture));
  return pictures.filter((picture) => picture !== undefined);
}
