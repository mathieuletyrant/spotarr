import type { ReactNode } from "react";

// One step of the setup: its number in an amber circle, what to do, then
// what it needs (the values to copy, the types to tick).
export function Step({ n, title, children }: { n: number; title: string; children?: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
        {n}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-4 pt-0.5">
        <p className="text-sm font-medium">{title}</p>
        {children}
      </div>
    </li>
  );
}
