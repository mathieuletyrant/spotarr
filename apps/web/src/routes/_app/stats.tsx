import type { MonthStats, SourceStats } from "@spotarr/contract";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { statsQuery } from "../../queries/status";

export const Route = createFileRoute("/_app/stats")({ component: StatsPage });

// The bar chart shows the last 12 months; the totals count everything.
const MONTHS_SHOWN = 12;

function StatsPage() {
  const { data, error, isPending } = useQuery(statsQuery());

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold">Stats</h1>
        <p className="mt-1 text-text-muted">What Spotarr did since the first share.</p>
      </div>
      {isPending && <p className="text-text-muted">Loading…</p>}
      {error && <p className="text-status-error">{error.message}</p>}
      {data && data.months.length === 0 && (
        <p className="text-text-muted">No shares yet: stats show up after the first one.</p>
      )}
      {data && data.months.length > 0 && (
        <>
          <Totals months={data.months} />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <MonthsChart months={data.months.slice(-MONTHS_SHOWN)} />
            <Sources sources={data.sources} />
          </div>
        </>
      )}
    </div>
  );
}

function Totals({ months }: { months: MonthStats[] }) {
  let shares = 0;
  let identified = 0;
  let finished = 0;
  let additions = 0;
  let automatic = 0;
  let cost = 0;
  for (const month of months) {
    shares += month.shares;
    identified += month.identified;
    finished += month.identified + month.noMatch + month.failed;
    additions += month.additions;
    automatic += month.automaticAdditions;
    cost += month.llmCostUsd;
  }
  // Out of the finished Identifications: the ones in progress do not count yet.
  const rate = finished > 0 ? Math.round((identified / finished) * 100) : 0;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile label="Shares" value={shares} />
      <Tile label="Identified" value={`${rate}%`} detail={`${identified} of ${finished}`} />
      <Tile label="Added" value={additions} detail={`${automatic} by auto add`} />
      <Tile
        label="LLM cost"
        value={`$${cost.toFixed(2)}`}
        detail={finished > 0 ? `$${(cost / finished).toFixed(3)} a share` : undefined}
      />
    </div>
  );
}

function Tile({ label, value, detail }: { label: string; value: ReactNode; detail?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface-raised p-4">
      <span className="text-sm text-text-muted">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      {detail && <span className="text-xs text-text-muted">{detail}</span>}
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface-raised p-5">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  );
}

// One bar per month, as tall as its Shares, split by how they ended.
function MonthsChart({ months }: { months: MonthStats[] }) {
  const highest = Math.max(...months.map((month) => month.shares), 1);

  return (
    <Card title="Shares per month">
      <div className="flex h-48 items-end gap-2">
        {months.map((month) => (
          <div key={month.month} className="flex h-full flex-1 flex-col items-center gap-1">
            <span className="text-xs tabular-nums text-text-muted">{month.shares}</span>
            <div
              role="img"
              aria-label={`${monthName(month.month)}: ${month.shares} shares, ${month.identified} identified, ${month.noMatch} no match, ${month.failed} failed`}
              className="flex w-full max-w-12 flex-col-reverse overflow-hidden rounded-t-md"
              style={{ height: `${(month.shares / highest) * 100}%` }}
            >
              <Segment count={month.identified} total={month.shares} className="bg-status-added" />
              <Segment count={month.noMatch} total={month.shares} className="bg-status-no-match" />
              <Segment count={month.failed} total={month.shares} className="bg-status-error" />
            </div>
            <span className="text-xs text-text-muted">{monthName(month.month)}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-text-muted">
        <Legend className="bg-status-added">Identified</Legend>
        <Legend className="bg-status-no-match">No match</Legend>
        <Legend className="bg-status-error">Failed</Legend>
      </div>
    </Card>
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

function Sources({ sources }: { sources: SourceStats[] }) {
  const highest = Math.max(...sources.map((source) => source.shares), 1);

  return (
    <Card title="Sources">
      <ul className="flex flex-col gap-3">
        {sources.map((source) => (
          <li key={source.source} className="flex flex-col gap-1 text-sm">
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
  );
}

// "2026-10" → "Oct 26".
function monthName(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}
