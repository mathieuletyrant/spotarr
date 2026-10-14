import { SpotarrError } from "../../../errors";
import type { Share, Summary } from "../types";

export type HistoryRequest = {
  // Shares per page: 50 when absent, 100 at most.
  limit?: number;
  // The id of the last Share of the previous page.
  cursor?: string;
  // Only these Summaries; all when empty.
  summaries: Summary[];
  // Searched in the source, the URL, the text, the candidates' titles and genres.
  query?: string;
  // Only the Shares with a Candidate of one of these genres; all when empty.
  genres?: string[];
};

// One page of the history, newest first. `shares` is the whole history, newest first.
export function historyPage(shares: Share[], request: HistoryRequest) {
  const { cursor, summaries, query } = request;
  const genres = request.genres ?? [];
  if (request.limit !== undefined && request.limit < 1) {
    throw new SpotarrError("invalid_input", "page_size: at least 1");
  }
  const limit = Math.min(request.limit ?? 50, 100);

  const matching = shares.filter(
    (share) =>
      (summaries.length === 0 || summaries.includes(share.summary)) &&
      (!query || matches(share, query)) &&
      (genres.length === 0 || genres.some((genre) => hasGenre(share, genre))) &&
      // Ids sort by creation time, so "after the cursor" means "older than it".
      (!cursor || share.id < cursor),
  );

  const page = matching.slice(0, limit);
  const nextCursor = matching.length > limit ? page.at(-1)?.id : undefined;
  return {
    shares: page,
    nextCursor,
    total: shares.length,
    counts: countBySummary(shares),
    genres: countByGenre(shares),
  };
}

function hasGenre(share: Share, genre: string): boolean {
  return share.candidates.some((c) => c.genres?.includes(genre));
}

// How many Shares per genre, over the whole history: most Shares first, then
// alphabetical. A Share counts once per genre, however many Candidates have it.
export function countByGenre(shares: Share[]): { genre: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const share of shares) {
    const genres = new Set(share.candidates.flatMap((c) => c.genres ?? []));
    for (const genre of genres) counts.set(genre, (counts.get(genre) ?? 0) + 1);
  }
  return [...counts]
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count || a.genre.localeCompare(b.genre));
}

// How many Shares per Summary, over the whole history.
function countBySummary(shares: Share[]): Map<Summary, number> {
  const counts = new Map<Summary, number>();
  for (const share of shares) counts.set(share.summary, (counts.get(share.summary) ?? 0) + 1);
  return counts;
}

function matches(share: Share, query: string): boolean {
  const words = [
    share.source,
    share.input.url,
    share.input.text,
    ...share.candidates.map((c) => c.title),
    ...share.candidates.flatMap((c) => c.genres ?? []),
  ];
  return words.join(" ").toLowerCase().includes(query.toLowerCase());
}
