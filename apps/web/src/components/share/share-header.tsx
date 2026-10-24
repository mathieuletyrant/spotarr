import { timestampDate } from "@bufbuild/protobuf/wkt";
import type { Share } from "@spotarr/contract";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { shareDate } from "../../lib/format";
import { DeleteShareButton } from "./delete-share-button";
import { HEADER_ACTION, HEADER_ACTION_LABEL } from "./header-action";
import { RetryButton } from "./retry-button";

// Back to the History and the actions (retry, open the source, delete) on one
// line, then who posted what was shared, where and when.
export function ShareHeader({ share }: { share: Share }) {
  const { day, time } = shareDate(share.createdAt ? timestampDate(share.createdAt) : new Date());
  const author = share.identification?.clues?.author;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {/* An app on the Home Screen has no Safari back button. */}
        <Link
          to="/"
          className="-ml-2 flex h-11 items-center gap-1.5 rounded-md px-2 text-sm text-text-muted hover:text-text"
        >
          <ArrowLeft aria-hidden className="size-4" />
          History
        </Link>
        <div className="ml-auto flex gap-2">
          <RetryButton share={share} />
          {share.input?.url && (
            <a href={share.input.url} target="_blank" rel="noreferrer" className={HEADER_ACTION}>
              <ExternalLink aria-hidden className="size-4" />
              <span className={HEADER_ACTION_LABEL}>Open the source</span>
            </a>
          )}
          <DeleteShareButton share={share} />
        </div>
      </div>
      <div className="min-w-0">
        <h1 className="line-clamp-2 text-2xl font-semibold sm:text-3xl">
          {author ?? `Share of ${day === "Today" || day === "Yesterday" ? day.toLowerCase() : day}`}
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          {share.source} · {day} {time}
        </p>
        {share.input?.url && (
          <p className="mt-1 hidden truncate font-mono text-sm text-text-muted sm:block">
            {share.input.url}
          </p>
        )}
      </div>
    </div>
  );
}
