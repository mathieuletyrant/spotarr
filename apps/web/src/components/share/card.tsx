import type { ReactNode } from "react";

// A bordered panel with a small upper-case title, as in the mockups.
export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface-raised p-5">
      <h2 className="mb-4 text-xs font-semibold tracking-wide text-text-muted uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}
