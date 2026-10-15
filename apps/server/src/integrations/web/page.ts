import * as cheerio from "cheerio";
import { SpotarrError } from "../../errors";

// What a web page says about itself: an article, a film's page on Letterboxd,
// AlloCiné or Wikipedia.
export type WebPage = {
  title?: string;
  description?: string;
  siteName?: string;
  // Its share picture (og:image) first, then the pictures of its content.
  imageUrls: string[];
  // The films and shows its JSON-LD describes: `Movie "Dune: Part Two" (2024)`.
  works: string[];
  // Every link of the page, where IMDb and TMDB links hide.
  links: string[];
  // Its paragraphs, capped: enough for the LLM, and a bounded price.
  text: string;
};

const MAX_TEXT = 8000;
const MAX_IMAGES = 6;
// Thumbnails of other articles and icons are smaller: they would mislead the LLM.
const MIN_IMAGE_SIZE = 300;

// Some sites (Wikipedia) refuse a request without a browser's User-Agent.
const HEADERS = {
  "Accept-Language": "fr, en;q=0.8",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
};

export async function readWebPage(url: string): Promise<WebPage> {
  const res = await fetchOrFail(url, "the page");
  const type = res.headers.get("content-type") ?? "";
  // A link to a picture (a poster) is a page made of that picture alone.
  if (type.startsWith("image/")) {
    return { imageUrls: [res.url || url], works: [], links: [], text: "" };
  }
  if (!type.includes("html")) {
    throw new SpotarrError("invalid_input", `the link is not a web page (${type || "no type"})`);
  }
  // A redirect may have moved the page: relative addresses follow it.
  return parseWebPage(await res.text(), res.url || url);
}

// Downloads one of the page's pictures.
export async function downloadImage(imageUrl: string): Promise<Uint8Array> {
  const image = await fetchOrFail(imageUrl, "the picture");
  return new Uint8Array(await image.arrayBuffer());
}

export function parseWebPage(html: string, pageUrl: string): WebPage {
  const $ = cheerio.load(html);
  const meta = (name: string) =>
    $(`meta[property="${name}"], meta[name="${name}"]`).first().attr("content")?.trim() ||
    undefined;

  const image = meta("og:image") ?? meta("twitter:image");
  const works = worksOf($);
  const links = linksOf($, pageUrl);
  // Last: the menus, headers and footers are removed from the page.
  const content = contentOf($);
  const imageUrls = imagesOf($, content, pageUrl);
  if (image) imageUrls.unshift(absolute(image, pageUrl));
  return {
    title:
      meta("og:title") ?? meta("twitter:title") ?? ($("title").first().text().trim() || undefined),
    description: meta("og:description") ?? meta("description"),
    siteName: meta("og:site_name"),
    imageUrls: [...new Set(imageUrls)].slice(0, MAX_IMAGES),
    works,
    links,
    text: textOf($, content),
  };
}

function linksOf($: cheerio.CheerioAPI, pageUrl: string): string[] {
  const links: string[] = [];
  $("a[href]").each((_, a) => {
    const href = $(a).attr("href");
    if (href) links.push(absolute(href, pageUrl));
  });
  // Letterboxd writes the film's TMDB id on its <body>: written as a TMDB link,
  // it is found like the others.
  const tmdbId = $("[data-tmdb-id]").first().attr("data-tmdb-id");
  const tmdbType = $("[data-tmdb-id]").first().attr("data-tmdb-type");
  if (tmdbId && (tmdbType === "movie" || tmdbType === "tv")) {
    links.unshift(`https://www.themoviedb.org/${tmdbType}/${tmdbId}`);
  }
  return links;
}

// The article (or main part) when the page marks one, else the whole body,
// without its menus, headers and footers.
function contentOf($: cheerio.CheerioAPI) {
  $("script, style, noscript, nav, header, footer, aside, form").remove();
  let content = $("article").first();
  if (content.length === 0) content = $("main").first();
  if (content.length === 0) content = $("body");
  return content;
}

type Content = ReturnType<typeof contentOf>;

