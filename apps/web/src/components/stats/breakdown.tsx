import type { SourceStats } from "@spotarr/contract";
import { Globe, PieChart } from "lucide-react";
import { Card } from "../share/card";

// Movies and shows added, as one bar across the card, then where the Shares come from.
export function Breakdown({
  movies,
  shows,
  sources,
}: {
  movies: number;
  shows: number;
  sources: SourceStats[];
}) {
  const added = movies + shows;
  const moviesPercent = added > 0 ? (movies / added) * 100 : 0;
  const highest = Math.max(...sources.map((source) => source.shares), 1);

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <Card icon={<PieChart aria-hidden className="size-4" />} title="Movies and shows">
        <div className="flex flex-col gap-5">
          <p className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold tabular-nums">{added}</span>
            <span className="text-sm text-text-muted">added</span>
          </p>
          {/* Movies, then shows; grey until something is added. */}
          <div
            role="img"
            aria-label={`${movies} movies and ${shows} shows added`}
            className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-divider"
          >
            {movies > 0 && <div className="bg-accent" style={{ width: `${moviesPercent}%` }} />}
            {shows > 0 && <div className="flex-1 bg-status-requested" />}
          </div>
          <ul className="grid grid-cols-2 gap-4">
            <Count className="bg-accent" label="Movies" count={movies} total={added} />
            <Count className="bg-status-requested" label="Shows" count={shows} total={added} />
          </ul>
        </div>
      </Card>

      <Card icon={<Globe aria-hidden className="size-4" />} title="Sources">
        <ul className="flex flex-col gap-3">
          {sources.map((source) => (
            <li key={source.source} className="flex flex-col gap-1.5 text-sm">
              <span className="flex justify-between gap-2">
                <span className="truncate">{source.source}</span>
                <span className="tabular-nums text-text-muted">{source.shares}</span>
              </span>
              <span className="h-2 overflow-hidden rounded-full bg-text/8">
                <span
                  className="block h-full rounded-full bg-accent"
                  style={{ width: `${(source.shares / highest) * 100}%` }}
                />
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

// One kind: its color and name, then how many and their share of the total.
function Count({
  className,
  label,
  count,
  total,
}: {
  className: string;
  label: string;
  count: number;
  total: number;
}) {
  const percent = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <li className="flex flex-col gap-1">
      <span className="flex items-center gap-2 text-sm text-text-muted">
        <span className={`size-2.5 rounded-sm ${className}`} />
        {label}
      </span>
      <span className="flex items-baseline gap-2">
        <span className="text-xl font-semibold tabular-nums">{count}</span>
        <span className="text-sm tabular-nums text-text-muted">{percent}%</span>
      </span>
    </li>
  );
}
