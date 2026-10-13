import { useMutation } from "@connectrpc/connect-query";
import { type Share, SpotarrService, Summary } from "@spotarr/contract";
import { useQueryClient } from "@tanstack/react-query";
import { RotateCw } from "lucide-react";
import { type SubmitEvent, useState } from "react";
import { EFFORTS } from "../../lib/effort";

// Retry the identification, with a hint for the LLM and another effort if
// chosen. Both are for this retry only: empty, the next one goes without.
export function RetryForm({ share }: { share: Share }) {
  const queryClient = useQueryClient();
  const [hint, setHint] = useState("");
  // Empty: the effort of the settings.
  const [effort, setEffort] = useState("");
  const retry = useMutation(SpotarrService.method.retryIdentification, {
    onSuccess: () => {
      setHint("");
      queryClient.invalidateQueries();
    },
  });

  function submit(event: SubmitEvent) {
    event.preventDefault();
    retry.mutate({ id: share.id, hint: hint.trim() || undefined, effort: effort || undefined });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 md:flex-row">
        <input
          aria-label="Hint for the LLM"
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          maxLength={500}
          placeholder="Hint for the LLM, optional"
          className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm placeholder:text-text-muted md:flex-1"
        />
        <div className="flex">
          <select
            aria-label="Effort of the retry"
            value={effort}
            onChange={(e) => setEffort(e.target.value)}
            className="h-10 rounded-l-md border border-border bg-bg px-3 text-sm"
          >
            <option value="">Default effort</option>
            {EFFORTS.map((e) => (
              <option key={e} value={e}>
                {`${e[0]?.toUpperCase()}${e.slice(1)} effort`}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={retry.isPending || share.summary === Summary.IN_PROGRESS}
            className="flex h-10 items-center gap-2 rounded-r-md border border-l-0 border-border px-4 whitespace-nowrap hover:bg-surface"
          >
            <RotateCw aria-hidden className="size-4" />
            Retry identification
          </button>
        </div>
      </div>
      {retry.error && <p className="text-sm text-status-error">{retry.error.message}</p>}
    </form>
  );
}
