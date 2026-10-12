import type { MonthStats } from "@spotarr/contract";
import { ChartColumn } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "../share/card";

// The last 12 months, empty ones included, so the chart reads as a timeline.
const MONTHS_SHOWN = 12;

// One bar per month, as tall as its Shares, split by how they ended.
export function MonthsChart({ months }: { months: MonthStats[] }) {
  const shown = lastMonths(months);
  const highest = Math.max(...shown.map((month) => month.shares), 1);

  return (
    <Card icon={<ChartColumn aria-hidden className="size-4" />} title="Shares per month">
      <div className="relative h-56">
        {/* Three faint lines: the top, the middle and the bottom of the scale. */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-5 bottom-6 flex flex-col justify-between"
        >
          <GridLine value={highest} />
          <GridLine value={Math.round(highest / 2)} />
          <GridLine value={0} />
        </div>
        <div className="absolute inset-0 left-8 flex items-end gap-1.5 sm:gap-3">
          {shown.map((month) => (
            <div key={month.month} className="flex h-full flex-1 flex-col items-center">
              <div className="flex w-full flex-1 flex-col justify-end pt-5">
                <div
                  role="img"
                  title={describe(month)}
                  aria-label={describe(month)}
                  className="mx-auto flex w-full max-w-10 flex-col-reverse overflow-hidden rounded-t-md transition-opacity hover:opacity-80"
                  style={{ height: `${(month.shares / highest) * 100}%` }}
                >
                  <Segment count={month.identified} total={month.shares} className="bg-accent" />
                  <Segment
                    count={month.noMatch}
                    total={month.shares}
                    className="bg-status-no-match"
                  />
                  <Segment count={month.failed} total={month.shares} className="bg-status-error" />
                </div>
              </div>
              <span className="h-6 pt-1.5 text-[11px] text-text-muted">
                {monthName(month.month)}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-text-muted">
        <Legend className="bg-accent">Identified</Legend>
        <Legend className="bg-status-no-match">No match</Legend>
        <Legend className="bg-status-error">Failed</Legend>
      </div>
    </Card>
  );
}

// The 12 months up to this one; a month without Shares gets an empty bar.
function lastMonths(months: MonthStats[]): MonthStats[] {
  const shown: MonthStats[] = [];
  const now = new Date();
  for (let back = MONTHS_SHOWN - 1; back >= 0; back--) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    const key = date.toISOString().slice(0, 7);
    const found = months.find((month) => month.month === key);
    shown.push(found ?? emptyMonth(key));
  }
  return shown;
}

function emptyMonth(month: string): MonthStats {
  return {
    $typeName: "spotarr.v1.MonthStats",
    month,
    shares: 0,
    identified: 0,
    noMatch: 0,
    failed: 0,
    additions: 0,
    automaticAdditions: 0,
    llmCostUsd: 0,
  };
}

function describe(month: MonthStats): string {
  return `${monthName(month.month)}: ${month.shares} shares, ${month.identified} identified, ${month.noMatch} no match, ${month.failed} failed`;
}

// Zero height: the line sits exactly where a bar of that value ends.
function GridLine({ value }: { value: number }) {
  return (
    <div className="flex h-0 items-center gap-2">
      <span className="w-6 text-right text-[11px] tabular-nums text-text-muted">{value}</span>
      <span className="h-px flex-1 bg-divider" />
    </div>
  );
}

function Segment({ count, total, className }: { count: number; total: number; className: string }) {
  if (count === 0) return null;
  return <div className={className} style={{ height: `${(count / total) * 100}%` }} />;
}

function Legend({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-2.5 rounded-sm ${className}`} />
      {children}
    </span>
  );
}

// "2026-10" → "Oct".
function monthName(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
}
