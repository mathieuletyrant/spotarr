import type { Summary } from "@spotarr/contract";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useDeferredValue, useState } from "react";
import { EmptyHistory } from "../../components/history/empty-history";
import { HistoryFilters } from "../../components/history/history-filters";
import { HistoryTable } from "../../components/history/history-table";
import { historyQuery } from "../../queries/shares";

export const Route = createFileRoute("/_app/")({
  // ?keyword=detective shows the Shares tagged with it: a Share's keywords link here.
  validateSearch: (search: Record<string, unknown>): { keyword?: string } =>
    typeof search.keyword === "string" && search.keyword !== "" ? { keyword: search.keyword } : {},
  component: HistoryPage,
});

function HistoryPage() {
  const [summary, setSummary] = useState<Summary>();
  const [genre, setGenre] = useState<string>();
  const [search, setSearch] = useState("");
  const { keyword } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const clearKeyword = () => navigate({ search: (prev) => ({ ...prev, keyword: undefined }) });
  // Typing stays smooth: the list follows a moment after the keystrokes.
  const query = useDeferredValue(search.trim());

  const history = useInfiniteQuery(
    historyQuery({
      summary,
      genres: genre ? [genre] : [],
      keywords: keyword ? [keyword] : [],
      query,
    }),
  );
  const firstPage = history.data?.pages[0];
  const shares = history.data?.pages.flatMap((page) => page.shares) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold">History</h1>
        <p className="mt-1 hidden text-text-muted sm:block">
          Every share, what was suggested and what was added.
        </p>
      </div>

      <HistoryFilters
        total={firstPage?.total ?? 0}
        counts={firstPage?.counts ?? []}
        summary={summary}
        onSummaryChange={setSummary}
        genres={firstPage?.genres ?? []}
        genre={genre}
        onGenreChange={setGenre}
        keyword={keyword}
        onKeywordClear={clearKeyword}
        search={search}
        onSearchChange={setSearch}
      />

      {history.isPending && <p className="text-text-muted">Loading…</p>}
      {history.error && <p className="text-status-error">{history.error.message}</p>}
      {history.isSuccess && shares.length === 0 && (
        <EmptyHistory
          filtered={
            summary !== undefined || genre !== undefined || keyword !== undefined || query !== ""
          }
          onClear={() => {
            setSummary(undefined);
            setGenre(undefined);
            setSearch("");
            clearKeyword();
          }}
        />
      )}
      {shares.length > 0 && <HistoryTable shares={shares} />}

      {history.hasNextPage && (
        <button
          type="button"
          onClick={() => history.fetchNextPage()}
          disabled={history.isFetchingNextPage}
          className="self-center rounded-md border border-border px-4 py-2 hover:bg-surface"
        >
          Load older
        </button>
      )}
    </div>
  );
}
