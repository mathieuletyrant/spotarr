import { SpotarrError } from "../../../errors";
import type { Share, Summary } from "../types";

export type HistoryRequest = {
  // Shares per page: 50 when absent, 100 at most.
  limit?: number;
  // The id of the last Share of the previous page.
  cursor?: string;
  // Only these Summaries; all when empty.
  summaries: Summary[];
  // Searched in the source, the URL, the text and the candidates' titles.
  query?: string;
};

// One page of the history, newest first. `shares` is the whole history, newest first.
export function historyPage(shares: Share[], request: HistoryRequest) {
  const { cursor, summaries, query } = request;
  if (request.limit !== undefined && request.limit < 1) {
    throw new SpotarrError("invalid_input", "page_size: at least 1");
  }
  const limit = Math.min(request.limit ?? 50, 100);

  const matching = shares.filter(
    (share) =>
      (summaries.length === 0 || summaries.includes(share.summary)) &&
      (!query || matches(share, query)) &&
      // Ids sort by creation time, so "after the cursor" means "older than it".
      (!cursor || share.id < cursor),
  );

  const page = matching.slice(0, limit);
  const nextCursor = matching.length > limit ? page.at(-1)?.id : undefined;
  return { shares: page, nextCursor, total: shares.length, counts: countBySummary(shares) };
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
  ];
  return words.join(" ").toLowerCase().includes(query.toLowerCase());
}
