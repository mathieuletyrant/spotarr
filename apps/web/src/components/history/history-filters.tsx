import { Summary, type SummaryCount } from "@spotarr/contract";
import { Search } from "lucide-react";
import type { ReactNode } from "react";
import { SummaryLabel } from "../status-badge";

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
  search: string;
  onSearchChange: (search: string) => void;
};

// The Summary filters with their counts, and the search, on one line. A
// Summary with no share is hidden, unless it is the one selected.
export function HistoryFilters(props: Props) {
  const countOf = (summary: Summary) => props.counts.find((c) => c.summary === summary)?.count ?? 0;

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      {/* On a phone the filters scroll sideways instead of taking three lines. */}
      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
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

      <label className="flex h-9 shrink-0 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm md:w-64">
        <Search aria-hidden className="size-4 text-text-muted" />
        <span className="sr-only">Search by title or source</span>
        <input
          type="search"
          placeholder="Title or source"
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
      className="flex h-8 shrink-0 items-center gap-2 rounded-md px-3 text-sm whitespace-nowrap text-text-muted hover:text-text focus-visible:outline-2 focus-visible:outline-accent aria-pressed:bg-bg aria-pressed:font-medium aria-pressed:text-text aria-pressed:shadow-sm"
    >
      {props.dot && <span aria-hidden className={`size-2 rounded-full ${props.dot}`} />}
      {props.label}
      <span className="rounded-full bg-text/8 px-1.5 text-xs tabular-nums">{props.count}</span>
    </button>
  );
}
