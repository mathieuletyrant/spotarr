import { Link } from "@tanstack/react-router";
import { Clapperboard, SearchX } from "lucide-react";

// What the History shows instead of the table: either no Share at all yet, or
// none matching the search and the filter, with the way out of each.
export function EmptyHistory({ filtered, onClear }: { filtered: boolean; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-surface text-text-muted">
        {filtered ? (
          <SearchX aria-hidden className="size-6" />
        ) : (
          <Clapperboard aria-hidden className="size-6" />
        )}
      </div>
      {filtered ? (
        <>
          <p className="text-lg font-medium">No share matches</p>
          <p className="max-w-sm text-sm text-text-muted">
            Try another title or source, or show every share.
          </p>
          <button
            type="button"
            onClick={onClear}
            className="mt-2 h-9 rounded-md border border-border px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-accent"
          >
            Clear the search and filter
          </button>
        </>
      ) : (
        <>
          <p className="text-lg font-medium">No shares yet</p>
          <p className="max-w-sm text-sm text-text-muted">
            Share a reel from your iPhone, or paste a link here: Spotarr finds the films and shows
            it is about.
          </p>
          <Link
            to="/share"
            className="mt-2 flex h-9 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-text focus-visible:outline-2 focus-visible:outline-accent"
          >
            Share a link
          </Link>
        </>
      )}
    </div>
  );
}
