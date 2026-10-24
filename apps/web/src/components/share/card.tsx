import type { ReactNode } from "react";

// A bordered panel, its title next to a small amber icon.
export function Card({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface-raised p-5 shadow-card">
      <h2 className="mb-4 flex items-center gap-2.5 font-semibold">
        <span className="flex size-7 items-center justify-center rounded-md bg-accent/15 text-accent">
          {icon}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}
