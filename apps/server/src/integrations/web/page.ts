import * as cheerio from "cheerio";
import { SpotarrError } from "../../errors";

// What a web page says about itself: an article, a film's page on Letterboxd,
// AlloCiné or Wikipedia.
export type WebPage = {
  title?: string;
  description?: string;
  siteName?: string;
  imageUrl?: string;
  // The films and shows its JSON-LD describes: `Movie "Dune: Part Two" (2024)`.
  works: string[];
  // Every link of the page, where IMDb and TMDB links hide.
  links: string[];
  // Its paragraphs, capped: enough for the LLM, and a bounded price.
  text: string;
};

const MAX_TEXT = 8000;

// Some sites (Wikipedia) refuse a request without a browser's User-Agent.
const HEADERS = {
  "Accept-Language": "fr, en;q=0.8",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
};

export async function readWebPage(url: string): Promise<WebPage> {
  const res = await fetchOrFail(url, "the page");
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("html")) {
    throw new SpotarrError("invalid_input", `the link is not a web page (${type || "no type"})`);
  }
  // A redirect may have moved the page: relative addresses follow it.
  return parseWebPage(await res.text(), res.url || url);
}

// Downloads the page's picture.
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
  // Last: it removes the menus and footers from the page.
  const text = textOf($);
  return {
    title:
      meta("og:title") ?? meta("twitter:title") ?? ($("title").first().text().trim() || undefined),
    description: meta("og:description") ?? meta("description"),
    siteName: meta("og:site_name"),
    imageUrl: image ? absolute(image, pageUrl) : undefined,
    works,
    links,
    text,
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

// The paragraphs of the article (or main part) when the page marks one.
// Menus, headers and footers are left out.
function textOf($: cheerio.CheerioAPI): string {
  $("script, style, noscript, nav, header, footer, aside, form").remove();
  let root = $("article").first();
  if (root.length === 0) root = $("main").first();
  if (root.length === 0) root = $("body");

  const paragraphs: string[] = [];
  root.find("h1, p").each((_, element) => {
    const text = $(element).text().replace(/\s+/g, " ").trim();
    if (text) paragraphs.push(text);
  });
  return paragraphs.join("\n").slice(0, MAX_TEXT);
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
