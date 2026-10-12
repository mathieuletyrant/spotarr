import * as cheerio from "cheerio";
import { type DirectId, findDirectIds } from "./direct-ids";

export type WebPage = {
  title?: string;
  description?: string;
  imageUrl?: string;
  // The film or show the page is about, when it says so in JSON-LD.
  work?: { name: string; originalName?: string };
  // The readable text of the page, for the LLM (#16).
  text: string;
  directIds: DirectId[];
};

const MAX_TEXT = 8000;

// Some sites only answer browsers.
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

// Downloads a page and reads it. Throws when the site answers an error or takes more than 15 s.
export async function readWebPage(url: string): Promise<WebPage> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "fr,en" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`${new URL(url).hostname} answered ${res.status}`);
  return parseWebPage(await res.text());
}

export function parseWebPage(html: string): WebPage {
  const $ = cheerio.load(html);
  const meta = (name: string) =>
    $(`meta[property="${name}"], meta[name="${name}"]`).attr("content")?.trim() || undefined;

  return {
    title: meta("og:title") ?? ($("title").text().trim() || undefined),
    description: meta("og:description") ?? meta("description"),
    imageUrl: meta("og:image"),
    work: workIn($),
    text: textOf($),
    directIds: directIdsIn($),
  };
}

// Letterboxd tags its pages with the TMDB id. Other pages may link to IMDb or TMDB.
function directIdsIn($: cheerio.CheerioAPI): DirectId[] {
  const tagged = $("[data-tmdb-id]").first();
  const tmdbId = Number(tagged.attr("data-tmdb-id"));
  if (tmdbId > 0) {
    const type = tagged.attr("data-tmdb-type") === "tv" ? "TV" : "MOVIE";
    return [{ source: "tmdb", type, id: tmdbId }];
  }

  const links = $("a[href]")
    .map((_, a) => $(a).attr("href"))
    .get();
  return findDirectIds(links.join(" "));
}

// JSON-LD is structured data some sites embed for search engines.
function workIn($: cheerio.CheerioAPI): WebPage["work"] {
  for (const script of $('script[type="application/ld+json"]').toArray()) {
    for (const item of jsonLdItems($(script).text())) {
      if (item["@type"] === "Movie" || item["@type"] === "TVSeries") {
        if (typeof item.name !== "string") continue;
        const originalName =
          typeof item.alternateName === "string" ? item.alternateName : undefined;
        return { name: item.name, originalName };
      }
    }
  }
  return undefined;
}

// A JSON-LD block holds one object, a list, or a list under "@graph".
// Some sites wrap it in /* */ comments; a block that is not valid JSON is skipped.
function jsonLdItems(block: string): Record<string, unknown>[] {
  try {
    const data = JSON.parse(block.replace(/\/\*[\s\S]*?\*\//g, ""));
    if (Array.isArray(data)) return data;
    if (Array.isArray(data["@graph"])) return data["@graph"];
    return [data];
  } catch {
    return [];
  }
}

// The text a reader sees: the article or main part when there is one, without menus.
function textOf($: cheerio.CheerioAPI): string {
  $("script, style, nav, header, footer, aside, form").remove();
  // Without this, "<h1>Review</h1><p>Great</p>" would read "ReviewGreat".
  $("p, div, li, br, h1, h2, h3, h4, td").after(" ");
  const main = $("article").first().text() || $("main").first().text() || $("body").text();
  return main.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT);
}
