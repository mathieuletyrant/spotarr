import { timestampDate } from "@bufbuild/protobuf/wkt";
import { useMutation } from "@connectrpc/connect-query";
import { type Share, SpotarrService, Summary } from "@spotarr/contract";
import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink, RotateCw } from "lucide-react";
import { useState } from "react";
import { EFFORTS } from "../../lib/effort";
import { shareDate } from "../../lib/format";
import { DeleteShareButton } from "./delete-share-button";

// Title, shared URL, and the actions: retry (with another effort if chosen),
// open the source, delete.
export function ShareHeader({ share }: { share: Share }) {
  const queryClient = useQueryClient();
  // Empty: the effort of the settings.
  const [effort, setEffort] = useState("");
  const retry = useMutation(SpotarrService.method.retryIdentification, {
    onSuccess: () => queryClient.invalidateQueries(),
  });
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
          <div className="flex">
            <select
              aria-label="Effort of the retry"
              value={effort}
              onChange={(e) => setEffort(e.target.value)}
              className="h-10 rounded-l-md border border-border bg-bg px-3 text-sm"
            >
              <option value="">Default effort</option>
              {EFFORTS.map((e) => (
                <option key={e.value} value={e.value}>
                  {e.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => retry.mutate({ id: share.id, effort: effort || undefined })}
              disabled={retry.isPending || share.summary === Summary.IN_PROGRESS}
              className="flex h-10 items-center gap-2 rounded-r-md border border-l-0 border-border px-4 whitespace-nowrap hover:bg-surface"
            >
              <RotateCw aria-hidden className="size-4" />
              Retry identification
            </button>
          </div>
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
      {retry.error && <p className="text-sm text-status-error">{retry.error.message}</p>}
    </div>
  );
}
