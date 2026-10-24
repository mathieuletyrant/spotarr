import { useMutation } from "@connectrpc/connect-query";
import { type Share, SpotarrService, Summary } from "@spotarr/contract";
import { useQueryClient } from "@tanstack/react-query";
import { RotateCw } from "lucide-react";
import { type SubmitEvent, useRef, useState } from "react";
import { EFFORTS } from "../../lib/effort";
import { inputClass } from "../settings/fields";
import { HEADER_ACTION, HEADER_ACTION_LABEL } from "./header-action";

// "Retry identification" opens a dialog: choose the effort, add a hint for the
// LLM if you want, then retry. Both are for this retry only. A native <dialog>:
// Escape closes it, and focus stays inside.
export function RetryButton({ share }: { share: Share }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const queryClient = useQueryClient();
  // Empty: the effort of the settings.
  const [effort, setEffort] = useState("");
  const [hint, setHint] = useState("");
  const retry = useMutation(SpotarrService.method.retryIdentification, {
    onSuccess: () => {
      dialog.current?.close();
      setEffort("");
      setHint("");
      queryClient.invalidateQueries();
    },
  });

  function submit(event: SubmitEvent) {
    event.preventDefault();
    retry.mutate({ id: share.id, effort: effort || undefined, hint: hint.trim() || undefined });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        disabled={share.summary === Summary.IN_PROGRESS}
        className={`${HEADER_ACTION}`}
      >
        <RotateCw aria-hidden className="size-4" />
        <span className={HEADER_ACTION_LABEL}>Retry identification</span>
      </button>

      <dialog
        ref={dialog}
        aria-labelledby="retry-title"
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-border bg-surface-raised text-text shadow-xl backdrop:bg-bg/70 backdrop:backdrop-blur-sm"
      >
        <form onSubmit={submit} className="flex flex-col gap-4 p-6">
          <h2 id="retry-title" className="text-lg font-semibold">
            Retry the identification
          </h2>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Effort</span>
            <select
              value={effort}
              onChange={(e) => setEffort(e.target.value)}
              className={inputClass}
            >
              <option value="">Default (Settings)</option>
              {EFFORTS.map((e) => (
                <option key={e.value} value={e.value}>
                  {e.label}
                </option>
              ))}
            </select>
            <span className="text-sm text-text-muted">
              Higher thinks longer: slower and dearer, and may find what a quick look missed.
            </span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Hint for the LLM (optional)</span>
            <textarea
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="The Korean show, not the movie"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm placeholder:text-text-muted"
            />
            <span className="text-sm text-text-muted">
              What the identification got wrong, in one sentence.
            </span>
          </label>
          {retry.error && <p className="text-sm text-status-error">{retry.error.rawMessage}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              className="h-10 rounded-md px-4 text-sm font-medium text-text-muted hover:bg-text/8 hover:text-text"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={retry.isPending}
              className="flex h-10 items-center gap-2 rounded-md bg-accent px-5 text-sm font-medium text-accent-text"
            >
              <RotateCw aria-hidden className="size-4" />
              {retry.isPending ? "Retrying…" : "Retry"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