function textOf($: cheerio.CheerioAPI, content: Content): string {
  const paragraphs: string[] = [];
  content.find("h1, p").each((_, element) => {
    const text = $(element).text().replace(/\s+/g, " ").trim();
    if (text) paragraphs.push(text);
  });
  return paragraphs.join("\n").slice(0, MAX_TEXT);
}

// The content's pictures, in order. Lazy-loaded ones keep their address in
// `data-src`. Vector drawings (logos), small pictures and the cards of other
// articles ("You may also like": a picture inside a link to another page) are
// left out.
function imagesOf($: cheerio.CheerioAPI, content: Content, pageUrl: string): string[] {
  const urls: string[] = [];
  content.find("img").each((_, element) => {
    const img = $(element);
    const src = img.attr("data-src") ?? img.attr("data-lazy-src") ?? img.attr("src");
    if (!src || src.startsWith("data:") || /\.svg(\?|$)/i.test(src)) return;
    if (isSmall(img.attr("width")) || isSmall(img.attr("height"))) return;
    if (linksToAnotherPage(img.closest("a[href]").attr("href"))) return;
    urls.push(absolute(src, pageUrl));
  });
  return urls;
}

// A link around a picture often opens it full size: that one stays.
function linksToAnotherPage(href: string | undefined): boolean {
  if (!href || href.startsWith("#")) return false;
  return !/\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(href);
}

function isSmall(size: string | undefined): boolean {
  const pixels = Number.parseInt(size ?? "", 10);
  return !Number.isNaN(pixels) && pixels < MIN_IMAGE_SIZE;
}

const WORK_TYPES = ["Movie", "TVSeries", "TVSeason", "TVEpisode"];

// JSON-LD is the page's own description for search engines, often with the
// exact title and year. Unreadable blocks (AlloCiné writes some) are skipped.
function worksOf($: cheerio.CheerioAPI): string[] {
  const works: string[] = [];
  $('script[type="application/ld+json"]').each((_, script) => {
    // Letterboxd wraps it in a CDATA comment.
    const json = $(script)
      .text()
      .replace(/\/\*\s*<!\[CDATA\[\s*\*\/|\/\*\s*\]\]>\s*\*\//g, "");
    let data: unknown;
    try {
      data = JSON.parse(json);
    } catch {
      return;
    }
    for (const item of jsonLdItems(data)) {
      const types = [item["@type"]].flat();
      const type = types.find((t) => WORK_TYPES.includes(String(t)));
      if (!type || typeof item.name !== "string") continue;
      works.push(describeWork(String(type), item));
    }
  });
  return works;
}

type JsonLdItem = Record<string, unknown>;

// A block is one item, a list of items, or a `@graph` of items.
function jsonLdItems(data: unknown): JsonLdItem[] {
  if (Array.isArray(data)) return data.flatMap(jsonLdItems);
  if (!data || typeof data !== "object") return [];
  const item = data as JsonLdItem;
  if (Array.isArray(item["@graph"])) return item["@graph"].flatMap(jsonLdItems);
  return [item];
}

// `Movie "Athéna" (also "Athena")`, `Movie "Dune: Part Two" (2024)`.
function describeWork(type: string, item: JsonLdItem): string {
  let text = `${type} "${item.name}"`;
  if (typeof item.alternateName === "string") text += ` (also "${item.alternateName}")`;
  const date = item.datePublished ?? item.dateCreated ?? item.startDate;
  const year = typeof date === "string" ? date.match(/^\d{4}/)?.[0] : undefined;
  if (year) text += ` (${year})`;
  return text;
}

function absolute(href: string, pageUrl: string): string {
  try {
    return new URL(href, pageUrl).href;
  } catch {
    return href;
  }
}

async function fetchOrFail(url: string, what: string): Promise<Response> {
  const host = new URL(url).hostname.replace(/^www\./, "");
  let res: Response;
  try {
    res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15_000) });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new SpotarrError("timeout", `${host} took more than 15 s to send ${what}`);
    }
    throw new SpotarrError("unavailable", `${host} could not be reached: ${String(error)}`);
  }
  if (!res.ok) {
    throw new SpotarrError("unavailable", `${host} answered HTTP ${res.status} for ${what}`);
  }
  return res;
}
