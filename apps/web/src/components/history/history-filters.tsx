import { type GenreCount, Summary, type SummaryCount } from "@spotarr/contract";
import { Search, Tag, X } from "lucide-react";
import type { ReactNode } from "react";
import { SUMMARY_LABELS, SummaryLabel } from "../status-badge";

// The filters, in the mockup's order.
const FILTERS = [
  Summary.IN_PROGRESS,
  Summary.ADDED,
  Summary.REQUESTED,
  Summary.ALREADY_PRESENT,
  Summary.TO_CHOOSE,
  Summary.NO_MATCH,
  Summary.FAILED,
];

// The same color as the Summary's badge in the table. Written out in full:
// Tailwind only generates classes it finds whole.
const DOTS: Record<Summary, string> = {
  [Summary.UNSPECIFIED]: "",
  [Summary.IN_PROGRESS]: "bg-status-progress",
  [Summary.TO_CHOOSE]: "bg-status-ready",
  [Summary.ADDED]: "bg-status-added",
  [Summary.REQUESTED]: "bg-status-requested",
  [Summary.ALREADY_PRESENT]: "bg-status-present",
  [Summary.NO_MATCH]: "bg-status-no-match",
  [Summary.FAILED]: "bg-status-error",
};

type Props = {
  total: number;
  counts: SummaryCount[];
  summary?: Summary;
  onSummaryChange: (summary?: Summary) => void;
  // The history's genres, most Shares first; the menu is hidden when there is none.
  genres: GenreCount[];
  genre?: string;
  onGenreChange: (genre?: string) => void;
  // Chosen by clicking a keyword on a Share's page: shown with a way to remove it.
  keyword?: string;
  onKeywordClear: () => void;
  search: string;
  onSearchChange: (search: string) => void;
};

// The Summary filters with their counts, then the genre menu, the keyword
// chosen and the search, on one line. A Summary with no share is hidden, unless it is the one selected.
export function HistoryFilters(props: Props) {
  const countOf = (summary: Summary) => props.counts.find((c) => c.summary === summary)?.count ?? 0;

  return (
    // On a phone the two menus share a line, and the search takes the next one.
    <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap lg:justify-between">
      {/* On a phone or a tablet: a native menu, next to the search. */}
      <select
        aria-label="Filter by status"
        value={props.summary ?? ""}
        onChange={(e) =>
          props.onSummaryChange(
            e.target.value === "" ? undefined : (Number(e.target.value) as Summary),
          )
        }
        className="h-9 min-w-0 flex-1 rounded-md border border-border bg-surface px-2 text-sm sm:flex-none lg:hidden"
      >
        <option value="">All ({props.total})</option>
        {FILTERS.filter((summary) => countOf(summary) > 0 || props.summary === summary).map(
          (summary) => (
            <option key={summary} value={summary}>
              {SUMMARY_LABELS[summary]} ({countOf(summary)})
            </option>
          ),
        )}
      </select>

      <div className="hidden lg:block">
        <div className="flex w-max gap-1 rounded-lg bg-surface p-1">
          <FilterButton
            label="All"
            count={props.total}
            active={props.summary === undefined}
            onClick={() => props.onSummaryChange(undefined)}
          />
          {FILTERS.filter((summary) => countOf(summary) > 0 || props.summary === summary).map(
            (summary) => (
              <FilterButton
                key={summary}
                label={<SummaryLabel summary={summary} />}
                dot={DOTS[summary]}
                count={countOf(summary)}
                active={props.summary === summary}
                onClick={() => props.onSummaryChange(summary)}
              />
            ),
          )}
        </div>
      </div>

      {props.genres.length > 0 && (
        <select
          aria-label="Filter by genre"
          value={props.genre ?? ""}
          onChange={(e) => props.onGenreChange(e.target.value || undefined)}
          className="h-9 min-w-0 flex-1 rounded-md border border-border bg-surface px-2 text-sm sm:max-w-44 sm:flex-none lg:ml-auto"
        >
          <option value="">All genres</option>
          {props.genres.map(({ genre, count }) => (
            <option key={genre} value={genre}>
              {genre} ({count})
            </option>
          ))}
        </select>
      )}

      {props.keyword && (
        <button
          type="button"
          onClick={props.onKeywordClear}
          className="flex h-9 max-w-full min-w-0 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-sm hover:bg-text/8 focus-visible:outline-2 focus-visible:outline-accent"
        >
          <Tag aria-hidden className="size-4 shrink-0 text-text-muted" />
          <span className="truncate">{props.keyword}</span>
          <X aria-hidden className="size-4 shrink-0 text-text-muted" />
          <span className="sr-only">(remove the keyword filter)</span>
        </button>
      )}

      <label className="flex h-9 min-w-0 basis-full items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm sm:flex-1 sm:basis-0 lg:w-64 lg:flex-none lg:basis-auto">
        <Search aria-hidden className="size-4 text-text-muted" />
        <span className="sr-only">Search by title, genre, keyword or source</span>
        <input
          type="search"
          placeholder="Title, genre or source"
          value={props.search}
          onChange={(e) => props.onSearchChange(e.target.value)}
          className="w-full bg-transparent outline-none placeholder:text-text-muted"
        />
      </label>
    </div>
  );
}

function FilterButton(props: {
  label: ReactNode;
  dot?: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={props.active}
      onClick={props.onClick}
      className="flex h-8 shrink-0 items-center gap-2 rounded-md px-3 text-sm whitespace-nowrap text-text-muted hover:text-text aria-pressed:bg-bg aria-pressed:font-medium aria-pressed:text-text aria-pressed:shadow-sm"
    >
      {props.dot && <span aria-hidden className={`size-2 rounded-full ${props.dot}`} />}
      {props.label}
      <span className="rounded-full bg-text/8 px-1.5 text-xs tabular-nums">{props.count}</span>
    </button>
  );
}
