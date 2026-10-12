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

type Props = {
  total: number;
  counts: SummaryCount[];
  summary?: Summary;
  onSummaryChange: (summary?: Summary) => void;
  search: string;
  onSearchChange: (search: string) => void;
};

// The Summary filters with their counts, and the search, on one line.
export function HistoryFilters(props: Props) {
  const countOf = (summary: Summary) => props.counts.find((c) => c.summary === summary)?.count ?? 0;

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      {/* On a phone the filters scroll sideways instead of taking three lines. */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
        <FilterButton
          label="All"
          count={props.total}
          active={props.summary === undefined}
          onClick={() => props.onSummaryChange(undefined)}
        />
        {FILTERS.map((summary) => (
          <FilterButton
            key={summary}
            label={<SummaryLabel summary={summary} />}
            count={countOf(summary)}
            active={props.summary === summary}
            onClick={() => props.onSummaryChange(summary)}
          />
        ))}
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
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={props.active}
      onClick={props.onClick}
      className="flex h-9 shrink-0 items-center gap-1 rounded-full border border-border px-3 text-sm whitespace-nowrap hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent aria-pressed:border-text aria-pressed:bg-text aria-pressed:text-bg"
    >
      {props.label} <span className="opacity-60">{props.count}</span>
    </button>
  );
}
