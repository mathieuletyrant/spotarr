import { useInfiniteQuery } from "@connectrpc/connect-query";
import { SpotarrService, Summary } from "@spotarr/contract";
import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { ShareRow } from "../components/share-row";
import { SUMMARIES } from "../lib/summary";

export const Route = createFileRoute("/")({ component: HistoryPage });

const PAGE_SIZE = 20;

function HistoryPage() {
  const [filter, setFilter] = useState<Summary>();
  const [search, setSearch] = useState("");
  // Typing stays smooth: the list follows a moment after the keystrokes.
  const query = useDeferredValue(search.trim());

  const history = useInfiniteQuery(
    SpotarrService.method.listShares,
    {
      pageSize: PAGE_SIZE,
      summaries: filter === undefined ? [] : [filter],
      query,
      cursor: "",
    },
    {
      // An empty cursor is the first page.
      pageParamKey: "cursor",
      getNextPageParam: (page) => page.nextCursor,
      // While a Share is being identified, ask again every 2 s.
      refetchInterval: (q) =>
        q.state.data?.pages.some((page) =>
          page.shares.some((s) => s.summary === Summary.IN_PROGRESS),
        )
          ? 2000
          : false,
    },
  );

  const firstPage = history.data?.pages[0];
  const shares = history.data?.pages.flatMap((page) => page.shares) ?? [];
  const countOf = (summary: Summary) =>
    firstPage?.counts.find((c) => c.summary === summary)?.count ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold">History</h1>
        <p className="mt-1 text-text-muted">Every share, what was suggested and what was added.</p>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        {/* On a phone the filters scroll sideways instead of taking three lines. */}
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
          <FilterButton
            label="All"
            count={firstPage?.total ?? 0}
            active={filter === undefined}
            onClick={() => setFilter(undefined)}
          />
          {SUMMARIES.map(({ summary, label }) => (
            <FilterButton
              key={summary}
              label={label}
              count={countOf(summary)}
              active={filter === summary}
              onClick={() => setFilter(summary)}
            />
          ))}
        </div>
        <label className="flex shrink-0 items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 xl:w-64">
          <Search aria-hidden className="size-4 text-text-muted" />
          <span className="sr-only">Search by title or source</span>
          <input
            type="search"
            placeholder="Title or source"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent outline-none placeholder:text-text-muted"
          />
        </label>
      </div>

      {history.isPending && <p className="text-text-muted">Loading…</p>}
      {history.error && <p className="text-status-error">{history.error.message}</p>}
      {history.isSuccess && shares.length === 0 && (
        <p className="text-text-muted">Nothing here yet.</p>
      )}

      {shares.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border bg-surface-raised">
          <div className="hidden border-b border-border px-4 py-3 text-xs font-semibold tracking-wide text-text-muted uppercase md:grid md:grid-cols-[6rem_minmax(0,1fr)_minmax(0,1.4fr)_6rem_10rem_7rem] md:gap-4">
            <span>Date</span>
            <span>Share</span>
            <span>Result</span>
            <span>Target</span>
            <span>Status</span>
            <span>Identification</span>
          </div>
          <ul className="divide-y divide-border">
            {shares.map((share) => (
              <ShareRow key={share.id} share={share} />
            ))}
          </ul>
        </div>
      )}

      {history.hasNextPage && (
        <button
          type="button"
          onClick={() => history.fetchNextPage()}
          disabled={history.isFetchingNextPage}
          className="self-center rounded-md border border-border px-4 py-2 hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
        >
          Load older
        </button>
      )}
    </div>
  );
}

function FilterButton(props: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={props.active}
      onClick={props.onClick}
      className="shrink-0 rounded-full border border-border px-3 py-1.5 text-sm whitespace-nowrap hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent aria-pressed:border-text aria-pressed:bg-text aria-pressed:text-bg"
    >
      {props.label} <span className="opacity-60">{props.count}</span>
    </button>
  );
}
