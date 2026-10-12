import type { MonthStats } from "@spotarr/contract";
import { Coins, LibraryBig, ScanSearch, Share } from "lucide-react";
import type { ReactNode } from "react";

// The four numbers of the whole history, summed from its months.
export function Totals({ months, added }: { months: MonthStats[]; added: number }) {
  let shares = 0;
  let identified = 0;
  let finished = 0;
  let automatic = 0;
  let cost = 0;
  for (const month of months) {
    shares += month.shares;
    identified += month.identified;
    finished += month.identified + month.noMatch + month.failed;
    automatic += month.automaticAdditions;
    cost += month.llmCostUsd;
  }
  // Out of the finished Identifications: the ones in progress do not count yet.
  const rate = finished > 0 ? Math.round((identified / finished) * 100) : 0;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile icon={<Share aria-hidden className="size-4" />} label="Shares" value={shares}>
        {thisMonth(months)} this month
      </Tile>
      <Tile
        icon={<ScanSearch aria-hidden className="size-4" />}
        label="Identified"
        value={`${rate}%`}
      >
        <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-text/8">
          <span className="block h-full rounded-full bg-accent" style={{ width: `${rate}%` }} />
        </span>
      </Tile>
      <Tile icon={<LibraryBig aria-hidden className="size-4" />} label="Added" value={added}>
        {automatic} by auto add
      </Tile>
      <Tile
        icon={<Coins aria-hidden className="size-4" />}
        label="LLM cost"
        value={`$${cost.toFixed(2)}`}
      >
        {finished > 0 ? `about $${(cost / finished).toFixed(3)} a share` : "nothing yet"}
      </Tile>
    </div>
  );
}

function thisMonth(months: MonthStats[]): number {
  const current = new Date().toISOString().slice(0, 7);
  return months.find((month) => month.month === current)?.shares ?? 0;
}

function Tile({
  icon,
  label,
  value,
  children,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-raised p-4 md:p-5">
      <span className="flex items-center gap-2 text-sm text-text-muted">
        <span className="flex size-7 items-center justify-center rounded-md bg-accent/15 text-accent">
          {icon}
        </span>
        {label}
      </span>
      <span className="text-3xl font-semibold tabular-nums md:text-4xl">{value}</span>
      <span className="text-xs text-text-muted">{children}</span>
    </div>
  );
}
