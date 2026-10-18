import { createInfiniteQueryOptions, createQueryOptions } from "@connectrpc/connect-query";
import { type MediaType, SpotarrService, Summary } from "@spotarr/contract";
import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { transport } from "../lib/api";

const HISTORY_PAGE_SIZE = 20;

export type HistoryFilter = { summary?: Summary; genres: string[]; query: string };

// The history, newest first, page by page. While a Share is being identified,
// it is asked again every 2 s. Use with TanStack Query's useInfiniteQuery.
export function historyQuery({ summary, genres, query }: HistoryFilter) {
  const listShares = createInfiniteQueryOptions(
    SpotarrService.method.listShares,
    {
      pageSize: HISTORY_PAGE_SIZE,
      summaries: summary === undefined ? [] : [summary],
      genres,
      query,
      // An empty cursor is the first page.
      cursor: "",
    },
    { transport, pageParamKey: "cursor", getNextPageParam: (page) => page.nextCursor },
  );

  return infiniteQueryOptions({
    ...listShares,
    refetchInterval: (q) => {
      const pages = q.state.data?.pages ?? [];
      const inProgress = pages.some((page) =>
        page.shares.some((s) => s.summary === Summary.IN_PROGRESS),
      );
      return inProgress ? 2000 : false;
    },
  });
}

// One Share, asked again every 2 s while it is being identified.
export function shareQuery(id: string) {
  return queryOptions({
    ...createQueryOptions(SpotarrService.method.getShare, { id }, { transport }),
    refetchInterval: (q) => (q.state.data?.share?.summary === Summary.IN_PROGRESS ? 2000 : false),
  });
}

// Where a Candidate can be watched now, asked when its Share's page opens.
export function watchLinksQuery(tmdbId: number, type: MediaType) {
  return queryOptions({
    ...createQueryOptions(SpotarrService.method.listWatchLinks, { tmdbId, type }, { transport }),
    staleTime: 10 * 60_000,
    retry: false,
  });
}
