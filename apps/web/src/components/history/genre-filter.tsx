import type { GenreCount } from "@spotarr/contract";
import { Check, X } from "lucide-react";

type Props = {
  // The history's genres, most Shares first, each with how many Shares have it.
  genres: GenreCount[];
  selected: string[];
  onChange: (selected: string[]) => void;
};

// The history's genres as pills. Several can be chosen: the History then shows
// the Shares of any of them. One line that scrolls sideways, faded at its right
// edge, so it stays one line on a phone too; the chosen ones come first, so
// they never hide off screen.
export function GenreFilter({ genres, selected, onChange }: Props) {
  if (genres.length === 0) return null;

  function toggle(genre: string) {
    if (selected.includes(genre)) onChange(selected.filter((g) => g !== genre));
    else onChange([...selected, genre]);
  }

  const chosenFirst = [
    ...genres.filter((g) => selected.includes(g.genre)),
    ...genres.filter((g) => !selected.includes(g.genre)),
  ];

  return (
    <div className="flex items-center gap-3">
      <span aria-hidden className="hidden shrink-0 text-sm font-medium text-text-muted sm:inline">
        Genres
      </span>
      {/* min-w-0: a fieldset is otherwise as wide as all its pills, and would not scroll. */}
      <fieldset className="flex min-w-0 flex-1 gap-2 overflow-x-auto py-0.5 pr-10 mask-r-from-90% [scrollbar-width:none]">
        <legend className="sr-only">Filter by genre</legend>
        {chosenFirst.map(({ genre, count }) => {
          const chosen = selected.includes(genre);
          return (
            <button
              key={genre}
              type="button"
              aria-pressed={chosen}
              onClick={() => toggle(genre)}
              className="flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-border px-3 text-sm whitespace-nowrap text-text-muted transition-colors hover:border-text/30 hover:text-text aria-pressed:border-accent aria-pressed:bg-accent/15 aria-pressed:text-text"
            >
              {chosen && <Check aria-hidden className="size-3.5 text-accent" />}
              {genre}
              <span className="text-xs tabular-nums opacity-60">{count}</span>
            </button>
          );
        })}
      </fieldset>
      {selected.length > 0 && (
        <button
          type="button"
          onClick={() => onChange([])}
          className="flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-sm text-text-muted hover:bg-text/8 hover:text-text"
        >
          <X aria-hidden className="size-3.5" />
          Clear
        </button>
      )}
    </div>
  );
}
