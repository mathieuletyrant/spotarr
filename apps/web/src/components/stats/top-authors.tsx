import type { AuthorStats } from "@spotarr/contract";
import { Users } from "lucide-react";
import { Card } from "../share/card";

// The accounts whose videos are shared the most, ranked.
export function TopAuthors({ authors }: { authors: AuthorStats[] }) {
  return (
    <Card icon={<Users aria-hidden className="size-4" />} title="Top authors">
      {authors.length === 0 ? (
        <p className="text-sm text-text-muted">No author yet: they come with shared videos.</p>
      ) : (
        <ol className="-mx-5 -mb-5 divide-y divide-divider border-t border-divider">
          {authors.map((author, index) => (
            <li
              key={`${author.author}-${author.source}`}
              className="flex items-center gap-3 px-5 py-2.5"
            >
              <span className="w-4 text-sm tabular-nums text-text-muted">{index + 1}</span>
              <span
                aria-hidden
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent/15 font-semibold text-accent"
              >
                {author.author.charAt(0).toUpperCase()}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">{author.author}</span>
                <span className="truncate font-mono text-xs text-text-muted">{author.source}</span>
              </span>
              <span className="flex flex-col items-end">
                <span className="text-sm font-semibold tabular-nums">
                  {author.shares} {author.shares === 1 ? "share" : "shares"}
                </span>
                <span className="text-xs text-text-muted">{author.identified} identified</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
