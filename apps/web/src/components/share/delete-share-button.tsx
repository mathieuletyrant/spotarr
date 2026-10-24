import { useMutation } from "@connectrpc/connect-query";
import { IdentificationStatus, type Share, SpotarrService } from "@spotarr/contract";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useRef } from "react";
import { useToast } from "../toast";
import { HEADER_ACTION, HEADER_ACTION_LABEL } from "./header-action";

// Deletes the Share after a confirmation, then goes back to the History and says
// so in a toast. A
// native <dialog>: Escape closes it, and focus stays inside.
export function DeleteShareButton({ share }: { share: Share }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const remove = useMutation(SpotarrService.method.deleteShare, {
    onSuccess: async () => {
      dialog.current?.close();
      await navigate({ to: "/" });
      toast("Share deleted");
      // After leaving the page: its own query would ask for a Share that is gone.
      await queryClient.invalidateQueries();
    },
  });
  // Spotarr refuses while the Identification runs.
  const processing = share.identification?.status === IdentificationStatus.PROCESSING;

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        disabled={processing}
        className={`${HEADER_ACTION} text-status-error`}
      >
        <Trash2 aria-hidden className="size-4" />
        <span className={HEADER_ACTION_LABEL}>Delete</span>
      </button>

      <dialog
        ref={dialog}
        aria-labelledby="delete-share-title"
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-border bg-surface-raised text-text shadow-xl backdrop:bg-bg/70 backdrop:backdrop-blur-sm"
      >
        <div className="flex flex-col gap-4 p-6">
          <h2 id="delete-share-title" className="text-lg font-semibold">
            Delete this Share?
          </h2>
          <p className="text-sm text-text-muted">
            Its candidates, frames and additions leave Spotarr's history and stats. What was already
            requested in Seerr stays there.
          </p>
          {remove.error && <p className="text-sm text-status-error">{remove.error.rawMessage}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              className="h-10 rounded-md px-4 text-sm font-medium text-text-muted hover:bg-text/8 hover:text-text"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => remove.mutate({ id: share.id })}
              disabled={remove.isPending}
              className="flex h-10 items-center gap-2 rounded-md border border-status-error px-4 text-sm font-medium text-status-error hover:bg-status-error/10"
            >
              <Trash2 aria-hidden className="size-4" />
              {remove.isPending ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
