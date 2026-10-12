import { SpotarrError } from "../../errors";

export type InstagramPost = { caption?: string; author?: string; imageUrl: string };

// Workaround: yt-dlp only reads videos, and fails on a photo post ("There is no
// video in this post"). The post's public page carries what Spotarr needs in its
// Open Graph tags, without a login: the caption, the author and the first picture.
// Instagram may show a login wall instead, to some server addresses: the post
// then cannot be read, and a screenshot is the way out.
export async function readInstagramPost(url: string): Promise<InstagramPost> {
  const page = await fetchOrFail(url, "the post");
  return parseInstagramPost(await page.text());
}

// Downloads the post's picture.
export async function downloadPicture(imageUrl: string): Promise<Uint8Array> {
  const image = await fetchOrFail(imageUrl, "the picture");
  return new Uint8Array(await image.arrayBuffer());
}

export function parseInstagramPost(html: string): InstagramPost {
  const imageUrl = metaContent(html, "og:image");
  if (!imageUrl) {
    throw new SpotarrError(
      "unavailable",
      "Instagram did not show the post (login wall?): share a screenshot of it instead",
    );
  }

  // og:title reads `Netflix France on Instagram: "the caption"`, or without the
  // caption part when there is none.
  const title = metaContent(html, "og:title") ?? "";
  const match = title.match(/^(.*?) on Instagram(?:: "([\s\S]*)")?$/);
  return {
    caption: match?.[2]?.trim() || undefined,
    author: match?.[1]?.trim() || undefined,
    imageUrl,
  };
}

function metaContent(html: string, property: string): string | undefined {
  const match = html.match(new RegExp(`<meta property="${property}" content="([^"]*)"`));
  if (!match?.[1]) return undefined;
  return decodeEntities(match[1]);
}

// Instagram writes `&quot;`, `&amp;`, `&#064;` and `&#x2022;` in its attributes.
function decodeEntities(text: string): string {
  const named: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">" };
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (entity, code: string) => {
    if (code.startsWith("#x") || code.startsWith("#X")) {
      return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
    }
    if (code.startsWith("#")) return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
    return named[code] ?? entity;
  });
}

async function fetchOrFail(url: string, what: string): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, {
      // The caption's wording ("on Instagram") depends on the language.
      headers: { "Accept-Language": "en", "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new SpotarrError("timeout", `Instagram took more than 15 s to send ${what}`);
    }
    throw new SpotarrError("unavailable", `Instagram could not be reached: ${String(error)}`);
  }
  if (!res.ok) {
    throw new SpotarrError("unavailable", `Instagram answered HTTP ${res.status} for ${what}`);
  }
  return res;
}
