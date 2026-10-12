import type { Summary } from "@spotarr/contract";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useDeferredValue, useState } from "react";
import { HistoryFilters } from "../../components/history/history-filters";
import { HistoryTable } from "../../components/history/history-table";
import { historyQuery } from "../../queries/shares";

export const Route = createFileRoute("/_app/")({ component: HistoryPage });

function HistoryPage() {
  const [summary, setSummary] = useState<Summary>();
  const [search, setSearch] = useState("");
  // Typing stays smooth: the list follows a moment after the keystrokes.
  const query = useDeferredValue(search.trim());

  const history = useInfiniteQuery(historyQuery({ summary, query }));
  const firstPage = history.data?.pages[0];
  const shares = history.data?.pages.flatMap((page) => page.shares) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold">History</h1>
        <p className="mt-1 text-text-muted">Every share, what was suggested and what was added.</p>
      </div>

      <HistoryFilters
        total={firstPage?.total ?? 0}
        counts={firstPage?.counts ?? []}
        summary={summary}
        onSummaryChange={setSummary}
        search={search}
        onSearchChange={setSearch}
      />

      {history.isPending && <p className="text-text-muted">Loading…</p>}
      {history.error && <p className="text-status-error">{history.error.message}</p>}
      {history.isSuccess && shares.length === 0 && (
        <p className="text-text-muted">Nothing here yet.</p>
      )}
      {shares.length > 0 && <HistoryTable shares={shares} />}

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
