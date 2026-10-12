import { type AddedTitle, MediaType } from "@spotarr/contract";
import { Link } from "@tanstack/react-router";
import { Sparkles, Zap } from "lucide-react";
import { Card } from "../share/card";

// The last titles added, as posters; each opens the Share it came from.
export function RecentlyAdded({ titles }: { titles: AddedTitle[] }) {
  return (
    <Card icon={<Sparkles aria-hidden className="size-4" />} title="Recently added">
      {titles.length === 0 ? (
        <p className="text-sm text-text-muted">
          Nothing added yet: pick a candidate in the History.
        </p>
      ) : (
        <ul className="-mx-5 flex gap-4 overflow-x-auto px-5 pb-2">
          {titles.map((title) => (
            <li key={`${title.shareId}-${title.title}`} className="w-28 shrink-0 sm:w-32">
              <Link
                to="/shares/$shareId"
                params={{ shareId: title.shareId }}
                className="group flex flex-col gap-2 rounded-md"
              >
                <span className="relative block aspect-[2/3] overflow-hidden rounded-lg border border-border bg-surface">
                  {title.posterUrl ? (
                    <img
                      src={title.posterUrl.replace("/w500/", "/w342/")}
                      alt=""
                      loading="lazy"
                      className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <span className="flex size-full items-center justify-center text-3xl font-semibold text-text-muted">
                      {title.title.charAt(0)}
                    </span>
                  )}
                  {title.automatic && (
                    <span
                      title="Added by auto add"
                      className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-accent text-accent-text"
                    >
                      <Zap aria-label="Auto add" className="size-3.5" />
                    </span>
                  )}
                </span>
                <span className="flex flex-col">
                  <span className="truncate text-sm font-medium group-hover:underline">
                    {title.title}
                  </span>
                  <span className="text-xs text-text-muted">
                    {title.type === MediaType.TV ? "Show" : "Movie"}
                    {title.year ? ` · ${title.year}` : ""}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
