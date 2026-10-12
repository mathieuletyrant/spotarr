import { Link } from "@tanstack/react-router";
import { Plus, ScanSearch, SearchX, Share, SquarePlus, X } from "lucide-react";
import type { ReactNode } from "react";

// What the History shows instead of the table: either no Share at all yet, or
// none matching the search and the filter, with the way out of each.
export function EmptyHistory({ filtered, onClear }: { filtered: boolean; onClear: () => void }) {
  if (filtered) {
    return (
      <Empty
        icon={<SearchX aria-hidden className="size-7" />}
        title="No share matches"
        text="Try another title or source, or show every share."
      >
        <button
          type="button"
          onClick={onClear}
          className="flex h-10 items-center gap-2 rounded-md border border-border bg-bg px-4 text-sm font-medium hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent"
        >
          <X aria-hidden className="size-4" />
          Clear the search and filter
        </button>
      </Empty>
    );
  }

  return (
    <Empty
      icon={<ScanSearch aria-hidden className="size-7" />}
      title="No shares yet"
      text="Spotarr finds the films and shows a reel is about, and adds them to your library."
    >
      <ol className="grid w-full max-w-2xl grid-cols-1 gap-3 text-left sm:grid-cols-3">
        <Step
          icon={<Share aria-hidden className="size-4" />}
          number={1}
          text="Share a reel from Instagram, or paste a link"
        />
        <Step
          icon={<ScanSearch aria-hidden className="size-4" />}
          number={2}
          text="Spotarr watches it and finds the titles"
        />
        <Step
          icon={<SquarePlus aria-hidden className="size-4" />}
          number={3}
          text="Add the right one in a click, or automatically"
        />
      </ol>
      <Link
        to="."
        search={(previous) => ({ ...previous, share: true })}
        className="flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-accent-text focus-visible:outline-2 focus-visible:outline-accent"
      >
        <Plus aria-hidden className="size-4" />
        Share a link
      </Link>
    </Empty>
  );
}

function Empty({
  icon,
  title,
  text,
  children,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-6 rounded-xl bg-surface px-6 py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-accent/15 text-accent">
        {icon}
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-xl font-semibold">{title}</p>
        <p className="max-w-md text-text-muted">{text}</p>
      </div>
      {children}
    </div>
  );
}

function Step({ icon, number, text }: { icon: ReactNode; number: number; text: string }) {
  return (
    <li className="flex items-start gap-3 rounded-lg border border-border bg-bg p-4">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
        {icon}
      </span>
      <span className="text-sm">
        <span className="font-semibold text-text-muted">{number}. </span>
        {text}
      </span>
    </li>
  );
}
