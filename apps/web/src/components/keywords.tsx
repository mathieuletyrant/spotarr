import { Link } from "@tanstack/react-router";
import { Tag } from "lucide-react";

// TMDB's keywords of a title, as Seerr shows them: one tag each, which opens
// the History filtered by it.
export function Keywords({ keywords }: { keywords: string[] }) {
  if (keywords.length === 0) return null;
  return (
    <ul aria-label="Keywords" className="flex flex-wrap gap-2">
      {keywords.map((keyword) => (
        <li key={keyword}>
          <Link
            to="/"
            search={{ keyword }}
            className="flex h-7 items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 text-xs hover:bg-text/8 focus-visible:outline-2 focus-visible:outline-accent"
          >
            <Tag aria-hidden className="size-3.5" />
            {keyword}
            <span className="sr-only"> (show the shares with this keyword)</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
