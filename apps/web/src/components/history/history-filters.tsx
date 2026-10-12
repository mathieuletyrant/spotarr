import type { Summary, SummaryCount } from "@spotarr/contract";
import { Search } from "lucide-react";
import { SUMMARIES } from "../../lib/summary";

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
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      {/* On a phone the filters scroll sideways instead of taking three lines. */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
        <FilterButton
          label="All"
          count={props.total}
          active={props.summary === undefined}
          onClick={() => props.onSummaryChange(undefined)}
        />
        {SUMMARIES.map(({ summary, label }) => (
          <FilterButton
            key={summary}
            label={label}
            count={countOf(summary)}
            active={props.summary === summary}
            onClick={() => props.onSummaryChange(summary)}
          />
        ))}
      </div>

      <label className="flex shrink-0 items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 md:w-64">
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
