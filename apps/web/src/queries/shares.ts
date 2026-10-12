import { createInfiniteQueryOptions } from "@connectrpc/connect-query";
import { SpotarrService, Summary } from "@spotarr/contract";
import { infiniteQueryOptions } from "@tanstack/react-query";
import { transport } from "../lib/api";

export const HISTORY_PAGE_SIZE = 20;

export type HistoryFilter = { summary?: Summary; query: string };

// The history, newest first, page by page. While a Share is being identified,
// it is asked again every 2 s. Use with TanStack Query's useInfiniteQuery.
export function historyQuery({ summary, query }: HistoryFilter) {
  const listShares = createInfiniteQueryOptions(
    SpotarrService.method.listShares,
    {
      pageSize: HISTORY_PAGE_SIZE,
      summaries: summary === undefined ? [] : [summary],
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
