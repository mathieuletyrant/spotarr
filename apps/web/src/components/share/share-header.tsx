import { timestampDate } from "@bufbuild/protobuf/wkt";
import type { Share } from "@spotarr/contract";
import { ExternalLink } from "lucide-react";
import { shareDate } from "../../lib/format";
import { DeleteShareButton } from "./delete-share-button";
import { RetryButton } from "./retry-button";

// Title, shared URL, and the actions: retry, open the source, delete.
export function ShareHeader({ share }: { share: Share }) {
  const { day, time } = shareDate(share.createdAt ? timestampDate(share.createdAt) : new Date());

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold">
            Share of{" "}
            {day.toLowerCase() === "today" || day === "Yesterday" ? day.toLowerCase() : day} at{" "}
            {time}
          </h1>
          {share.input?.url && (
            <p className="mt-1 truncate font-mono text-sm text-text-muted">{share.input.url}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 md:shrink-0">
          <RetryButton share={share} />
          {share.input?.url && (
            <a
              href={share.input.url}
              target="_blank"
              rel="noreferrer"
              className="flex h-10 items-center gap-2 rounded-md border border-border px-4 whitespace-nowrap hover:bg-surface"
            >
              <ExternalLink aria-hidden className="size-4" />
              Open the source
            </a>
          )}
          <DeleteShareButton share={share} />
        </div>
      </div>
    </div>
  );
}
