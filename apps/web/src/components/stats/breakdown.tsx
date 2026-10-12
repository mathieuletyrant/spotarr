import type { SourceStats } from "@spotarr/contract";
import { Globe, PieChart } from "lucide-react";
import { Card } from "../share/card";

// Movies and shows added, as a ring, then where the Shares come from.
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
    <div className="flex flex-col gap-6">
      <Card icon={<PieChart aria-hidden className="size-4" />} title="Movies and shows">
        <div className="flex items-center gap-6">
          <div
            role="img"
            aria-label={`${movies} movies and ${shows} shows added`}
            className="relative size-28 shrink-0 rounded-full"
            style={{
              background:
                added > 0
                  ? `conic-gradient(var(--color-accent) 0 ${moviesPercent}%, var(--color-status-requested) ${moviesPercent}% 100%)`
                  : "var(--color-divider)",
            }}
          >
            {/* The hole of the ring, with the total in it. */}
            <span className="absolute inset-3 flex flex-col items-center justify-center rounded-full bg-surface-raised">
              <span className="text-2xl font-semibold tabular-nums">{added}</span>
              <span className="text-[11px] text-text-muted">added</span>
            </span>
          </div>
          <ul className="flex flex-col gap-2 text-sm">
            <Count className="bg-accent" label="Movies" count={movies} />
            <Count className="bg-status-requested" label="Shows" count={shows} />
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

function Count({ className, label, count }: { className: string; label: string; count: number }) {
  return (
    <li className="flex items-center gap-2">
      <span className={`size-2.5 rounded-sm ${className}`} />
      <span className="text-text-muted">{label}</span>
      <span className="font-semibold tabular-nums">{count}</span>
    </li>
  );
}
