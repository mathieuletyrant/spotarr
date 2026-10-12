import { timestampDate } from "@bufbuild/protobuf/wkt";
import { useMutation } from "@connectrpc/connect-query";
import { type Share, SpotarrService, Summary } from "@spotarr/contract";
import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink, RotateCw } from "lucide-react";
import { shareDate } from "../../lib/format";

// Title, shared URL, and the two actions: retry, open the source.
export function ShareHeader({ share }: { share: Share }) {
  const queryClient = useQueryClient();
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
          <button
            type="button"
            onClick={() => retry.mutate({ id: share.id })}
            disabled={retry.isPending || share.summary === Summary.IN_PROGRESS}
            className="flex h-10 items-center gap-2 rounded-md border border-border px-4 whitespace-nowrap hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
          >
            <RotateCw aria-hidden className="size-4" />
            Retry identification
          </button>
          {share.input?.url && (
            <a
              href={share.input.url}
              target="_blank"
              rel="noreferrer"
              className="flex h-10 items-center gap-2 rounded-md border border-border px-4 whitespace-nowrap hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent"
            >
              <ExternalLink aria-hidden className="size-4" />
              Open the source
            </a>
          )}
        </div>
      </div>
      {retry.error && <p className="text-sm text-status-error">{retry.error.message}</p>}
    </div>
  );
}
